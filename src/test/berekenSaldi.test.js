import { describe, it, expect } from 'vitest'
import { berekenSaldi } from '../utils/berekenSaldi'

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
