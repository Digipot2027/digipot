/**
 * berekenVereffening — unit tests voor het vereffening-algoritme
 *
 * berekenVereffening staat nu als geëxporteerde functie in utils/berekenSaldi.js.
 * Verplaatst vanuit PaginaEindafrekening (was module-private, niet testbaar via import).
 *
 * Algoritme: greedy — grootste debiteur koppelen aan grootste crediteur.
 * Doel: minimaal aantal transacties (maximaal n-1 voor n deelnemers).
 *
 * Gedekte cases:
 *   BV-01  één crediteur, één debiteur, exact gelijk bedrag
 *   BV-02  één crediteur, één debiteur, crediteur heeft meer
 *   BV-03  één crediteur, één debiteur, debiteur heeft meer (cap: nooit negatief)
 *   BV-04  twee debiteuren, één crediteur — beide betalen aan crediteur
 *   BV-05  één debiteur, twee crediteuren — debiteur betaalt aan grootste eerst
 *   BV-06  twee debiteuren, twee crediteuren — minimale paden
 *   BV-07  lege input — geen transacties
 *   BV-08  iedereen heeft verrekening 0 — geen transacties
 *   BV-09  drempelwaarde 0.005 — kleine bedragen onder drempel worden genegeerd
 *   BV-10  afrondingscorrectheid — bedragen afgerond op 2 decimalen
 *   BV-11  maximaal n-1 transacties voor n deelnemers (invariant)
 *   BV-12  T1-scenario: 5 personen — verwachte vereffening
 */

import { describe, it, expect } from 'vitest'
import { berekenVereffening } from '../utils/berekenVereffening'

// ── BV-01: één crediteur, één debiteur, exact gelijk bedrag ──────────────────

describe('berekenVereffening — BV-01: één op één, gelijk bedrag', () => {
  it('één transactie van debiteur naar crediteur', () => {
    const saldi = [
      { naam: 'Alice', verrekening:  10 },
      { naam: 'Bob',   verrekening: -10 },
    ]
    const result = berekenVereffening(saldi)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ van: 'Bob', aan: 'Alice', bedrag: 10 })
  })
})

// ── BV-02: crediteur heeft meer dan debiteur ──────────────────────────────────

describe('berekenVereffening — BV-02: crediteur heeft meer', () => {
  it('debiteur betaalt zijn volledige schuld, crediteur heeft restant', () => {
    const saldi = [
      { naam: 'Alice', verrekening:  20 },
      { naam: 'Bob',   verrekening: -10 },
    ]
    const result = berekenVereffening(saldi)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ van: 'Bob', aan: 'Alice', bedrag: 10 })
  })
})

// ── BV-03: debiteur heeft meer dan crediteur ──────────────────────────────────

describe('berekenVereffening — BV-03: debiteur heeft meer', () => {
  it('crediteur wordt volledig vergoed, debiteur heeft restant voor volgende', () => {
    const saldi = [
      { naam: 'Alice',   verrekening:  10 },
      { naam: 'Bob',     verrekening: -20 },
      { naam: 'Charlie', verrekening:  10 },
    ]
    const result = berekenVereffening(saldi)
    expect(result).toHaveLength(2)
    const totaalVanBob = result.filter(t => t.van === 'Bob').reduce((s, t) => s + t.bedrag, 0)
    expect(totaalVanBob).toBeCloseTo(20, 1)
  })
})

// ── BV-04: twee debiteuren, één crediteur ────────────────────────────────────

describe('berekenVereffening — BV-04: twee debiteuren, één crediteur', () => {
  it('beide debiteuren betalen aan de crediteur', () => {
    const saldi = [
      { naam: 'Alice',   verrekening:  30 },
      { naam: 'Bob',     verrekening: -20 },
      { naam: 'Charlie', verrekening: -10 },
    ]
    const result = berekenVereffening(saldi)
    expect(result).toHaveLength(2)
    expect(result.every(t => t.aan === 'Alice')).toBe(true)
    expect(result[0].van).toBe('Bob')
    expect(result[0].bedrag).toBe(20)
    expect(result[1].van).toBe('Charlie')
    expect(result[1].bedrag).toBe(10)
  })

  it('totaal ontvangen door crediteur = som van alle schulden', () => {
    const saldi = [
      { naam: 'Alice',   verrekening:  30 },
      { naam: 'Bob',     verrekening: -20 },
      { naam: 'Charlie', verrekening: -10 },
    ]
    const result = berekenVereffening(saldi)
    const totaal = result.reduce((s, t) => s + t.bedrag, 0)
    expect(totaal).toBeCloseTo(30, 1)
  })
})

