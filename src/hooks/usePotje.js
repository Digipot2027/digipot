import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { logFout } from '../utils/logFout'
import { useDeviceId } from './useDeviceId'

/**
 * usePotje — laadt en synchroniseert alle data voor één potje.
 *
 * Vervangt de gedupliceerde laadData + realtime-abonnementen +
 * online/offline-logica in PaginaPotje en PaginaStorten.
 *
 * Realtime-abonnementen (vier events):
 *   potjes     *       — potjestatus, gesloten_op, enz.
 *   deelnemers INSERT  — nieuwe deelnemer
 *   deelnemers UPDATE  — bijv. actief → false bij afmelden
 *   transacties INSERT — nieuwe storting of betaling
 *   transacties DELETE — undo van eigen transactie (SEC-L2)
 *
 * SEC-L2: DELETE-abonnement toegevoegd zodat undo's van andere clients
 * (of van eigen client via directe API-aanroep) direct zichtbaar zijn
 * zonder herladen. Zonder dit abonnement bleef een verwijderde transactie
 * zichtbaar in de lokale state tot aan de volgende refresh.
 *
 * @param {string} potjeId - UUID van het potje (uit useParams)
 * @returns {{
 *   potje: object|null,
 *   deelnemers: Array,
 *   transacties: Array,
 *   deelnemer: object|null,
 *   setDeelnemer: Function,
 *   setDeelnemers: Function,
 *   setTransacties: Function,
 *   laden: boolean,
 *   fout: string,
 *   online: boolean,
 * }}
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

      // Potje-updates (status, gesloten_op, enz.)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'potjes', filter: `id=eq.${potjeId}` },
        payload => setPotje(payload.new)
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
      // payload.old bevat alleen het primaire sleutel-veld (id) als RLS actief is.
      // We filteren op id — meer data is niet nodig voor een DELETE.
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
