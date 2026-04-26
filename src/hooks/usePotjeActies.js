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
 * D21 afgelost (2026-04-26): device_id kolom nullable, INSERT zonder device_id.
 * UX (2026-04-26): undo-functionaliteit verwijderd.
 */

export function usePotjeActies({
  potjeId,
  potje,
  deelnemers,
  transacties,
  deelnemer,
  setDeelnemer,
  setDeelnemers,
  toonToast,
  setModaal,
  setAfmeldenLaden,
}) {
  const navigate = useNavigate()
  const valuta = potje?.valuta ?? STANDAARD_VALUTA

  // ── handleDeelnemen ──────────────────────────────────────────────────────────

  const handleDeelnemen = useCallback(async (naam) => {
    const nieuweDeelnemerId = crypto.randomUUID()

    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id ?? null

    const { error } = await metTimeout(supabase
      .from('deelnemers')
      .insert({
        id: nieuweDeelnemerId,
        potje_id: potjeId,
        naam,
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

  // ── handleTransactie ─────────────────────────────────────────────────────────

  const handleTransactie = useCallback(async (type, bedrag) => {
    if (!deelnemer?.id) throw new Error('DEELNEMER_ONTBREEKT')
    if (deelnemer.actief === false) throw new Error('NIET_ACTIEF')

    const saldi = berekenSaldi(deelnemers, transacties)
    if (type === 'betaling' && bedrag > saldi.potSaldo) {
      throw new Error(`SALDO_TE_LAAG:${saldi.potSaldo}`)
    }

    const { error } = await metTimeout(supabase
      .from('transacties')
      .insert({ potje_id: potjeId, deelnemer_id: deelnemer.id, type, bedrag }))
    if (error) throw error

    setModaal(null)
    logMelding(type === 'storting' ? 'succes_storting_modal_geslaagd' : 'succes_betaling_geslaagd', { component: 'usePotjeActies' })
    toonToast(
      type === 'storting'
        ? `Storting van ${formatBedrag(bedrag, valuta)} geregistreerd.`
        : `Betaling van ${formatBedrag(bedrag, valuta)} geregistreerd.`,
      'ok'
    )
  }, [potjeId, deelnemer, deelnemers, transacties, valuta, setModaal, toonToast])

  // ── handleSluiten ────────────────────────────────────────────────────────────

  const handleSluiten = useCallback(async () => {
    if (!deelnemer?.id) throw new Error('DEELNEMER_ONTBREEKT')

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
    handleSluiten,
    handleAfmelden,
  }
}
