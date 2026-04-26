/**
 * formatBedrag — multi-valuta opmaak en STANDAARD_VALUTA
 *
 * Hernoemd van multicurrency.constants.formatBedrag.regressie.test.js
 * (2026-04-26): de oorspronkelijke naam verwees naar VALUTA_OPTIES die
 * is verwijderd toen multicurrency definitief niet werd geactiveerd.
 * De resterende dekking gaat over formatBedrag-gedrag met valutacodes
 * die historisch in de DB-kolom potjes.valuta kunnen voorkomen.
 *
 * Dekking:
 *   STANDAARD_VALUTA is 'EUR'
 *   FB-01  alle gangbare valutacodes produceren een niet-lege string
 *   FB-02  EUR en USD geven verschillende opmaak
 *   FB-03  formatBedrag(0/null, valuta) geeft altijd resultaat (geen crash)
 *   FB-04  lege valutacode gooit RangeError
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

// ── Ondersteunde valutacodes ──────────────────────────────────────────────────
// De DB-kolom potjes.valuta bestaat nog en kan historisch niet-EUR waarden
// bevatten. formatBedrag moet deze correct kunnen weergeven.

const VALUTA_CODES = ['EUR', 'USD', 'GBP', 'CHF', 'DKK', 'NOK', 'SEK']

describe('formatBedrag — valuta-opmaak (FB-01 t/m FB-04)', () => {
  it('FB-01: alle gangbare valutacodes produceren een niet-lege string', () => {
    for (const code of VALUTA_CODES) {
      const result = formatBedrag(10, code)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
      expect(result).toMatch(/10/)
    }
  })

  it('FB-02: EUR en USD geven verschillende opmaak', () => {
    expect(formatBedrag(10, 'EUR')).not.toBe(formatBedrag(10, 'USD'))
  })

  it('FB-03: bedrag 0 of null geeft altijd resultaat (geen crash)', () => {
    for (const code of VALUTA_CODES) {
      expect(() => formatBedrag(0, code)).not.toThrow()
      expect(() => formatBedrag(null, code)).not.toThrow()
    }
  })

  it('FB-04: lege valutacode gooit RangeError', () => {
    expect(() => formatBedrag(10, '')).toThrow()
  })
})
