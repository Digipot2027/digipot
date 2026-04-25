import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { logFout } from '../utils/logFout'
import { metTimeout } from '../utils/requestTimeout'
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
 *
 * Zombie-preventie (2026-04-18):
 *   - handleAfmelden veroorzaakt onrechtstreeks het sluiten van het potje
 *     wanneer dit de laatste actieve deelnemer betreft. De sluiting vindt
 *     plaats in de DB via trigger trg_sluit_potje_bij_laatste_afmelding.
 *     De UI ontvangt de status-wijziging via het realtime abonnement in
 *     usePotje en schakelt automatisch door naar de eindafrekening.
 *     Geen codewijziging in deze hook — alleen gedragsverandering op DB-niveau.
 *
 * Lint-fix (2026-04-21 / eslint-plugin-react-hooks 7.1.1):
 *   - handleUndo vóór handleTransactie gedeclareerd om de
 *     react-hooks/immutability "accessed before declaration" fout op te lossen.
 *
 * Fase 2 (2026-04-25):
 *   - handleDeelnemen: user_id meesturen bij INSERT via supabase.auth.getUser().
 *     user_id is nullable — als getUser() mislukt of geen sessie heeft,
 *     wordt null ingevoerd (overgangsperiode device_id RLS blijft werken).
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

    // Fase 2: user_id ophalen uit de actieve Supabase auth-sessie.
    // Als er geen sessie is (overgangsperiode of auth-fout), valt user_id
    // terug op null — de device_id RLS blijft in Fase 2 nog volledig werken.
    let userId = null
    try {
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id ?? null
    } catch {
      // Niet fataal — null is een geldige waarde in de overgangsperiode
    }

    const { error } = await metTimeout(supabase
      .from('deelnemers')
      .insert({
        id: nieuweDeelnemerId,
        potje_id: potjeId,
        naam,
        device_id: deviceId,
        user_id: userId,
      }))

    if (error) throw error

    setDeelnemer({
      id: nieuweDeelnemerId,
      potje_id: potjeId,
      naam,
      device_id: deviceId,
      user_id: userId,
      actief: true,
      aangemaakt_op: new Date().toISOString(),
      afgemeld_op: null,
    })

    navigate(`/potje/${potjeId}/storten`)
  }, [potjeId, deviceId, setDeelnemer, navigate])

  // ── handleUndo ───────────────────────────────────────────────────────────────
  // Gedeclareerd vóór handleTransactie zodat handleTransactie ernaar kan
  // verwijzen in de toast-callback zonder "accessed before declaration" te triggeren
  // (react-hooks/immutability, eslint-plugin-react-hooks 7.1.1).

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

    const { error } = await metTimeout(supabase
      .from('transacties')
      .delete()
      .eq('id', transactie.id)
      .eq('deelnemer_id', actiefDeelnemer.id))
    if (error) {
      toonToast(logFout(error, { component: 'usePotjeActies', actie: 'undo' }), 'fout')
    } else {
      setTransacties(prev => prev.filter(t => t.id !== transactie.id))
      toonToast('Transactie ongedaan gemaakt.', 'ok')
    }
  }, [transacties, deelnemers, deelnemer, toonToast, setTransacties])

  // ── handleTransactie ─────────────────────────────────────────────────────────

  const handleTransactie = useCallback(async (type, bedrag) => {
    if (!deelnemer?.id) throw new Error('DEELNEMER_ONTBREEKT')
    if (deelnemer.actief === false) throw new Error('NIET_ACTIEF')

    const saldi = berekenSaldi(deelnemers, transacties)
    if (type === 'betaling' && bedrag > saldi.potSaldo) {
      throw new Error(`SALDO_TE_LAAG:${saldi.potSaldo}`)
    }

    const { data, error } = await metTimeout(supabase
      .from('transacties')
      .insert({ potje_id: potjeId, deelnemer_id: deelnemer.id, type, bedrag })
      .select()
      .single())
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

  // ── handleSluiten ────────────────────────────────────────────────────────────

  const handleSluiten = useCallback(async () => {
    if (!deelnemer?.id) {
      throw new Error('DEELNEMER_ONTBREEKT')
    }

    const { error } = await metTimeout(supabase
      .from('potjes')
      .update({
        status: 'gesloten',
        gesloten_op: new Date().toISOString(),
        gesloten_door: deelnemer.id,
      })
      .eq('id', potjeId)
      .eq('status', 'open'))
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
      const { data, error } = await metTimeout(supabase
        .from('deelnemers')
        .update({ actief: false, afgemeld_op: new Date().toISOString() })
        .eq('id', deelnemer.id)
        .select()
        .maybeSingle())
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