// ── BV-05: één debiteur, twee crediteuren ────────────────────────────────────

describe('berekenVereffening — BV-05: één debiteur, twee crediteuren', () => {
  it('debiteur betaalt aan grootste crediteur eerst', () => {
    const saldi = [
      { naam: 'Alice',   verrekening:  20 },
      { naam: 'Bob',     verrekening:  10 },
      { naam: 'Charlie', verrekening: -30 },
    ]
    const result = berekenVereffening(saldi)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ van: 'Charlie', aan: 'Alice', bedrag: 20 })
    expect(result[1]).toEqual({ van: 'Charlie', aan: 'Bob',   bedrag: 10 })
  })
})

// ── BV-06: twee debiteuren, twee crediteuren ────────────────────────────────

describe('berekenVereffening — BV-06: twee debiteuren, twee crediteuren', () => {
  it('maximaal 3 transacties voor 4 deelnemers (n-1 invariant)', () => {
    const saldi = [
      { naam: 'Alice',   verrekening:  15 },
      { naam: 'Bob',     verrekening:   5 },
      { naam: 'Charlie', verrekening: -12 },
      { naam: 'David',   verrekening:  -8 },
    ]
    const result = berekenVereffening(saldi)
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it('som van alle betalingen = som van alle positieve verrekenings', () => {
    const saldi = [
      { naam: 'Alice',   verrekening:  15 },
      { naam: 'Bob',     verrekening:   5 },
      { naam: 'Charlie', verrekening: -12 },
      { naam: 'David',   verrekening:  -8 },
    ]
    const result = berekenVereffening(saldi)
    const totaal = result.reduce((s, t) => s + t.bedrag, 0)
    expect(totaal).toBeCloseTo(20, 1)
  })

  it('alle transacties hebben een positief bedrag', () => {
    const saldi = [
      { naam: 'Alice',   verrekening:  15 },
      { naam: 'Bob',     verrekening:   5 },
      { naam: 'Charlie', verrekening: -12 },
      { naam: 'David',   verrekening:  -8 },
    ]
    const result = berekenVereffening(saldi)
    expect(result.every(t => t.bedrag > 0)).toBe(true)
  })
})

// ── BV-07: lege input ────────────────────────────────────────────────────────

describe('berekenVereffening — BV-07: lege input', () => {
  it('geeft lege array bij lege deelnemersSaldi', () => {
    expect(berekenVereffening([])).toEqual([])
  })
})

// ── BV-08: iedereen verrekening 0 ────────────────────────────────────────────

describe('berekenVereffening — BV-08: iedereen quitte', () => {
  it('geeft lege array als alle verrekenings 0 zijn', () => {
    const saldi = [
      { naam: 'Alice', verrekening: 0 },
      { naam: 'Bob',   verrekening: 0 },
    ]
    expect(berekenVereffening(saldi)).toEqual([])
  })
})

// ── BV-09: drempelwaarde 0.005 ───────────────────────────────────────────────

describe('berekenVereffening — BV-09: drempelwaarde 0.005', () => {
  it('verrekening van exact 0.005 wordt genegeerd (niet > 0.005)', () => {
    const saldi = [
      { naam: 'Alice', verrekening:  0.005 },
      { naam: 'Bob',   verrekening: -0.005 },
    ]
    expect(berekenVereffening(saldi)).toEqual([])
  })

  it('verrekening van 0.006 wordt wél meegenomen', () => {
    const saldi = [
      { naam: 'Alice', verrekening:  0.006 },
      { naam: 'Bob',   verrekening: -0.006 },
    ]
    const result = berekenVereffening(saldi)
    expect(result).toHaveLength(1)
  })

  it('verrekening van -0.004 wordt genegeerd', () => {
    const saldi = [
      { naam: 'Alice',   verrekening:  10 },
      { naam: 'Bob',     verrekening: -10 },
      { naam: 'Charlie', verrekening: -0.004 },
    ]
    const result = berekenVereffening(saldi)
    expect(result.every(t => t.van !== 'Charlie')).toBe(true)
  })
})

// ── BV-10: afrondingscorrectheid ────────────────────────────────────────────

describe('berekenVereffening — BV-10: afrondingscorrectheid', () => {
  it('bedragen worden afgerond op 2 decimalen', () => {
    const saldi = [
      { naam: 'Alice', verrekening:  7.19 },
      { naam: 'Bob',   verrekening: -7.19 },
    ]
    const result = berekenVereffening(saldi)
    expect(result[0].bedrag).toBe(7.19)
  })

  it('geen NaN-bedragen in het resultaat', () => {
    const saldi = [
      { naam: 'Alice',   verrekening:  10.23 },
      { naam: 'Bob',     verrekening: -11.85 },
      { naam: 'Charlie', verrekening:   1.62 },
    ]
    const result = berekenVereffening(saldi)
    expect(result.every(t => !isNaN(t.bedrag))).toBe(true)
  })
})

// ── BV-11: n-1 invariant ────────────────────────────────────────────────────

describe('berekenVereffening — BV-11: maximaal n-1 transacties', () => {
  it('5 deelnemers → maximaal 4 transacties', () => {
    const saldi = [
      { naam: 'A', verrekening:  30 },
      { naam: 'B', verrekening:  20 },
      { naam: 'C', verrekening: -10 },
      { naam: 'D', verrekening: -15 },
      { naam: 'E', verrekening: -25 },
    ]
    const result = berekenVereffening(saldi)
    expect(result.length).toBeLessThanOrEqual(4)
  })

  it('10 deelnemers → maximaal 9 transacties', () => {
    const saldi = [
      { naam: 'A', verrekening:  50 },
      { naam: 'B', verrekening:  40 },
      { naam: 'C', verrekening:  30 },
      { naam: 'D', verrekening:  20 },
      { naam: 'E', verrekening:  10 },
      { naam: 'F', verrekening: -30 },
      { naam: 'G', verrekening: -25 },
      { naam: 'H', verrekening: -35 },
      { naam: 'I', verrekening: -30 },
      { naam: 'J', verrekening: -30 },
    ]
    const result = berekenVereffening(saldi)
    expect(result.length).toBeLessThanOrEqual(9)
  })
})

// ── BV-12: T1-scenario uit de smoke test ────────────────────────────────────

describe('berekenVereffening — BV-12: T1-scenario', () => {
  const saldi = [
    { naam: 'Beek',    verrekening:   7.19 },
    { naam: 'Beer',    verrekening:  10.23 },
    { naam: 'Poiesz',  verrekening: -11.85 },
    { naam: 'Tesser',  verrekening:   7.26 },
    { naam: 'Chantal', verrekening: -12.83 },
  ]

  it('geeft maximaal 4 transacties terug (5 deelnemers, n-1)', () => {
    const result = berekenVereffening(saldi)
    expect(result.length).toBeLessThanOrEqual(4)
  })

  it('alle crediteuren ontvangen hun volledige verrekening', () => {
    const result = berekenVereffening(saldi)
    const ontvangenPerNaam = {}
    result.forEach(t => {
      ontvangenPerNaam[t.aan] = (ontvangenPerNaam[t.aan] ?? 0) + t.bedrag
    })
    expect(ontvangenPerNaam['Beer']   ?? 0).toBeCloseTo(10.23, 1)
    expect(ontvangenPerNaam['Tesser'] ?? 0).toBeCloseTo(7.26,  1)
    expect(ontvangenPerNaam['Beek']   ?? 0).toBeCloseTo(7.19,  1)
  })

  it('alle debiteuren betalen hun volledige schuld', () => {
    const result = berekenVereffening(saldi)
    const betaaldPerNaam = {}
    result.forEach(t => {
      betaaldPerNaam[t.van] = (betaaldPerNaam[t.van] ?? 0) + t.bedrag
    })
    expect(betaaldPerNaam['Poiesz']  ?? 0).toBeCloseTo(11.85, 1)
    expect(betaaldPerNaam['Chantal'] ?? 0).toBeCloseTo(12.83, 1)
  })

  it('Beer (grootste crediteur) wordt eerst vergoed', () => {
    const result = berekenVereffening(saldi)
    expect(result[0].aan).toBe('Beer')
  })

  it('alle transacties hebben positief bedrag ≥ 0.01', () => {
    const result = berekenVereffening(saldi)
    expect(result.every(t => t.bedrag >= 0.01)).toBe(true)
  })
})
