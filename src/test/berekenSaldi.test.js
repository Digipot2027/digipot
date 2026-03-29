import { describe, it, expect } from 'vitest'
import { berekenSaldi, berekenEindafrekening } from '../utils/berekenSaldi'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const maakDeelnemer = (id, actief = true) => ({
  id,
  naam: `Deelnemer ${id}`,
  aangemaakt_op: new Date(2026, 0, 1, 18, 0).toISOString(),
  actief,
  afgemeld_op: null,
})

const maakAfgemeld = (id) => ({
  id,
  naam: `Deelnemer ${id}`,
  aangemaakt_op: new Date(2026, 0, 1, 18, 0).toISOString(),
  actief: false,
  afgemeld_op: new Date(2026, 0, 1, 19, 0).toISOString(),
})

const storting = (id, deelnemer_id, bedrag) => ({
  id,
  type: 'storting',
  deelnemer_id,
  bedrag,
  aangemaakt_op: new Date(2026, 0, 1, 18, 5).toISOString(),
})

const betaling = (id, deelnemer_id, bedrag) => ({
  id,
  type: 'betaling',
  deelnemer_id,
  bedrag,
  aangemaakt_op: new Date(2026, 0, 1, 18, 30).toISOString(),
})

// ─── berekenSaldi: lege input ─────────────────────────────────────────────────

describe('berekenSaldi — lege input', () => {
  it('geeft nullwaarden bij geen deelnemers', () => {
    const r = berekenSaldi([], [])
    expect(r.potTotaal).toBe(0)
    expect(r.potUitgaven).toBe(0)
    expect(r.potSaldo).toBe(0)
    expect(r.deelnemersSaldi).toEqual([])
  })

  it('geeft nullwaarden bij null deelnemers', () => {
    const r = berekenSaldi(null, [])
    expect(r.potTotaal).toBe(0)
    expect(r.deelnemersSaldi).toEqual([])
  })

  it('geeft nullwaarden zonder transacties', () => {
    const r = berekenSaldi([maakDeelnemer('a')], [])
    expect(r.potTotaal).toBe(0)
    expect(r.potSaldo).toBe(0)
    const s = r.deelnemersSaldi[0]
    expect(s.gestort).toBe(0)
    expect(s.betaald).toBe(0)
    expect(s.verrekening).toBe(0)
  })
})

// ─── berekenSaldi: pot-totalen ────────────────────────────────────────────────

describe('berekenSaldi — pot-totalen', () => {
  it('berekent potTotaal correct', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a')],
      [storting('t1', 'a', 20), storting('t2', 'a', 30)]
    )
    expect(r.potTotaal).toBe(50)
  })

  it('berekent potUitgaven correct', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a')],
      [storting('t1', 'a', 50), betaling('t2', 'a', 10)]
    )
    expect(r.potUitgaven).toBe(10)
  })

  it('berekent potSaldo correct', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a')],
      [storting('t1', 'a', 50), betaling('t2', 'a', 10)]
    )
    expect(r.potSaldo).toBe(40)
  })
})

// ─── berekenSaldi: gestort en betaald per deelnemer ───────────────────────────

describe('berekenSaldi — gestort en betaald per deelnemer', () => {
  it('registreert gestort per deelnemer', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a'), maakDeelnemer('b')],
      [storting('t1', 'a', 20), storting('t2', 'b', 30)]
    )
    expect(r.deelnemersSaldi.find(s => s.id === 'a').gestort).toBe(20)
    expect(r.deelnemersSaldi.find(s => s.id === 'b').gestort).toBe(30)
  })

  it('telt meerdere stortingen per deelnemer op', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a')],
      [storting('t1', 'a', 10), storting('t2', 'a', 20)]
    )
    expect(r.deelnemersSaldi[0].gestort).toBe(30)
  })

  it('registreert betaald per deelnemer', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a'), maakDeelnemer('b')],
      [storting('t1', 'a', 50), betaling('t2', 'a', 10), betaling('t3', 'b', 15)]
    )
    expect(r.deelnemersSaldi.find(s => s.id === 'a').betaald).toBe(10)
    expect(r.deelnemersSaldi.find(s => s.id === 'b').betaald).toBe(15)
  })

  it('geeft 0 betaald als deelnemer niets heeft voorgeschoten', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a'), maakDeelnemer('b')],
      [storting('t1', 'a', 50), betaling('t2', 'a', 10)]
    )
    expect(r.deelnemersSaldi.find(s => s.id === 'b').betaald).toBe(0)
  })
})

// ─── berekenSaldi: verrekening = betaald − aandeel ───────────────────────────

