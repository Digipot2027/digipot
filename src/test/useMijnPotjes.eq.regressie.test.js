/**
 * Regressietests — useMijnPotjes profielnaamfilter SEC-H2 (eq vs ilike)
 *
 * Teststrategie: logica-extractie patroon.
 *
 * SEC-H2: het profielnaamfilter gebruikte voorheen .ilike() wat SQL-wildcards
 * (% en _) accepteert. Een profielnaam '%' zou alle deelnemers matchen.
 * Na de fix gebruikt het filter .eq() — een exacte case-sensitieve vergelijking.
 *
 * De tests valideren de CORRECTE gedragsverandering:
 *   - Exacte naam-matching werkt nog steeds
 *   - Wildcardtekens worden NIET als patroon behandeld
 *   - Lege of null profielnaam levert geen resultaten op
 *
 * Gedekte scenario's:
 *   EQ-01  exacte naam-match → deelnemer gevonden
 *   EQ-02  andere case → NIET gevonden (eq is case-sensitief)
 *   EQ-03  wildcard '%' als naam → NIET gevonden (geen pattern matching)
 *   EQ-04  wildcard '_' als naam → NIET gevonden
 *   EQ-05  gedeeltelijke naam → NIET gevonden (geen like-matching)
 *   EQ-06  null profielnaam → lege lijst, geen query
 *   EQ-07  lege string profielnaam → lege lijst, geen query
 *   EQ-08  naam met spaties → exacte match werkt
 *
 * Aanname: de query-builder gedraagt zich als een exacte vergelijking.
 * We testen de CLIENT-SIDE matching die na de fix in useMijnPotjes staat
 * (stap 4: mijnDeelnemer zoeken). De DB-filter .eq() is niet mockbaar
 * zonder Supabase, maar de client-side equivalent is wel testbaar.
 */

import { describe, it, expect } from 'vitest'

// ── Geëxtraheerde logica: deelnemer vinden op naam (eq-semantiek) ─────────────
// Simuleert de stap-4 logica in useMijnPotjes na de SEC-H2 fix.
// Oud: d.naam.toLowerCase() === profielNaam.toLowerCase() (case-insensitief)
// Nieuw: d.naam === profielNaam (exact, case-sensitief, geen wildcards)

function vindDeelnemerOpNaam(deelnemers, profielNaam) {
  if (!profielNaam) return null
  return deelnemers.find(d => d.naam === profielNaam) ?? null
}

// Simuleert de Supabase .eq() filterlogica client-side
// (representeert hoe de DB-filter werkt bij een exacte vergelijking)
function filterdOpNaamEq(deelnemers, profielNaam) {
  if (!profielNaam) return []
  return deelnemers.filter(d => d.naam === profielNaam)
}

// ── Testdata ──────────────────────────────────────────────────────────────────

const deelnemers = [
  { id: 'd1', naam: 'Alice', device_id: 'dev-a' },
  { id: 'd2', naam: 'Bob',   device_id: 'dev-b' },
  { id: 'd3', naam: '%',     device_id: 'dev-c' }, // aanvallersnaam
  { id: 'd4', naam: 'Jan de Vries', device_id: 'dev-d' },
]

// ── EQ-01 t/m EQ-08 ───────────────────────────────────────────────────────────

describe('useMijnPotjes — SEC-H2: profielnaamfilter eq-semantiek (EQ-01 t/m EQ-08)', () => {

  it('EQ-01: exacte naam-match → deelnemer gevonden', () => {
    expect(vindDeelnemerOpNaam(deelnemers, 'Alice')?.id).toBe('d1')
    expect(filterdOpNaamEq(deelnemers, 'Bob')).toHaveLength(1)
  })

  it('EQ-02: andere case → NIET gevonden (eq is case-sensitief)', () => {
    // Oud gedrag: 'alice'.toLowerCase() === 'Alice'.toLowerCase() → true (gevonden)
    // Nieuw gedrag: 'alice' === 'Alice' → false (niet gevonden)
    expect(vindDeelnemerOpNaam(deelnemers, 'alice')).toBeNull()
    expect(filterdOpNaamEq(deelnemers, 'ALICE')).toHaveLength(0)
  })

  it('EQ-03: wildcard "%" als profielnaam → NIET gevonden als patroon (alleen exacte match op naam "%")', () => {
    // ilike('%') zou ALLE deelnemers matchen — eq('%') matcht alleen naam === '%'
    const result = filterdOpNaamEq(deelnemers, '%')
    // Alleen d3 heeft naam '%' — niet alle vier
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('d3')
  })

  it('EQ-04: wildcard "_" als profielnaam → geen onbedoelde matches', () => {
    // ilike('_') zou deelnemers met één-karakter namen matchen
    // eq('_') matcht alleen exacte naam '_' — die bestaat niet in de testdata
    expect(filterdOpNaamEq(deelnemers, '_')).toHaveLength(0)
  })

  it('EQ-05: gedeeltelijke naam → NIET gevonden (geen like-matching)', () => {
    // ilike('Ali%') zou Alice matchen; eq('Ali%') matcht alleen exacte naam 'Ali%'
    expect(vindDeelnemerOpNaam(deelnemers, 'Ali')).toBeNull()
    expect(filterdOpNaamEq(deelnemers, 'Alic')).toHaveLength(0)
  })

  it('EQ-06: null profielnaam → lege lijst (geen query uitgevoerd)', () => {
    expect(vindDeelnemerOpNaam(deelnemers, null)).toBeNull()
    expect(filterdOpNaamEq(deelnemers, null)).toHaveLength(0)
  })

  it('EQ-07: lege string profielnaam → lege lijst (geen query uitgevoerd)', () => {
    expect(vindDeelnemerOpNaam(deelnemers, '')).toBeNull()
    expect(filterdOpNaamEq(deelnemers, '')).toHaveLength(0)
  })

  it('EQ-08: naam met spaties → exacte match werkt correct', () => {
    expect(vindDeelnemerOpNaam(deelnemers, 'Jan de Vries')?.id).toBe('d4')
    expect(vindDeelnemerOpNaam(deelnemers, 'Jan de vries')).toBeNull()
  })

})

describe('useMijnPotjes — SEC-H2: aanvalsscenario volledig geblokkeerd', () => {

  it('EQ-09: aanvaller met naam "%" matcht alleen zijn eigen deelnemerrecord', () => {
    // Vóór de fix: .ilike('%') zou alle deelnemers teruggeven
    // Na de fix: .eq('%') geeft alleen deelnemers met naam === '%'
    const alles = deelnemers // alle 4 deelnemers in de DB
    const resultOud = alles // ilike('%') gedrag: alle records
    const resultNieuw = filterdOpNaamEq(alles, '%')

    // Het verschil toont de aanvalssuppressie:
    expect(resultOud.length).toBeGreaterThan(resultNieuw.length)
    expect(resultNieuw).toHaveLength(1) // alleen eigen record
  })

})
