/**
 * Regressietests — berekenSaldi/berekenEindafrekening met stringbedragen + afgemelde deelnemers (#11)
 *
 * Probleem:
 *   berekenSaldi.regressie.test.js (BS-3) dekt stringbedragen uitsluitend
 *   voor ACTIEVE deelnemers. De eindafrekening-logica (berekenEindafrekening)
 *   werkt anders: afgemelde deelnemers krijgen een vaste bijdrage = volledige
 *   inleg, actieve deelnemers krijgen een factor toegepast.
 *
 *   Beide berekeningen doen Number(t.bedrag) — maar de factor-berekening
 *   in berekenEindafrekening combineert meerdere getallen:
 *     resterendVoorActieven = potUitgaven - totaalBijdrageAfgemelden
 *
 *   Als ergens een string niet correct wordt gecast, kan resterendVoorActieven
 *   NaN worden — en dan zijn ALLE factor-berekeningen NaN.
 *
 *   Dit is precies het scenario dat jullie tegenkwamen: stringbedragen kwamen
 *   correct door in het losse potje, maar kraakten bij de eindafrekening.
 *
 * Combinaties die gedekt worden:
 *   SB-01  Stringbedragen storting + afgemelde deelnemer → factor correct
 *   SB-02  Stringbedragen betaling + afgemelde deelnemer → resterend correct
 *   SB-03  Mix string/number bedragen in zelfde potje → geen NaN
 *   SB-04  Scenario B (referentiescenario) met alle bedragen als string
 *   SB-05  Scenario C (referentiescenario) met alle bedragen als string
 *   SB-06  Vaste bijdrage afgemelde deelnemer bij stringbedrag = volledige inleg
 *   SB-07  Factor = 0 als alle actieven niets ingelegd hebben (stringpad)
 *   SB-08  potTotaal correct bij mix string/number stortingen
 *   SB-09  Geen NaN in welk veld dan ook (invariant)
 *   SB-10  Stringbedrag '0' voor afgemelde deelnemer → bijdrage = 0, verrekening = 0
 */

import { describe, it, expect } from 'vitest'
import { berekenEindafrekening, berekenSaldi } from '../utils/berekenSaldi'

// ── Helpers ───────────────────────────────────────────────────────────────────

const T_AANMELD = '2026-01-01T18:00:00.000Z'
const T_AFMELD  = '2026-01-01T19:00:00.000Z'
const T_SLUIT   = '2026-01-01T20:00:00.000Z'
const T_STOR1   = '2026-01-01T18:05:00.000Z'
const T_STOR2   = '2026-01-01T18:10:00.000Z'
const T_BETAAL  = '2026-01-01T18:30:00.000Z'

function actief(id, naam) {
  return { id, naam, aangemaakt_op: T_AANMELD, actief: true, afgemeld_op: null }
}
function afgemeld(id, naam) {
  return { id, naam, aangemaakt_op: T_AANMELD, actief: false, afgemeld_op: T_AFMELD }
}

// String-bedrag helpers (simuleren Supabase JSON-uitvoer)
function stortingStr(id, deelnemer_id, bedrag) {
  return { id, type: 'storting', deelnemer_id, bedrag: String(bedrag), potje_id: 'p1', aangemaakt_op: T_STOR1 }
}
function betalingStr(id, deelnemer_id, bedrag) {
  return { id, type: 'betaling', deelnemer_id, bedrag: String(bedrag), potje_id: 'p1', aangemaakt_op: T_BETAAL }
}
function stortingNum(id, deelnemer_id, bedrag) {
  return { id, type: 'storting', deelnemer_id, bedrag, potje_id: 'p1', aangemaakt_op: T_STOR2 }
}
function betalingNum(id, deelnemer_id, bedrag) {
  return { id, type: 'betaling', deelnemer_id, bedrag, potje_id: 'p1', aangemaakt_op: T_BETAAL }
}

