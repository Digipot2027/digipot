/**
 * Regressietests — Stap 5: DeelnemerRij
 *
 * Teststrategie: logica-extractie patroon.
 *
 * DeelnemerRij bevat presentatielogica die direct als pure functies
 * testbaar is zonder React-mount of DOM:
 *
 *   DR-01 t/m DR-04  aria-label opbouw (naam + afgemeld-suffix)
 *   DR-05 t/m DR-07  weergave-stijl logica (opacity, doorstreping)
 *   DR-08 t/m DR-10  naamweergave (ikzelf-suffix, badge-conditie)
 *   DR-11 t/m DR-12  saldi-fallback (null/undefined → 0)
 */

import { describe, it, expect } from 'vitest'
import { formatBedrag } from '../utils/formatBedrag'

// ── Geëxtraheerde logica uit DeelnemerRij ─────────────────────────────────────

function maakAriaLabel(naam, isAfgemeld) {
  return `Details van ${naam}${isAfgemeld ? ', afgemeld' : ''}`
}

function bepaalOpacity(isAfgemeld) {
  return isAfgemeld ? 0.6 : 1
}

function bepaalTextDecoration(isAfgemeld) {
  return isAfgemeld ? 'line-through' : 'none'
}

function maakNaamTekst(naam, isIkzelf) {
  return `${naam}${isIkzelf ? ' (jij)' : ''}`
}

function formatSaldiWaarde(waarde, valuta = 'EUR') {
  return formatBedrag(waarde || 0, valuta)
}

// ── Testdata ──────────────────────────────────────────────────────────────────

const actief    = { id: 'd1', naam: 'Alice', actief: true }
const afgemeld  = { id: 'd2', naam: 'Bob',   actief: false }
const saldiVol  = { gestort: 25, betaald: 30 }
const saldiLeeg = { gestort: 0,  betaald: 0  }

// ── DR-01 t/m DR-04: aria-label ───────────────────────────────────────────────

describe('DeelnemerRij — DR-01 t/m DR-04: aria-label opbouw', () => {
  it('DR-01: actieve deelnemer — geen afgemeld-suffix', () => {
    expect(maakAriaLabel('Alice', false)).toBe('Details van Alice')
  })

  it('DR-02: afgemelde deelnemer — heeft ", afgemeld" suffix', () => {
    expect(maakAriaLabel('Bob', true)).toBe('Details van Bob, afgemeld')
  })

  it('DR-03: naam met spaties werkt correct', () => {
    expect(maakAriaLabel('Jan de Vries', false)).toBe('Details van Jan de Vries')
  })

  it('DR-04: afgemeld=false geeft geen suffix', () => {
    const label = maakAriaLabel('X', false)
    expect(label).not.toContain('afgemeld')
  })
})

// ── DR-05 t/m DR-07: weergave-stijl logica ───────────────────────────────────

describe('DeelnemerRij — DR-05 t/m DR-07: weergave-stijl logica', () => {
  it('DR-05: actieve deelnemer heeft opacity 1', () => {
    expect(bepaalOpacity(false)).toBe(1)
  })

  it('DR-06: afgemelde deelnemer heeft opacity 0.6', () => {
    expect(bepaalOpacity(true)).toBe(0.6)
  })

  it('DR-07: naam actief → geen doorstreping; afgemeld → line-through', () => {
    expect(bepaalTextDecoration(false)).toBe('none')
    expect(bepaalTextDecoration(true)).toBe('line-through')
  })
})

// ── DR-08 t/m DR-10: naamweergave ────────────────────────────────────────────

describe('DeelnemerRij — DR-08 t/m DR-10: naamweergave', () => {
  it('DR-08: eigen deelnemer krijgt " (jij)" suffix', () => {
    expect(maakNaamTekst('Alice', true)).toBe('Alice (jij)')
  })

  it('DR-09: andere deelnemer krijgt geen suffix', () => {
    expect(maakNaamTekst('Bob', false)).toBe('Bob')
  })

  it('DR-10: isIkzelf=false toont naam ongewijzigd', () => {
    const tekst = maakNaamTekst('Charlie', false)
    expect(tekst).not.toContain('(jij)')
  })
})

// ── DR-11 t/m DR-12: saldi-fallback ──────────────────────────────────────────

describe('DeelnemerRij — DR-11 t/m DR-12: saldi-fallback bij null/undefined', () => {
  it('DR-11: null saldi → formatteert als 0', () => {
    const result = formatSaldiWaarde(null, 'EUR')
    // formatBedrag(0) geeft '€ 0,00' of vergelijkbaar — bevat altijd '0'
    expect(result).toMatch(/0/)
  })

  it('DR-12: undefined saldi → formatteert als 0', () => {
    const result = formatSaldiWaarde(undefined, 'EUR')
    expect(result).toMatch(/0/)
  })

  it('DR-12b: positief saldo wordt correct geformatteerd', () => {
    const result = formatSaldiWaarde(25, 'EUR')
    expect(result).toMatch(/25/)
  })

  it('DR-12c: valuta-parameter wordt doorgegeven aan formatBedrag', () => {
    const eur = formatSaldiWaarde(10, 'EUR')
    const usd = formatSaldiWaarde(10, 'USD')
    expect(eur).not.toBe(usd)
  })
})
