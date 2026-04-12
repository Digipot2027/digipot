import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { logFout } from '../utils/logFout'
import { useDeviceId } from './useDeviceId'

/**
 * usePotje — laadt en synchroniseert alle data voor één potje.
 *
 * Realtime-abonnementen (vijf events):
 *   potjes     UPDATE  — potjestatus, gesloten_op, enz.
 *   potjes     DELETE  — potje verwijderd door lifecycle-cron
 *   deelnemers INSERT  — nieuwe deelnemer
 *   deelnemers UPDATE  — bijv. actief → false bij afmelden
 *   transacties INSERT — nieuwe storting of betaling
 *   transacties DELETE — undo van eigen transactie (SEC-L2)
 *
 * Issue 8 fix (2026-04-12): potjes-abonnement was `event: '*'`, waardoor
 * DELETE-events ook binnenkwamen met `payload.new === undefined`. Die
 * waarde werd direct aan setPotje doorgegeven → `potje` state werd
 * undefined → UI brak stil zonder fout of Sentry-melding.
 *
 * Fix: aparte abonnementen voor UPDATE en DELETE op potjes.
 * - UPDATE: setPotje(payload.new) — payload.new is altijd aanwezig
 * - DELETE: setFout met een begrijpelijke melding; potje-state op null
 *
 * SEC-L2: DELETE-abonnement op transacties geeft bij actieve RLS alleen
 * payload.old.id terug. De reducer filtert op dat id.
 *
 * @param {string} potjeId - UUID van het potje (uit useParams)
 */
export function usePotje(potjeId) {
  const deviceId = useDeviceId()

  const [potje, setPotje] = useState(null)
  const [deelnemers, setDeelnemers] = useState([])
  const [transacties, setTransacties] = useState([])
  const [deelnemer, setDeelnemer] = useState(null)
  const [laden, setLaden] = useState(true)
  const [fout, setFout] = useState('')
  const [online, setOnline] = useState(true)

  // ── Initiële datalaad ────────────────────────────────────────────────────────
  const laadData = useCallback(async () => {
    try {
      const [
        { data: p, error: pe },
        { data: d, error: de },
        { data: t, error: te },
      ] = await Promise.all([
        supabase.from('potjes').select('*').eq('id', potjeId).single(),
        supabase.from('deelnemers').select('*').eq('potje_id', potjeId).order('aangemaakt_op'),
        supabase.from('transacties').select('*').eq('potje_id', potjeId).order('aangemaakt_op'),
      ])
      if (pe) throw pe
      if (de) throw de
      if (te) throw te

      setPotje(p)
      setDeelnemers(d)
      setTransacties(t)

      const bekende = d.find(x => x.device_id === deviceId)
      if (bekende) setDeelnemer(bekende)
    } catch (e) {
      const vertaald = logFout(e, { component: 'usePotje', actie: 'laadData' })
      setFout(vertaald || 'Dit potje bestaat niet. Controleer de link.')
    } finally {
      setLaden(false)
    }
  }, [potjeId, deviceId])

  // ── Realtime abonnementen + online/offline ───────────────────────────────────
  useEffect(() => {
    laadData()

    const kanaal = supabase
      .channel(`potje-${potjeId}`)

      // Potje UPDATE — bijv. status → 'gesloten', gesloten_op ingevuld.
      // Alleen UPDATE: payload.new is bij UPDATE altijd aanwezig.
      // Issue 8 fix: was event: '*' — DELETE-event gaf payload.new === undefined
      // waardoor setPotje(undefined) de potje-state stil kapot maakte.
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'potjes', filter: `id=eq.${potjeId}` },
        payload => setPotje(payload.new)
      )

      // Potje DELETE — lifecycle-cron verwijdert potjes na 7 dagen.
      // Bij DELETE is payload.new undefined; payload.old bevat alleen het id.
      // Toon een begrijpelijke melding in plaats van stil de UI te breken.
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'potjes', filter: `id=eq.${potjeId}` },
        () => {
          setPotje(null)
          setFout('Dit potje is verwijderd. Na 7 dagen worden potjes automatisch opgeruimd.')
        }
      )

      // Nieuwe deelnemer
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'deelnemers', filter: `potje_id=eq.${potjeId}` },
        payload =>
          setDeelnemers(prev =>
            [...prev.filter(d => d.id !== payload.new.id), payload.new].sort(
              (a, b) => new Date(a.aangemaakt_op) - new Date(b.aangemaakt_op)
            )
          )
      )

      // Deelnemer-update (bijv. actief → false bij afmelden)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'deelnemers', filter: `potje_id=eq.${potjeId}` },
        payload => {
          setDeelnemers(prev => prev.map(d => d.id === payload.new.id ? payload.new : d))
          setDeelnemer(prev => prev?.id === payload.new.id ? payload.new : prev)
        }
      )

      // Nieuwe transactie
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transacties', filter: `potje_id=eq.${potjeId}` },
        payload => setTransacties(prev => [...prev, payload.new])
      )

      // SEC-L2: Verwijderde transactie (undo).
      // payload.old bevat alleen het id als RLS actief is.
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'transacties', filter: `potje_id=eq.${potjeId}` },
        payload => {
          const verwijderdId = payload.old?.id
          if (verwijderdId) {
            setTransacties(prev => prev.filter(t => t.id !== verwijderdId))
          }
        }
      )

      .subscribe(status => setOnline(status === 'SUBSCRIBED'))

    function handleOnline()  { setOnline(true)  }
    function handleOffline() { setOnline(false) }
    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      supabase.removeChannel(kanaal)
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [potjeId, laadData])

  return {
    potje,
    deelnemers,
    transacties,
    deelnemer,
    setDeelnemer,
    setDeelnemers,
    setTransacties,
    laden,
    fout,
    online,
  }
}
