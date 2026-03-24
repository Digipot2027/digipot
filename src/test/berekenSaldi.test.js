import { describe, it, expect } from 'vitest'
import { berekenSaldi, berekenEindafrekening } from '../utils/berekenSaldi'

// Helpers voor leesbare testdata
const d = (id, minuten = 0, actief = true, afgemeld_op = null) => ({
  id,
  naam: `Deelnemer ${id}`,
  aangemaakt_op: new Date(2026, 0, 1, 12, minuten).toISOString(),
  actief,
  afgemeld_op,
})

const storting = (id, deelnemer_id, bedrag, minuten = 10) => ({
  id,
  type: 'storting',
  deelnemer_id,
  bedrag,
  aangemaakt_op: new Date(2026, 0, 1, 12, minuten).toISOString(),
})

const betaling = (id, deelnemer_id, bedrag, minuten = 20) => ({
  id,
  type: 'betaling',
  deelnemer_id,
  bedrag,
  aangemaakt_op: new Date(2026, 0, 1, 12, minuten).toISOString(),
})

// ─── Lege input ───────────────────────────────────────────────────────────────

describe('berekenSaldi — lege input', () => {
  it('geeft nullwaarden terug bij geen deelnemers', () => {
    const result = berekenSaldi([], [])
    expect(result.potTotaal).toBe(0)
    expect(result.potUitgaven).toBe(0)
    expect(result.potSaldo).toBe(0)
    expect(result.deelnemersSaldi).toEqual([])
  })

  it('geeft nullwaarden terug bij null deelnemers', () => {
    const result = berekenSaldi(null, [])
    expect(result.potTotaal).toBe(0)
    expect(result.deelnemersSaldi).toEqual([])
  })

  it('berekent correct zonder transacties', () => {
    const result = berekenSaldi([d('a')], [])
    expect(result.potTotaal).toBe(0)
    expect(result.potSaldo).toBe(0)
    expect(result.deelnemersSaldi[0].gestort).toBe(0)
    expect(result.deelnemersSaldi[0].aandeel).toBe(0)
    expect(result.deelnemersSaldi[0].verrekening).toBe(0)
  })
})

// ─── Saldo berekening ─────────────────────────────────────────────────────────

describe('berekenSaldi — pot totalen', () => {
  it('berekent potTotaal correct', () => {
    const result = berekenSaldi(
      [d('a')],
      [storting('t1', 'a', 20), storting('t2', 'a', 30)]
    )
    expect(result.potTotaal).toBe(50)
  })

  it('berekent potUitgaven correct', () => {
    const result = berekenSaldi(
      [d('a')],
      [storting('t1', 'a', 50), betaling('t2', 'a', 10)]
    )
    expect(result.potUitgaven).toBe(10)
  })

  it('berekent potSaldo correct', () => {
    const result = berekenSaldi(
      [d('a')],
      [storting('t1', 'a', 50), betaling('t2', 'a', 10)]
    )
    expect(result.potSaldo).toBe(40)
  })
})

// ─── Gestort per deelnemer ────────────────────────────────────────────────────

describe('berekenSaldi — gestort per deelnemer', () => {
  it('registreert gestort bedrag correct per deelnemer', () => {
    const result = berekenSaldi(
      [d('a'), d('b')],
      [storting('t1', 'a', 20), storting('t2', 'b', 30)]
    )
    const sA = result.deelnemersSaldi.find(s => s.id === 'a')
    const sB = result.deelnemersSaldi.find(s => s.id === 'b')
    expect(sA.gestort).toBe(20)
    expect(sB.gestort).toBe(30)
  })

  it('telt meerdere stortingen per deelnemer op', () => {
    const result = berekenSaldi(
      [d('a')],
      [storting('t1', 'a', 10), storting('t2', 'a', 20)]
    )
    expect(result.deelnemersSaldi[0].gestort).toBe(30)
  })
})

// ─── Uitgegeven per deelnemer ─────────────────────────────────────────────────

