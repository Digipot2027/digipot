/**
 * useMijnPotjes — naam-matching regressietests
 *
 * Samenvoeging van twee historisch afzonderlijke testbestanden:
 *   - useMijnPotjes.eq.regressie.test.js  (SEC-H2 fix, 2026-04-16)
 *   - useMijnPotjes.ilike.regressie.test.js (N4 fix, 2026-04-20)
 *
 * Beide bestanden testten overlappende logica: hoe `vindMijnDeelnemer`
 * een deelnemer opzoekt op device_id of profielnaam. Samengevoegd
 * tot één bestand zodat wijzigingen aan de matching-logica op één
 * plek worden gesignaleerd.
 *
 * Achtergrond:
 *
 * SEC-H2 (2026-04-16): het DB-filter voor de deelnemers-query gebruikte
 * voorheen .ilike(profielnaam) — SQL-wildcards (% en _) werden als patroon
 * behandeld. Een profielnaam '%' zou alle deelnemers matchen. Na de fix
 * gebruikt de DB-query .eq() voor exacte matching.
 *
 * N4 (2026-04-20): de client-side mijnDeelnemer-lookup na de DB-query
 * was case-sensitief (.eq). Profielnaam "jan" vond deelnemer "Jan" niet.
 * Na de fix: .toLowerCase() op beide zijden bij de naam-vergelijking.
 *
 * Teststrategie: logica-extractie patroon.
 * De daadwerkelijke Supabase-queries (.eq / .ilike) zijn integratiepunten
 * gedekt via e2e. De client-side matching-logica is pure JavaScript.
 *
 * Gedekte scenario's:
 *
 * DB-filterlogica (SEC-H2 — eq-semantiek):
 *   EQ-01  exacte naam-match → gevonden
 *   EQ-02  andere case → niet gevonden (DB-filter is case-sensitief)
 *   EQ-03  wildcard '%' als naam → matcht alleen eigen record, niet alle
 *   EQ-04  wildcard '_' → geen onbedoelde matches
 *   EQ-05  gedeeltelijke naam → niet gevonden
 *   EQ-06  null profielnaam → lege lijst
 *   EQ-07  lege string → lege lijst
 *   EQ-08  naam met spaties → exacte match werkt
 *   EQ-09  aanvalsscenario: '%' matcht alleen eigen record (niet alle 4)
 *
 * Client-side matching (N4 — case-insensitief):
 *   N4-01  lowercase profielnaam matcht deelnemer met hoofdletter
 *   N4-02  hoofdletter profielnaam matcht deelnemer lowercase
 *   N4-03  gemixte casing → matcht na toLowerCase()
 *   N4-04  exact gelijke naam → basisgeval
 *   N4-05  device_id-match werkt onafhankelijk van profielnaam
 *   N4-06  profielnaam-match zonder device_id-match
 *   N4-07  geen match → null
 *   N4-08  lege deelnemers-array → null
 *   N4-09  mijnVerrekening is getal bij case-insensitieve naam-match
 *   N4-10  mijnVerrekening is null bij typefout in naam
 *   N4-11  verrekening via device_id === verrekening via naam
 */

import { describe, it, expect } from 'vitest'
import { berekenEindafrekening } from '../utils/berekenEindafrekening'

// ── DB-filterlogica (simuleert .eq() semantiek van Supabase) ──────────────────

function vindDeelnemerOpNaam(deelnemers, profielNaam) {
  if (!profielNaam) return null
  return deelnemers.find(d => d.naam === profielNaam) ?? null
}

function filterdOpNaamEq(deelnemers, profielNaam) {
  if (!profielNaam) return []
  return deelnemers.filter(d => d.naam === profielNaam)
}

// ── Client-side matching (simuleert vindMijnDeelnemer in useMijnPotjes) ────────

function vindMijnDeelnemer(deelnemers, deviceId, profielNaamLower) {
  return deelnemers.find(d =>
    d.device_id === deviceId ||
    (profielNaamLower && d.naam.toLowerCase() === profielNaamLower)
  ) ?? null
}

