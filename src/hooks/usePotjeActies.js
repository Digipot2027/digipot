import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { logFout } from '../utils/logFout'
import { berekenSaldi } from '../utils/berekenSaldi'
import { formatBedrag } from '../utils/formatBedrag'
import { DEVICE_ID_KEY } from '../constants'

/**
 * usePotjeActies — alle schrijf-acties voor één potje.
 *
 * Pure async functies, geen JSX, geen eigen useState — direct unit-testbaar.
 * State-updates lopen via de setters die usePotje teruggaf.
 *
 * Acties:
 *   handleDeelnemen  — schrijft nieuwe deelnemer, navigeert naar storten
 *   handleTransactie — registreert storting of betaling, toont toast + undo
 *   handleUndo       — verwijdert eigen transactie na veiligheidscheck
 *   handleSluiten    — sluit het potje (status → 'gesloten')
 *   handleAfmelden   — meldt huidige deelnemer af (actief → false)
 *
 * @param {Object} params
 * @param {string}   params.potjeId       - UUID van het potje
 * @param {object}   params.potje         - potje-record (incl. valuta)
 * @param {Array}    params.deelnemers    - huidig deelnemers-array
 * @param {Array}    params.transacties   - huidig transacties-array
 * @param {object}   params.deelnemer     - huidig device's deelnemer, of null
 * @param {Function} params.setDeelnemer  - state-setter uit usePotje
 * @param {Function} params.setDeelnemers - state-setter uit usePotje
 * @param {Function} params.setTransacties- state-setter uit usePotje
 * @param {Function} params.toonToast     - toast-callback (bericht, type, actie?)
 * @param {Function} params.setModaal     - modaal-state-setter uit PaginaPotje
 * @param {Function} params.setAfmeldenLaden - laden-state-setter uit PaginaPotje
 */
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
  const valuta = potje?.valuta ?? 'EUR'

  // ── handleDeelnemen ──────────────────────────────────────────────────────────

  const handleDeelnemen = useCallback(async (naam) => {
    const deviceId = localStorage.getItem(DEVICE_ID_KEY)
    const { data, error } = await supabase
      .from('deelnemers')
      .insert({ potje_id: potjeId, naam, device_id: deviceId })
      .select()
      .single()
    if (error) throw error
    setDeelnemer(data)
    navigate(`/potje/${potjeId}/storten`)
  }, [potjeId, setDeelnemer, navigate])

  // ── handleTransactie ─────────────────────────────────────────────────────────

  const handleTransactie = useCallback(async (type, bedrag) => {
    if (deelnemer?.actief === false) throw new Error('NIET_ACTIEF')

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

    // Snapshot de huidige deelnemer op het moment van de transactie.
    // handleUndo ontvangt het volledige transactie-object + de deelnemer-snapshot
    // zodat de eigenaarschaps-check nooit afhankelijk is van een verouderde closure.
    const deelnemerSnapshot = deelnemer

    setModaal(null)
    toonToast(
      type === 'storting'
        ? `Storting van ${formatBedrag(bedrag, valuta)} geregistreerd.`
        : `Betaling van ${formatBedrag(bedrag, valuta)} geregistreerd.`,
      'ok',
      // Geef het volledige transactie-object mee (niet alleen data.id) zodat
      // handleUndo niet hoeft te zoeken in de mogelijk verouderde transacties-closure.
      // Geef ook de deelnemerSnapshot mee om de stale-closure bug te voorkomen
      // waarbij deelnemer nog null was op het moment dat handleTransactie werd gemaakt.
      { label: 'Ongedaan', handler: () => handleUndo(data, deelnemerSnapshot) }
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [potjeId, deelnemer, deelnemers, transacties, valuta, setModaal, toonToast])

  // ── handleUndo ───────────────────────────────────────────────────────────────
  //
  // Accepteert het volledige transactie-object zodat eigenaarschaps-check
  // niet afhankelijk is van de `transacties`-closure.
  //
  // Bug (opgelost): handleTransactie gaf data.id door aan handleUndo. Op het
  // moment van klikken had de realtime-listener de array soms nog niet bijgewerkt,
  // waardoor transacties.find() undefined retourneerde → foutmelding
  // "alleen eigen transacties", ook bij de enige gebruiker.

  const handleUndo = useCallback(async (transactie, deelnemerOverride) => {
    // Gebruik de meegegeven deelnemer-snapshot (uit handleTransactie) als die beschikbaar
    // is. Dit voorkomt de stale-closure bug waarbij `deelnemer` uit de useCallback-closure
    // nog de oude (null) waarde heeft op het moment dat de toast-knop wordt getoond.
    const actiefDeelnemer = deelnemerOverride ?? deelnemer

    // Veiligheidscheck 1: eigenaarschap op basis van meegegeven object
    if (!transactie || transactie.deelnemer_id !== actiefDeelnemer?.id) {
      toonToast('Je kunt alleen je eigen transacties ongedaan maken.', 'fout')
      return
    }

    // Veiligheidscheck 2: storting terugdraaien mag saldo niet negatief maken
    if (transactie.type === 'storting') {
      const huidigSaldo = berekenSaldi(deelnemers, transacties).potSaldo
      if (huidigSaldo < Number(transactie.bedrag)) {
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
      .eq('deelnemer_id', actiefDeelnemer.id) // expliciete ownership-check op DB-niveau
    if (error) {
      toonToast(logFout(error, { component: 'usePotjeActies', actie: 'undo' }), 'fout')
    } else {
      setTransacties(prev => prev.filter(t => t.id !== transactie.id))
      toonToast('Transactie ongedaan gemaakt.', 'ok')
    }
  }, [transacties, deelnemers, deelnemer, toonToast, setTransacties])

  // ── handleSluiten ────────────────────────────────────────────────────────────

  const handleSluiten = useCallback(async () => {
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
    const mijnSaldi = saldi.deelnemersSaldi.find(s => s.id === deelnemer.id)
    if ((mijnSaldi?.gestort ?? 0) === 0) {
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
        .single()
      if (error) throw error
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
