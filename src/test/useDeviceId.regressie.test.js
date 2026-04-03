/**
 * Regressietests — useDeviceId UUID-validatie (SEC-M1)
 *
 * Teststrategie: logica-extractie patroon.
 *
 * useDeviceId bevat een UUID v4-validatiepatroon dat voorkomt dat een
 * gemanipuleerde waarde in localStorage als device-identiteit wordt
 * geaccepteerd. De validatielogica is extracteerbaar als pure functie.
 *
 * Gedekte scenario's:
 *   UID-01  geldige UUID v4 wordt geaccepteerd
 *   UID-02  lege string → nieuw UUID genereren
 *   UID-03  null → nieuw UUID genereren
 *   UID-04  willekeurige tekst → nieuw UUID genereren
 *   UID-05  UUID v1 (andere versie) → afwijzen
 *   UID-06  UUID met hoofdletters → accepteren (patroon is case-insensitief)
 *   UID-07  UUID met ontbrekend segment → afwijzen
 *   UID-08  SQL-wildcard als profielnaam → niet als UUID geaccepteerd
 *   UID-09  nieuw gegenereerd UUID voldoet altijd aan het patroon
 */

import { describe, it, expect } from 'vitest'

// ── Geëxtraheerde validatielogica uit useDeviceId ─────────────────────────────

const UUID_PATROON = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isGeldigeUuid(waarde) {
  if (!waarde) return false
  return UUID_PATROON.test(waarde)
}

// Simuleert de volledige hook-logica zonder localStorage
function bepaalDeviceId(opgeslagen) {
  if (opgeslagen && isGeldigeUuid(opgeslagen)) {
    return opgeslagen
  }
  // In productie: crypto.randomUUID() — hier simuleren we een vast nieuw UUID
  return 'nieuw-uuid-gegenereerd'
}

// ── UID-01 t/m UID-09 ─────────────────────────────────────────────────────────

describe('useDeviceId — UUID v4 validatie (UID-01 t/m UID-09)', () => {

  it('UID-01: geldige UUID v4 wordt geaccepteerd', () => {
    const geldig = '550e8400-e29b-41d4-a716-446655440000'
    expect(isGeldigeUuid(geldig)).toBe(true)
    expect(bepaalDeviceId(geldig)).toBe(geldig)
  })

  it('UID-01b: tweede geldige UUID v4 vorm', () => {
    const geldig = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
    expect(isGeldigeUuid(geldig)).toBe(true)
  })

  it('UID-02: lege string → ongeldig → nieuw UUID', () => {
    expect(isGeldigeUuid('')).toBe(false)
    expect(bepaalDeviceId('')).toBe('nieuw-uuid-gegenereerd')
  })

  it('UID-03: null → ongeldig → nieuw UUID', () => {
    expect(isGeldigeUuid(null)).toBe(false)
    expect(bepaalDeviceId(null)).toBe('nieuw-uuid-gegenereerd')
  })

  it('UID-04: willekeurige tekst → afwijzen', () => {
    expect(isGeldigeUuid('hallo-wereld')).toBe(false)
    expect(isGeldigeUuid('admin')).toBe(false)
    expect(isGeldigeUuid('12345')).toBe(false)
  })

  it('UID-05: UUID v1 (versiecijfer 1 ipv 4) → afwijzen', () => {
    // Derde groep begint met 1, niet 4 → geen v4
    const v1 = '550e8400-e29b-11d4-a716-446655440000'
    expect(isGeldigeUuid(v1)).toBe(false)
  })

  it('UID-06: UUID met hoofdletters → accepteren (patroon is /i)', () => {
    const hoofdletters = '550E8400-E29B-41D4-A716-446655440000'
    expect(isGeldigeUuid(hoofdletters)).toBe(true)
  })

  it('UID-07: UUID met ontbrekend segment → afwijzen', () => {
    expect(isGeldigeUuid('550e8400-e29b-41d4-a716')).toBe(false)
    expect(isGeldigeUuid('550e8400-e29b-41d4')).toBe(false)
  })

  it('UID-08: SQL-wildcard tekens worden als ongeldige UUID herkend', () => {
    // Beschermt indirect: % en _ kunnen in localStorage gezet worden
    // door een aanvaller om vervolgens in een Supabase .eq()-query te laten matchen
    expect(isGeldigeUuid('%')).toBe(false)
    expect(isGeldigeUuid('_')).toBe(false)
    expect(isGeldigeUuid('%25')).toBe(false)
  })

  it('UID-09: nieuw gegenereerd UUID via crypto.randomUUID() voldoet aan het patroon', () => {
    // crypto.randomUUID() is beschikbaar in Vitest (jsdom met Node.js crypto)
    const nieuw = crypto.randomUUID()
    expect(isGeldigeUuid(nieuw)).toBe(true)
  })

})
