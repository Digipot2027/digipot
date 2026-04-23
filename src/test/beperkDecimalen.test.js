/**
 * beperkDecimalen() + valideerTransactieBedrag decimalen-check — unit tests
 *
 * beperkDecimalen (BD):
 *   BD-01  geen decimaalteken → ongewijzigd
 *   BD-02  0 decimalen (enkel scheidingsteken) → ongewijzigd
 *   BD-03  1 decimaal → ongewijzigd
 *   BD-04  2 decimalen → ongewijzigd
 *   BD-05  3 decimalen → afgekapt tot 2
 *   BD-06  4 decimalen → afgekapt tot 2
 *   BD-07  10 decimalen → afgekapt tot 2
 *   BD-08  komma als scheidingsteken, 3 decimalen → afgekapt tot 2
 *   BD-09  komma als scheidingsteken, 2 decimalen → ongewijzigd
 *   BD-10  punt als scheidingsteken, 3 decimalen → afgekapt tot 2
 *   BD-11  geheel getal als number (geen string) → ongewijzigd
 *   BD-12  lege string → lege string terug
 *   BD-13  null → lege string terug
 *   BD-14  undefined → lege string terug
 *   BD-15  alleen scheidingsteken ("," of ".") → ongewijzigd (0 decimalen)
 *   BD-16  negatief getal met 3 decimalen → afgekapt tot 2
 *   BD-17  meerdere scheidingstekens (ongeldig) → afgekapt op eerste
 *   BD-18  eerste scheidingsteken is komma, tweede is punt → afgekapt op komma
 *
 * valideerTransactieBedrag — decimalen-check (VTD):
 *   VTD-01  invoer "10,123" → fout (meer dan 2 decimalen)
 *   VTD-02  invoer "10.123" → fout (meer dan 2 decimalen)
 *   VTD-03  invoer "10,99" → geen fout (precies 2 decimalen)
 *   VTD-04  invoer "10,9" → geen fout (1 decimaal)
 *   VTD-05  invoer "10" → geen fout (geen decimalen)
 *   VTD-06  foutmelding bevat de verwachte tekst
 *   VTD-07  volgorde: te-laag gaat vóór decimalen-check
 *   VTD-08  volgorde: decimalen-check gaat vóór boven-max-check
 */

import { describe, it, expect } from 'vitest'
import { beperkDecimalen } from '../utils/valideer'
import { valideerTransactieBedrag } from '../utils/valideer'
import { parseBedrag, formatBedrag } from '../utils/formatBedrag'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function valideerBedrag(invoer, { isStorting = true, potSaldo = 9999, max = 999.99 } = {}) {
  const bedragNum = parseBedrag(invoer)
  return valideerTransactieBedrag(invoer, bedragNum, {
    isStorting,
    potSaldo,
    formatBedrag,
    max,
  })
}

// ─── beperkDecimalen ──────────────────────────────────────────────────────────

describe('beperkDecimalen — BD-01 t/m BD-07: punt als scheidingsteken', () => {
  it('BD-01: geen decimaalteken → ongewijzigd', () => {
    expect(beperkDecimalen('42')).toBe('42')
  })

  it('BD-02: enkel scheidingsteken, 0 decimalen → ongewijzigd', () => {
    expect(beperkDecimalen('42.')).toBe('42.')
  })

  it('BD-03: 1 decimaal → ongewijzigd', () => {
    expect(beperkDecimalen('42.5')).toBe('42.5')
  })

  it('BD-04: 2 decimalen → ongewijzigd', () => {
    expect(beperkDecimalen('42.50')).toBe('42.50')
  })

  it('BD-05: 3 decimalen → afgekapt tot 2', () => {
    expect(beperkDecimalen('42.501')).toBe('42.50')
  })

  it('BD-06: 4 decimalen → afgekapt tot 2', () => {
    expect(beperkDecimalen('42.5019')).toBe('42.50')
  })

  it('BD-07: 10 decimalen → afgekapt tot 2', () => {
    expect(beperkDecimalen('1.1234567890')).toBe('1.12')
  })
})

