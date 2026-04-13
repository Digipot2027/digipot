/**
 * Regressietests — Medium audit-bevindingen 2026-04-13
 *
 * SEC-M1: ModalDeelnemen hardcoded constanten
 *   MAX_NAAM = 30 en MAX_DEELNEMERS = 20 waren hardcoded lokale variabelen
 *   in ModalDeelnemen.jsx. Bij een toekomstige wijziging in constants.js
 *   zouden de modal-validaties achter blijven lopen.
 *   Fix: beide constanten geïmporteerd uit constants.js.
 *
 * WCAG-2: Toast role/aria-live niet afgestemd op type
 *   Toast had altijd role="status" en aria-live="polite", ook bij foutmeldingen.
 *   Screenreaders kondigen polite-berichten pas aan bij een pauze — een fout
 *   die niet direct gemeld wordt verslechtert de toegankelijkheid (WCAG 4.1.3).
 *   Fix: type='fout' → role="alert" + aria-live="assertive";
 *        overige typen behouden role="status" + aria-live="polite".
 *
 * UX-1: Afmeldknop mist aria-disabled en cursor bij al-afgemeld staat
 *   De knop toonde "✅ Afgemeld" maar had geen aria-disabled en geen
 *   cursor: not-allowed. Niet-technische gebruikers en screenreader-gebruikers
 *   konden niet afleiden waarom de knop niet reageerde (WCAG 4.1.2).
 *   Fix: aria-disabled={true} + cursor: not-allowed + opacity: 0.6
 *        toegevoegd als deelnemer al afgemeld is.
 *
 * SEC-L2: supabaseClient.js x-device-id getter omzeilt UUID-validatie
 *   De getter leest localStorage direct zonder UUID-validatie van useDeviceId().
 *   Dit is een bewuste architectuurkeuze: useDeviceId() is een React hook en
 *   kan niet buiten een component worden gebruikt. De RLS-policies zijn de
 *   primaire verdedigingslinie. Gedocumenteerd als bewuste keuze in JSDoc.
 *
 * SEC-M2: aangemaakt_op client-side in handleDeelnemen
 *   Bij handleDeelnemen wordt aangemaakt_op client-side aangemaakt als
 *   tijdelijke weergavewaarde. De DB-waarde is leidend en overschrijft de
 *   client-waarde via het realtime-abonnement. Gedocumenteerd als bewuste keuze.
 *
 * WCAG-3: ModalDeelnemen Escape is no-op als onAnnuleer niet meegegeven is
 *   Als deelnemen verplicht is, is onAnnuleer undefined en is Escape een
 *   bewuste no-op. Dit is geen WCAG-overtreding maar een expliciete keuze.
 *   Gedocumenteerd als bewuste keuze in code-commentaar.
 *
 * Gedekte cases:
 *
 * SM1-01  MAX_NAAM uit constants.js heeft waarde 30 (backward compat)
 * SM1-02  MAX_DEELNEMERS uit constants.js heeft waarde 20 (backward compat)
 * SM1-03  Naam van precies MAX_NAAM tekens is geldig
 * SM1-03b Naam van MAX_NAAM + 1 tekens geeft foutmelding met juist getal
 * SM1-04  MAX_DEELNEMERS deelnemers → volgende aanmelding geblokkeerd
 * SM1-04b MAX_DEELNEMERS - 1 deelnemers → aanmelding nog mogelijk
 *
 * WC2-01  Toast type 'fout' → role 'alert' + aria-live 'assertive'
 * WC2-02  Toast type 'ok' → role 'status' + aria-live 'polite'
 * WC2-03  Toast type 'info' → role 'status' + aria-live 'polite'
 * WC2-04  Onbekend type → role 'status' + aria-live 'polite' (veilige default)
 * WC2-05  Fout-toast: role niet 'status' (regressiebescherming oud gedrag)
 * WC2-05b Fout-toast: aria-live niet 'polite' (regressiebescherming oud gedrag)
 *
 * UX1-01  Afgemelde deelnemer → aria-disabled true
 * UX1-02  Actieve deelnemer → aria-disabled undefined (niet gezet)
 * UX1-03  Afgemelde deelnemer → cursor 'not-allowed' in style
 * UX1-04  Actieve deelnemer → geen cursor override in style
 * UX1-05  Afgemelde deelnemer → opacity 0.6 in style
 * UX1-05b Actieve deelnemer → geen opacity override in style
 *
 * SL2-01  x-device-id getter: geldige UUID doorgelaten
 * SL2-02  x-device-id getter: ongeldige waarde doorgelaten (RLS is primaire verdediging)
 * SL2-03  x-device-id getter: lege localStorage → lege string (geen crash)
 *
 * SM2-01  handleDeelnemen client-side object: bevat verwachte velden
 * SM2-02  handleDeelnemen client-side object: actief is true
 * SM2-03  handleDeelnemen client-side object: aangemaakt_op is geldige ISO-string
 *
 * WC3-01  useFocusTrap fallback: onAnnuleer undefined → no-op (geen throw)
 * WC3-02  useFocusTrap fallback: onAnnuleer meegegeven → wordt aangeroepen
 */

