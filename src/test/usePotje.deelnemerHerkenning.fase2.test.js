/**
 * Regressietests — usePotje deelnemer-herkenning Fase 2 (user_id primair)
 *
 * Teststrategie: logica-extractie patroon.
 *
 * De deelnemer-herkenning in usePotje.laadData is uitgebreid met een
 * user_id-match (primair) naast de bestaande device_id-match (fallback).
 *
 * Volgorde (Fase 2):
 *   1. user_id match via auth.getUser() — betrouwbaarder dan device_id
 *   2. device_id match — overgangsperiode en auth-fallback
 *
 * Gedekte scenario's:
 *   DH-01  user_id match wint van device_id match
 *   DH-02  geen user_id → device_id als fallback
 *   DH-03  user_id null in DB → device_id match werkt nog
 *   DH-04  auth.getUser() gooit → device_id als fallback
 *   DH-05  geen match op user_id én device_id → deelnemer blijft null
 *   DH-06  user_id match op inactieve deelnemer → toch herkend (actief-check
 *          is UI-verantwoordelijkheid, niet herkenningsverantwoordelijkheid)
 *   DH-07  meerdere deelnemers — juiste wordt geselecteerd op user_id
 */

import { describe, it, expect } from 'vitest'

// ── Geëxtraheerde herkenningslogica (spiegel van usePotje.laadData) ───────────

async function herkenDeelnemer({ deelnemers, getUser, deviceId }) {
  let bekende = null

  // Stap 1: user_id-match
  try {
    const { data: { user } } = await getUser()
    if (user?.id) {
      bekende = deelnemers.find(x => x.user_id === user.id) ?? null
    }
  } catch {
    // fallback
  }

  // Stap 2: device_id fallback
  if (!bekende) {
    bekende = deelnemers.find(x => x.device_id === deviceId) ?? null
  }

  return bekende
}

// ── Testdata ──────────────────────────────────────────────────────────────────

const USER_ID_A = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
const USER_ID_B = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
const DEVICE_A  = 'device-aaa'
const DEVICE_B  = 'device-bbb'

const deelnemerA = { id: '1', naam: 'Anna', user_id: USER_ID_A, device_id: DEVICE_A, actief: true }
const deelnemerB = { id: '2', naam: 'Bas',  user_id: USER_ID_B, device_id: DEVICE_B, actief: true }
const deelnemerOud = { id: '3', naam: 'Cor', user_id: null, device_id: 'device-cor', actief: true }

// ── DH-01 t/m DH-07 ──────────────────────────────────────────────────────────

describe('usePotje — deelnemer-herkenning Fase 2 (DH-01 t/m DH-07)', () => {

  it('DH-01: user_id match wint van device_id match', async () => {
    // Simuleer: user heeft user_id A, device_id B (kan gebeuren na device-wissel)
    const getUser = async () => ({ data: { user: { id: USER_ID_A } } })
    const result = await herkenDeelnemer({
      deelnemers: [deelnemerA, deelnemerB],
      getUser,
      deviceId: DEVICE_B, // device_id zou deelnemerB matchen — maar user_id wint
    })
    expect(result).toEqual(deelnemerA)
  })

  it('DH-02: geen sessie (user null) → device_id als fallback', async () => {
    const getUser = async () => ({ data: { user: null } })
    const result = await herkenDeelnemer({
      deelnemers: [deelnemerA, deelnemerB],
      getUser,
      deviceId: DEVICE_B,
    })
    expect(result).toEqual(deelnemerB)
  })

  it('DH-03: deelnemer heeft user_id null (overgangsperiode) → device_id match werkt', async () => {
    const getUser = async () => ({ data: { user: { id: 'onbekende-user-id' } } })
    const result = await herkenDeelnemer({
      deelnemers: [deelnemerOud],
      getUser,
      deviceId: 'device-cor',
    })
    expect(result).toEqual(deelnemerOud)
  })

  it('DH-04: auth.getUser() gooit → device_id als fallback, geen crash', async () => {
    const getUser = async () => { throw new Error('auth niet beschikbaar') }
    const result = await herkenDeelnemer({
      deelnemers: [deelnemerA, deelnemerB],
      getUser,
      deviceId: DEVICE_A,
    })
    expect(result).toEqual(deelnemerA)
  })

  it('DH-05: geen match op user_id én device_id → null', async () => {
    const getUser = async () => ({ data: { user: { id: 'onbekend' } } })
    const result = await herkenDeelnemer({
      deelnemers: [deelnemerA, deelnemerB],
      getUser,
      deviceId: 'onbekend-device',
    })
    expect(result).toBeNull()
  })

  it('DH-06: user_id match op inactieve deelnemer → toch herkend', async () => {
    const inactief = { ...deelnemerA, actief: false }
    const getUser = async () => ({ data: { user: { id: USER_ID_A } } })
    const result = await herkenDeelnemer({
      deelnemers: [inactief],
      getUser,
      deviceId: 'ander-device',
    })
    // Herkenning is los van actief-status — UI beslist wat te tonen
    expect(result).toEqual(inactief)
  })

  it('DH-07: meerdere deelnemers — juiste geselecteerd op user_id', async () => {
    const getUser = async () => ({ data: { user: { id: USER_ID_B } } })
    const result = await herkenDeelnemer({
      deelnemers: [deelnemerA, deelnemerB, deelnemerOud],
      getUser,
      deviceId: DEVICE_A, // zou A matchen zonder user_id-check
    })
    expect(result).toEqual(deelnemerB)
  })

})