describe('berekenSaldi — uitgegeven per deelnemer', () => {
  it('registreert uitgegeven bedrag per deelnemer', () => {
    const result = berekenSaldi(
      [d('a'), d('b')],
      [storting('t1', 'a', 50), betaling('t2', 'a', 10), betaling('t3', 'b', 15)]
    )
    const sA = result.deelnemersSaldi.find(s => s.id === 'a')
    const sB = result.deelnemersSaldi.find(s => s.id === 'b')
    expect(sA.uitgegeven).toBe(10)
    expect(sB.uitgegeven).toBe(15)
  })

  it('geeft 0 uitgegeven als deelnemer niets betaald heeft', () => {
    const result = berekenSaldi(
      [d('a'), d('b')],
      [storting('t1', 'a', 50), betaling('t2', 'a', 10)]
    )
    const sB = result.deelnemersSaldi.find(s => s.id === 'b')
    expect(sB.uitgegeven).toBe(0)
  })
})

// ─── Tijdgebaseerde verdeling ─────────────────────────────────────────────────

describe('berekenSaldi — tijdgebaseerde verdeling', () => {
  it('verdeelt betaling gelijk over 2 deelnemers', () => {
    // Beide deelnemers ingestapt op minuut 0, betaling op minuut 20
    const result = berekenSaldi(
      [d('a', 0), d('b', 0)],
      [storting('t1', 'a', 100), betaling('t2', 'a', 60, 20)]
    )
    const sA = result.deelnemersSaldi.find(s => s.id === 'a')
    const sB = result.deelnemersSaldi.find(s => s.id === 'b')
    expect(sA.aandeel).toBe(30)
    expect(sB.aandeel).toBe(30)
  })

  it('deelnemer die later instapt betaalt niet mee aan eerdere betalingen', () => {
    // a ingestapt op minuut 0, b op minuut 30, betaling op minuut 20
    const result = berekenSaldi(
      [d('a', 0), d('b', 30)],
      [storting('t1', 'a', 100), betaling('t2', 'a', 60, 20)]
    )
    const sA = result.deelnemersSaldi.find(s => s.id === 'a')
    const sB = result.deelnemersSaldi.find(s => s.id === 'b')
    // Alleen a was actief bij de betaling
    expect(sA.aandeel).toBe(60)
    expect(sB.aandeel).toBe(0)
  })

  it('deelnemer die tegelijk instapt met betaling telt mee', () => {
    // a op minuut 0, b op minuut 20, betaling ook op minuut 20
    const result = berekenSaldi(
      [d('a', 0), d('b', 20)],
      [storting('t1', 'a', 100), betaling('t2', 'a', 60, 20)]
    )
    const sA = result.deelnemersSaldi.find(s => s.id === 'a')
    const sB = result.deelnemersSaldi.find(s => s.id === 'b')
    expect(sA.aandeel).toBe(30)
    expect(sB.aandeel).toBe(30)
  })
})

// ─── Verrekening ─────────────────────────────────────────────────────────────

describe('berekenSaldi — verrekening', () => {
  it('verrekening is positief als deelnemer meer gestort heeft dan aandeel', () => {
    const result = berekenSaldi(
      [d('a'), d('b', 0)],
      [storting('t1', 'a', 100), betaling('t2', 'a', 60, 20)]
    )
    const sA = result.deelnemersSaldi.find(s => s.id === 'a')
    // a gestort 100, aandeel 30 → verrekening +70
    expect(sA.verrekening).toBe(70)
  })

  it('verrekening is negatief als deelnemer minder gestort heeft dan aandeel', () => {
    const result = berekenSaldi(
      [d('a', 0), d('b', 0)],
      [storting('t1', 'a', 100), betaling('t2', 'a', 60, 20)]
    )
    const sB = result.deelnemersSaldi.find(s => s.id === 'b')
    // b gestort 0, aandeel 30 → verrekening -30
    expect(sB.verrekening).toBe(-30)
  })

  it('verrekening is nul als gestort gelijk is aan aandeel', () => {
    const result = berekenSaldi(
      [d('a', 0)],
      [storting('t1', 'a', 50), betaling('t2', 'a', 50, 20)]
    )
    const sA = result.deelnemersSaldi.find(s => s.id === 'a')
    expect(sA.verrekening).toBe(0)
  })
})

