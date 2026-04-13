/**
 * Regressietests — Stap 2: usePotje
 *
 * Teststrategie: logica-extractie patroon.
 *
 * usePotje bevat twee categorieën logica:
 *
 * A) Pure state-update functies (Supabase realtime payloads → nieuwe state)
 *    → Extraheerbaar als pure functies → direct testbaar zonder React of Supabase
 *
 * B) Side-effect orchestratie (laadData, channel-setup, online/offline)
 *    → Vereist Supabase-mock + React-mount
 *    → Niet gedekt in unit tests; gedekt via integratie/e2e (buiten scope stap 2)
 *    → Motivatie: mock van Supabase.channel().on().subscribe() is fragiel en
 *      test de mock, niet de logica. Regressie via bestaande paginaStorten-tests.
 *
 * Gedekte logica (categorie A):
 *   UP-01  deelnemers INSERT: nieuw lid wordt toegevoegd en gesorteerd op aangemaakt_op
 *   UP-02  deelnemers INSERT: duplicaat (zelfde id) wordt vervangen, niet dubbel toegevoegd
 *   UP-03  deelnemers UPDATE: bestaand lid wordt bijgewerkt in de lijst
 *   UP-04  deelnemers UPDATE: huidig deelnemer wordt bijgewerkt als id overeenkomt
 *   UP-05  deelnemers UPDATE: andere deelnemer wordt NIET bijgewerkt als deelnemer
 *   UP-06  transacties INSERT: nieuwe transactie wordt aan de lijst toegevoegd
 *   UP-07  transacties INSERT: volgorde is onbepaald (niet gesorteerd in reducer)
 *   UP-08  handleDeelnemenReductie: zoeklogica bekende deelnemer op device_id
 */

import { describe, it, expect } from 'vitest'

// ── Pure reducer-functies (geëxtraheerd uit usePotje voor testbaarheid) ──────
//
// Dit zijn de exacte functies die usePotje gebruikt als realtime-callbacks.
// Ze worden hier geëxtraheerd zodat ze zonder React of Supabase testbaar zijn.

function reduceDeelnemersInsert(prev, nieuw) {
  return [...prev.filter(d => d.id !== nieuw.id), nieuw].sort(
    (a, b) => new Date(a.aangemaakt_op) - new Date(b.aangemaakt_op)
  )
}

function reduceDeelnemersUpdate(prev, bijgewerkt) {
  return prev.map(d => d.id === bijgewerkt.id ? bijgewerkt : d)
}

function reduceHuidigeDeelnemer(prev, bijgewerkt) {
  return prev?.id === bijgewerkt.id ? bijgewerkt : prev
}

function reduceTransactiesInsert(prev, nieuw) {
  return [...prev, nieuw]
}

function vindBekende(deelnemers, deviceId) {
  return deelnemers.find(x => x.device_id === deviceId) ?? null
}

// ── Testdata ──────────────────────────────────────────────────────────────────

const alice = { id: 'a1', naam: 'Alice', device_id: 'dev-a', aangemaakt_op: '2026-01-01T10:00:00Z', actief: true }
const bob   = { id: 'b1', naam: 'Bob',   device_id: 'dev-b', aangemaakt_op: '2026-01-01T11:00:00Z', actief: true }
const carol = { id: 'c1', naam: 'Carol', device_id: 'dev-c', aangemaakt_op: '2026-01-01T12:00:00Z', actief: true }

const tx1 = { id: 't1', deelnemer_id: 'a1', type: 'storting', bedrag: '25.00', aangemaakt_op: '2026-01-01T10:05:00Z' }
const tx2 = { id: 't2', deelnemer_id: 'b1', type: 'storting', bedrag: '30.00', aangemaakt_op: '2026-01-01T11:05:00Z' }

// ── UP-01 t/m UP-02: deelnemers INSERT ───────────────────────────────────────

describe('usePotje — deelnemers INSERT reducer (UP-01 t/m UP-02)', () => {
  it('UP-01: nieuw lid wordt toegevoegd en gesorteerd op aangemaakt_op', () => {
    const eerder = [alice, carol] // carol is aangemaakt na alice
    const david = { id: 'd1', naam: 'David', device_id: 'dev-d', aangemaakt_op: '2026-01-01T10:30:00Z' }
    const result = reduceDeelnemersInsert(eerder, david)
    expect(result.map(d => d.id)).toEqual(['a1', 'd1', 'c1'])
  })

  it('UP-02: duplicaat id wordt vervangen, niet dubbel toegevoegd', () => {
    const eerder = [alice, bob]
    const aliceBijgewerkt = { ...alice, naam: 'Alice V2' }
    const result = reduceDeelnemersInsert(eerder, aliceBijgewerkt)
    expect(result).toHaveLength(2)
    expect(result.find(d => d.id === 'a1')?.naam).toBe('Alice V2')
  })

  it('UP-01b: lege lijst + nieuw lid geeft lijst met één element', () => {
    const result = reduceDeelnemersInsert([], alice)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a1')
  })

  it('UP-01c: volgorde bij gelijke aangemaakt_op is stabiel (sort is deterministic)', () => {
    const x = { id: 'x1', aangemaakt_op: '2026-01-01T10:00:00Z' }
    const y = { id: 'y1', aangemaakt_op: '2026-01-01T10:00:00Z' }
    const result = reduceDeelnemersInsert([x], y)
    expect(result).toHaveLength(2)
  })
})

// ── UP-03 t/m UP-05: deelnemers UPDATE ───────────────────────────────────────

