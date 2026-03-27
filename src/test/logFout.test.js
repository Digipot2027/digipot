import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Sentry vóór de import van logFout zodat de mock al actief is
vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}))

import * as Sentry from '@sentry/react'
import { logFout } from '../utils/logFout'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('logFout', () => {
  it('geeft een vertaalde foutmelding terug', () => {
    const error = new Error('fetch failed')
    const bericht = logFout(error, { component: 'Test', actie: 'laden' })
    expect(typeof bericht).toBe('string')
    expect(bericht.length).toBeGreaterThan(0)
  })

  it('stuurt onbekende fouten naar Sentry', () => {
    const error = new Error('onverwachte databasefout')
    logFout(error, { component: 'Test', actie: 'opslaan' })
    expect(Sentry.captureException).toHaveBeenCalledWith(error, expect.objectContaining({
      extra: expect.objectContaining({
        component: 'Test',
        actie: 'opslaan',
      })
    }))
  })

  it('stuurt duplicate key fouten NIET naar Sentry (verwachte gebruikersfout)', () => {
    const error = new Error('duplicate key value violates unique constraint deelnemers_potje_id_naam')
    logFout(error, { component: 'Test', actie: 'deelnemen' })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('stuurt SALDO_TE_LAAG NIET naar Sentry (verwachte gebruikersfout)', () => {
    const error = new Error('SALDO_TE_LAAG:10.00')
    logFout(error, { component: 'Test', actie: 'betaling' })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('stuurt NIET_ACTIEF NIET naar Sentry (verwachte gebruikersfout)', () => {
    const error = new Error('NIET_ACTIEF')
    logFout(error, { component: 'Test', actie: 'betaling' })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('geeft fallback tekst terug bij null error', () => {
    const bericht = logFout(null)
    expect(bericht).toBe('Er is iets misgegaan. Probeer het opnieuw.')
  })

  it('gebruikt onbekend als context ontbreekt maar logt nog steeds naar Sentry', () => {
    const error = new Error('netwerkfout')
    logFout(error)
    expect(Sentry.captureException).toHaveBeenCalledWith(error, expect.objectContaining({
      extra: expect.objectContaining({
        component: 'onbekend',
        actie: 'onbekend',
      })
    }))
  })
})