describe('beperkDecimalen — BD-08 t/m BD-10: komma als scheidingsteken (nl-NL)', () => {
  it('BD-08: komma, 3 decimalen → afgekapt tot 2', () => {
    expect(beperkDecimalen('42,501')).toBe('42,50')
  })

  it('BD-09: komma, 2 decimalen → ongewijzigd', () => {
    expect(beperkDecimalen('42,50')).toBe('42,50')
  })

  it('BD-10: komma, 1 decimaal → ongewijzigd', () => {
    expect(beperkDecimalen('42,5')).toBe('42,5')
  })
})

describe('beperkDecimalen — BD-11 t/m BD-15: randgevallen', () => {
  it('BD-11: number-type input → behandeld als string', () => {
    expect(beperkDecimalen(42)).toBe('42')
  })

  it('BD-12: lege string → lege string', () => {
    expect(beperkDecimalen('')).toBe('')
  })

  it('BD-13: null → lege string', () => {
    expect(beperkDecimalen(null)).toBe('')
  })

  it('BD-14: undefined → lege string', () => {
    expect(beperkDecimalen(undefined)).toBe('')
  })

  it('BD-15: alleen scheidingsteken "," → ongewijzigd (0 decimalen erna)', () => {
    expect(beperkDecimalen(',')).toBe(',')
  })
})

describe('beperkDecimalen — BD-16 t/m BD-18: speciale invoerpatronen', () => {
  it('BD-16: negatief getal met 3 decimalen → afgekapt tot 2', () => {
    expect(beperkDecimalen('-5.123')).toBe('-5.12')
  })

  it('BD-17: twee punten (ongeldig getal) → slice op het eerste scheidingsteken, 2 chars erna', () => {
    // '5..3': eerste punt op index 1 → slice(0, 4) = '5..3'
    // De tweede punt telt mee als één van de 2 toegestane posities na het scheidingsteken.
    // Dit is consistent gedrag; parseBedrag() levert NaN op, wat valideerTransactieBedrag() afvangt.
    expect(beperkDecimalen('5..3')).toBe('5..3')
  })

  it('BD-18: komma daarna punt → afgekapt op komma (het eerste scheidingsteken)', () => {
    // Gebruiker typt "5,123.45" — eerste scheidingsteken is komma
    expect(beperkDecimalen('5,123.45')).toBe('5,12')
  })
})

// ─── valideerTransactieBedrag — decimalen-check ────────────────────────────

describe('valideerTransactieBedrag — VTD-01 t/m VTD-06: decimalen-validatie', () => {
  it('VTD-01: "10,123" geeft foutmelding (komma, 3 decimalen)', () => {
    const fout = valideerBedrag('10,123')
    expect(fout).toBe('Voer maximaal 2 cijfers achter de komma in.')
  })

  it('VTD-02: "10.123" geeft foutmelding (punt, 3 decimalen)', () => {
    const fout = valideerBedrag('10.123')
    expect(fout).toBe('Voer maximaal 2 cijfers achter de komma in.')
  })

  it('VTD-03: "10,99" geeft geen fout (precies 2 decimalen)', () => {
    expect(valideerBedrag('10,99')).toBeNull()
  })

  it('VTD-04: "10,9" geeft geen fout (1 decimaal)', () => {
    expect(valideerBedrag('10,9')).toBeNull()
  })

  it('VTD-05: "10" geeft geen fout (geen decimalen)', () => {
    expect(valideerBedrag('10')).toBeNull()
  })

  it('VTD-06: foutmelding bevat de verwachte tekst', () => {
    const fout = valideerBedrag('1,999')
    expect(fout).toContain('2 cijfers achter de komma')
  })
})

describe('valideerTransactieBedrag — VTD-07 t/m VTD-08: volgorde van checks', () => {
  it('VTD-07: lege-invoer-check gaat v\u00f3\u00f3r decimalen-check (leeg \u2192 minimaal-fout, niet decimalen-fout)', () => {
    // Lege string heeft geen decimalen-probleem maar is ook leeg. Leeg gaat voor.
    const fout = valideerBedrag('')
    expect(fout).toBe('Voer een bedrag in van minimaal \u20ac0,01.')
  })

  it('VTD-08: decimalen-check gaat vóór boven-max-check', () => {
    // "1000,999" is zowel boven max als meer dan 2 decimalen. Decimalen gaat vóór.
    const fout = valideerBedrag('1000,999')
    expect(fout).toBe('Voer maximaal 2 cijfers achter de komma in.')
  })
})