// Helper: controleer dat geen enkel veld NaN is
function heeftGeenNaN(saldi) {
  for (const s of saldi.deelnemersSaldi) {
    if (isNaN(s.gestort))    return false
    if (isNaN(s.betaald))    return false
    if (isNaN(s.aandeel))    return false
    if (isNaN(s.verrekening)) return false
  }
  return true
}

// ── SB-01: Stringbedragen storting + afgemelde deelnemer → factor correct ─────

describe('berekenEindafrekening — SB-01: stringbedragen storting + afgemeld', () => {
  it('factor wordt correct berekend als alle stortingen strings zijn', () => {
    // Charlie afgemeld: inleg '25' (string), bijdrage = 25
    // Actieven: Alice '25', Bob '25' → totaal actief = 50
    // Betaald: Alice 30, Bob 20 → totaal = 50
    // Resterend = 50 - 25 = 25, factor = 25/50 = 0,5
    // Netto Alice = 25 * 0,5 = 12,5. Verrekening Alice = 30 - 12,5 = +17,5
    // Netto Bob   = 25 * 0,5 = 12,5. Verrekening Bob   = 20 - 12,5 = +7,5
    const deelnemers = [actief('alice', 'Alice'), actief('bob', 'Bob'), afgemeld('charlie', 'Charlie')]
    const txs = [
      stortingStr('s1', 'alice',   '25'),
      stortingStr('s2', 'bob',     '25'),
      stortingStr('s3', 'charlie', '25'),
      betalingStr('b1', 'alice',   '30'),
      betalingStr('b2', 'bob',     '20'),
    ]
    const r = berekenEindafrekening(deelnemers, txs, T_SLUIT)
    expect(r.deelnemersSaldi.find(s => s.id === 'alice').verrekening).toBeCloseTo(17.5, 1)
    expect(r.deelnemersSaldi.find(s => s.id === 'bob').verrekening).toBeCloseTo(7.5, 1)
    expect(r.deelnemersSaldi.find(s => s.id === 'charlie').verrekening).toBeCloseTo(-25, 1)
  })
})

// ── SB-02: Stringbedragen betaling + afgemelde deelnemer → resterend correct ──

describe('berekenEindafrekening — SB-02: stringbedragen betaling, resterend correct', () => {
  it('resterendVoorActieven correct bij string betalingen', () => {
    // Charlie afgemeld: inleg 20, bijdrage = 20
    // Betaald totaal (als string): Alice '18', Bob '12' → potUitgaven = 30
    // Resterend = 30 - 20 = 10, factor = 10/(20+20) = 0,25
    const deelnemers = [actief('alice', 'Alice'), actief('bob', 'Bob'), afgemeld('charlie', 'Charlie')]
    const txs = [
      stortingStr('s1', 'alice',   '20'),
      stortingStr('s2', 'bob',     '20'),
      stortingStr('s3', 'charlie', '20'),
      betalingStr('b1', 'alice',   '18'),
      betalingStr('b2', 'bob',     '12'),
    ]
    const r = berekenEindafrekening(deelnemers, txs, T_SLUIT)
    // Netto Alice = 20 * 0,25 = 5. Verrekening = 18 - 5 = +13
    expect(r.deelnemersSaldi.find(s => s.id === 'alice').verrekening).toBeCloseTo(13, 1)
    expect(r.deelnemersSaldi.find(s => s.id === 'charlie').verrekening).toBeCloseTo(-20, 1)
  })
})

// ── SB-03: Mix string/number bedragen in zelfde potje → geen NaN ──────────────