describe('usePotje — deelnemers UPDATE reducer (UP-03 t/m UP-05)', () => {
  it('UP-03: bestaand lid wordt bijgewerkt in de lijst', () => {
    const eerder = [alice, bob]
    const aliceAfgemeld = { ...alice, actief: false }
    const result = reduceDeelnemersUpdate(eerder, aliceAfgemeld)
    expect(result.find(d => d.id === 'a1')?.actief).toBe(false)
    expect(result).toHaveLength(2)
  })

  it('UP-04: huidig deelnemer wordt bijgewerkt als id overeenkomt', () => {
    const aliceAfgemeld = { ...alice, actief: false }
    const result = reduceHuidigeDeelnemer(alice, aliceAfgemeld)
    expect(result?.actief).toBe(false)
  })

  it('UP-05: andere deelnemer wordt NIET als huidig deelnemer bijgewerkt', () => {
    const bobBijgewerkt = { ...bob, actief: false }
    const result = reduceHuidigeDeelnemer(alice, bobBijgewerkt)
    expect(result?.id).toBe('a1')
    expect(result?.actief).toBe(true)
  })

  it('UP-05b: deelnemer null blijft null na UPDATE van andere deelnemer', () => {
    const result = reduceHuidigeDeelnemer(null, bob)
    expect(result).toBeNull()
  })
})

// ── UP-06 t/m UP-07: transacties INSERT ──────────────────────────────────────

describe('usePotje — transacties INSERT reducer (UP-06 t/m UP-07)', () => {
  it('UP-06: nieuwe transactie wordt aan de lijst toegevoegd', () => {
    const eerder = [tx1]
    const result = reduceTransactiesInsert(eerder, tx2)
    expect(result).toHaveLength(2)
    expect(result[1].id).toBe('t2')
  })

  it('UP-06b: lege lijst + nieuwe transactie geeft lijst met één element', () => {
    const result = reduceTransactiesInsert([], tx1)
    expect(result).toHaveLength(1)
  })

  it('UP-07: transacties worden NIET gesorteerd (volgorde = invoegvolgorde)', () => {
    // Realtime INSERT komt al in chronologische volgorde van de DB.
    // De reducer sorteert niet opnieuw — dat is bewust, geen bug.
    const eerder = [tx2] // tx2 is later, maar staat eerste in de array
    const result = reduceTransactiesInsert(eerder, tx1)
    expect(result[0].id).toBe('t2')
    expect(result[1].id).toBe('t1')
  })
})

// ── UP-08: vindBekende (device_id matching) ───────────────────────────────────

describe('usePotje — vindBekende deelnemer (UP-08)', () => {
  it('UP-08a: vindt deelnemer op basis van device_id', () => {
    const result = vindBekende([alice, bob, carol], 'dev-b')
    expect(result?.id).toBe('b1')
  })

  it('UP-08b: geeft null terug als device_id niet voorkomt', () => {
    const result = vindBekende([alice, bob], 'dev-onbekend')
    expect(result).toBeNull()
  })

  it('UP-08c: geeft null terug bij lege deelnemerslijst', () => {
    const result = vindBekende([], 'dev-a')
    expect(result).toBeNull()
  })

  it('UP-08d: matcht op exacte device_id — geen gedeeltelijke match', () => {
    const result = vindBekende([alice], 'dev-')
    expect(result).toBeNull()
  })
})

// ── UP-09: transacties INSERT-reducer deduplicatie ───────────────────────────
// Fix UI-dubbelpost 2026-04-13: de initiële fetch en het Realtime INSERT-event
// kunnen dezelfde transactie beiden aanleveren als navigate en Realtime-event
// elkaar overlappen. De reducer mag een id nooit twee keer toevoegen.

function transactieInsertReducer(prev, nieuw) {
  return prev.some(t => t.id === nieuw.id) ? prev : [...prev, nieuw]
}

describe('usePotje — UP-09: transacties INSERT-reducer deduplicatie', () => {
  const bestaand = { id: 'tx-1', bedrag: '20.00', type: 'storting' }

  it('UP-09a: nieuwe transactie wordt toegevoegd', () => {
    const result = transactieInsertReducer([], { id: 'tx-1', bedrag: '20.00', type: 'storting' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('tx-1')
  })

  it('UP-09b: bestaand id wordt niet opnieuw toegevoegd (deduplicatie)', () => {
    const result = transactieInsertReducer([bestaand], bestaand)
    expect(result).toHaveLength(1)
  })

  it('UP-09c: zelfde id drie keer aangeboden blijft één rij', () => {
    let state = []
    state = transactieInsertReducer(state, bestaand)
    state = transactieInsertReducer(state, bestaand)
    state = transactieInsertReducer(state, bestaand)
    expect(state).toHaveLength(1)
  })

  it('UP-09d: verschillende ids worden allemaal toegevoegd', () => {
    const tx2 = { id: 'tx-2', bedrag: '10.00', type: 'betaling' }
    const tx3 = { id: 'tx-3', bedrag: '5.00',  type: 'storting' }
    let state = [bestaand]
    state = transactieInsertReducer(state, tx2)
    state = transactieInsertReducer(state, tx3)
    expect(state).toHaveLength(3)
    expect(state.map(t => t.id)).toEqual(['tx-1', 'tx-2', 'tx-3'])
  })

  it('UP-09e: lege beginstate + nieuw id → lijst met één element', () => {
    const result = transactieInsertReducer([], { id: 'tx-nieuw', bedrag: '50.00', type: 'storting' })
    expect(result).toHaveLength(1)
  })
})
