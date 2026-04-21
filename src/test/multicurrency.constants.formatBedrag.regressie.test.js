/**
 * Regressietests — formatBedrag multi-currency gedrag
 *
 * Teststrategie: logica-extractie patroon.
 *
 * Oorspronkelijk testte dit bestand ook VALUTA_OPTIES uit constants.js.
 * Die export is verwijderd (2026-04-21): multicurrency wordt definitief
 * niet geactiveerd voor eindgebruikers. De valuta is altijd EUR.
 *
 * Overgebleven dekking:
 *   MC-09 t/m MC-11  formatBedrag met niet-EUR valuta's (end-to-end opmaak)
 *   MC-13            formatBedrag gooit bij lege valutacode
 */

import { describe, it, expect } from 'vitest'
import { STANDAARD_VALUTA } from '../constants'
import { formatBedrag } from '../utils/formatBedrag'

// ── STANDAARD_VALUTA ──────────────────────────────────────────────────────────

describe('STANDAARD_VALUTA', () => {
  it('is EUR', () => {
    expect(STANDAARD_VALUTA).toBe('EUR')
  })
})

// ── MC-09 t/m MC-11: formatBedrag met vaste valuta's ─────────────────────────
// De DB-kolom potjes.valuta bestaat nog en bevat historisch niet-EUR waarden.
// formatBedrag moet deze correct kunnen weergeven.

describe('formatBedrag — MC-09 t/m MC-11: multi-currency opmaak', () => {
  const VALUTA_CODES = ['EUR', 'USD', 'GBP', 'CHF', 'DKK', 'NOK', 'SEK']

  it('MC-09: alle ondersteunde valutacodes produceren een niet-lege string', () => {
    for (const code of VALUTA_CODES) {
      const result = formatBedrag(10, code)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
      expect(result).toMatch(/10/)
    }
  })

  it('MC-10: EUR en USD geven verschillende opmaak', () => {
    const eur = formatBedrag(10, 'EUR')
    const usd = formatBedrag(10, 'USD')
    expect(eur).not.toBe(usd)
  })

  it('MC-11: formatBedrag(0, valuta) geeft altijd een resultaat terug (geen crash)', () => {
    for (const code of VALUTA_CODES) {
      expect(() => formatBedrag(0, code)).not.toThrow()
      expect(() => formatBedrag(null, code)).not.toThrow()
    }
  })
})

// ── MC-13: ongeldige valutacode ───────────────────────────────────────────────

describe('formatBedrag — MC-13: ongeldige valutacode', () => {
  it('MC-13: lege string gooit RangeError', () => {
    expect(() => formatBedrag(10, '')).toThrow()
  })
})