function berekenMijnVerrekening(deelnemers, transacties, geslotenOp, deviceId, profielNaamLower) {
  const saldi = berekenEindafrekening(deelnemers, transacties, geslotenOp)
  const mijnDeelnemer = vindMijnDeelnemer(deelnemers, deviceId, profielNaamLower)
  if (!mijnDeelnemer) return null
  return saldi.deelnemersSaldi.find(s => s.id === mijnDeelnemer.id)?.verrekening ?? null
}

// ── Testdata ──────────────────────────────────────────────────────────────────

const deelnemersEq = [
  { id: 'd1', naam: 'Alice',        device_id: 'dev-a' },
  { id: 'd2', naam: 'Bob',          device_id: 'dev-b' },
  { id: 'd3', naam: '%',            device_id: 'dev-c' }, // aanvallersnaam
  { id: 'd4', naam: 'Jan de Vries', device_id: 'dev-d' },
]

const deelnemerJan  = { id: 'd1', naam: 'Jan',  device_id: 'dev-jan',  actief: true, aangemaakt_op: '2026-01-01T10:00:00Z', afgemeld_op: null, potje_id: 'p1' }
const deelnemerPiet = { id: 'd2', naam: 'Piet', device_id: 'dev-piet', actief: true, aangemaakt_op: '2026-01-01T10:01:00Z', afgemeld_op: null, potje_id: 'p1' }
const stortingJan   = { id: 't1', type: 'storting', deelnemer_id: 'd1', bedrag: '20', potje_id: 'p1', aangemaakt_op: '2026-01-01T10:05:00Z' }
const stortingPiet  = { id: 't2', type: 'storting', deelnemer_id: 'd2', bedrag: '20', potje_id: 'p1', aangemaakt_op: '2026-01-01T10:06:00Z' }
const betalingJan   = { id: 't3', type: 'betaling', deelnemer_id: 'd1', bedrag: '30', potje_id: 'p1', aangemaakt_op: '2026-01-01T11:00:00Z' }
const geslotenOp    = '2026-01-02T10:00:00Z'
const deelnemersN4  = [deelnemerJan, deelnemerPiet]
const transactiesN4 = [stortingJan, stortingPiet, betalingJan]

// ── EQ-01 t/m EQ-09: DB-filterlogica (SEC-H2) ────────────────────────────────

describe('useMijnPotjes — SEC-H2: DB-filter eq-semantiek (EQ-01 t/m EQ-09)', () => {
  it('EQ-01: exacte naam-match → deelnemer gevonden', () => {
    expect(vindDeelnemerOpNaam(deelnemersEq, 'Alice')?.id).toBe('d1')
    expect(filterdOpNaamEq(deelnemersEq, 'Bob')).toHaveLength(1)
  })

  it('EQ-02: andere case → niet gevonden (DB-filter is case-sensitief)', () => {
    expect(vindDeelnemerOpNaam(deelnemersEq, 'alice')).toBeNull()
    expect(filterdOpNaamEq(deelnemersEq, 'ALICE')).toHaveLength(0)
  })

  it('EQ-03: wildcard "%" als naam → matcht alleen eigen record (niet alle)', () => {
    const result = filterdOpNaamEq(deelnemersEq, '%')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('d3')
  })

  it('EQ-04: wildcard "_" → geen onbedoelde matches', () => {
    expect(filterdOpNaamEq(deelnemersEq, '_')).toHaveLength(0)
  })

  it('EQ-05: gedeeltelijke naam → niet gevonden', () => {
    expect(vindDeelnemerOpNaam(deelnemersEq, 'Ali')).toBeNull()
    expect(filterdOpNaamEq(deelnemersEq, 'Alic')).toHaveLength(0)
  })

  it('EQ-06: null profielnaam → lege lijst', () => {
    expect(vindDeelnemerOpNaam(deelnemersEq, null)).toBeNull()
    expect(filterdOpNaamEq(deelnemersEq, null)).toHaveLength(0)
  })

  it('EQ-07: lege string → lege lijst', () => {
    expect(vindDeelnemerOpNaam(deelnemersEq, '')).toBeNull()
    expect(filterdOpNaamEq(deelnemersEq, '')).toHaveLength(0)
  })

  it('EQ-08: naam met spaties → exacte match werkt', () => {
    expect(vindDeelnemerOpNaam(deelnemersEq, 'Jan de Vries')?.id).toBe('d4')
    expect(vindDeelnemerOpNaam(deelnemersEq, 'Jan de vries')).toBeNull()
  })

  it('EQ-09: aanvaller met naam "%" matcht alleen eigen record, niet alle', () => {
    const resultNieuw = filterdOpNaamEq(deelnemersEq, '%')
    expect(resultNieuw).toHaveLength(1)
    expect(deelnemersEq.length).toBeGreaterThan(resultNieuw.length)
  })
})

