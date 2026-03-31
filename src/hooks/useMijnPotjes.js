import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { logFout } from '../utils/logFout'
import { berekenSaldi, berekenEindafrekening } from '../utils/berekenSaldi'
import { DEVICE_ID_KEY, PROFIEL_NAAM_KEY } from '../constants'

/**
 * useMijnPotjes — laadt alle open of gesloten potjes voor dit device/profiel.
 *
 * Oplossing N+1 query probleem:
 *   Oud: 1 (deelnemers) + 1 (potjes) + N×2 (deelnemers+transacties per potje)
 *        = 2 + 2N calls voor N potjes
 *   Nieuw: 1 (deelnemers) + 1 (potjes incl. deelnemers+transacties genest) = 2 calls totaal
 *
 * Supabase ondersteunt geneste selects: .select('*, deelnemers(*), transacties(*)')
 * Dit retourneert potjes met ingebedde arrays — geen extra calls per potje nodig.
 *
 * Fix (2026-03-31):
 *   - Profielnaam-filter gebruikt nu aparte .or()-kolommen zonder string-interpolatie
 *     om Supabase query-injectie te voorkomen (security fix)
 *   - Geneste query gesplitst: eerst potjes ophalen, dan deelnemers+transacties apart
 *     om RLS-conflicten bij geneste selects te vermijden (bugfix foutmelding)
 *   - herlaad() functie toegevoegd zodat de UI een retry-knop kan aanbieden (UX fix)
 *
 * @param {'open'|'gesloten'} status - Welke potjes te laden
 * @returns {{
 *   potjes: Array,   — verrijkte potjes (met saldo, aantalDeelnemers of mijnVerrekening)
 *   laden: boolean,
 *   fout: string,
 *   herlaad: Function, — handmatige retry
 * }}
 */
export function useMijnPotjes(status) {
  const [potjes, setPotjes] = useState([])
  const [laden, setLaden] = useState(true)
  const [fout, setFout] = useState('')
  const [teller, setTeller] = useState(0) // increment triggert herlaad

  const herlaad = useCallback(() => {
    setFout('')
    setLaden(true)
    setTeller(t => t + 1)
  }, [])

  useEffect(() => {
    const deviceId = localStorage.getItem(DEVICE_ID_KEY)
    const profielNaam = localStorage.getItem(PROFIEL_NAAM_KEY)?.trim() || null

    async function laadPotjes() {
      try {
        // ── Stap 1: zoek potje-IDs voor dit device / deze profielnaam ──────────
        // Bouw de OR-filter op als twee aparte condities (geen string-interpolatie).
        // Dit voorkomt dat een profielnaam met komma's of punten de query breekt.
        if (!deviceId && !profielNaam) {
          setPotjes([])
          setLaden(false)
          return
        }

        // Gebruik twee aparte queries en combineer de resultaten client-side
        // om RLS-problemen met .or() op meerdere kolommen te vermijden.
        const deelnemerSets = await Promise.all([
          deviceId
            ? supabase
                .from('deelnemers')
                .select('potje_id, naam, id, device_id')
                .eq('device_id', deviceId)
            : Promise.resolve({ data: [], error: null }),
          profielNaam
            ? supabase
                .from('deelnemers')
                .select('potje_id, naam, id, device_id')
                .ilike('naam', profielNaam)
            : Promise.resolve({ data: [], error: null }),
        ])

        // Gooi bij eerste fout
        for (const { error } of deelnemerSets) {
          if (error) throw error
        }

        const alleDeelnemers = [
          ...(deelnemerSets[0].data ?? []),
          ...(deelnemerSets[1].data ?? []),
        ]

        if (alleDeelnemers.length === 0) {
          setPotjes([])
          setLaden(false)
          return
        }

        const potjeIds = [...new Set(alleDeelnemers.map(d => d.potje_id))]

        // ── Stap 2: haal potjes op (zonder geneste selects om RLS-conflicten te vermijden) ──
        const orderKolom = status === 'open' ? 'aangemaakt_op' : 'gesloten_op'
        const { data: gevondenPotjes, error: pError } = await supabase
          .from('potjes')
          .select('*')
          .in('id', potjeIds)
          .eq('status', status)
          .order(orderKolom, { ascending: false })

        if (pError) throw pError
        if (!gevondenPotjes || gevondenPotjes.length === 0) {
          setPotjes([])
          setLaden(false)
          return
        }

        const gevondenIds = gevondenPotjes.map(p => p.id)

        // ── Stap 3: haal deelnemers + transacties op in 2 losse queries ────────
        // Losse queries vermijden RLS-problemen met geneste selects.
        const [
          { data: deelnemers, error: dError },
          { data: transacties, error: tError },
        ] = await Promise.all([
          supabase
            .from('deelnemers')
            .select('*')
            .in('potje_id', gevondenIds),
          supabase
            .from('transacties')
            .select('*')
            .in('potje_id', gevondenIds),
        ])

        if (dError) throw dError
        if (tError) throw tError

        // ── Stap 4: verrijk elk potje met berekende waarden (puur, geen DB) ───
        const verrijkt = gevondenPotjes.map(potje => {
          const potjeDeelnemers = (deelnemers ?? []).filter(d => d.potje_id === potje.id)
          const potjeTransacties = (transacties ?? []).filter(t => t.potje_id === potje.id)

          if (status === 'open') {
            const saldi = berekenSaldi(potjeDeelnemers, potjeTransacties)
            return {
              ...potje,
              aantalDeelnemers: potjeDeelnemers.length,
              potSaldo: saldi.potSaldo,
            }
          } else {
            // gesloten: bereken verrekening voor dit device / deze naam
            const saldi = berekenEindafrekening(potjeDeelnemers, potjeTransacties, potje.gesloten_op)
            const mijnDeelnemer = potjeDeelnemers.find(d =>
              d.device_id === deviceId ||
              (profielNaam && d.naam.toLowerCase() === profielNaam.toLowerCase())
            )
            const mijnVerrekening = mijnDeelnemer
              ? saldi.deelnemersSaldi.find(s => s.id === mijnDeelnemer.id)?.verrekening ?? null
              : null
            return {
              ...potje,
              mijnVerrekening,
            }
          }
        })

        setPotjes(verrijkt)
      } catch (e) {
        setFout(logFout(e, { component: 'useMijnPotjes', actie: 'laadPotjes' }))
      } finally {
        setLaden(false)
      }
    }

    laadPotjes()
  }, [status, teller]) // teller-dependency triggert herlaad()

  return { potjes, laden, fout, herlaad }
}