describe('berekenEindafrekening — SB-03: mix string en number bedragen', () => {
  it('mix van string en number bedragen geeft geen NaN', () => {
    // Supabase levert altijd strings, maar tests of eigen data kan numbers bevatten
    const deelnemers = [actief('alice', 'Alice'), afgemeld('bob', 'Bob')]
    const txs = [
      stortingStr('s1', 'alice', '30'),   // string
      stortingNum('s2', 'alice',  10),    // number — tweede storting, T_STOR2 > T_STOR1
      stortingStr('s3', 'bob',   '20'),   // string
      betalingStr('b1', 'alice', '25'),   // string
      betalingNum('b2', 'alice',   5),    // number
    ]
    const r = berekenEindafrekening(deelnemers, txs, T_SLUIT)
    expect(heeftGeenNaN(r)).toBe(true)
  })

  it('potTotaal correct bij mix string/number stortingen', () => {
    const deelnemers = [actief('alice', 'Alice'), afgemeld('bob', 'Bob')]
    const txs = [
      stortingStr('s1', 'alice', '30'),
      stortingNum('s2', 'alice', 10),
      stortingStr('s3', 'bob', '20'),
    ]
    const r = berekenEindafrekening(deelnemers, txs, T_SLUIT)
    expect(r.potTotaal).toBe(60)
  })
})

// ── SB-04: Scenario B met alle bedragen als string ────────────────────────────

describe('berekenEindafrekening — SB-04: scenario B volledig als string', () => {
  // Identiek aan scenario B in berekenSaldi.test.js maar alle bedragen als string.
  // Charlie afgemeld: vaste bijdrage €25
  // Resterend actieven: €112 − €25 = €87, factor 87/135 = 0,6444
  // Alice: betaald €56 → nettobijdrage €16,11 → +€39,89
  // Bob:   betaald €24 → nettobijdrage €29,00 → −€5,00
  // David: betaald €32 → nettobijdrage €41,89 → −€9,89

  const deelnemers = [
    actief('alice', 'Alice'),
    actief('bob', 'Bob'),
    afgemeld('charlie', 'Charlie'),
    actief('david', 'David'),
  ]
  const txs = [
    stortingStr('s1', 'alice',   '25'),
    stortingStr('s2', 'bob',     '25'),
    stortingStr('s3', 'bob',     '20'),
    stortingStr('s4', 'charlie', '25'),
    stortingStr('s5', 'david',   '25'),
    stortingStr('s6', 'david',   '40'),
    betalingStr('b1', 'alice',   '24'),
    betalingStr('b2', 'bob',     '24'),
    betalingStr('b3', 'david',   '32'),
    betalingStr('b4', 'alice',   '32'),
  ]

  it('charlie (afgemeld): verrekening ≈ −€25', () => {
    const r = berekenEindafrekening(deelnemers, txs, T_SLUIT)
    expect(r.deelnemersSaldi.find(s => s.id === 'charlie').verrekening).toBeCloseTo(-25, 1)
  })

  it('alice: betaald €56, nettobijdrage €16,11 → +€39,89', () => {
    const r = berekenEindafrekening(deelnemers, txs, T_SLUIT)
    expect(r.deelnemersSaldi.find(s => s.id === 'alice').verrekening).toBeCloseTo(39.89, 1)
  })

  it('bob: betaald €24, nettobijdrage €29,00 → −€5,00', () => {
    const r = berekenEindafrekening(deelnemers, txs, T_SLUIT)
    expect(r.deelnemersSaldi.find(s => s.id === 'bob').verrekening).toBeCloseTo(-5.00, 1)
  })

  it('david: betaald €32, nettobijdrage €41,89 → −€9,89', () => {
    const r = berekenEindafrekening(deelnemers, txs, T_SLUIT)
    expect(r.deelnemersSaldi.find(s => s.id === 'david').verrekening).toBeCloseTo(-9.89, 1)
  })

  it('geen NaN in enig veld', () => {
    const r = berekenEindafrekening(deelnemers, txs, T_SLUIT)
    expect(heeftGeenNaN(r)).toBe(true)
  })

  it('som van verrekenings ≈ 0', () => {
    const r = berekenEindafrekening(deelnemers, txs, T_SLUIT)
    const som = r.deelnemersSaldi.reduce((s, d) => s + d.verrekening, 0)
    expect(Math.abs(som)).toBeLessThan(0.02)
  })
})

