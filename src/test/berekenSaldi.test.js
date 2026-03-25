import { describe, it, expect } from 'vitest'
import { berekenSaldi, berekenEindafrekening } from '../utils/berekenSaldi'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    expect(s.aandeel).toBe(0)
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
  // Scenario 1: één betaalt alles, A=€30, 3 actief → aandeel €10 p.p.
  // A: betaald=30, aandeel=10 → +20
  // B: betaald=0,  aandeel=10 → -10
  // C: betaald=0,  aandeel=10 → -10
  it('scenario 1: één betaalt alles', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a'), maakDeelnemer('b'), maakDeelnemer('c')],
      [
        storting('t1', 'a', 20), storting('t2', 'b', 15), storting('t3', 'c', 10),
        betaling('t4', 'a', 30, 15),
      ]
    )
    expect(r.deelnemersSaldi.find(s => s.id === 'a').verrekening).toBe(20)
    expect(r.deelnemersSaldi.find(s => s.id === 'b').verrekening).toBe(-10)
    expect(r.deelnemersSaldi.find(s => s.id === 'c').verrekening).toBe(-10)
  })

  it('verrekening is 0 als betaald gelijk is aan aandeel', () => {
    // A betaalt €20, 2 actief → €10 p.p.
    // A: betaald=20, aandeel=10 → +10
    // B: betaald=0,  aandeel=10 → -10
    // Als B ook €10 betaalt:
    // A: betaald=20, aandeel=20 → 0
    // B: betaald=10, aandeel=20 → -10  ← nee, dit klopt niet
    // Simpelste geval: één deelnemer, betaalt precies zijn aandeel
    const r = berekenSaldi(
      [maakDeelnemer('a')],
      [storting('t1', 'a', 50), betaling('t2', 'a', 50)]
    )
    expect(r.deelnemersSaldi[0].verrekening).toBe(0)
  })
})

// ─── berekenSaldi: tijdgebaseerde verdeling ───────────────────────────────────

describe('berekenSaldi — tijdgebaseerde verdeling', () => {
  // Scenario 2: gespreid aanmelden
  // 18:00 A aangemeld, 18:05 A stort €25
  // 18:15 A betaalt €20 (alleen A actief → €20 voor A)
  // 18:30 B aangemeld, 18:35 B stort €15
  // 18:45 A betaalt €20 (A en B actief → €10 p.p.)
  // A: betaald=40, aandeel=30 → +10
  // B: betaald=0,  aandeel=10 → -10
  it('scenario 2: late deelnemer telt niet mee bij eerdere betaling', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a', 0), maakDeelnemer('b', 30)],
      [
        storting('t1', 'a', 25, 5),
        betaling('t2', 'a', 20, 15),
        storting('t3', 'b', 15, 35),
        betaling('t4', 'a', 20, 45),
      ]
    )
    expect(r.deelnemersSaldi.find(s => s.id === 'a').verrekening).toBe(10)
    expect(r.deelnemersSaldi.find(s => s.id === 'b').verrekening).toBe(-10)
  })

  it('deelnemer die tegelijk met betaling instapt telt mee', () => {
    // a op minuut 0, b op minuut 20, betaling ook op minuut 20 → b telt mee
    const r = berekenSaldi(
      [maakDeelnemer('a', 0), maakDeelnemer('b', 20)],
      [storting('t1', 'a', 100), betaling('t2', 'a', 20, 20)]
    )
    expect(r.deelnemersSaldi.find(s => s.id === 'a').aandeel).toBe(10)
    expect(r.deelnemersSaldi.find(s => s.id === 'b').aandeel).toBe(10)
  })
})

// ─── berekenSaldi: afmelden ───────────────────────────────────────────────────