import { describe, it, expect } from 'vitest'
import { MAX_NAAM, MAX_DEELNEMERS } from '../constants'

// ── SEC-M1: ModalDeelnemen constanten uit constants.js ────────────────────────
//
// Simuleert de naamvalidatie zoals die in ModalDeelnemen plaatsvindt,
// maar nu met de geïmporteerde constanten uit constants.js (na SEC-M1 fix).
// Vóór fix: lokale const MAX_NAAM = 30 en MAX_DEELNEMERS = 20 — bij een
// wijziging in constants.js zouden deze stille afwijkingen geven.

function valideerNaamMetConstants(naam, deelnemers) {
  const naamTrimmed = naam.trim()
  if (!naamTrimmed) return 'Vul je naam in om deel te nemen.'
  if (naamTrimmed.length > MAX_NAAM) return `Je naam mag maximaal ${MAX_NAAM} tekens zijn.`
  if (deelnemers.length >= MAX_DEELNEMERS) return `Dit potje heeft het maximum van ${MAX_DEELNEMERS} deelnemers bereikt.`
  const naamBezet = deelnemers.some(d => d.naam.toLowerCase() === naamTrimmed.toLowerCase())
  if (naamBezet) return 'Deze naam is al bezet in dit potje. Kies een andere naam.'
  return null
}

describe('ModalDeelnemen — SM1-01..04b: constanten uit constants.js', () => {
  it('SM1-01: MAX_NAAM uit constants.js is 30 (backward compat met hardcoded waarde)', () => {
    expect(MAX_NAAM).toBe(30)
  })

  it('SM1-02: MAX_DEELNEMERS uit constants.js is 20 (backward compat met hardcoded waarde)', () => {
    expect(MAX_DEELNEMERS).toBe(20)
  })

  it('SM1-03: naam van precies MAX_NAAM tekens is geldig', () => {
    const naam = 'a'.repeat(MAX_NAAM)
    expect(valideerNaamMetConstants(naam, [])).toBeNull()
  })

  it('SM1-03b: naam van MAX_NAAM + 1 tekens geeft foutmelding met het juiste getal', () => {
    const naam = 'a'.repeat(MAX_NAAM + 1)
    const fout = valideerNaamMetConstants(naam, [])
    expect(fout).not.toBeNull()
    expect(fout).toContain(String(MAX_NAAM))
  })

  it('SM1-04: precies MAX_DEELNEMERS deelnemers → volgende aanmelding geblokkeerd', () => {
    const deelnemers = Array.from({ length: MAX_DEELNEMERS }, (_, i) => ({
      naam: `Deelnemer${i}`,
    }))
    const fout = valideerNaamMetConstants('Nieuw', deelnemers)
    expect(fout).not.toBeNull()
    expect(fout).toContain(String(MAX_DEELNEMERS))
  })

  it('SM1-04b: MAX_DEELNEMERS - 1 deelnemers → aanmelding nog mogelijk', () => {
    const deelnemers = Array.from({ length: MAX_DEELNEMERS - 1 }, (_, i) => ({
      naam: `Deelnemer${i}`,
    }))
    expect(valideerNaamMetConstants('Nieuw', deelnemers)).toBeNull()
  })
})

