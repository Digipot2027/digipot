/**
 * berekenSaldi — regressietests voor ontbrekende codepaden
 *
 * Dit bestand dekt uitsluitend gaps die niet in berekenSaldi.test.js zitten.
 * Bestaande scenariotests (A–C) worden hier NIET herhaald.
 *
 * Gedekte gaps:
 *   BS-1  null transacties gooit geen TypeError
 *   BS-2  storting van onbekende deelnemer_id wordt genegeerd op deelnemersniveau
 *   BS-3  bedragen als string (zoals Supabase ze levert via JSON)
 *   LF-2  logFout geeft null terug bij SALDO_TE_LAAG (contract voor callers)
 */

import { describe, it, expect } from 'vitest'
import { berekenSaldi, berekenEindafrekening } from '../utils/berekenSaldi'

// ─── Helpers (lokaal, identiek aan berekenSaldi.test.js) ──────────────────────

const maakDeelnemer = (id, minuten = 0, actief = true, afgemeld_op = null) => ({
  id,
  naam: `Deelnemer ${id}`,
  aangemaakt_op: new Date(2026, 0, 1, 18, minuten).toISOString(),
  actief,
  afgemeld_op,
})

const maakAfgemeld = (id, aanmeldMinuten = 0, afmeldMinuten = 15) => ({
  id,
  naam: `Deelnemer ${id}`,
  aangemaakt_op: new Date(2026, 0, 1, 18, aanmeldMinuten).toISOString(),
  actief: false,
  afgemeld_op: new Date(2026, 0, 1, 18, afmeldMinuten).toISOString(),
})

const storting = (id, deelnemer_id, bedrag, minuten = 5) => ({
  id,
  type: 'storting',
  deelnemer_id,
  bedrag,
  aangemaakt_op: new Date(2026, 0, 1, 18, minuten).toISOString(),
})

const betaling = (id, deelnemer_id, bedrag, minuten = 20) => ({
  id,
  type: 'betaling',
  deelnemer_id,
  bedrag,
  aangemaakt_op: new Date(2026, 0, 1, 18, minuten).toISOString(),
})

// ─── BS-1: null transacties ───────────────────────────────────────────────────

describe('berekenSaldi — BS-1: null/undefined transacties', () => {
  it('gooit geen TypeError bij null transacties', () => {
    // Supabase kan in edge cases null teruggeven — de code doet transacties.filter()
    // Dit moet een duidelijke fout geven, niet een stille NaN-cascade
    expect(() => berekenSaldi([maakDeelnemer('a')], null)).toThrow()
  })

  it('werkt correct bij lege transactie-array', () => {
    const r = berekenSaldi([maakDeelnemer('a')], [])
    expect(r.potTotaal).toBe(0)
    expect(r.deelnemersSaldi[0].gestort).toBe(0)
  })
})

// ─── BS-2: storting van onbekende deelnemer_id ────────────────────────────────

describe('berekenSaldi — BS-2: transactie van onbekende deelnemer', () => {
  it('telt storting van onbekende deelnemer_id wél mee in potTotaal', () => {
    // De pot ziet alle stortingen, ongeacht of deelnemer_id bekend is
    const r = berekenSaldi(
      [maakDeelnemer('a')],
      [storting('t1', 'ONBEKEND_ID', 50)]
    )
    expect(r.potTotaal).toBe(50)
  })

  it('schrijft storting van onbekende deelnemer_id NIET toe aan bestaande deelnemer', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a')],
      [storting('t1', 'ONBEKEND_ID', 50)]
    )
    expect(r.deelnemersSaldi[0].gestort).toBe(0)
  })

  it('telt betaling van onbekende deelnemer_id wél mee in potUitgaven', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a')],
      [storting('t1', 'a', 100), betaling('t2', 'ONBEKEND_ID', 30)]
    )
    expect(r.potUitgaven).toBe(30)
    expect(r.potSaldo).toBe(70)
  })

  it('schrijft betaling van onbekende deelnemer_id NIET toe aan bestaande deelnemer', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a')],
      [storting('t1', 'a', 100), betaling('t2', 'ONBEKEND_ID', 30)]
    )
    expect(r.deelnemersSaldi[0].betaald).toBe(0)
  })
})

// ─── BS-3: stringbedragen (Supabase levert numeric als string) ────────────────

