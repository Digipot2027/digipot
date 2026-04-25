import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { logFout } from '../utils/logFout'
import { metTimeout } from '../utils/requestTimeout'

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
 * Issue 8 fix (2026-04-12): aparte abonnementen voor UPDATE en DELETE op
 * potjes zodat payload.new nooit undefined is bij setPotje().
 *
 * SEC-L2: DELETE-abonnement op transacties geeft bij actieve RLS alleen
 * payload.old.id terug. De reducer filtert op dat id.
 *
 * Fase 4 (2026-04-25): device_id-herkenning volledig verwijderd.
 * Deelnemer-herkenning uitsluitend via auth.uid() → user_id match.
 *
 * @param {string} potjeId - UUID van het potje (uit useParams)
 */
export function usePotje(potjeId) {
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
        { data: authData },
      ] = await Promise.all([
        metTimeout(supabase.from('potjes').select('*').eq('id', potjeId).single()),
        metTimeout(supabase.from('deelnemers').select('*').eq('potje_id', potjeId).order('aangemaakt_op')),
        metTimeout(supabase.from('transacties').select('*').eq('potje_id', potjeId).order('aangemaakt_op')),
        supabase.auth.getUser(),
      ])

      if (pe) throw pe
      if (de) throw de
      if (te) throw te

      setPotje(p)
      setDeelnemers(d)
      setTransacties(t)

      // Deelnemer-herkenning via auth.uid()
      const userId = authData?.user?.id ?? null
      const bekende = userId ? (d.find(x => x.user_id === userId) ?? null) : null
      if (bekende) setDeelnemer(bekende)
    } catch (e) {
      const vertaald = logFout(e, { component: 'usePotje', actie: 'laadData' })
      setFout(vertaald || 'Dit potje bestaat niet. Controleer de link.')
    } finally {
      setLaden(false)
    }
  }, [potjeId])

  // ── Realtime abonnementen + online/offline ───────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laadData()

    const kanaal = supabase
      .channel(`potje-${potjeId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'potjes', filter: `id=eq.${potjeId}` },
        payload => setPotje(payload.new)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'potjes', filter: `id=eq.${potjeId}` },
        () => {
          setPotje(null)
          setFout('Dit potje is verwijderd. Na 7 dagen worden potjes automatisch opgeruimd.')
        }
      )
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
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'deelnemers', filter: `potje_id=eq.${potjeId}` },
        payload => {
          setDeelnemers(prev => prev.map(d => d.id === payload.new.id ? payload.new : d))
          setDeelnemer(prev => prev?.id === payload.new.id ? payload.new : prev)
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transacties', filter: `potje_id=eq.${potjeId}` },
        payload => setTransacties(prev =>
          prev.some(t => t.id === payload.new.id) ? prev : [...prev, payload.new]
        )
      )
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
