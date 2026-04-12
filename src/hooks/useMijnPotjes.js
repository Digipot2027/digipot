import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { logFout } from '../utils/logFout'
import { berekenSaldi, berekenEindafrekening } from '../utils/berekenSaldi'
import { useDeviceId } from './useDeviceId'
import { PROFIEL_NAAM_KEY } from '../constants'

/**
 * useMijnPotjes — laadt alle open of gesloten potjes voor dit device/profiel.
 *
 * Oplossing N+1 query probleem:
 *   Oud: 1 (deelnemers) + 1 (potjes) + N×2 (deelnemers+transacties per potje)
 *        = 2 + 2N calls voor N potjes
 *   Nieuw: 3 queries totaal ongeacht het aantal potjes.
 *
 * Fix (2026-03-31):
 *   - Profielnaam-filter gebruikt nu aparte queries zonder string-interpolatie
 *     om Supabase query-injectie te voorkomen (security fix)
 *   - Geneste query gesplitst: eerst potjes ophalen, dan deelnemers+transacties apart
 *     om RLS-conflicten bij geneste selects te vermijden (bugfix foutmelding)
 *   - herlaad() functie toegevoegd zodat de UI een retry-knop kan aanbieden (UX fix)
 *
 * Fix (2026-04-03):
 *   - Profielnaam-filter gewijzigd van .ilike() naar .eq() (SEC-H2).
 *     ilike accepteert SQL-wildcards (% en _): een profielnaam '%' zou alle
 *     deelnemers matchen en daarmee potjes van vreemden tonen (informatielekage).
 *     eq is een exacte case-sensitieve vergelijking zonder wildcardrisico.
 *
 * Fix (2026-04-12):
 *   - deviceId wordt nu opgehaald via useDeviceId() in plaats van
 *     localStorage.getItem() direct (zelfde root cause als JAVASCRIPT-REACT-6).
 *     Bij lege of ongeldige localStorage retourneerde getItem() null, waardoor
 *     de hook de deelnemersqueries oversloeg en een stille lege lijst toonde.
 *     useDeviceId() garandeert altijd een geldige UUID v4.
 *   - DEVICE_ID_KEY import verwijderd — niet langer nodig.
 *
 * Fix (2026-04-12 / hoog-6):
 *   - Profielnaam-matching bij het zoeken van de eigen deelnemer (mijnDeelnemer)
 *     was case-sensitief: "Jan" vond geen deelnemer "jan".
 *     valideerDeelnemerNaam() matcht case-insensitief — beide moeten consistent zijn.
 *     Fix: .toLowerCase() op beide zijden bij de mijnDeelnemer-lookup.
 *     De DB-query (.eq('naam', profielNaam)) blijft case-sensitief voor SEC-H2 —
 *     alleen de client-side verrijkingsstap is aangepast.
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
  // Fix 2026-04-12: useDeviceId() i.p.v. localStorage.getItem() direct.
  // useDeviceId is een hook en moet op het niveau van de functie worden aangeroepen —
  // niet binnen useEffect. De waarde is stabiel voor de gehele levensduur (useMemo
  // met lege deps in useDeviceId), dus het is veilig als useEffect-dependency.
  const deviceId = useDeviceId()

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
    // profielNaam blijft via localStorage — dit is geen device-identiteit maar
    // een optionele profielnaam die de gebruiker zelf instelt. Er is geen hook
    // voor nodig; localStorage.getItem() hier is correct en intentioneel.
    const profielNaam = localStorage.getItem(PROFIEL_NAAM_KEY)?.trim() || null
    // Hoog-6 fix: lowercase voor case-insensitieve vergelijking in de verrijkingsstap.
    // De DB-query (.eq) blijft exact — alleen de client-side lookup wordt versoepeld.
    const profielNaamLower = profielNaam?.toLowerCase() ?? null

    async function laadPotjes() {
      try {
        // ── Stap 1: zoek potje-IDs voor dit device / deze profielnaam ──────────
        // Twee aparte queries gecombineerd client-side om RLS-problemen met .or()
        // op meerdere kolommen te vermijden.
        //
        // SEC-H2: .eq() i.p.v. .ilike() — ilike accepteert SQL-wildcards (% en _)
        // waardoor een profielnaam zoals '%' alle deelnemers zou matchen.
        // .eq() is een exacte vergelijking zonder wildcardrisico.
        if (!deviceId && !profielNaam) {
          setPotjes([])
          setLaden(false)
          return
        }

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
                .eq('naam', profielNaam)          // was: .ilike('naam', profielNaam)
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

            // Hoog-6 fix (2026-04-12): case-insensitieve vergelijking voor naam.
            // valideerDeelnemerNaam() matcht ook case-insensitief — beide moeten
            // consistent zijn. Scenario: profielnaam "Jan", deelnemernaam "jan" →
            // zonder toLowerCase() werd mijnDeelnemer niet gevonden en bleef
            // mijnVerrekening null, ook al is "jan" dezelfde persoon.
            const mijnDeelnemer = potjeDeelnemers.find(d =>
              d.device_id === deviceId ||
              (profielNaamLower && d.naam.toLowerCase() === profielNaamLower)
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
  }, [status, teller, deviceId]) // deviceId toegevoegd als dependency (stabiel via useMemo)

  return { potjes, laden, fout, herlaad }
}