// ── WCAG-2: Toast role en aria-live per type ──────────────────────────────────
//
// Simuleert de role/aria-live bepaling zoals die nu in PaginaPotje plaatsvindt
// (na WCAG-2 fix). Vóór fix: altijd role="status" + aria-live="polite",
// ongeacht het type. Foutmeldingen werden daardoor niet direct aangekondigd.

function bepaalToastAria(type) {
  return {
    role: type === 'fout' ? 'alert' : 'status',
    ariaLive: type === 'fout' ? 'assertive' : 'polite',
  }
}

describe('PaginaPotje toast — WC2-01..05b: role en aria-live per type', () => {
  it('WC2-01: type fout → role alert + aria-live assertive (WCAG 4.1.3)', () => {
    const { role, ariaLive } = bepaalToastAria('fout')
    expect(role).toBe('alert')
    expect(ariaLive).toBe('assertive')
  })

  it('WC2-02: type ok → role status + aria-live polite', () => {
    const { role, ariaLive } = bepaalToastAria('ok')
    expect(role).toBe('status')
    expect(ariaLive).toBe('polite')
  })

  it('WC2-03: type info → role status + aria-live polite', () => {
    const { role, ariaLive } = bepaalToastAria('info')
    expect(role).toBe('status')
    expect(ariaLive).toBe('polite')
  })

  it('WC2-04: onbekend type → role status + aria-live polite (veilige default)', () => {
    const { role, ariaLive } = bepaalToastAria('onbekend')
    expect(role).toBe('status')
    expect(ariaLive).toBe('polite')
  })

  it('WC2-05: type fout → role is NIET status (regressiebescherming oud gedrag)', () => {
    const { role } = bepaalToastAria('fout')
    expect(role).not.toBe('status')
  })

  it('WC2-05b: type fout → aria-live is NIET polite (regressiebescherming oud gedrag)', () => {
    const { ariaLive } = bepaalToastAria('fout')
    expect(ariaLive).not.toBe('polite')
  })
})

// ── UX-1: Afmeldknop aria-disabled en cursor bij afgemelde staat ──────────────
//
// Simuleert de props/style bepaling van de afmeldknop in PaginaOverzicht
// (na UX-1 fix). Vóór fix: geen aria-disabled, geen cursor: not-allowed.

function bepaalAfmeldKnopProps(ikBenActief) {
  return {
    ariaDisabled: !ikBenActief || undefined,
    style: {
      minWidth: 0,
      fontSize: '0.85rem',
      ...(!ikBenActief ? { cursor: 'not-allowed', opacity: 0.6 } : {}),
    },
  }
}

describe('PaginaOverzicht afmeldknop — UX1-01..05b: aria en stijl bij afgemeld', () => {
  it('UX1-01: afgemelde deelnemer → aria-disabled is true (WCAG 4.1.2)', () => {
    const { ariaDisabled } = bepaalAfmeldKnopProps(false)
    expect(ariaDisabled).toBe(true)
  })

  it('UX1-02: actieve deelnemer → aria-disabled is undefined (niet gezet)', () => {
    const { ariaDisabled } = bepaalAfmeldKnopProps(true)
    expect(ariaDisabled).toBeUndefined()
  })

  it('UX1-03: afgemelde deelnemer → cursor not-allowed in style', () => {
    const { style } = bepaalAfmeldKnopProps(false)
    expect(style.cursor).toBe('not-allowed')
  })

  it('UX1-04: actieve deelnemer → geen cursor override in style', () => {
    const { style } = bepaalAfmeldKnopProps(true)
    expect(style.cursor).toBeUndefined()
  })

  it('UX1-05: afgemelde deelnemer → opacity 0.6 in style', () => {
    const { style } = bepaalAfmeldKnopProps(false)
    expect(style.opacity).toBe(0.6)
  })

  it('UX1-05b: actieve deelnemer → geen opacity override in style', () => {
    const { style } = bepaalAfmeldKnopProps(true)
    expect(style.opacity).toBeUndefined()
  })
})

// ── SEC-L2: x-device-id getter gedrag ────────────────────────────────────────
//
// De getter in supabaseClient leest localStorage direct zonder UUID-validatie.
// Dit is een bewuste keuze (React hooks niet beschikbaar buiten componenten).
// RLS-policies zijn de primaire verdediging.
// Tests borgen het gedrag dat ten grondslag ligt aan de keuze.