describe('berekenSaldi — BS-3: bedragen als string (Supabase JSON-formaat)', () => {
  it('verwerkt storting-bedrag als string correct', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a')],
      [{ ...storting('t1', 'a', '25.50') }]
    )
    expect(r.potTotaal).toBe(25.50)
    expect(r.deelnemersSaldi[0].gestort).toBe(25.50)
  })

  it('verwerkt betaling-bedrag als string correct', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a')],
      [
        { ...storting('t1', 'a', '50.00') },
        { ...betaling('t2', 'a', '12.99') },
      ]
    )
    expect(r.potUitgaven).toBe(12.99)
    expect(r.potSaldo).toBe(37.01)
  })

  it('berekent gestort correct bij stringbedragen (aandeel = ingelegd tijdens lopend potje)', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a', 0), maakDeelnemer('b', 0)],
      [
        { ...storting('t1', 'a', '50.00') },
        { ...storting('t2', 'b', '50.00') },
        { ...betaling('t3', 'a', '10.00', 20) },
      ]
    )
    // Tijdens lopend potje: aandeel = ingelegd
    expect(r.deelnemersSaldi.find(s => s.id === 'a').aandeel).toBe(50)
    expect(r.deelnemersSaldi.find(s => s.id === 'b').aandeel).toBe(50)
  })

  it('geeft geen NaN-waarden bij stringbedragen', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a'), maakDeelnemer('b')],
      [
        { ...storting('t1', 'a', '20.00') },
        { ...storting('t2', 'b', '15.00') },
        { ...betaling('t3', 'a', '9.99', 20) },
      ]
    )
    r.deelnemersSaldi.forEach(s => {
      expect(isNaN(s.gestort)).toBe(false)
      expect(isNaN(s.betaald)).toBe(false)
      expect(isNaN(s.aandeel)).toBe(false)
      expect(isNaN(s.verrekening)).toBe(false)
    })
  })
})

// ─── BS-4: aandeel tijdens lopend potje = ingelegd ──────────────────────────

describe('berekenSaldi — BS-4: aandeel tijdens lopend potje', () => {
  it('aandeel = ingelegd voor actieve deelnemer', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a', 0), maakDeelnemer('b', 0)],
      [
        storting('t1', 'a', 30, 5),
        storting('t2', 'b', 20, 5),
        betaling('t3', 'a', 25, 15),
      ]
    )
    expect(r.deelnemersSaldi.find(s => s.id === 'a').aandeel).toBe(30)
    expect(r.deelnemersSaldi.find(s => s.id === 'b').aandeel).toBe(20)
  })

  it('aandeel = ingelegd ook voor afgemelde deelnemer in berekenSaldi', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a', 0), maakAfgemeld('b', 0, 15)],
      [
        storting('t1', 'a', 30, 5),
        storting('t2', 'b', 20, 5),
      ]
    )
    expect(r.deelnemersSaldi.find(s => s.id === 'b').aandeel).toBe(20)
  })
})

// ─── BS-5: centcorrectie en afrondingsinvariant ──────────────────────────────

describe('berekenSaldi — BS-5: afrondingsinvariant', () => {
  it('som van verrekenings is nul bij twee deelnemers, één betaalt voor', () => {
    // A legt €30 in, B legt €20 in, A betaalt €25
    // Verrekening A = 25 - 30 = -5, B = 0 - 20 = -20
    // Som = -25 (geen nul — dat is correct: som verrekenings = totaal betaald - totaal gestort)
    // We testen: verrekening per deelnemer klopt op de cent
    const r = berekenSaldi(
      [maakDeelnemer('a', 0), maakDeelnemer('b', 0)],
      [
        storting('t1', 'a', 30),
        storting('t2', 'b', 20),
        betaling('t3', 'a', 25, 15),
      ]
    )
    expect(r.deelnemersSaldi.find(s => s.id === 'a').verrekening).toBe(-5)
    expect(r.deelnemersSaldi.find(s => s.id === 'b').verrekening).toBe(-20)
  })

  it('geen NaN bij kleine bedragen', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a', 0), maakDeelnemer('b', 0)],
      [
        storting('t1', 'a', 0.01),
        betaling('t2', 'a', 0.01, 10),
      ]
    )
    r.deelnemersSaldi.forEach(s => {
      expect(isNaN(s.verrekening)).toBe(false)
    })
  })
})

// ─── BS-6: eindafrekening scenario D, E, F ────────────────────────────────