// ── SB-05: Scenario C met alle bedragen als string ────────────────────────────

describe('berekenEindafrekening — SB-05: scenario C volledig als string', () => {
  // Identiek aan scenario C in berekenSaldi.test.js maar alle bedragen als string.
  // Bob: −€20, David: −€45. Resterend: €25, factor 25/110 = 0,2273
  // Alice: +€25,45 | Charlie: +€19,77 | Eva: +€19,77

  const deelnemers = [
    actief('alice',   'Alice'),
    afgemeld('bob',   'Bob'),
    actief('charlie', 'Charlie'),
    afgemeld('david', 'David'),
    actief('eva',     'Eva'),
  ]
  const txs = [
    stortingStr('s1', 'alice',   '20'),
    stortingStr('s2', 'bob',     '20'),
    stortingStr('s3', 'charlie', '20'),
    stortingStr('s4', 'charlie', '25'),
    stortingStr('s5', 'david',   '20'),
    stortingStr('s6', 'david',   '25'),
    stortingStr('s7', 'eva',     '20'),
    stortingStr('s8', 'eva',     '25'),
    betalingStr('b1', 'alice',   '30'),
    betalingStr('b2', 'charlie', '30'),
    betalingStr('b3', 'eva',     '30'),
  ]

  it('bob (afgemeld): verrekening ≈ −€20', () => {
    const r = berekenEindafrekening(deelnemers, txs, T_SLUIT)
    expect(r.deelnemersSaldi.find(s => s.id === 'bob').verrekening).toBeCloseTo(-20, 1)
  })

  it('david (afgemeld): verrekening ≈ −€45', () => {
    const r = berekenEindafrekening(deelnemers, txs, T_SLUIT)
    expect(r.deelnemersSaldi.find(s => s.id === 'david').verrekening).toBeCloseTo(-45, 1)
  })

  it('alice: +€25,45', () => {
    const r = berekenEindafrekening(deelnemers, txs, T_SLUIT)
    expect(r.deelnemersSaldi.find(s => s.id === 'alice').verrekening).toBeCloseTo(25.45, 1)
  })

  it('charlie: +€19,77', () => {
    const r = berekenEindafrekening(deelnemers, txs, T_SLUIT)
    expect(r.deelnemersSaldi.find(s => s.id === 'charlie').verrekening).toBeCloseTo(19.77, 1)
  })

  it('geen NaN in enig veld', () => {
    const r = berekenEindafrekening(deelnemers, txs, T_SLUIT)
    expect(heeftGeenNaN(r)).toBe(true)
  })

  it('som van verrekenings ≈ 0', () => {
    const r = berekenEindafrekening(deelnemers, txs, T_SLUIT)
    const som = r.deelnemersSaldi.reduce((s, d) => s + d.verrekening, 0)
    expect(Math.abs(som)).toBeLessThan(0.02)
  })
})

// ── SB-06: Vaste bijdrage afgemelde deelnemer bij stringbedrag = volledige inleg

describe('berekenEindafrekening — SB-06: vaste bijdrage afgemeld bij string', () => {
  it('afgemelde deelnemer: aandeel = gestort (string)', () => {
    const deelnemers = [actief('alice', 'Alice'), afgemeld('bob', 'Bob')]
    const txs = [
      stortingStr('s1', 'alice', '30'),
      stortingStr('s2', 'bob',   '20'),
      betalingStr('b1', 'alice', '25'),
    ]
    const r = berekenEindafrekening(deelnemers, txs, T_SLUIT)
    const bob = r.deelnemersSaldi.find(s => s.id === 'bob')
    expect(bob.aandeel).toBe(bob.gestort) // vaste bijdrage = inleg
    expect(bob.gestort).toBe(20)
  })
})

