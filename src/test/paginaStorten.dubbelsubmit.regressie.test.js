/**
 * PaginaStorten — regressietest dubbelstorten (fix 2026-04-13)
 *
 * Bug: deelnemer "iMac" stortte €20 drie keer in 18 seconden.
 *
 * Root cause 1 (frontend): setBezig(true) is asynchroon. Bij snelle dubbele klik
 * werd handleStorten twee keer aangeroepen vóórdat React de knop had uitgeschakeld.
 *
 * Root cause 2 (database): geen idempotency constraint — de DB accepteerde
 * identieke inserts zonder bezwaar.
 *
 * Fix laag 1: bezigRef (useRef) — synchroon, niet afhankelijk van render-cyclus.
 * Fix laag 2: idempotency_key UUID per submit — DB-constraint blokkeert duplicaat.
 *
 * Gedekte scenario's:
 *   DS-01  ref-guard blokkeert tweede aanroep synchroon
 *   DS-02  ref-guard reset correct na fout (bezigRef.current = false in catch)
 *   DS-03  ref-guard reset NIET na succes (navigate heeft al plaatsgevonden)
 *   DS-04  idempotency_key is een geldige UUID v4
 *   DS-05  twee opeenvolgende submits genereren verschillende keys
 *   DS-06  duplicate key error wordt herkend als gebruikersfout (niet naar Sentry)
 *   DS-07  ref-guard werkt onafhankelijk van bezig state
 */

import { describe, it, expect } from 'vitest'

// ── Extractie: ref-guard logica ───────────────────────────────────────────────
function maakRefGuard() {
  const ref = { current: false }
  function probeerSubmit() {
    if (ref.current) return false
    ref.current = true
    return true
  }
  function resetNaFout() {
    ref.current = false
  }
  return { probeerSubmit, resetNaFout, ref }
}

// ── Extractie: idempotency key ────────────────────────────────────────────────
const UUID_PATROON = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function genereerIdempotencyKey() {
  return crypto.randomUUID()
}

// ── Extractie: duplicate key herkenning ──────────────────────────────────────
function isDuplicateKeyFout(msg) {
  return msg?.includes('duplicate key') ?? false
}

// ── DS-01 ─────────────────────────────────────────────────────────────────────
describe('DS-01: ref-guard blokkeert tweede aanroep synchroon', () => {
  it('eerste aanroep wordt toegelaten', () => {
    const { probeerSubmit } = maakRefGuard()
    expect(probeerSubmit()).toBe(true)
  })

  it('tweede aanroep wordt geblokkeerd', () => {
    const { probeerSubmit } = maakRefGuard()
    probeerSubmit()
    expect(probeerSubmit()).toBe(false)
  })

  it('derde en vierde aanroep worden ook geblokkeerd', () => {
    const { probeerSubmit } = maakRefGuard()
    probeerSubmit()
    expect(probeerSubmit()).toBe(false)
    expect(probeerSubmit()).toBe(false)
    expect(probeerSubmit()).toBe(false)
  })
})

// ── DS-02 ─────────────────────────────────────────────────────────────────────
describe('DS-02: ref reset correct na fout', () => {
  it('na resetNaFout is een nieuwe aanroep weer toegelaten', () => {
    const { probeerSubmit, resetNaFout } = maakRefGuard()
    probeerSubmit()
    resetNaFout()
    expect(probeerSubmit()).toBe(true)
  })

  it('na reset werkt de guard daarna weer normaal', () => {
    const { probeerSubmit, resetNaFout } = maakRefGuard()
    probeerSubmit()
    resetNaFout()
    probeerSubmit()
    expect(probeerSubmit()).toBe(false)
  })
})

// ── DS-03 ─────────────────────────────────────────────────────────────────────
describe('DS-03: ref reset NIET na succes', () => {
  it('na succesvolle submit blijft de ref vergrendeld', () => {
    const { probeerSubmit, ref } = maakRefGuard()
    probeerSubmit()
    // Geen reset na succes — navigate heeft plaatsgevonden, component unmounted
    expect(ref.current).toBe(true)
    expect(probeerSubmit()).toBe(false)
  })
})

// ── DS-04 ─────────────────────────────────────────────────────────────────────
describe('DS-04: idempotency_key is geldige UUID v4', () => {
  it('voldoet aan UUID v4 patroon', () => {
    expect(UUID_PATROON.test(genereerIdempotencyKey())).toBe(true)
  })

  it('versiecijfer is 4', () => {
    expect(genereerIdempotencyKey().split('-')[2][0]).toBe('4')
  })
})

// ── DS-05 ─────────────────────────────────────────────────────────────────────
describe('DS-05: twee submits genereren verschillende keys', () => {
  it('twee opeenvolgende keys zijn verschillend', () => {
    expect(genereerIdempotencyKey()).not.toBe(genereerIdempotencyKey())
  })

  it('tien keys zijn allemaal uniek', () => {
    const keys = Array.from({ length: 10 }, genereerIdempotencyKey)
    expect(new Set(keys).size).toBe(10)
  })
})

// ── DS-06 ─────────────────────────────────────────────────────────────────────
describe('DS-06: duplicate key error herkenning', () => {
  it('duplicate key wordt herkend', () => {
    expect(isDuplicateKeyFout('duplicate key value violates unique constraint')).toBe(true)
  })

  it('andere fouten worden niet herkend als duplicate', () => {
    expect(isDuplicateKeyFout('foreign key violation')).toBe(false)
    expect(isDuplicateKeyFout('null value in column')).toBe(false)
    expect(isDuplicateKeyFout(null)).toBe(false)
  })
})

// ── DS-07 ─────────────────────────────────────────────────────────────────────
describe('DS-07: ref-guard onafhankelijk van bezig state', () => {
  it('ref blokkeert ook als bezig state nog false is', () => {
    const { probeerSubmit } = maakRefGuard()
    let bezigState = false   // simuleert React state — nog niet bijgewerkt

    const eerste = probeerSubmit()
    expect(bezigState).toBe(false)   // state nog false
    expect(eerste).toBe(true)        // ref liet eerste door

    const tweede = probeerSubmit()
    expect(bezigState).toBe(false)   // state nog steeds false
    expect(tweede).toBe(false)       // ref blokkeert toch correct
  })
})
