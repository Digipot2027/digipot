import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { logFout } from '../utils/logFout'
import { berekenSaldi } from '../utils/berekenSaldi'
import { formatBedrag } from '../utils/formatBedrag'
import { useDeviceId } from './useDeviceId'

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
 * Fixes (2026-04-12):
 *   - handleAfmelden: .single() vervangen door .maybeSingle() (kritiek-2).
 *   - handleSluiten: null-guard op deelnemer toegevoegd (kritiek-3).
 *
 * Fixes (2026-04-12 / audit bevinding 1 & 2):
 *   - handleDeelnemen: deelnemer-ID client-side genereren zodat .select().single()
 *     na de INSERT niet meer nodig is. Zelfde patroon als hoog-4 fix in
 *     PaginaNieuwPotje. Bij RLS-blokkade van de SELECT gooide .single() PGRST116
 *     met een misleidende "potje bestaat niet"-melding.
 *   - handleTransactie: null-guard op deelnemer toegevoegd vóór deelnemer.id.
 *     De NIET_ACTIEF-check (`deelnemer?.actief === false`) gaat ervan uit dat
 *     deelnemer bestaat — maar bij een race condition (afmelden + betalen tegelijk)
 *     kan deelnemer null zijn. Zonder guard crasht deelnemer.id met TypeError.
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
  const deviceId = useDeviceId()
  const valuta = potje?.valuta ?? 'EUR'

  // ── handleDeelnemen ──────────────────────────────────────────────────────────
  //
  // Audit bevinding 1 (2026-04-12): deelnemer-ID client-side genereren.
  //
  // Oud gedrag: .insert(...).select().single() — als de RLS-policy de SELECT
  // na de INSERT blokkeerde, gooide .single() PGRST116. Die fout werd vertaald
  // als "Dit potje bestaat niet of is verwijderd" — terwijl de deelnemer net
  // succesvol was aangemaakt. Zelfde patroon als hoog-4 (PaginaNieuwPotje).
  //
  // Nieuw gedrag: deelnemer-ID client-side genereren via crypto.randomUUID().
  // De ID wordt meegegeven in de INSERT en direct gebruikt voor setDeelnemer
  // en navigatie — geen .select().single() meer nodig.
  //
  // Voordeel: robuuster bij RLS-variaties + consistent met hoog-4.

  const handleDeelnemen = useCallback(async (naam) => {
    const nieuweDeelnemerId = crypto.randomUUID()

    const { error } = await supabase
      .from('deelnemers')
      .insert({ id: nieuweDeelnemerId, potje_id: potjeId, naam, device_id: deviceId })

    if (error) throw error

    // Construeer het deelnemer-object lokaal — zelfde structuur als wat de DB
    // zou teruggeven. aangemaakt_op wordt hier met now() ingevuld; de DB-waarde
    // kan iets afwijken maar is niet kritisch voor weergave.
    //
    // SEC-M2 bewuste keuze (2026-04-13): de client-side aangemaakt_op is een
    // tijdelijke weergavewaarde totdat de realtime-update de correcte DB-waarde
    // overschrijft via het deelnemers INSERT-abonnement in usePotje.
    // De DB-waarde is leidend voor alle berekeningen (berekenSaldi gebruikt
    // aangemaakt_op niet). Discrepantie is maximaal enkele honderden milliseconden.
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
  //
  // Audit bevinding 2 (2026-04-12): null-guard op deelnemer vóór deelnemer.id.
  //
  // De NIET_ACTIEF-check (`deelnemer?.actief === false`) laat deelnemer null
  // doorvallen — null is niet false, dus de check passeert stil. Vervolgens
  // crasht `deelnemer.id` met TypeError.
  // Fix: expliciete null-guard vóór alle deelnemer-toegangen.

  const handleTransactie = useCallback(async (type, bedrag) => {
    // Null-guard — kan optreden bij race condition (afmelden + betalen tegelijk)
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
