/**
 * Regressietests — Stap 4: useMijnPotjes
 *
 * Teststrategie: logica-extractie patroon.
 *
 * useMijnPotjes bevat twee categorieën logica:
 *
 * A) Filter-opbouw (deviceId / profielNaam → filters array)
 *    → Pure functie, direct testbaar
 *
 * B) Verrijking (genest Supabase-resultaat → verrijkt potje-object)
 *    → Pure functie per status ('open' / 'gesloten'), direct testbaar
 *    → Dit is de meest complexe en risicovolle logica: N+1-fix + saldo-berekening
 *
 * Niet gedekt (vereisen Supabase-mock):
 *    → De daadwerkelijke DB-queries
 *    → Foutpaden (al gedekt in filterLogica.regressie.test.js)
 *
 * Gedekte logica:
 *   MP-01 t/m MP-04  filter-opbouw
 *   MP-05 t/m MP-09  verrijking open potje (saldo, aantalDeelnemers)
 *   MP-10 t/m MP-14  verrijking gesloten potje (mijnVerrekening)
 *   MP-15 t/m MP-16  geneste arrays worden verwijderd uit resultaat
 */

import { describe, it, expect } from 'vitest'
import { berekenSaldi } from '../utils/berekenSaldi'
import { berekenEindafrekening } from '../utils/berekenEindafrekening'

// ── Geëxtraheerde logica uit useMijnPotjes ────────────────────────────────────

/**
 * Filter-opbouw — identiek aan de logica in useMijnPotjes.
 */
function bouwFilters(deviceId, profielNaam) {
  const filters = []
  if (deviceId) filters.push(`device_id.eq.${deviceId}`)
  if (profielNaam) filters.push(`naam.ilike.${profielNaam}`)
  return filters
}

/**
 * Verrijkt een open potje op basis van geneste deelnemers + transacties.
 * Identiek aan de 'open'-tak in useMijnPotjes.
 */
function verrijkOpenPotje(potje) {
  const allDeelnemers = potje.deelnemers ?? []
  const allTransacties = potje.transacties ?? []
  const saldi = berekenSaldi(allDeelnemers, allTransacties)
  return {
    ...potje,
    aantalDeelnemers: allDeelnemers.length,
    potSaldo: saldi.potSaldo,
    deelnemers: undefined,
    transacties: undefined,
  }
}

/**
 * Verrijkt een gesloten potje op basis van geneste deelnemers + transacties.
 * Identiek aan de 'gesloten'-tak in useMijnPotjes.
 */
function verrijkGeslotenPotje(potje, deviceId, profielNaam) {
  const allDeelnemers = potje.deelnemers ?? []
  const allTransacties = potje.transacties ?? []
  const saldi = berekenEindafrekening(allDeelnemers, allTransacties)
  const mijnDeelnemer = allDeelnemers.find(d =>
    d.device_id === deviceId ||
    (profielNaam && d.naam.toLowerCase() === profielNaam.toLowerCase())
  )
  const mijnVerrekening = mijnDeelnemer
    ? saldi.deelnemersSaldi.find(s => s.id === mijnDeelnemer.id)?.verrekening ?? null
    : null
  return {
    ...potje,
    mijnVerrekening,
    deelnemers: undefined,
    transacties: undefined,
  }
}

// ── Testdata ──────────────────────────────────────────────────────────────────

const deelnemerAlice = { id: 'd1', naam: 'Alice', device_id: 'dev-a', actief: true,  aangemaakt_op: '2026-01-01T10:00:00Z', afgemeld_op: null, potje_id: 'p1' }
const deelnemerBob   = { id: 'd2', naam: 'Bob',   device_id: 'dev-b', actief: true,  aangemaakt_op: '2026-01-01T10:01:00Z', afgemeld_op: null, potje_id: 'p1' }

const stortingAlice  = { id: 't1', type: 'storting', deelnemer_id: 'd1', bedrag: '30', potje_id: 'p1', aangemaakt_op: '2026-01-01T10:05:00Z' }
const stortingBob    = { id: 't2', type: 'storting', deelnemer_id: 'd2', bedrag: '20', potje_id: 'p1', aangemaakt_op: '2026-01-01T10:06:00Z' }
const betalingAlice  = { id: 't3', type: 'betaling', deelnemer_id: 'd1', bedrag: '40', potje_id: 'p1', aangemaakt_op: '2026-01-01T11:00:00Z' }

const basisPotje = {
  id: 'p1',
  naam: 'Testpotje',
  status: 'open',
  aangemaakt_op: '2026-01-01T10:00:00Z',
  gesloten_op: null,
  valuta: 'EUR',
}

// ── MP-01 t/m MP-04: filter-opbouw ───────────────────────────────────────────

describe('useMijnPotjes — MP-01 t/m MP-04: filter-opbouw', () => {
  it('MP-01: alleen deviceId → één device_id-filter', () => {
    const filters = bouwFilters('dev-a', null)
    expect(filters).toEqual(['device_id.eq.dev-a'])
  })

  it('MP-02: alleen profielNaam → één naam.ilike-filter', () => {
    const filters = bouwFilters(null, 'Alice')
    expect(filters).toEqual(['naam.ilike.Alice'])
  })

  it('MP-03: beide → twee filters', () => {
    const filters = bouwFilters('dev-a', 'Alice')
    expect(filters).toHaveLength(2)
    expect(filters[0]).toMatch(/device_id/)
    expect(filters[1]).toMatch(/naam\.ilike/)
  })

  it('MP-04: geen van beide → lege array (laadPotjes geeft vroeg terug)', () => {
    const filters = bouwFilters(null, null)
    expect(filters).toHaveLength(0)
  })
})