describe('berekenSaldi — afgemelde deelnemers', () => {
  // Scenario 3: afmelding vóór betaling
  // A, B, C aangemeld op minuut 0
  // Minuut 15: B meldt af
  // Minuut 20: A betaalt €30 (alleen A en C actief → €15 p.p.)
  // A: betaald=30, aandeel=15 → +15
  // B: betaald=0,  aandeel=0  → 0 (was al afgemeld)
  // C: betaald=0,  aandeel=15 → -15
  it('scenario 3: afgemelde deelnemer telt niet mee bij betaling na afmelding', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a', 0), maakAfgemeld('b', 0, 15), maakDeelnemer('c', 0)],
      [
        storting('t1', 'a', 20), storting('t2', 'b', 20), storting('t3', 'c', 20),
        betaling('t4', 'a', 30, 20),
      ]
    )
    expect(r.deelnemersSaldi.find(s => s.id === 'a').verrekening).toBe(15)
    expect(r.deelnemersSaldi.find(s => s.id === 'b').verrekening).toBe(0)
    expect(r.deelnemersSaldi.find(s => s.id === 'c').verrekening).toBe(-15)
  })

  // Scenario 4: afmelding tussen twee betalingen
  // A, B aangemeld op minuut 0, A stort €5, B stort €5
  // Minuut 15: A betaalt €8 (2 actief → €4 p.p.)
  // Minuut 30: B meldt af
  // Minuut 45: A betaalt €2 (alleen A actief → €2 voor A)
  // A: betaald=10, aandeel=6 → +4
  // B: betaald=0,  aandeel=4 → -4
  it('scenario 4: afmelding tussen twee betalingen', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a', 0), maakAfgemeld('b', 0, 30)],
      [
        storting('t1', 'a', 5), storting('t2', 'b', 5),
        betaling('t3', 'a', 8, 15),
        betaling('t4', 'a', 2, 45),
      ]
    )
    expect(r.deelnemersSaldi.find(s => s.id === 'a').verrekening).toBe(4)
    expect(r.deelnemersSaldi.find(s => s.id === 'b').verrekening).toBe(-4)
  })

  it('afgemelde deelnemer telt nog mee bij betaling vóór afmelding', () => {
    // b afgemeld op minuut 25, betaling op minuut 20 → b telt nog mee
    const r = berekenSaldi(
      [maakDeelnemer('a', 0), maakAfgemeld('b', 0, 25)],
      [storting('t1', 'a', 100), betaling('t2', 'a', 60, 20)]
    )
    expect(r.deelnemersSaldi.find(s => s.id === 'a').aandeel).toBe(30)
    expect(r.deelnemersSaldi.find(s => s.id === 'b').aandeel).toBe(30)
  })

  it('deelnemer met actief=false en geen afgemeld_op telt nooit mee', () => {
    const r = berekenSaldi(
      [maakDeelnemer('a', 0), maakDeelnemer('b', 0, false, null)],
      [storting('t1', 'a', 100), betaling('t2', 'a', 60, 20)]
    )
    expect(r.deelnemersSaldi.find(s => s.id === 'b').aandeel).toBe(0)
  })
})

// ─── berekenSaldi: centcorrectie ──────────────────────────────────────────────

describe('berekenSaldi — centcorrectie', () => {
  it('totale aandelen zijn gelijk aan het betaalde bedrag (geen centenverlies)', () => {
    // €10 over 3 personen = €3,33 + €3,33 + €3,34
    const r = berekenSaldi(
      [maakDeelnemer('a', 0), maakDeelnemer('b', 0), maakDeelnemer('c', 0)],
      [storting('t1', 'a', 100), betaling('t2', 'a', 10, 20)]
    )
    const totaal = r.deelnemersSaldi.reduce((sum, s) => sum + s.aandeel, 0)
    expect(Math.round(totaal * 100) / 100).toBe(10)
  })
})

// ─── berekenEindafrekening ────────────────────────────────────────────────────

