/**
 * logFout.42501.regressie.test.js — A18 fix regressietest
 *
 * Vóór de fix (A18, 2026-04-20) was '42501' uitgesloten van Sentry-logging.
 * Na de fix worden 42501-fouten (PostgreSQL permission denied / RLS) wél naar
 * Sentry gestuurd zodat ze zichtbaar zijn als bugs.
 *
 * 'row-level security' (de tekstmatcher) blijft als gebruikersfout uitgesloten:
 * die kan optreden bij verouderde sessies en is dan een verwachte situatie.
 *
 * Dekt:
 *   - 42501 fout wordt nu naar Sentry gestuurd (was eerder uitgesloten)
 *   - 'row-level security' in message blijft als gebruikersfout (geen Sentry)
 *   - REQUEST_TIMEOUT is uitgesloten van Sentry (A8 fix)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCapture = vi.fn()

vi.mock('@sentry/react', () => ({
  captureException: mockCapture,
}))

// Dynamische import na de mock zodat de module de mock oppikt
let logFout
beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  const mod = await import('../utils/logFout')
  logFout = mod.logFout
})

describe('A18 fix — 42501 gaat naar Sentry', () => {
  it('stuurt een 42501-fout naar Sentry', () => {
    const fout = new Error('permission denied for table transacties — 42501')
    logFout(fout, { component: 'test', actie: 'test' })
    expect(mockCapture).toHaveBeenCalledTimes(1)
  })

  it('stuurt een Supabase plain object met code 42501 naar Sentry als message geen row-level tekst bevat', () => {
    // Supabase plain object met alleen de code als message — geen 'row-level security'-tekst
    const fout = { code: '42501', message: '42501', hint: '', details: '' }
    logFout(fout, { component: 'test', actie: 'test' })
    // message bevat '42501' maar niet 'row-level security' → gaat naar Sentry
    expect(mockCapture).toHaveBeenCalledTimes(1)
  })

  it('stuurt fout met alleen code 42501 en geen row-level tekst naar Sentry', () => {
    // Stel: Supabase stuurt code zonder de human-readable tekst
    const fout = new Error('42501')
    logFout(fout, { component: 'test', actie: 'test' })
    // '42501' zit niet meer in de uitzonderingslijst — gaat naar Sentry
    expect(mockCapture).toHaveBeenCalledTimes(1)
  })
})

describe('A18 — row-level security blijft gebruikersfout', () => {
  it('stuurt fout met "row-level security" in message NIET naar Sentry', () => {
    const fout = new Error('new row violates row-level security policy for table "transacties"')
    logFout(fout, { component: 'test', actie: 'test' })
    expect(mockCapture).toHaveBeenCalledTimes(0)
  })
})

describe('A8 fix — REQUEST_TIMEOUT is geen Sentry-event', () => {
  it('stuurt REQUEST_TIMEOUT NIET naar Sentry', () => {
    const fout = new Error('REQUEST_TIMEOUT')
    logFout(fout, { component: 'test', actie: 'test' })
    expect(mockCapture).toHaveBeenCalledTimes(0)
  })
})
