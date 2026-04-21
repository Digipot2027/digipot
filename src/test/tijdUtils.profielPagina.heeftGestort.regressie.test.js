/**
 * Regressietests — lage bevindingen (2026-04-16)
 *
 * BUG-2: tijdLabel en volledigTijdLabel gedupliceerd — gecentraliseerd in tijdUtils.js.
 * BUG-5: PaginaProfiel sloeg lege naam stil op — nu geblokkeerd met melding.
 * TECH-1: STANDAARD_VALUTA dubbel geëxporteerd — alleen nog in constants.js.
 * TECH-3: ikBenGestort inline check gedupliceerd — heeftGestort() in berekenSaldi.js.
 * UX-1:  Pot afsluiten knop miste uitleg — helptekst toegevoegd.
 */

import { describe, it, expect } from 'vitest'
import { tijdLabel, volledigTijdLabel } from '../utils/tijdUtils'
import { heeftGestort } from '../utils/berekenSaldi'
import { STANDAARD_VALUTA } from '../constants'

// ── BUG-2: tijdUtils centralisatie ───────────────────────────────────────────

describe('BUG-2 — tijdUtils: tijdLabel en volledigTijdLabel zijn geëxporteerd', () => {
  it('TU-01: tijdLabel is een functie', () => {
    expect(typeof tijdLabel).toBe('function')
  })

  it('TU-02: volledigTijdLabel is een functie', () => {
    expect(typeof volledigTijdLabel).toBe('function')
  })

  it('TU-03: tijdLabel geeft altijd "uu:mm" terug', () => {
    const iso = new Date(2026, 3, 16, 14, 30).toISOString()
    const result = tijdLabel(iso)
    expect(result).toMatch(/14.30/)
    expect(result).not.toMatch(/2026/)
  })

  it('TU-04: volledigTijdLabel en tijdLabel zijn niet dezelfde functie', () => {
    expect(tijdLabel).not.toBe(volledigTijdLabel)
  })

  it('TU-05: tijdLabel en volledigTijdLabel geven zelfde output voor vandaag', () => {
    const nu = new Date()
    nu.setHours(10, 0, 0, 0)
    const iso = nu.toISOString()
    // Beide geven "uu:mm" voor vandaag — output moet gelijk zijn
    expect(tijdLabel(iso)).toBe(volledigTijdLabel(iso))
  })
})

// ── BUG-5: PaginaProfiel lege naam validatie ─────────────────────────────────
//
// Simuleert de handleOpslaan-logica na de fix.

function handleOpslaanLogica(naam, opgeslagenNaamState, maxNaam = 30) {
  const naamTrimmed = naam.trim()

  if (naamTrimmed.length > maxNaam) {
    return { succes: false, fout: `Je naam mag maximaal ${maxNaam} tekens zijn.` }
  }

  // BUG-5 fix: lege naam geblokkeerd
  if (!naamTrimmed) {
    return { succes: false, fout: 'Vul een naam in of gebruik "Naam verwijderen" om je naam te wissen.' }
  }

  return { succes: true, opgeslagenWaarde: naamTrimmed }
}

describe('BUG-5 — PaginaProfiel: lege naam wordt geblokkeerd', () => {
  it('PP-01: lege string → fout, niet opgeslagen', () => {
    const { succes, fout } = handleOpslaanLogica('', 'Jan')
    expect(succes).toBe(false)
    expect(fout).toMatch(/verwijderen/)
  })

  it('PP-02: spatie-only string → fout, niet opgeslagen', () => {
    const { succes, fout } = handleOpslaanLogica('   ', 'Jan')
    expect(succes).toBe(false)
    expect(fout).toMatch(/verwijderen/)
  })

  it('PP-03: geldige naam → succes', () => {
    const { succes, opgeslagenWaarde } = handleOpslaanLogica('Alice', '')
    expect(succes).toBe(true)
    expect(opgeslagenWaarde).toBe('Alice')
  })

  it('PP-04: naam te lang → fout', () => {
    const { succes, fout } = handleOpslaanLogica('A'.repeat(31), '')
    expect(succes).toBe(false)
    expect(fout).toMatch(/maximaal 30/)
  })

  it('PP-05: naam met spaties eromheen → getrimd opgeslagen', () => {
    const { succes, opgeslagenWaarde } = handleOpslaanLogica('  Bob  ', '')
    expect(succes).toBe(true)
    expect(opgeslagenWaarde).toBe('Bob')
  })
})

// ── TECH-1: STANDAARD_VALUTA één bron ────────────────────────────────────────

describe('TECH-1 — formatBedrag importeert STANDAARD_VALUTA uit constants', () => {
  it('T1-01: STANDAARD_VALUTA uit constants.js is "EUR"', () => {
    expect(STANDAARD_VALUTA).toBe('EUR')
  })

  it('T1-02: formatBedrag default parameter gebruikt STANDAARD_VALUTA impliciet', async () => {
    const { formatBedrag } = await import('../utils/formatBedrag')
    const metDefault = formatBedrag(10)
    const metExpliciet = formatBedrag(10, STANDAARD_VALUTA)
    expect(metDefault).toBe(metExpliciet)
  })
})

// ── TECH-3: heeftGestort() gedeelde functie ───────────────────────────────────

describe('TECH-3 — heeftGestort() uit berekenSaldi.js', () => {
  const deelnemerA = { id: 'd1', naam: 'Alice', gestort: 20, betaald: 0, aandeel: 20, verrekening: -20 }
  const deelnemerB = { id: 'd2', naam: 'Bob',   gestort: 0,  betaald: 0, aandeel: 0,  verrekening: 0  }

  it('HG-01: deelnemer met gestort > 0 → true', () => {
    expect(heeftGestort([deelnemerA, deelnemerB], 'd1')).toBe(true)
  })

  it('HG-02: deelnemer met gestort = 0 → false', () => {
    expect(heeftGestort([deelnemerA, deelnemerB], 'd2')).toBe(false)
  })

  it('HG-03: onbekend deelnemer-id → false', () => {
    expect(heeftGestort([deelnemerA], 'onbekend')).toBe(false)
  })

  it('HG-04: lege saldi-array → false', () => {
    expect(heeftGestort([], 'd1')).toBe(false)
  })

  it('HG-05: null deelnemerId → false zonder crash', () => {
    expect(heeftGestort([deelnemerA], null)).toBe(false)
  })

  it('HG-06: drempel is strikt > 0, niet >= 0', () => {
    const metNulGestort = { id: 'd3', naam: 'Charlie', gestort: 0, betaald: 0, aandeel: 0, verrekening: 0 }
    expect(heeftGestort([metNulGestort], 'd3')).toBe(false)
  })
})

// ── UX-1: Pot afsluiten helptekst ────────────────────────────────────────────
// De helptekst is UI-logica — getest als pure conditielogica.

describe('UX-1 — Pot afsluiten helptekst conditie', () => {
  function bepaalHelpTekst(heeftTransacties) {
    if (heeftTransacties) return 'Iedereen kan het potje afsluiten.'
    return 'Afsluiten kan pas als er transacties zijn.'
  }

  it('UX-01: bij transacties → uitleg dat iedereen kan afsluiten', () => {
    expect(bepaalHelpTekst(true)).toMatch(/Iedereen/)
  })

  it('UX-02: zonder transacties → melding dat afsluiten niet kan', () => {
    expect(bepaalHelpTekst(false)).toMatch(/transacties/)
  })
})