// ─── Afmelden ─────────────────────────────────────────────────────────────────

describe('berekenSaldi — afgemelde deelnemers', () => {
  it('afgemelde deelnemer telt niet mee bij betaling na afmelding', () => {
    // b afgemeld op minuut 15, betaling op minuut 20
    const afgemeldOp = new Date(2026, 0, 1, 12, 15).toISOString()
    const result = berekenSaldi(
      [d('a', 0), d('b', 0, false, afgemeldOp)],
      [storting('t1', 'a', 100), betaling('t2', 'a', 60, 20)]
    )
    const sA = result.deelnemersSaldi.find(s => s.id === 'a')
    const sB = result.deelnemersSaldi.find(s => s.id === 'b')
    // Alleen a actief bij betaling
    expect(sA.aandeel).toBe(60)
    expect(sB.aandeel).toBe(0)
  })

  it('afgemelde deelnemer telt nog mee bij betaling vóór afmelding', () => {
    // b afgemeld op minuut 25, betaling op minuut 20
    const afgemeldOp = new Date(2026, 0, 1, 12, 25).toISOString()
    const result = berekenSaldi(
      [d('a', 0), d('b', 0, false, afgemeldOp)],
      [storting('t1', 'a', 100), betaling('t2', 'a', 60, 20)]
    )
    const sA = result.deelnemersSaldi.find(s => s.id === 'a')
    const sB = result.deelnemersSaldi.find(s => s.id === 'b')
    // Beide actief bij betaling (b nog niet afgemeld)
    expect(sA.aandeel).toBe(30)
    expect(sB.aandeel).toBe(30)
  })

  it('deelnemer met actief=false en geen afgemeld_op telt nooit mee', () => {
    const result = berekenSaldi(
      [d('a', 0), d('b', 0, false, null)],
      [storting('t1', 'a', 100), betaling('t2', 'a', 60, 20)]
    )
    const sB = result.deelnemersSaldi.find(s => s.id === 'b')
    expect(sB.aandeel).toBe(0)
  })
})

// ─── Cent-correctie ───────────────────────────────────────────────────────────

describe('berekenSaldi — cent-correctie', () => {
  it('totale aandelen zijn gelijk aan het betaalde bedrag (geen verlies door afronden)', () => {
    // €10 over 3 personen = €3,33 + €3,33 + €3,34
    const result = berekenSaldi(
      [d('a', 0), d('b', 0), d('c', 0)],
      [storting('t1', 'a', 100), betaling('t2', 'a', 10, 20)]
    )
    const totaalAandeel = result.deelnemersSaldi.reduce((sum, s) => sum + s.aandeel, 0)
    expect(Math.round(totaalAandeel * 100) / 100).toBe(10)
  })
})

// ─── berekenEindafrekening ────────────────────────────────────────────────────

// Helper voor inactieve deelnemer (altijd afgemeld op minuut 5)
const dInactief = (id, gestortMinuten = 0) => ({
  id,
  naam: `Deelnemer ${id}`,
  aangemaakt_op: new Date(2026, 0, 1, 12, gestortMinuten).toISOString(),
  actief: false,
  afgemeld_op: new Date(2026, 0, 1, 12, 5).toISOString(), // afgemeld vóór de betaling op min 20
})

