import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { logFout } from '../utils/logFout'
import { berekenSaldi, heeftGestort } from '../utils/berekenSaldi'
import { formatBedrag } from '../utils/formatBedrag'
import { useDeviceId } from './useDeviceId'
import { STANDAARD_VALUTA } from '../constants'

/**
 * usePotjeActies — alle schrijf-acties voor één potje.
 *
 * Pure async functies, geen JSX, geen eigen useState — direct unit-testbaar.
 * State-updates lopen via de setters die usePotje teruggaf.
 *
 * Fixes (2026-04-12):
 *   - handleAfmelden: .single() vervangen door .maybeSingle() (kritiek-2).
 *   - handleSluiten: null-guard op deelnemer toegevoegd (kritiek-3).
 *   - handleDeelnemen: deelnemer-ID client-side genereren (audit bevinding 1).
 *   - handleTransactie: null-guard op deelnemer toegevoegd (audit bevinding 2).
 *
 * Fix (2026-04-16 / SEC-3):
 *   - handleUndo: saldocheck afgerond via rond() voor vergelijking met transactie.bedrag.
 *
 * Fix (2026-04-16 / SEC-4):
 *   - valuta fallback gebruikt nu STANDAARD_VALUTA uit constants.js.
 *
 * Fix (2026-04-16 / TECH-3):
 *   - handleAfmelden: heeftGestort() uit berekenSaldi.js i.p.v. inline check.
 *     Eén bron van waarheid voor de afmeld-drempel.
 */

function rond(waarde) {
  const afgerond = Math.round(waarde * 100) / 100
  return afgerond === 0 ? 0 : afgerond
}

export function usePotjeActies({
  potjeId,
  potje,
  deelnemers,
  transacties,
  deelnemer,
  setDeelnemer,
  setDeelnemers,
  setTransacties,
  toonToast,
  setModaal,
  setAfmeldenLaden,
}) {
  const navigate = useNavigate()
  const deviceId = useDeviceId()
  const valuta = potje?.valuta ?? STANDAARD_VALUTA

  // ── handleDeelnemen ──────────────────────────────────────────────────────────

  const handleDeelnemen = useCallback(async (naam) => {
    const nieuweDeelnemerId = crypto.randomUUID()

    const { error } = await supabase
      .from('deelnemers')
      .insert({ id: nieuweDeelnemerId, potje_id: potjeId, naam, device_id: deviceId })

    if (error) throw error

    setDeelnemer({
      id: nieuweDeelnemerId,
      potje_id: potjeId,
      naam,
      device_id: deviceId,
      actief: true,
      aangemaakt_op: new Date().toISOString(),
      afgemeld_op: null,
    })

    navigate(`/potje/${potjeId}/storten`)
  }, [potjeId, deviceId, setDeelnemer, navigate])

  // ── handleTransactie ─────────────────────────────────────────────────────────

  const handleTransactie = useCallback(async (type, bedrag) => {
    if (!deelnemer?.id) throw new Error('DEELNEMER_ONTBREEKT')
    if (deelnemer.actief === false) throw new Error('NIET_ACTIEF')

    const saldi = berekenSaldi(deelnemers, transacties)
    if (type === 'betaling' && bedrag > saldi.potSaldo) {
      throw new Error(`SALDO_TE_LAAG:${saldi.potSaldo}`)
    }

    const { data, error } = await supabase
      .from('transacties')
      .insert({ potje_id: potjeId, deelnemer_id: deelnemer.id, type, bedrag })
      .select()
      .single()
    if (error) throw error

    const deelnemerSnapshot = deelnemer

    setModaal(null)
    toonToast(
      type === 'storting'
        ? `Storting van ${formatBedrag(bedrag, valuta)} geregistreerd.`
        : `Betaling van ${formatBedrag(bedrag, valuta)} geregistreerd.`,
      'ok',
      { label: 'Ongedaan', handler: () => handleUndo(data, deelnemerSnapshot) }
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [potjeId, deelnemer, deelnemers, transacties, valuta, setModaal, toonToast])

  // ── handleUndo ───────────────────────────────────────────────────────────────

  const handleUndo = useCallback(async (transactie, deelnemerOverride) => {
    const actiefDeelnemer = deelnemerOverride ?? deelnemer

    if (!transactie || transactie.deelnemer_id !== actiefDeelnemer?.id) {
      toonToast('Je kunt alleen je eigen transacties ongedaan maken.', 'fout')
      return
    }

    if (transactie.type === 'storting') {
      const huidigSaldo = berekenSaldi(deelnemers, transacties).potSaldo
      // SEC-3 fix: rond() beide zijden — Supabase NUMERIC kan residuen geven
      if (rond(huidigSaldo) < rond(Number(transactie.bedrag))) {
        toonToast(
          'Ongedaan maken niet mogelijk: er zijn al betalingen gedaan uit dit bedrag.',
          'fout'
        )
        return
      }
    }

    const { error } = await supabase
      .from('transacties')
      .delete()
      .eq('id', transactie.id)
      .eq('deelnemer_id', actiefDeelnemer.id)
    if (error) {
      toonToast(logFout(error, { component: 'usePotjeActies', actie: 'undo' }), 'fout')
    } else {
      setTransacties(prev => prev.filter(t => t.id !== transactie.id))
      toonToast('Transactie ongedaan gemaakt.', 'ok')
    }
  }, [transacties, deelnemers, deelnemer, toonToast, setTransacties])

  // ── handleSluiten ────────────────────────────────────────────────────────────

  const handleSluiten = useCallback(async () => {
    if (!deelnemer?.id) {
      throw new Error('DEELNEMER_ONTBREEKT')
    }

    const { error } = await supabase
      .from('potjes')
      .update({
        status: 'gesloten',
        gesloten_op: new Date().toISOString(),
        gesloten_door: deelnemer.id,
      })
      .eq('id', potjeId)
      .eq('status', 'open')
    if (error) throw error
    setModaal(null)
  }, [potjeId, deelnemer, setModaal])

  // ── handleAfmelden ───────────────────────────────────────────────────────────

  const handleAfmelden = useCallback(async () => {
    if (!deelnemer) return

    const saldi = berekenSaldi(deelnemers, transacties)
    // TECH-3 fix: heeftGestort() i.p.v. inline check — eén bron van waarheid
    if (!heeftGestort(saldi.deelnemersSaldi, deelnemer.id)) {
      toonToast('Je kunt je pas afmelden als je hebt gestort.', 'fout')
      return
    }

    setAfmeldenLaden(true)
    try {
      const { data, error } = await supabase
        .from('deelnemers')
        .update({ actief: false, afgemeld_op: new Date().toISOString() })
        .eq('id', deelnemer.id)
        .select()
        .maybeSingle()
      if (error) throw error

      if (!data) {
        toonToast('Afmelden mislukt. Je deelnemersprofiel is niet meer beschikbaar.', 'fout')
        return
      }

      setDeelnemer(data)
      setDeelnemers(prev => prev.map(d => d.id === data.id ? data : d))
      toonToast('Je bent afgemeld. Je telt niet meer mee bij nieuwe betalingen.', 'info')
    } catch (e) {
      toonToast(logFout(e, { component: 'usePotjeActies', actie: 'afmelden' }), 'fout')
    } finally {
      setAfmeldenLaden(false)
    }
  }, [deelnemer, deelnemers, transacties, toonToast, setAfmeldenLaden, setDeelnemer, setDeelnemers])

  return {
    handleDeelnemen,
    handleTransactie,
    handleUndo,
    handleSluiten,
    handleAfmelden,
  }
}