describe('berekenSaldi — verrekening', () => {
  it('verrekening = betaald − ingelegd (positief: ontvangt)', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a')],
      [storting('t1', 'a', 20), betaling('t2', 'a', 30)]
    )
    expect(r.deelnemersSaldi[0].verrekening).toBe(10)
  })

  it('verrekening = betaald − ingelegd (negatief: betaalt bij)', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a')],
      [storting('t1', 'a', 20)]
    )
    expect(r.deelnemersSaldi[0].verrekening).toBe(-20)
  })

  it('verrekening is 0 als betaald gelijk is aan ingelegd', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a')],
      [storting('t1', 'a', 50), betaling('t2', 'a', 50)]
    )
    expect(r.deelnemersSaldi[0].verrekening).toBe(0)
  })

  it('verrekening nooit lager dan −ingelegd (cap)', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a')],
      [storting('t1', 'a', 10)]
    )
    expect(r.deelnemersSaldi[0].verrekening).toBeGreaterThanOrEqual(-10)
  })
})

// ─── berekenEindafrekening: lege input ───────────────────────────────────────

describe('berekenEindafrekening — lege input', () => {
  it('geeft nullwaarden bij geen deelnemers', () => {
    const r = berekenEindafrekening([], [])
    expect(r.potTotaal).toBe(0)
    expect(r.deelnemersSaldi).toEqual([])
  })

  it('geeft nullwaarden bij null deelnemers', () => {
    const r = berekenEindafrekening(null, [])
    expect(r.potTotaal).toBe(0)
    expect(r.deelnemersSaldi).toEqual([])
  })
})

// ─── berekenEindafrekening: scenario A — niemand afgemeld ────────────────────
// Alice:   ingelegd €25, betaald €36 → factor 0,700 → nettobijdrage €17,50 → +€18,50
// Bob:     ingelegd €35, betaald €20 → nettobijdrage €24,50 → −€4,50
// Charlie: ingelegd €45, betaald €20 → nettobijdrage €31,50 → −€11,50
// David:   ingelegd €55, betaald €36 → nettobijdrage €38,50 → −€2,50

describe('berekenEindafrekening — scenario A: vier deelnemers, niemand afgemeld', () => {
  const deelnemers = [
    maakDeelnemer('alice'),
    maakDeelnemer('bob'),
    maakDeelnemer('charlie'),
    maakDeelnemer('david'),
  ]
  const txs = [
    storting('s1', 'alice', 15), storting('s2', 'alice', 10),
    storting('s3', 'bob', 15),   storting('s4', 'bob', 20),
    storting('s5', 'charlie', 15), storting('s6', 'charlie', 30),
    storting('s7', 'david', 15),  storting('s8', 'david', 40),
    betaling('b1', 'bob', 20),
    betaling('b2', 'charlie', 20),
    betaling('b3', 'david', 36),
    betaling('b4', 'alice', 36),
  ]

  it('potTotaal = €160, potUitgaven = €112', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    expect(r.potTotaal).toBe(160)
    expect(r.potUitgaven).toBe(112)
  })

  it('alice: betaald €36, nettobijdrage €17,50 → +€18,50', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    expect(r.deelnemersSaldi.find(s => s.id === 'alice').verrekening).toBeCloseTo(18.50, 1)
  })

  it('bob: betaald €20, nettobijdrage €24,50 → −€4,50', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    expect(r.deelnemersSaldi.find(s => s.id === 'bob').verrekening).toBeCloseTo(-4.50, 1)
  })

  it('charlie: betaald €20, nettobijdrage €31,50 → −€11,50', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    expect(r.deelnemersSaldi.find(s => s.id === 'charlie').verrekening).toBeCloseTo(-11.50, 1)
  })

  it('david: betaald €36, nettobijdrage €38,50 → −€2,50', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    expect(r.deelnemersSaldi.find(s => s.id === 'david').verrekening).toBeCloseTo(-2.50, 1)
  })

  it('som van verrekenings is netto nul (max 1 cent afronding)', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    const som = r.deelnemersSaldi.reduce((s, d) => s + d.verrekening, 0)
    expect(Math.abs(som)).toBeLessThan(0.02)
  })
})

// ─── berekenEindafrekening: scenario B — één afgemeld ────────────────────────
// Charlie afgemeld: vaste bijdrage €25
// Resterend voor actieven: €112 − €25 = €87, factor 87/135 = 0,6444
// Alice: betaald €56 → nettobijdrage €16,11 → +€39,89
// Bob:   betaald €24 → nettobijdrage €29,00 → −€5,00
// David: betaald €32 → nettobijdrage €41,89 → −€9,89

