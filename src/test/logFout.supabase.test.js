/**
 * logFout — aanvullende tests voor Supabase plain object conversie
 *
 * Dekt de fix voor JAVASCRIPT-REACT-3:
 * Supabase geeft soms een plain object terug { code, details, hint, message }
 * in plaats van een Error-instantie. logFout moet dit omzetten naar een Error
 * zodat Sentry een leesbare melding toont i.p.v. "Object captured as exception
 * with keys: code, details, hint, message".
 *
 * Gedekte cases:
 *   LF-PO-01  plain object met message → Error met die message
 *   LF-PO-02  plain object met SALDO_TE_LAAG → niet naar Sentry, geeft null
 *   LF-PO-03  plain object met duplicate key → niet naar Sentry
 *   LF-PO-04  plain object zonder message → Error met code als fallback
 *   LF-PO-05  plain object zonder message én zonder code → Error met JSON
 *   LF-PO-06  supabaseCode wordt als extra meegegeven aan Sentry
 *   LF-PO-07  echte Error-instantie blijft onaangetast (instanceof check)
 *   LF-PO-08  plain object geeft Nederlandse gebruikerstekst terug
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}))

import * as Sentry from '@sentry/react'
import { logFout } from '../utils/logFout'

beforeEach(() => {
  vi.clearAllMocks()
})

// ── LF-PO-01: plain object met message → correct verwerkt ────────────────────

describe('logFout — LF-PO-01: plain object met message', () => {
  it('geeft een Nederlandse gebruikerstekst terug (geen crash)', () => {
    const supabaseObj = { code: 'PGRST116', details: null, hint: null, message: 'onbekende fout' }
    const result = logFout(supabaseObj, { component: 'Test', actie: 'laden' })
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('stuurt de fout naar Sentry als het geen gebruikersfout is', () => {
    const supabaseObj = { code: 'PGRST116', details: null, hint: null, message: 'row not found' }
    logFout(supabaseObj, { component: 'Test', actie: 'laden' })
    expect(Sentry.captureException).toHaveBeenCalledOnce()
  })

  it('stuurt een echte Error-instantie naar Sentry (niet het plain object)', () => {
    const supabaseObj = { code: 'PGRST116', details: null, hint: null, message: 'row not found' }
    logFout(supabaseObj, { component: 'Test', actie: 'laden' })
    const [errorArg] = Sentry.captureException.mock.calls[0]
    expect(errorArg).toBeInstanceOf(Error)
    expect(errorArg.message).toBe('row not found')
  })
})

// ── LF-PO-02: plain object SALDO_TE_LAAG → niet naar Sentry, geeft null ─────

describe('logFout — LF-PO-02: plain object met SALDO_TE_LAAG', () => {
  it('geeft null terug bij SALDO_TE_LAAG in plain object', () => {
    const supabaseObj = {
      code: 'P0001', details: null, hint: null,
      message: 'SALDO_TE_LAAG: betaling van 56.00 overschrijdt beschikbaar saldo van 50.00',
    }
    const result = logFout(supabaseObj, { component: 'Test', actie: 'betaling' })
    expect(result).toBeNull()
  })

  it('stuurt SALDO_TE_LAAG plain object NIET naar Sentry', () => {
    const supabaseObj = {
      code: 'P0001', details: null, hint: null,
      message: 'SALDO_TE_LAAG: betaling van 56.00 overschrijdt beschikbaar saldo van 50.00',
    }
    logFout(supabaseObj, { component: 'Test', actie: 'betaling' })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})

// ── LF-PO-03: plain object duplicate key → niet naar Sentry ──────────────────

describe('logFout — LF-PO-03: plain object met duplicate key', () => {
  it('stuurt duplicate key plain object NIET naar Sentry', () => {
    const supabaseObj = {
      code: '23505', details: null, hint: null,
      message: 'duplicate key value violates unique constraint "deelnemers_potje_id_naam"',
    }
    logFout(supabaseObj, { component: 'Test', actie: 'deelnemen' })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('geeft de juiste vertaalde tekst terug voor duplicate naam', () => {
    const supabaseObj = {
      code: '23505', details: null, hint: null,
      message: 'duplicate key value violates unique constraint "deelnemers_potje_id_naam"',
    }
    const result = logFout(supabaseObj, { component: 'Test', actie: 'deelnemen' })
    expect(result).toBe('Deze naam is al bezet in dit potje. Kies een andere naam.')
  })
})

// ── LF-PO-04: plain object zonder message → code als fallback ────────────────

describe('logFout — LF-PO-04: plain object zonder message', () => {
  it('gebruikt code als fallback voor de Error message', () => {
    const supabaseObj = { code: 'PGRST301', details: null, hint: null, message: undefined }
    logFout(supabaseObj, { component: 'Test', actie: 'laden' })
    const [errorArg] = Sentry.captureException.mock.calls[0]
    expect(errorArg).toBeInstanceOf(Error)
    expect(errorArg.message).toBe('PGRST301')
  })
})

// ── LF-PO-05: plain object zonder message én code → JSON-fallback ────────────

describe('logFout — LF-PO-05: plain object zonder message en code', () => {
  it('valt terug op JSON.stringify als message en code ontbreken', () => {
    const supabaseObj = { details: 'iets', hint: null, message: undefined, code: undefined }
    expect(() => {
      logFout(supabaseObj, { component: 'Test', actie: 'laden' })
    }).not.toThrow()
  })

  it('geeft altijd een string terug, geen crash', () => {
    const supabaseObj = { details: 'iets', hint: null }
    const result = logFout(supabaseObj, { component: 'Test', actie: 'laden' })
    expect(typeof result).toBe('string')
  })
})

// ── LF-PO-06: supabaseCode wordt als extra meegegeven aan Sentry ──────────────

describe('logFout — LF-PO-06: supabaseCode in Sentry extra', () => {
  it('supabaseCode zit in de extra-context naar Sentry', () => {
    const supabaseObj = { code: 'PGRST116', details: null, hint: null, message: 'row not found' }
    logFout(supabaseObj, { component: 'TestComp', actie: 'laden' })
    const [, opties] = Sentry.captureException.mock.calls[0]
    expect(opties.extra.supabaseCode).toBe('PGRST116')
  })

  it('component en actie zitten in de extra-context naar Sentry', () => {
    const supabaseObj = { code: 'PGRST116', details: null, hint: null, message: 'row not found' }
    logFout(supabaseObj, { component: 'TestComp', actie: 'opslaan' })
    const [, opties] = Sentry.captureException.mock.calls[0]
    expect(opties.extra.component).toBe('TestComp')
    expect(opties.extra.actie).toBe('opslaan')
  })
})

// ── LF-PO-07: echte Error-instantie blijft onaangetast ───────────────────────

describe('logFout — LF-PO-07: echte Error-instantie wordt niet gewijzigd', () => {
  it('echte Error wordt direct naar Sentry gestuurd (niet opnieuw verpakt)', () => {
    const error = new Error('echte fout')
    logFout(error, { component: 'Test', actie: 'laden' })
    const [errorArg] = Sentry.captureException.mock.calls[0]
    expect(errorArg).toBe(error) // referentie-gelijkheid
  })

  it('echte Error behoudt zijn originele message', () => {
    const error = new Error('netwerk timeout')
    logFout(error, { component: 'Test', actie: 'laden' })
    const [errorArg] = Sentry.captureException.mock.calls[0]
    expect(errorArg.message).toBe('netwerk timeout')
  })
})

// ── LF-PO-08: plain object geeft Nederlandse gebruikerstekst ─────────────────

describe('logFout — LF-PO-08: plain object geeft vertaalde tekst', () => {
  it('JWT-fout in plain object geeft Nederlandse sessie-melding', () => {
    const supabaseObj = { code: 'PGRST301', details: null, hint: null, message: 'JWT expired' }
    const result = logFout(supabaseObj, { component: 'Test', actie: 'laden' })
    expect(result).toBe('Sessie verlopen. Ververs de pagina.')
  })

  it('netwerk-fout in plain object geeft Nederlandse verbindingsmelding', () => {
    const supabaseObj = { code: null, details: null, hint: null, message: 'fetch failed: network error' }
    const result = logFout(supabaseObj, { component: 'Test', actie: 'laden' })
    expect(result).toContain('Verbinding verbroken')
  })

  it('onbekende fout in plain object geeft fallback-melding', () => {
    const supabaseObj = { code: 'XYZ', details: null, hint: null, message: 'totaal onbekend' }
    const result = logFout(supabaseObj, { component: 'Test', actie: 'laden' })
    expect(result).toBe('Er is iets misgegaan. Probeer het opnieuw.')
  })
})