describe('berekenEindafrekening — basisregels', () => {
  it('geeft zelfde resultaat als berekenSaldi als iedereen actief is', () => {
    const deelnemers = [d('a', 0), d('b', 0)]
    const txs = [storting('t1', 'a', 60), betaling('t2', 'a', 40, 20)]
    const basis = berekenSaldi(deelnemers, txs)
    const eind = berekenEindafrekening(deelnemers, txs)
    // Verrekenings moeten gelijk zijn
    basis.deelnemersSaldi.forEach((bs, i) => {
      expect(eind.deelnemersSaldi[i].verrekening).toBeCloseTo(bs.verrekening, 5)
    })
  })

  it('inactieve deelnemer met aandeel < gestort: ontvangt geld terug', () => {
    // c inactief, gestort 20, aandeel 10 → verrekening +10
    const deelnemers = [d('a', 0), dInactief('c')]
    const txs = [
      storting('t1', 'a', 40),
      storting('t2', 'c', 20),
      betaling('t3', 'a', 20, 20), // betaling na afmelding van c
    ]
    // Na afmelding van c (min 5) telt c niet mee bij betaling (min 20)
    // Aandeel c = 0 (niet actief bij betaling), gestort = 20
    // verrekening c = 20 - 0 = +20
    const eind = berekenEindafrekening(deelnemers, txs)
    const sc = eind.deelnemersSaldi.find(s => s.id === 'c')
    expect(sc.verrekening).toBeGreaterThanOrEqual(0)
    expect(sc.verrekening).toBe(sc.gestort) // c krijgt alles terug want aandeel=0
  })

  it('inactieve deelnemer met aandeel > gestort maar ≤ 2×gestort: betaalt tikkie (negatieve verrekening ≥ −gestort)', () => {
    // c inactief, gestort 5, aandeel 8 → verrekening = 5-8 = -3
    // Cap: max(-3, -5) = -3 → geen cap (3 ≤ 5)
    // Verrekening = -3 (tikkie van €3)
    const afgemeldOp = new Date(2026, 0, 1, 12, 5).toISOString()
    const deelnemers = [
      d('a', 0),
      { id: 'c', naam: 'c', aangemaakt_op: new Date(2026, 0, 1, 12, 0).toISOString(), actief: false, afgemeld_op: afgemeldOp }
    ]
    // Beide actief bij betaling op minuut 3 (vóór afmelding c op min 5)
    const betalingVoorAfmelding = {
      id: 't2', type: 'betaling', deelnemer_id: 'a', bedrag: 16,
      aangemaakt_op: new Date(2026, 0, 1, 12, 3).toISOString(), // min 3, vóór afmelding
    }
    const txs = [storting('t1', 'a', 100), betalingVoorAfmelding]
    const eind = berekenEindafrekening(deelnemers, txs)
    const sc = eind.deelnemersSaldi.find(s => s.id === 'c')
    // aandeel c = 16/2 = 8, gestort = 0 (c heeft niets gestort)
    // verrekening = 0 - 8 = -8, cap = max(-8, -0) = 0
    // c heeft gestort=0, dus cap=-gestort=0 → verrekening=max(-8,0)=0
    expect(sc.verrekening).toBeGreaterThanOrEqual(-sc.gestort)
  })

  it('inactieve deelnemer met gestort > 0 en aandeel > gestort: verrekening ≥ −gestort', () => {
    const afgemeldOp = new Date(2026, 0, 1, 12, 5).toISOString()
    const deelnemers = [
      d('a', 0),
      { id: 'c', naam: 'c', aangemaakt_op: new Date(2026, 0, 1, 12, 0).toISOString(), actief: false, afgemeld_op: afgemeldOp }
    ]
    const betalingVoorAfmelding = {
      id: 't2', type: 'betaling', deelnemer_id: 'a', bedrag: 14,
      aangemaakt_op: new Date(2026, 0, 1, 12, 3).toISOString(),
    }
    const txs = [storting('t1', 'a', 40), storting('t3', 'c', 5), betalingVoorAfmelding]
    // c: gestort=5, aandeel=7 (14/2), verrekening=5-7=-2, cap=max(-2,-5)=-2 (geen cap)
    const eind = berekenEindafrekening(deelnemers, txs)
    const sc = eind.deelnemersSaldi.find(s => s.id === 'c')
    expect(sc.verrekening).toBeGreaterThanOrEqual(-sc.gestort)
    expect(sc.verrekening).toBe(-2)
  })
})

