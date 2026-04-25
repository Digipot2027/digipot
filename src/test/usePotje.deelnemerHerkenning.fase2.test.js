/**
 * Regressietests — usePotje deelnemer-herkenning Fase 4 (uitsluitend user_id)
 *
 * Fase 4 (2026-04-25): device_id-fallback verwijderd. Herkenning werkt
 * uitsluitend via auth.uid() → user_id match.
 *
 * Gedekte scenario's:
 *   DH-01  user_id match → juiste deelnemer herkend
 *   DH-02  geen sessie (user null) → geen deelnemer herkend
 *   DH-03  user_id niet aanwezig in deelnemerslijst → null
 *   DH-04  meerdere deelnemers — juiste geselecteerd op user_id
 *   DH-05  user_id match op inactieve deelnemer → toch herkend
 */

import { describe, it, expect } from 'vitest'

// ── Geëxtraheerde herkenningslogica (spiegel van usePotje.laadData Fase 4) ───

function herkenDeelnemer({ deelnemers, userId }) {
  if (!userId) return null
  return deelnemers.find(x => x.user_id === userId) ?? null
}

// ── Testdata ──────────────────────────────────────────────────────────────────

const USER_ID_A = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
const USER_ID_B = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'

const deelnemerA = { id: '1', naam: 'Anna', user_id: USER_ID_A, actief: true }
const deelnemerB = { id: '2', naam: 'Bas',  user_id: USER_ID_B, actief: true }

// ── DH-01 t/m DH-05 ──────────────────────────────────────────────────────────

describe('usePotje — deelnemer-herkenning Fase 4 (uitsluitend user_id)', () => {

  it('DH-01: user_id match → juiste deelnemer herkend', () => {
    const result = herkenDeelnemer({ deelnemers: [deelnemerA, deelnemerB], userId: USER_ID_A })
    expect(result).toEqual(deelnemerA)
  })

  it('DH-02: geen sessie (userId null) → null', () => {
    const result = herkenDeelnemer({ deelnemers: [deelnemerA, deelnemerB], userId: null })
    expect(result).toBeNull()
  })

  it('DH-03: user_id niet in lijst → null', () => {
    const result = herkenDeelnemer({ deelnemers: [deelnemerA], userId: USER_ID_B })
    expect(result).toBeNull()
  })

  it('DH-04: meerdere deelnemers — juiste geselecteerd op user_id', () => {
    const result = herkenDeelnemer({ deelnemers: [deelnemerA, deelnemerB], userId: USER_ID_B })
    expect(result).toEqual(deelnemerB)
  })

  it('DH-05: user_id match op inactieve deelnemer → toch herkend (actief-check is UI)', () => {
    const inactief = { ...deelnemerA, actief: false }
    const result = herkenDeelnemer({ deelnemers: [inactief], userId: USER_ID_A })
    expect(result).toEqual(inactief)
  })

})