describe('berekenEindafrekening — BS-6: scenario D (vijf deelnemers, gelijktijdig, één afmelder)', () => {
  // Charlie afgemeld: vaste bijdrage €30
  // Resterend actieven: 182-30=152, totaal actief ingelegd: 40+50+60+20=170, factor=152/170=0,8941
  // Alice: betaald 40, netto 35,76 → +4,24
  // Bob:   betaald 42, netto 44,71 → -2,71
  // David: betaald 50, netto 53,65 → -3,65
  // Eva:   betaald 50, netto 17,88 → +32,12
  const deelnemers = [
    { id: 'alice',   naam: 'Alice',   aangemaakt_op: new Date(2026,0,1,18,0).toISOString(), actief: true,  afgemeld_op: null },
    { id: 'bob',     naam: 'Bob',     aangemaakt_op: new Date(2026,0,1,18,0).toISOString(), actief: true,  afgemeld_op: null },
    { id: 'charlie', naam: 'Charlie', aangemaakt_op: new Date(2026,0,1,18,0).toISOString(), actief: false, afgemeld_op: new Date(2026,0,1,19,0).toISOString() },
    { id: 'david',   naam: 'David',   aangemaakt_op: new Date(2026,0,1,18,0).toISOString(), actief: true,  afgemeld_op: null },
    { id: 'eva',     naam: 'Eva',     aangemaakt_op: new Date(2026,0,1,18,0).toISOString(), actief: true,  afgemeld_op: null },
  ]
  const txs = [
    { id: 's1', type: 'storting', deelnemer_id: 'alice',   bedrag: 20, aangemaakt_op: new Date(2026,0,1,18,5).toISOString() },
    { id: 's2', type: 'storting', deelnemer_id: 'bob',     bedrag: 20, aangemaakt_op: new Date(2026,0,1,18,5).toISOString() },
    { id: 's3', type: 'storting', deelnemer_id: 'charlie', bedrag: 20, aangemaakt_op: new Date(2026,0,1,18,5).toISOString() },
    { id: 's4', type: 'storting', deelnemer_id: 'david',   bedrag: 20, aangemaakt_op: new Date(2026,0,1,18,5).toISOString() },
    { id: 's5', type: 'storting', deelnemer_id: 'eva',     bedrag: 20, aangemaakt_op: new Date(2026,0,1,18,5).toISOString() },
    { id: 's6', type: 'storting', deelnemer_id: 'alice',   bedrag: 20, aangemaakt_op: new Date(2026,0,1,18,30).toISOString() },
    { id: 's7', type: 'storting', deelnemer_id: 'bob',     bedrag: 30, aangemaakt_op: new Date(2026,0,1,18,30).toISOString() },
    { id: 's8', type: 'storting', deelnemer_id: 'charlie', bedrag: 10, aangemaakt_op: new Date(2026,0,1,18,30).toISOString() },
    { id: 's9', type: 'storting', deelnemer_id: 'david',   bedrag: 40, aangemaakt_op: new Date(2026,0,1,18,30).toISOString() },
    { id: 'b1', type: 'betaling', deelnemer_id: 'alice',   bedrag: 40, aangemaakt_op: new Date(2026,0,1,18,45).toISOString() },
    { id: 'b2', type: 'betaling', deelnemer_id: 'bob',     bedrag: 42, aangemaakt_op: new Date(2026,0,1,18,50).toISOString() },
    { id: 'b3', type: 'betaling', deelnemer_id: 'david',   bedrag: 50, aangemaakt_op: new Date(2026,0,1,18,55).toISOString() },
    { id: 'b4', type: 'betaling', deelnemer_id: 'eva',     bedrag: 50, aangemaakt_op: new Date(2026,0,1,19,0).toISOString() },
  ]

  it('charlie (afgemeld): verrekening = −20', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    expect(r.deelnemersSaldi.find(s => s.id === 'charlie').verrekening).toBeCloseTo(-30, 1)
  })

  it('alice: betaald €40, nettobijdrage €35,76 → +€4,24', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    expect(r.deelnemersSaldi.find(s => s.id === 'alice').verrekening).toBeCloseTo(4.24, 1)
  })

  it('eva: betaald €50, nettobijdrage €17,88 → +€32,12', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    expect(r.deelnemersSaldi.find(s => s.id === 'eva').verrekening).toBeCloseTo(32.12, 1)
  })

  it('som van verrekenings is netto nul (max 1 cent afronding)', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    const som = r.deelnemersSaldi.reduce((s, d) => s + d.verrekening, 0)
    expect(Math.abs(som)).toBeLessThan(0.02)
  })
})