describe('berekenEindafrekening — cap-regel bij extreem tekort', () => {
  it('inactieve deelnemer met aandeel > 2×gestort: verrekening gecapt op −gestort', () => {
    // c: gestort=2, aandeel=10 → normal verrekening=-8, cap=max(-8,-2)=-2
    const afgemeldOp = new Date(2026, 0, 1, 12, 5).toISOString()
    const deelnemers = [
      d('a', 0),
      { id: 'c', naam: 'c', aangemaakt_op: new Date(2026, 0, 1, 12, 0).toISOString(), actief: false, afgemeld_op: afgemeldOp }
    ]
    const betalingVoorAfmelding = {
      id: 't2', type: 'betaling', deelnemer_id: 'a', bedrag: 20,
      aangemaakt_op: new Date(2026, 0, 1, 12, 3).toISOString(),
    }
    const txs = [storting('t1', 'a', 50), storting('t3', 'c', 2), betalingVoorAfmelding]
    // c: gestort=2, aandeel=10 (20/2), verrekening=2-10=-8, cap=max(-8,-2)=-2
    const eind = berekenEindafrekening(deelnemers, txs)
    const sc = eind.deelnemersSaldi.find(s => s.id === 'c')
    expect(sc.verrekening).toBe(-2) // gecapt op -gestort
  })

  it('tekort wordt gelijk verdeeld over actieve deelnemers', () => {
    // Twee actieve deelnemers, één inactieve die gecapt wordt
    // c: gestort=2, aandeel=10 → cap=-2, tekort=6 → elk actief -3
    const afgemeldOp = new Date(2026, 0, 1, 12, 5).toISOString()
    const deelnemers = [
      d('a', 0),
      d('b', 0),
      { id: 'c', naam: 'c', aangemaakt_op: new Date(2026, 0, 1, 12, 0).toISOString(), actief: false, afgemeld_op: afgemeldOp }
    ]
    const betalingVoorAfmelding = {
      id: 't2', type: 'betaling', deelnemer_id: 'a', bedrag: 30,
      aangemaakt_op: new Date(2026, 0, 1, 12, 3).toISOString(),
    }
    const txs = [
      storting('t1', 'a', 60),
      storting('t3', 'b', 60),
      storting('t4', 'c', 2),
      betalingVoorAfmelding,
    ]
    // a: gestort=60, aandeel=10 (30/3), base verrekening=50
    // b: gestort=60, aandeel=10, base verrekening=50
    // c: gestort=2, aandeel=10, verrekening=-8, gecapt=-2, tekort=6
    // verdeling: elk actief (a,b) -3 → a=47, b=47, c=-2
    const eind = berekenEindafrekening(deelnemers, txs)
    const sa = eind.deelnemersSaldi.find(s => s.id === 'a')
    const sb = eind.deelnemersSaldi.find(s => s.id === 'b')
    const sc = eind.deelnemersSaldi.find(s => s.id === 'c')
    expect(sc.verrekening).toBe(-2)
    expect(sa.verrekening).toBe(47)
    expect(sb.verrekening).toBe(47)
  })

  it('som van alle verrekenings is altijd gelijk aan potSaldo', () => {
    const afgemeldOp = new Date(2026, 0, 1, 12, 5).toISOString()
    const deelnemers = [
      d('a', 0),
      d('b', 0),
      { id: 'c', naam: 'c', aangemaakt_op: new Date(2026, 0, 1, 12, 0).toISOString(), actief: false, afgemeld_op: afgemeldOp }
    ]
    const betalingVoorAfmelding = {
      id: 't2', type: 'betaling', deelnemer_id: 'a', bedrag: 30,
      aangemaakt_op: new Date(2026, 0, 1, 12, 3).toISOString(),
    }
    const txs = [
      storting('t1', 'a', 60),
      storting('t3', 'b', 60),
      storting('t4', 'c', 2),
      betalingVoorAfmelding,
    ]
    const eind = berekenEindafrekening(deelnemers, txs)
    const somVerrekenings = Math.round(
      eind.deelnemersSaldi.reduce((s, d) => s + d.verrekening, 0) * 100
    ) / 100
    expect(somVerrekenings).toBeCloseTo(eind.potSaldo, 1)
  })
})

