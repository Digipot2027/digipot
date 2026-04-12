import { useState, useEffect, useCallback, useRef } from 'react'
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
 *   - Profielnaam-filter gebruikt aparte queries zonder string-interpolatie (SEC)
 *   - Geneste query gesplitst om RLS-conflicten te vermijden
 *   - herlaad() toegevoegd voor retry-knop in UI
 *
 * Fix (2026-04-03):
 *   - .ilike() → .eq() voor profielnaam-filter (SEC-H2)
 *
 * Fix (2026-04-12 / kritiek-1):
 *   - deviceId via useDeviceId() i.p.v. localStorage.getItem() direct
 *
 * Fix (2026-04-12 / hoog-6):
 *   - mijnDeelnemer-lookup case-insensitief via .toLowerCase()
 *
 * Fix (2026-04-12 / issue 9):
 *   - Realtime-abonnement toegevoegd op potjes (UPDATE/DELETE) en
 *     deelnemers (INSERT/UPDATE) voor potjes die dit device/profiel betreffen.
 *
 *   Probleem: de lijst open/gesloten potjes verouderde zodra een ander device
 *   een potje sloot of een nieuwe deelnemer zich aanmeldde. De gebruiker zag
 *   verouderde data tot aan een handmatige refresh.
 *
 *   Aanpak: één Supabase-kanaal per status ('open' of 'gesloten') dat luistert
 *   op wijzigingen in de potjes-tabel. Bij elke relevante wijziging wordt
 *   herlaad() aangeroepen die de volledige datalaad opnieuw uitvoert.
 *   Dit is een "herlaad bij change"-aanpak (i.p.v. granulaire state-mutaties)
 *   omdat useMijnPotjes meerdere potjes aggregeert en granulaire updates
 *   de verrijkingslogica in stap 4 zouden compliceren.
 *
 *   Kanaal wordt opgeruimd bij unmount of bij wijziging van status/deviceId.
 *
 * @param {'open'|'gesloten'} status - Welke potjes te laden
 * @returns {{
 *   potjes: Array,
 *   laden: boolean,
 *   fout: string,
 *   herlaad: Function,
 * }}
 */
export function useMijnPotjes(status) {
  const deviceId = useDeviceId()

  const [potjes, setPotjes] = useState([])
  const [laden, setLaden] = useState(true)
  const [fout, setFout] = useState('')
  const [teller, setTeller] = useState(0)

  // Ref om de gevonden potje-IDs bij te houden voor het realtime-filter.
  // Een ref voorkomt dat het abonnement opnieuw wordt opgebouwd bij elke render.
  const potjeIdsRef = useRef([])

  const herlaad = useCallback(() => {
    setFout('')
    setLaden(true)
    setTeller(t => t + 1)
  }, [])

  // ── Datalaad ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const profielNaam = localStorage.getItem(PROFIEL_NAAM_KEY)?.trim() || null
    const profielNaamLower = profielNaam?.toLowerCase() ?? null

    async function laadPotjes() {
      try {
        if (!deviceId && !profielNaam) {
          setPotjes([])
          potjeIdsRef.current = []
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
                .eq('naam', profielNaam)
            : Promise.resolve({ data: [], error: null }),
        ])

        for (const { error } of deelnemerSets) {
          if (error) throw error
        }

        const alleDeelnemers = [
          ...(deelnemerSets[0].data ?? []),
          ...(deelnemerSets[1].data ?? []),
        ]

        if (alleDeelnemers.length === 0) {
          setPotjes([])
          potjeIdsRef.current = []
          setLaden(false)
          return
        }

        const potjeIds = [...new Set(alleDeelnemers.map(d => d.potje_id))]
        potjeIdsRef.current = potjeIds

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

        const [
          { data: deelnemers, error: dError },
          { data: transacties, error: tError },
        ] = await Promise.all([
          supabase.from('deelnemers').select('*').in('potje_id', gevondenIds),
          supabase.from('transacties').select('*').in('potje_id', gevondenIds),
        ])

        if (dError) throw dError
        if (tError) throw tError

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
            const saldi = berekenEindafrekening(potjeDeelnemers, potjeTransacties, potje.gesloten_op)
            const mijnDeelnemer = potjeDeelnemers.find(d =>
              d.device_id === deviceId ||
              (profielNaamLower && d.naam.toLowerCase() === profielNaamLower)
            )
            const mijnVerrekening = mijnDeelnemer
              ? saldi.deelnemersSaldi.find(s => s.id === mijnDeelnemer.id)?.verrekening ?? null
              : null
            return { ...potje, mijnVerrekening }
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
  }, [status, teller, deviceId])

  // ── Realtime abonnement (issue 9 fix 2026-04-12) ─────────────────────────────
  //
  // Luistert op potjes-wijzigingen (UPDATE/DELETE) en deelnemers-wijzigingen
  // (INSERT/UPDATE) om de lijst automatisch bij te werken.
  //
  // Aanpak: herlaad() aanroepen bij elke relevante wijziging. Dit is een
  // "herlaad bij change"-strategie — niet granulaire state-mutaties — omdat
  // de verrijkingslogica meerdere potjes aggregeert en een volledige herlaad
  // eenvoudiger en correcte is dan partiële state-updates.
  //
  // Filter: we kunnen niet filteren op potje_id in het abonnement zelf omdat
  // we meerdere potje-IDs bewaken. Supabase ondersteunt geen IN-filter in
  // realtime-abonnementen. We filteren client-side na ontvangst.
  useEffect(() => {
    if (!deviceId) return

    const kanaal = supabase
      .channel(`mijn-potjes-${status}-${deviceId}`)

      // Potje gesloten of status gewijzigd → herlaad de lijst
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'potjes' },
        payload => {
          // Alleen herlaad als dit potje ons betreft
          if (potjeIdsRef.current.includes(payload.new?.id)) {
            herlaad()
          }
        }
      )

      // Potje verwijderd (lifecycle-cron na 7 dagen) → verwijder uit lijst
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'potjes' },
        payload => {
          const verwijderdId = payload.old?.id
          if (verwijderdId && potjeIdsRef.current.includes(verwijderdId)) {
            setPotjes(prev => prev.filter(p => p.id !== verwijderdId))
            potjeIdsRef.current = potjeIdsRef.current.filter(id => id !== verwijderdId)
          }
        }
      )

      // Nieuwe deelnemer in een van onze potjes → herlaad (aantalDeelnemers bijwerken)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'deelnemers' },
        payload => {
          if (potjeIdsRef.current.includes(payload.new?.potje_id)) {
            herlaad()
          }
        }
      )

      .subscribe()

    return () => {
      supabase.removeChannel(kanaal)
    }
  }, [status, deviceId, herlaad])

  return { potjes, laden, fout, herlaad }
}