// ── MP-05 t/m MP-09: verrijking open potje ───────────────────────────────────

describe('useMijnPotjes — MP-05 t/m MP-09: verrijking open potje', () => {
  it('MP-05: potSaldo is som van stortingen min betalingen', () => {
    // Alice €30 + Bob €20 = €50 gestort, Alice €40 betaald → saldo €10
    const potje = { ...basisPotje, deelnemers: [deelnemerAlice, deelnemerBob], transacties: [stortingAlice, stortingBob, betalingAlice] }
    const result = verrijkOpenPotje(potje)
    expect(result.potSaldo).toBe(10)
  })

  it('MP-06: aantalDeelnemers telt alle deelnemers (ook afgemeld)', () => {
    const afgemeld = { ...deelnemerBob, actief: false }
    const potje = { ...basisPotje, deelnemers: [deelnemerAlice, afgemeld], transacties: [] }
    const result = verrijkOpenPotje(potje)
    expect(result.aantalDeelnemers).toBe(2)
  })

  it('MP-07: lege deelnemers + transacties → saldo 0, aantalDeelnemers 0', () => {
    const potje = { ...basisPotje, deelnemers: [], transacties: [] }
    const result = verrijkOpenPotje(potje)
    expect(result.potSaldo).toBe(0)
    expect(result.aantalDeelnemers).toBe(0)
  })

  it('MP-08: ontbrekende deelnemers-key (null van Supabase) → aantalDeelnemers 0', () => {
    const potje = { ...basisPotje, deelnemers: null, transacties: null }
    const result = verrijkOpenPotje(potje)
    expect(result.aantalDeelnemers).toBe(0)
    expect(result.potSaldo).toBe(0)
  })

  it('MP-09: originele potje-velden blijven behouden', () => {
    const potje = { ...basisPotje, deelnemers: [], transacties: [] }
    const result = verrijkOpenPotje(potje)
    expect(result.id).toBe('p1')
    expect(result.naam).toBe('Testpotje')
    expect(result.valuta).toBe('EUR')
  })
})

// ── MP-10 t/m MP-14: verrijking gesloten potje ───────────────────────────────

describe('useMijnPotjes — MP-10 t/m MP-14: verrijking gesloten potje', () => {
  const geslotenPotje = { ...basisPotje, status: 'gesloten', gesloten_op: '2026-01-02T10:00:00Z' }

  it('MP-10: mijnVerrekening gevonden op device_id', () => {
    // Alice €30 gestort, €40 betaald → betaald meer dan aandeel → positieve verrekening
    const potje = { ...geslotenPotje, deelnemers: [deelnemerAlice, deelnemerBob], transacties: [stortingAlice, stortingBob, betalingAlice] }
    const result = verrijkGeslotenPotje(potje, 'dev-a', null)
    expect(result.mijnVerrekening).not.toBeNull()
    expect(typeof result.mijnVerrekening).toBe('number')
  })

  it('MP-11: mijnVerrekening gevonden op profielNaam (case-insensitief)', () => {
    const potje = { ...geslotenPotje, deelnemers: [deelnemerAlice, deelnemerBob], transacties: [stortingAlice, stortingBob] }
    // Zoek op 'alice' terwijl naam 'Alice' is
    const result = verrijkGeslotenPotje(potje, 'onbekend-device', 'alice')
    expect(result.mijnVerrekening).not.toBeNull()
  })

  it('MP-12: mijnVerrekening is null als deelnemer niet gevonden', () => {
    const potje = { ...geslotenPotje, deelnemers: [deelnemerAlice], transacties: [stortingAlice] }
    const result = verrijkGeslotenPotje(potje, 'onbekend-device', null)
    expect(result.mijnVerrekening).toBeNull()
  })

  it('MP-13: lege deelnemers → mijnVerrekening is null', () => {
    const potje = { ...geslotenPotje, deelnemers: [], transacties: [] }
    const result = verrijkGeslotenPotje(potje, 'dev-a', null)
    expect(result.mijnVerrekening).toBeNull()
  })

  it('MP-14: originele potje-velden blijven behouden', () => {
    const potje = { ...geslotenPotje, deelnemers: [], transacties: [] }
    const result = verrijkGeslotenPotje(potje, 'dev-a', null)
    expect(result.id).toBe('p1')
    expect(result.gesloten_op).toBe('2026-01-02T10:00:00Z')
  })
})

// ── MP-15 t/m MP-16: geneste arrays verwijderd ───────────────────────────────

describe('useMijnPotjes — MP-15 t/m MP-16: geneste arrays niet in resultaat', () => {
  it('MP-15: verrijkOpenPotje verwijdert deelnemers- en transacties-arrays', () => {
    const potje = { ...basisPotje, deelnemers: [deelnemerAlice], transacties: [stortingAlice] }
    const result = verrijkOpenPotje(potje)
    // undefined = verwijderd (niet aanwezig als eigenschap met waarde)
    expect(result.deelnemers).toBeUndefined()
    expect(result.transacties).toBeUndefined()
  })

  it('MP-16: verrijkGeslotenPotje verwijdert deelnemers- en transacties-arrays', () => {
    const potje = { ...basisPotje, status: 'gesloten', deelnemers: [deelnemerAlice], transacties: [stortingAlice] }
    const result = verrijkGeslotenPotje(potje, 'dev-a', null)
    expect(result.deelnemers).toBeUndefined()
    expect(result.transacties).toBeUndefined()
  })
})