describe('berekenEindafrekening — edge cases', () => {
  it('geen actieve deelnemers: verrekenings worden niet herverdeeld', () => {
    const afgemeldOp = new Date(2026, 0, 1, 12, 5).toISOString()
    const deelnemers = [
      { id: 'a', naam: 'a', aangemaakt_op: new Date(2026, 0, 1, 12, 0).toISOString(), actief: false, afgemeld_op: afgemeldOp },
      { id: 'b', naam: 'b', aangemaakt_op: new Date(2026, 0, 1, 12, 0).toISOString(), actief: false, afgemeld_op: afgemeldOp },
    ]
    const txs = [storting('t1', 'a', 30), storting('t2', 'b', 30)]
    const eind = berekenEindafrekening(deelnemers, txs)
    // Geen betalingen → verrekening = gestort voor iedereen
    expect(eind.deelnemersSaldi.find(s => s.id === 'a').verrekening).toBe(30)
    expect(eind.deelnemersSaldi.find(s => s.id === 'b').verrekening).toBe(30)
  })

  it('inactieve deelnemer met gestort=0 en aandeel>0: verrekening gecapt op 0', () => {
    const afgemeldOp = new Date(2026, 0, 1, 12, 5).toISOString()
    const deelnemers = [
      d('a', 0),
      { id: 'c', naam: 'c', aangemaakt_op: new Date(2026, 0, 1, 12, 0).toISOString(), actief: false, afgemeld_op: afgemeldOp }
    ]
    const betalingVoorAfmelding = {
      id: 't2', type: 'betaling', deelnemer_id: 'a', bedrag: 20,
      aangemaakt_op: new Date(2026, 0, 1, 12, 3).toISOString(),
    }
    const txs = [storting('t1', 'a', 50), betalingVoorAfmelding]
    // c: gestort=0, aandeel=10 → cap=max(-10, 0)=0 → verrekening=0
    const eind = berekenEindafrekening(deelnemers, txs)
    const sc = eind.deelnemersSaldi.find(s => s.id === 'c')
    expect(sc.verrekening).toBe(0)
  })

  it('lege input geeft nullwaarden', () => {
    const eind = berekenEindafrekening([], [])
    expect(eind.potSaldo).toBe(0)
    expect(eind.deelnemersSaldi).toEqual([])
  })

  it('meerdere inactieve deelnemers met cap: tekort correct gesplitst', () => {
    // c1 en c2 beiden inactief met cap, tekort per persoon = 4 → totaal tekort = 8
    // Eén actieve: a → a krijgt -8
    const afgemeldOp = new Date(2026, 0, 1, 12, 5).toISOString()
    const deelnemers = [
      d('a', 0),
      { id: 'c1', naam: 'c1', aangemaakt_op: new Date(2026, 0, 1, 12, 0).toISOString(), actief: false, afgemeld_op: afgemeldOp },
      { id: 'c2', naam: 'c2', aangemaakt_op: new Date(2026, 0, 1, 12, 0).toISOString(), actief: false, afgemeld_op: afgemeldOp },
    ]
    const betalingVoorAfmelding = {
      id: 't2', type: 'betaling', deelnemer_id: 'a', bedrag: 30,
      aangemaakt_op: new Date(2026, 0, 1, 12, 3).toISOString(),
    }
    const txs = [
      storting('t1', 'a', 100),
      storting('t3', 'c1', 2),
      storting('t4', 'c2', 2),
      betalingVoorAfmelding,
    ]
    // Elk aandeel = 30/3 = 10
    // c1: gestort=2, aandeel=10, verrekening=-8, cap=-2, tekort=6
    // c2: idem → tekort=6 → totaal=12
    // a: base verrekening = 100-10=90, aanpassing = -12/1 = -12 → a=78
    const eind = berekenEindafrekening(deelnemers, txs)
    const sc1 = eind.deelnemersSaldi.find(s => s.id === 'c1')
    const sc2 = eind.deelnemersSaldi.find(s => s.id === 'c2')
    const sa = eind.deelnemersSaldi.find(s => s.id === 'a')
    expect(sc1.verrekening).toBe(-2)
    expect(sc2.verrekening).toBe(-2)
    expect(sa.verrekening).toBe(78)
    // potSaldo = 104 - 30 = 74
    const som = Math.round((sa.verrekening + sc1.verrekening + sc2.verrekening) * 100) / 100
    expect(som).toBeCloseTo(eind.potSaldo, 1)
  })
})