// ── SB-07: Factor = 0 als actieven niets ingelegd hebben (stringpad) ───────────

describe('berekenEindafrekening — SB-07: factor = 0 bij geen actief ingelegd', () => {
  it('alle inleg door afgemelde deelnemers → factor = 0, actieven verrekening = betaald', () => {
    // Edge case: alleen Bob (afgemeld) heeft ingelegd.
    // Alice (actief) heeft niets ingelegd → totaalIngelegdActieven = 0 → factor = 0
    // Netto Alice = 0. Verrekening Alice = betaald (30) - 0 = +30
    // Netto Bob (afgemeld) = inleg (20). Verrekening Bob = 0 - 20 = -20
    const deelnemers = [actief('alice', 'Alice'), afgemeld('bob', 'Bob')]
    const txs = [
      stortingStr('s1', 'bob',   '20'),
      betalingStr('b1', 'alice', '15'),
    ]
    const r = berekenEindafrekening(deelnemers, txs, T_SLUIT)
    expect(r.deelnemersSaldi.find(s => s.id === 'alice').verrekening).toBeCloseTo(15, 1)
    expect(r.deelnemersSaldi.find(s => s.id === 'bob').verrekening).toBeCloseTo(-20, 1)
    expect(heeftGeenNaN(r)).toBe(true)
  })
})

// ── SB-08: potTotaal correct bij mix string/number in berekenSaldi ────────────

describe('berekenSaldi — SB-08: potTotaal bij mix string/number', () => {
  it('potTotaal = som van alle stortingen ongeacht type (string of number)', () => {
    const deelnemers = [
      { id: 'a', naam: 'Alice', aangemaakt_op: T_AANMELD, actief: true, afgemeld_op: null },
      { id: 'b', naam: 'Bob',   aangemaakt_op: T_AANMELD, actief: false, afgemeld_op: T_AFMELD },
    ]
    const txs = [
      stortingStr('s1', 'a', '30.50'),
      stortingNum('s2', 'a', 10),
      stortingStr('s3', 'b', '20.00'),
    ]
    const r = berekenSaldi(deelnemers, txs)
    expect(r.potTotaal).toBeCloseTo(60.50, 2)
  })
})

// ── SB-09: Geen NaN invariant over alle combinaties ──────────────────────────

describe('berekenEindafrekening — SB-09: NaN-invariant over randgevallen', () => {
  it('één actief, één afgemeld, string decimal bedragen met komma-notatie in Number()', () => {
    // Number('25.50') = 25.5 ✓. Number('25,50') = NaN ✗
    // Supabase levert altijd punt-notatie — dit test dat de code niet per ongeluk
    // komma-notatie verwerkt (dat is de taak van parseBedrag, niet berekenSaldi)
    const deelnemers = [actief('a', 'A'), afgemeld('b', 'B')]
    const txs = [
      stortingStr('s1', 'a', '25.50'), // Supabase-formaat: punt
      stortingStr('s2', 'b', '10.00'),
      betalingStr('b1', 'a', '15.75'),
    ]
    const r = berekenEindafrekening(deelnemers, txs, T_SLUIT)
    expect(heeftGeenNaN(r)).toBe(true)
    expect(r.potTotaal).toBeCloseTo(35.50, 2)
  })

  it('stringbedrag "0" voor afgemelde deelnemer → bijdrage 0, verrekening 0', () => {
    const deelnemers = [actief('a', 'A'), afgemeld('b', 'B')]
    const txs = [
      stortingStr('s1', 'a',  '30'),
      stortingStr('s2', 'b',  '0'),   // afgemeld met inleg = 0 (edge case)
      betalingStr('b1', 'a',  '20'),
    ]
    const r = berekenEindafrekening(deelnemers, txs, T_SLUIT)
    expect(r.deelnemersSaldi.find(s => s.id === 'b').verrekening).toBe(0)
    expect(heeftGeenNaN(r)).toBe(true)
  })
})
