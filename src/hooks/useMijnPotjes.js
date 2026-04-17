import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { logFout } from '../utils/logFout'
import { berekenSaldi } from '../utils/berekenSaldi'
import { berekenEindafrekening } from '../utils/berekenEindafrekening'
import { useDeviceId } from './useDeviceId'
import { PROFIEL_NAAM_KEY } from '../constants'
import { getItem } from '../utils/storage'

/**
 * useMijnPotjes — laadt alle open of gesloten potjes voor dit device/profiel.
 *
 * Fix (2026-04-16 / storage-abstractie):
 *   - localStorage.getItem(PROFIEL_NAAM_KEY) vervangen door getItem() uit storage.js.
 *     Consistent met de rest van de codebase; foutafhandeling (QuotaExceededError)
 *     zit nu in de abstractielaag i.p.v. direct in de hook.
 */
export function useMijnPotjes(status) {
  const deviceId = useDeviceId()

  const [potjes, setPotjes] = useState([])
  const [laden, setLaden] = useState(true)
  const [fout, setFout] = useState('')
  const [teller, setTeller] = useState(0)

  const potjeIdsRef = useRef([])

  const herlaad = useCallback(() => {
    setFout('')
    setLaden(true)
    setTeller(t => t + 1)
  }, [])

  // ── Datalaad ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    // storage-abstractie fix: getItem() i.p.v. localStorage.getItem()
    const profielNaam = getItem(PROFIEL_NAAM_KEY)?.trim() || null
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

  // ── Realtime abonnement ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!deviceId) return

    const kanaal = supabase
      .channel(`mijn-potjes-${status}-${deviceId}`)

      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'potjes' },
        payload => {
          if (potjeIdsRef.current.includes(payload.new?.id)) {
            herlaad()
          }
        }
      )

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
