/**
 * Regressietests — is_mijn_deelnemer() logica (Fase 3)
 *
 * Teststrategie: logica-extractie patroon.
 *
 * is_mijn_deelnemer() is een SQL-hulpfunctie (SECURITY DEFINER) in Supabase.
 * De logica is volledig extracteerbaar als pure JS-functie zonder DB-afhankelijkheid.
 *
 * Semantiek:
 *   - Nieuwe rij  (user_id IS NOT NULL): match op auth.uid()
 *   - Legacy rij  (user_id IS NULL):     match op x-device-id header
 *
 * Dit dekt de overgangsperiode van 7 dagen waarbij beide identificatie-
 * methoden gelijktijdig actief zijn.
 *
 * Gedekte scenario's:
 *   IMD-01  user_id aanwezig + uid match → true
 *   IMD-02  user_id aanwezig + uid mismatch → false
 *   IMD-03  user_id aanwezig + uid null → false (geen auth)
 *   IMD-04  user_id null + device_id match → true (legacy)
 *   IMD-05  user_id null + device_id mismatch → false
 *   IMD-06  user_id null + device_id null → false
 *   IMD-07  beide null → false
 *   IMD-08  user_id aanwezig maar uid null, device_id match → false
 *           (user_id-rij vereist uid-match, device_id wordt genegeerd)
 *   IMD-09  user_id null, device_id leeg ('') → false
 */

import { describe, it, expect } from 'vitest'

// ── Geëxtraheerde logica (spiegel van is_mijn_deelnemer SQL-functie) ──────────

function isMijnDeelnemer({ dUserId, dDeviceId, authUid, requestDeviceId }) {
  if (dUserId !== null && dUserId !== undefined) {
    // Nieuwe situatie: eigenaarschap alleen via auth.uid()
    return authUid !== null && authUid !== undefined && dUserId === authUid
  }
  // Legacy/overgangsperiode: eigenaarschap via x-device-id
  return dDeviceId !== null &&
         dDeviceId !== undefined &&
         dDeviceId !== '' &&
         requestDeviceId !== null &&
         requestDeviceId !== undefined &&
         dDeviceId === requestDeviceId
}

// ── IMD-01 t/m IMD-09 ─────────────────────────────────────────────────────────

const UID_A   = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
const UID_B   = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
const DEV_A   = 'device-aaa'
const DEV_B   = 'device-bbb'

describe('is_mijn_deelnemer — Fase 3 eigenaarschapslogica (IMD-01 t/m IMD-09)', () => {

  it('IMD-01: user_id aanwezig + uid match → true', () => {
    expect(isMijnDeelnemer({
      dUserId: UID_A, dDeviceId: DEV_A,
      authUid: UID_A, requestDeviceId: DEV_B,
    })).toBe(true)
  })

  it('IMD-02: user_id aanwezig + uid mismatch → false', () => {
    expect(isMijnDeelnemer({
      dUserId: UID_A, dDeviceId: DEV_A,
      authUid: UID_B, requestDeviceId: DEV_A,
    })).toBe(false)
  })

  it('IMD-03: user_id aanwezig + geen auth (uid null) → false', () => {
    expect(isMijnDeelnemer({
      dUserId: UID_A, dDeviceId: DEV_A,
      authUid: null, requestDeviceId: DEV_A,
    })).toBe(false)
  })

  it('IMD-04: user_id null + device_id match → true (legacy overgangsperiode)', () => {
    expect(isMijnDeelnemer({
      dUserId: null, dDeviceId: DEV_A,
      authUid: null, requestDeviceId: DEV_A,
    })).toBe(true)
  })

  it('IMD-05: user_id null + device_id mismatch → false', () => {
    expect(isMijnDeelnemer({
      dUserId: null, dDeviceId: DEV_A,
      authUid: null, requestDeviceId: DEV_B,
    })).toBe(false)
  })

  it('IMD-06: user_id null + device_id null → false', () => {
    expect(isMijnDeelnemer({
      dUserId: null, dDeviceId: null,
      authUid: null, requestDeviceId: DEV_A,
    })).toBe(false)
  })

  it('IMD-07: beide null → false', () => {
    expect(isMijnDeelnemer({
      dUserId: null, dDeviceId: null,
      authUid: null, requestDeviceId: null,
    })).toBe(false)
  })

  it('IMD-08: user_id aanwezig maar uid null + device_id match → false (uid vereist voor user_id-rijen)', () => {
    // Kritiek: als user_id ingevuld is, mag device_id NOOIT als fallback dienen.
    // Een aanvaller die device_id raadt maar geen geldige sessie heeft wordt geblokkeerd.
    expect(isMijnDeelnemer({
      dUserId: UID_A, dDeviceId: DEV_A,
      authUid: null, requestDeviceId: DEV_A,
    })).toBe(false)
  })

  it('IMD-09: user_id null + device_id leeg string → false', () => {
    expect(isMijnDeelnemer({
      dUserId: null, dDeviceId: '',
      authUid: null, requestDeviceId: '',
    })).toBe(false)
  })

})

// ── Securityscenario's ────────────────────────────────────────────────────────

describe('is_mijn_deelnemer — securityscenario\'s', () => {

  it('SEC-1: aanvaller kent device_id van slachtoffer maar heeft geen sessie — geblokkeerd als user_id aanwezig', () => {
    // Slachtoffer heeft user_id. Aanvaller stuurt correcte device_id maar
    // heeft geen geldige auth-sessie (authUid = null of verkeerd).
    expect(isMijnDeelnemer({
      dUserId: UID_A, dDeviceId: DEV_A,
      authUid: null, requestDeviceId: DEV_A,
    })).toBe(false)
  })

  it('SEC-2: aanvaller heeft sessie maar verkeerde uid — geblokkeerd', () => {
    expect(isMijnDeelnemer({
      dUserId: UID_A, dDeviceId: DEV_A,
      authUid: UID_B, requestDeviceId: DEV_A,
    })).toBe(false)
  })

  it('SEC-3: legacy rij — aanvaller kent device_id niet — geblokkeerd', () => {
    expect(isMijnDeelnemer({
      dUserId: null, dDeviceId: DEV_A,
      authUid: UID_B, requestDeviceId: DEV_B,
    })).toBe(false)
  })

  it('SEC-4: eigen uid + eigen device_id op eigen rij → altijd true', () => {
    expect(isMijnDeelnemer({
      dUserId: UID_A, dDeviceId: DEV_A,
      authUid: UID_A, requestDeviceId: DEV_A,
    })).toBe(true)
  })

})