describe('berekenEindafrekening — basisregels', () => {
  it('geeft zelfde resultaat als berekenSaldi als iedereen actief is', () => {
    // Beide deelnemers storten én betalen zodat gestort > 0 voor beiden
    const deelnemers = [maakDeelnemer('a'), maakDeelnemer('b')]
    const txs = [
      storting('t1', 'a', 30), storting('t2', 'b', 30),
      betaling('t3', 'a', 40), // A betaalt €40, 2 actief → €20 p.p.
      // A: betaald=40, aandeel=20 → +20
      // B: betaald=0,  aandeel=20 → -20
    ]
    const basis = berekenSaldi(deelnemers, txs)
    const eind = berekenEindafrekening(deelnemers, txs)
    basis.deelnemersSaldi.forEach((bs, i) => {
      expect(eind.deelnemersSaldi[i].verrekening).toBeCloseTo(bs.verrekening, 5)
    })
  })

  // Scenario 3 eindafrekening: B afgemeld vóór betaling → aandeel B = 0 → verrekening B = +gestort
  it('afgemelde deelnemer zonder aandeel heeft verrekening 0 (betaald=0, aandeel=0)', () => {
    // B meldt af vóór betaling → aandeel=0, betaald=0 → verrekening = 0-0 = 0
    // De inleg (gestort) staat los van de verrekening — verrekening = betaald - aandeel
    const deelnemers = [
      maakDeelnemer('a', 0),
      maakAfgemeld('b', 0, 15),
      maakDeelnemer('c', 0),
    ]
    const txs = [
      storting('t1', 'a', 20), storting('t2', 'b', 20), storting('t3', 'c', 20),
      betaling('t4', 'a', 30, 20),
    ]
    const eind = berekenEindafrekening(deelnemers, txs)
    const sb = eind.deelnemersSaldi.find(s => s.id === 'b')
    // verrekening = betaald(0) - aandeel(0) = 0
    expect(sb.verrekening).toBe(0)
    // gestort staat in sb.gestort maar telt niet mee in verrekening
    expect(sb.gestort).toBe(20)
    expect(sb.aandeel).toBe(0)
  })

  it('verrekening nooit lager dan −gestort (cap als vangnet)', () => {
    // Kunstmatig scenario via directe data (V2 zou dit blokkeren in de app)
    const deelnemers = [maakDeelnemer('a'), maakDeelnemer('b')]
    const txs = [
      storting('t1', 'a', 5), storting('t2', 'b', 5),
      betaling('t3', 'a', 50), // overschrijdt saldo — V2 blokkeert dit normaal
    ]
    const eind = berekenEindafrekening(deelnemers, txs)
    eind.deelnemersSaldi.forEach(s => {
      expect(s.verrekening).toBeGreaterThanOrEqual(-s.gestort)
    })
  })
})

describe('berekenEindafrekening — scenario 5: iedereen afgemeld', () => {
  // A stort €5, B stort €5
  // A betaalt €8 (2 actief → €4 p.p.)
  // A en B melden af
  // A: betaald=8, aandeel=4 → +4
  // B: betaald=0, aandeel=4 → -4
  // Geen actieve deelnemers → tekorten verdwijnen niet (in dit geval geen cap nodig)
  it('scenario 5: iedereen afgemeld, tekorten verdwijnen niet als cap niet bijt', () => {
    const deelnemers = [maakAfgemeld('a', 0, 30), maakAfgemeld('b', 0, 30)]
    const txs = [
      storting('t1', 'a', 5), storting('t2', 'b', 5),
      betaling('t3', 'a', 8, 15),
    ]
    const eind = berekenEindafrekening(deelnemers, txs)
    expect(eind.deelnemersSaldi.find(s => s.id === 'a').verrekening).toBe(4)
    expect(eind.deelnemersSaldi.find(s => s.id === 'b').verrekening).toBe(-4)
  })

  it('geen actieve deelnemers: tekort door cap verdwijnt', () => {
    // Cap bijt bij b (gestort=2, aandeel=10 → verrekening=-8 → cap=-2, tekort=6)
    // Geen actieve deelnemers → tekort verdwijnt
    const deelnemers = [maakAfgemeld('a', 0, 30), maakAfgemeld('b', 0, 30)]
    const txs = [
      storting('t1', 'a', 50),
      storting('t2', 'b', 2),
      betaling('t3', 'a', 20, 15), // vóór afmelding op minuut 30
    ]
    const eind = berekenEindafrekening(deelnemers, txs)
    const sb = eind.deelnemersSaldi.find(s => s.id === 'b')
    // b: betaald=0, aandeel=10, verrekening=-10, cap=-2
    expect(sb.verrekening).toBe(-2)
    // tekort van 8 verdwijnt → geen actieve deelnemers om op te vangen
  })
})

describe('berekenEindafrekening — centcorrectie eindsom', () => {
  it('som van verrekenings is gelijk aan totaal betaald minus totaal aandeel (netto nul)', () => {
    // verrekening = betaald - aandeel, som over alle deelnemers = 0
    // want totaal betaald = totaal aandeel (elke betaling wordt volledig verdeeld)
    const deelnemers = [
      maakDeelnemer('a', 0),
      maakDeelnemer('b', 0),
      maakAfgemeld('c', 0, 10),
    ]
    const txs = [
      storting('t1', 'a', 30), storting('t2', 'b', 30), storting('t3', 'c', 10),
      betaling('t4', 'a', 20, 15), // na afmelding c → alleen A en B actief → €10 p.p.
    ]
    const eind = berekenEindafrekening(deelnemers, txs)
    const som = Math.round(
      eind.deelnemersSaldi.reduce((s, d) => s + d.verrekening, 0) * 100
    ) / 100
    // Som van verrekenings = som(betaald) - som(aandeel) = 20 - 20 = 0
    expect(som).toBeCloseTo(0, 1)
  })
})
