import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { logFout } from '../utils/logFout'
import { logMelding } from '../utils/logMelding'
import { metTimeout } from '../utils/requestTimeout'
import { berekenSaldi, heeftGestort } from '../utils/berekenSaldi'
import { formatBedrag } from '../utils/formatBedrag'
import { STANDAARD_VALUTA } from '../constants'

/**
 * usePotjeActies — alle schrijf-acties voor één potje.
 *
 * Pure async functies, geen JSX, geen eigen useState — direct unit-testbaar.
 * State-updates lopen via de setters die usePotje teruggaf.
 *
 * Fase 4 (2026-04-25): device_id volledig verwijderd uit handleDeelnemen.
 * Deelnemers worden aangemaakt met alleen user_id (via auth.getUser()).
 * device_id kolom ontvangt een lege string als DB-default totdat de kolom
 * in een volgende migratie nullable of verwijderd wordt.
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
  const valuta = potje?.valuta ?? STANDAARD_VALUTA

  // ── handleDeelnemen ──────────────────────────────────────────────────────────

  const handleDeelnemen = useCallback(async (naam) => {
    const nieuweDeelnemerId = crypto.randomUUID()

    // Haal user_id op uit de actieve auth-sessie.
    // bootstrapAnonAuth() in supabaseClient.js garandeert dat er altijd
    // een sessie is — getUser() geeft dus altijd een user terug.
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id ?? null

    const { error } = await metTimeout(supabase
      .from('deelnemers')
      .insert({
        id: nieuweDeelnemerId,
        potje_id: potjeId,
        naam,
        device_id: crypto.randomUUID(), // tijdelijk: kolom is nog NOT NULL
        user_id: userId,
      }))

    if (error) throw error

    logMelding('succes_deelgenomen', { component: 'usePotjeActies' })
    setDeelnemer({
      id: nieuweDeelnemerId,
      potje_id: potjeId,
      naam,
      user_id: userId,
      actief: true,
      aangemaakt_op: new Date().toISOString(),
      afgemeld_op: null,
    })

    navigate(`/potje/${potjeId}/storten`)
  }, [potjeId, setDeelnemer, navigate])

  // ── handleUndo ───────────────────────────────────────────────────────────────

  const handleUndo = useCallback(async (transactie, deelnemerOverride) => {
    const actiefDeelnemer = deelnemerOverride ?? deelnemer

    if (!transactie || transactie.deelnemer_id !== actiefDeelnemer?.id) {
      logMelding('fout_gebruiker_undo_niet_eigen', { component: 'usePotjeActies' })
      toonToast('Je kunt alleen je eigen transacties ongedaan maken.', 'fout')
      return
    }

    if (transactie.type === 'storting') {
      const huidigSaldo = berekenSaldi(deelnemers, transacties).potSaldo
      if (rond(huidigSaldo) < rond(Number(transactie.bedrag))) {
        logMelding('fout_gebruiker_undo_saldo_te_laag', { component: 'usePotjeActies' })
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
      logMelding('succes_transactie_ongedaan', { component: 'usePotjeActies' })
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
    logMelding(type === 'storting' ? 'succes_storting_modal_geslaagd' : 'succes_betaling_geslaagd', { component: 'usePotjeActies' })
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
    logMelding('succes_potje_gesloten', { component: 'usePotjeActies' })
    setModaal(null)
  }, [potjeId, deelnemer, setModaal])

  // ── handleAfmelden ───────────────────────────────────────────────────────────

  const handleAfmelden = useCallback(async () => {
    if (!deelnemer) return

    const saldi = berekenSaldi(deelnemers, transacties)
    if (!heeftGestort(saldi.deelnemersSaldi, deelnemer.id)) {
      logMelding('fout_gebruiker_afmelden_niet_gestort', { component: 'usePotjeActies' })
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
      logMelding('succes_afgemeld', { component: 'usePotjeActies' })
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