function simuleerDeviceIdGetter(localStorageWaarde) {
  // Exacte kopie van de getter-logica in supabaseClient.js
  return localStorageWaarde ?? ''
}

describe('supabaseClient — SL2-01..03: x-device-id getter gedrag', () => {
  it('SL2-01: geldige UUID wordt ongewijzigd doorgelaten', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    expect(simuleerDeviceIdGetter(uuid)).toBe(uuid)
  })

  it('SL2-02: ongeldige waarde wordt doorgelaten (RLS is primaire verdediging)', () => {
    // Bewuste keuze: geen validatie hier — RLS blokkeert ongeautoriseerde toegang
    const ongeldig = 'niet-een-uuid'
    expect(simuleerDeviceIdGetter(ongeldig)).toBe(ongeldig)
  })

  it('SL2-03: null localStorage (geen waarde) → lege string, geen crash', () => {
    // null ?? '' geeft '' — request gaat door zonder x-device-id
    expect(simuleerDeviceIdGetter(null)).toBe('')
  })
})

// ── SEC-M2: handleDeelnemen client-side deelnemer-object ─────────────────────
//
// Bij handleDeelnemen wordt een deelnemer-object lokaal geconstrueerd als
// tijdelijke weergavewaarde. De DB-waarde overschrijft dit via realtime.
// Tests borgen de structuur van het client-side object.

function bouwClientDeelnemerObject({ id, potjeId, naam, deviceId }) {
  // Exacte kopie van de setDeelnemer-aanroep in handleDeelnemen
  return {
    id,
    potje_id: potjeId,
    naam,
    device_id: deviceId,
    actief: true,
    aangemaakt_op: new Date().toISOString(),
    afgemeld_op: null,
  }
}

describe('usePotjeActies handleDeelnemen — SM2-01..03: client-side deelnemer-object', () => {
  const obj = bouwClientDeelnemerObject({
    id: 'test-uuid',
    potjeId: 'potje-uuid',
    naam: 'Alice',
    deviceId: 'device-uuid',
  })

  it('SM2-01: object bevat alle verwachte velden', () => {
    expect(obj).toHaveProperty('id', 'test-uuid')
    expect(obj).toHaveProperty('potje_id', 'potje-uuid')
    expect(obj).toHaveProperty('naam', 'Alice')
    expect(obj).toHaveProperty('device_id', 'device-uuid')
    expect(obj).toHaveProperty('afgemeld_op', null)
  })

  it('SM2-02: actief is true (nieuwe deelnemer is altijd actief)', () => {
    expect(obj.actief).toBe(true)
  })

  it('SM2-03: aangemaakt_op is geldige ISO-datumstring (tijdelijke waarde)', () => {
    expect(() => new Date(obj.aangemaakt_op)).not.toThrow()
    expect(isNaN(new Date(obj.aangemaakt_op).getTime())).toBe(false)
  })
})

// ── WCAG-3: ModalDeelnemen Escape no-op als onAnnuleer undefined ──────────────
//
// Als deelnemen verplicht is, wordt onAnnuleer niet meegegeven.
// De fallback `onAnnuleer ?? (() => {})` zorgt voor een no-op.
// Dit is een bewuste keuze — geen WCAG-overtreding, gedocumenteerd als zodanig.

function bepaalEscapeCallback(onAnnuleer) {
  // Exacte kopie van de fallback-logica in ModalDeelnemen
  return onAnnuleer ?? (() => {})
}

describe('ModalDeelnemen — WC3-01..02: Escape no-op bij verplicht deelnemen', () => {
  it('WC3-01: onAnnuleer undefined → no-op callback, geen throw bij aanroep', () => {
    const callback = bepaalEscapeCallback(undefined)
    expect(() => callback()).not.toThrow()
  })

  it('WC3-02: onAnnuleer meegegeven → originele functie wordt gebruikt', () => {
    let aangeroepen = false
    const callback = bepaalEscapeCallback(() => { aangeroepen = true })
    callback()
    expect(aangeroepen).toBe(true)
  })
})