describe('berekenEindafrekening — scenario B: vier deelnemers, één afgemeld', () => {
  const deelnemers = [
    maakDeelnemer('alice'),
    maakDeelnemer('bob'),
    maakAfgemeld('charlie'),
    maakDeelnemer('david'),
  ]
  const txs = [
    storting('s1', 'alice', 25),
    storting('s2', 'bob', 25), storting('s3', 'bob', 20),
    storting('s4', 'charlie', 25),
    storting('s5', 'david', 25), storting('s6', 'david', 40),
    betaling('b1', 'alice', 24),
    betaling('b2', 'bob', 24),
    betaling('b3', 'david', 32),
    betaling('b4', 'alice', 32),
  ]

  it('charlie (afgemeld): verrekening = −€25 (volledige inleg)', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    expect(r.deelnemersSaldi.find(s => s.id === 'charlie').verrekening).toBeCloseTo(-25, 1)
  })

  it('alice: betaald €56, nettobijdrage €16,11 → +€39,89', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    expect(r.deelnemersSaldi.find(s => s.id === 'alice').verrekening).toBeCloseTo(39.89, 1)
  })

  it('bob: betaald €24, nettobijdrage €29,00 → −€5,00', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    expect(r.deelnemersSaldi.find(s => s.id === 'bob').verrekening).toBeCloseTo(-5.00, 1)
  })

  it('david: betaald €32, nettobijdrage €41,89 → −€9,89', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    expect(r.deelnemersSaldi.find(s => s.id === 'david').verrekening).toBeCloseTo(-9.89, 1)
  })

  it('som van verrekenings is netto nul (max 1 cent afronding)', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    const som = r.deelnemersSaldi.reduce((s, d) => s + d.verrekening, 0)
    expect(Math.abs(som)).toBeLessThan(0.02)
  })
})

// ─── berekenEindafrekening: scenario C — twee afgemeld ───────────────────────
// Bob: −€20, David: −€45. Resterend: €25, factor 25/110 = 0,2273
// Alice: +€25,45 | Charlie: +€19,77 | Eva: +€19,77

describe('berekenEindafrekening — scenario C: vijf deelnemers, twee afgemeld', () => {
  const deelnemers = [
    maakDeelnemer('alice'),
    maakAfgemeld('bob'),
    maakDeelnemer('charlie'),
    maakAfgemeld('david'),
    maakDeelnemer('eva'),
  ]
  const txs = [
    storting('s1', 'alice', 20),
    storting('s2', 'bob', 20),
    storting('s3', 'charlie', 20), storting('s4', 'charlie', 25),
    storting('s5', 'david', 20),  storting('s6', 'david', 25),
    storting('s7', 'eva', 20),    storting('s8', 'eva', 25),
    betaling('b1', 'alice', 30),
    betaling('b2', 'charlie', 30),
    betaling('b3', 'eva', 30),
  ]

  it('bob (afgemeld): verrekening = −€20', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    expect(r.deelnemersSaldi.find(s => s.id === 'bob').verrekening).toBeCloseTo(-20, 1)
  })

  it('david (afgemeld): verrekening = −€45', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    expect(r.deelnemersSaldi.find(s => s.id === 'david').verrekening).toBeCloseTo(-45, 1)
  })

  it('alice: betaald €30, nettobijdrage €4,55 → +€25,45', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    expect(r.deelnemersSaldi.find(s => s.id === 'alice').verrekening).toBeCloseTo(25.45, 1)
  })

  it('charlie: betaald €30, nettobijdrage €10,23 → +€19,77', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    expect(r.deelnemersSaldi.find(s => s.id === 'charlie').verrekening).toBeCloseTo(19.77, 1)
  })

  it('eva: betaald €30, nettobijdrage €10,23 → +€19,77', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    expect(r.deelnemersSaldi.find(s => s.id === 'eva').verrekening).toBeCloseTo(19.77, 1)
  })

  it('som van verrekenings is netto nul (max 1 cent afronding)', () => {
    const r = berekenEindafrekening(deelnemers, txs)
    const som = r.deelnemersSaldi.reduce((s, d) => s + d.verrekening, 0)
    expect(Math.abs(som)).toBeLessThan(0.02)
  })
})

// ─── berekenEindafrekening: cap ───────────────────────────────────────────────

describe('berekenEindafrekening — cap: nooit meer bijbetalen dan ingelegd', () => {
  it('verrekening nooit lager dan −ingelegd', () => {
    const deelnemers = [maakDeelnemer('a'), maakDeelnemer('b')]
    const txs = [
      storting('s1', 'a', 10),
      storting('s2', 'b', 50),
      betaling('b1', 'b', 55),
    ]
    const r = berekenEindafrekening(deelnemers, txs)
    r.deelnemersSaldi.forEach(s => {
      expect(s.verrekening).toBeGreaterThanOrEqual(-s.gestort)
    })
  })

  it('tekort verdwijnt — wordt niet doorgeschoven naar anderen', () => {
    const deelnemers = [maakDeelnemer('a'), maakDeelnemer('b')]
    const txs = [
      storting('s1', 'a', 5),
      storting('s2', 'b', 50),
      betaling('b1', 'b', 50),
    ]
    const r = berekenEindafrekening(deelnemers, txs)
    const sa = r.deelnemersSaldi.find(s => s.id === 'a')
    expect(sa.verrekening).toBeGreaterThanOrEqual(-sa.gestort)
    expect(sa.verrekening).toBeLessThanOrEqual(0)
  })
})