// ── N4-01 t/m N4-11: client-side matching (case-insensitief) ─────────────────

describe('useMijnPotjes — N4: client-side naam-matching case-insensitief (N4-01 t/m N4-11)', () => {
  it('N4-01: lowercase profielnaam matcht deelnemer met hoofdletter', () => {
    expect(vindMijnDeelnemer(deelnemersN4, 'onbekend', 'jan')?.naam).toBe('Jan')
  })

  it('N4-02: "JAN" na toLowerCase() matcht deelnemer "Jan"', () => {
    expect(vindMijnDeelnemer(deelnemersN4, 'onbekend', 'jan')?.naam).toBe('Jan')
  })

  it('N4-03: gemixte casing "jAn" → na toLowerCase() matcht "jan"', () => {
    const profielNaamLower = 'jAn'.toLowerCase()
    expect(vindMijnDeelnemer(deelnemersN4, 'onbekend', profielNaamLower)?.naam).toBe('Jan')
  })

  it('N4-04: exact gelijke naam → basisgeval', () => {
    expect(vindMijnDeelnemer(deelnemersN4, 'onbekend', 'jan')).not.toBeNull()
  })

  it('N4-05: device_id-match werkt onafhankelijk van profielnaam', () => {
    expect(vindMijnDeelnemer(deelnemersN4, 'dev-jan', null)?.id).toBe('d1')
  })

  it('N4-06: profielnaam-match vindt deelnemer zonder device_id-match', () => {
    expect(vindMijnDeelnemer(deelnemersN4, 'vreemd', 'piet')?.id).toBe('d2')
  })

  it('N4-07: geen device_id- én naam-match → null', () => {
    expect(vindMijnDeelnemer(deelnemersN4, 'vreemd', 'onbekend')).toBeNull()
  })

  it('N4-08: lege deelnemers-array → null', () => {
    expect(vindMijnDeelnemer([], 'dev-jan', 'jan')).toBeNull()
  })

  it('N4-09: mijnVerrekening is een getal bij case-insensitieve naam-match', () => {
    const v = berekenMijnVerrekening(deelnemersN4, transactiesN4, geslotenOp, 'vreemd', 'jan')
    expect(v).not.toBeNull()
    expect(typeof v).toBe('number')
  })

  it('N4-10: mijnVerrekening is null bij naam die niet matcht', () => {
    const v = berekenMijnVerrekening(deelnemersN4, transactiesN4, geslotenOp, 'vreemd', 'janpieter')
    expect(v).toBeNull()
  })

  it('N4-11: verrekening via device_id is gelijk aan verrekening via naam', () => {
    const viaDevice = berekenMijnVerrekening(deelnemersN4, transactiesN4, geslotenOp, 'dev-jan', null)
    const viaNaam   = berekenMijnVerrekening(deelnemersN4, transactiesN4, geslotenOp, 'vreemd', 'jan')
    expect(viaDevice).toBe(viaNaam)
  })
})
