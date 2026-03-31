import { useState, useEffect } from 'react'
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
 * @param {'open'|'gesloten'} status - Welke potjes te laden
 * @returns {{
 *   potjes: Array,   — verrijkte potjes (met saldo, aantalDeelnemers of mijnVerrekening)
 *   laden: boolean,
 *   fout: string,
 * }}
 */
export function useMijnPotjes(status) {
  const [potjes, setPotjes] = useState([])
  const [laden, setLaden] = useState(true)
  const [fout, setFout] = useState('')

  useEffect(() => {
    const deviceId = localStorage.getItem(DEVICE_ID_KEY)
    const profielNaam = localStorage.getItem(PROFIEL_NAAM_KEY)?.trim() || null

    async function laadPotjes() {
      try {
        // ── Stap 1: zoek potje-IDs voor dit device / deze profielnaam ──────────
        const filters = []
        if (deviceId) filters.push(`device_id.eq.${deviceId}`)
        if (profielNaam) filters.push(`naam.ilike.${profielNaam}`)

        if (filters.length === 0) {
          setPotjes([])
          setLaden(false)
          return
        }

        const { data: deelnemers, error: deError } = await supabase
          .from('deelnemers')
          .select('potje_id, naam, id, device_id')
          .or(filters.join(','))

        if (deError) throw deError
        if (!deelnemers || deelnemers.length === 0) {
          setPotjes([])
          setLaden(false)
          return
        }

        const potjeIds = [...new Set(deelnemers.map(d => d.potje_id))]

        // ── Stap 2: haal potjes op met geneste deelnemers + transacties ────────
        // .select('*, deelnemers(*), transacties(*)') = 1 query i.p.v. N×2
        const orderKolom = status === 'open' ? 'aangemaakt_op' : 'gesloten_op'
        const { data: gevondenPotjes, error: pError } = await supabase
          .from('potjes')
          .select('*, deelnemers(*), transacties(*)')
          .in('id', potjeIds)
          .eq('status', status)
          .order(orderKolom, { ascending: false })

        if (pError) throw pError

        // ── Stap 3: verrijk elk potje met berekende waarden (puur, geen DB) ───
        const verrijkt = (gevondenPotjes || []).map(potje => {
          const allDeelnemers = potje.deelnemers ?? []
          const allTransacties = potje.transacties ?? []

          if (status === 'open') {
            const saldi = berekenSaldi(allDeelnemers, allTransacties)
            return {
              ...potje,
              aantalDeelnemers: allDeelnemers.length,
              potSaldo: saldi.potSaldo,
              // verwijder geneste arrays — consumers hoeven ze niet
              deelnemers: undefined,
              transacties: undefined,
            }
          } else {
            // gesloten: bereken verrekening voor dit device / deze naam
            const saldi = berekenEindafrekening(allDeelnemers, allTransacties)
            const mijnDeelnemer = allDeelnemers.find(d =>
              d.device_id === deviceId ||
              (profielNaam && d.naam.toLowerCase() === profielNaam.toLowerCase())
            )
            const mijnVerrekening = mijnDeelnemer
              ? saldi.deelnemersSaldi.find(s => s.id === mijnDeelnemer.id)?.verrekening ?? null
              : null
            return {
              ...potje,
              mijnVerrekening,
              deelnemers: undefined,
              transacties: undefined,
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
  }, [status])

  return { potjes, laden, fout }
}
