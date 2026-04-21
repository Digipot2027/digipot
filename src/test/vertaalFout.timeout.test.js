/**
 * vertaalFout.timeout.test.js — tests voor REQUEST_TIMEOUT vertaling
 *
 * A8 fix (2026-04-20): metTimeout() gooit REQUEST_TIMEOUT bij overschrijding.
 * vertaalFout.js moet dit vertalen naar een Nederlandse gebruikerstekst.
 */
import { describe, it, expect } from 'vitest'
import { vertaalFout } from '../utils/vertaalFout'

describe('vertaalFout REQUEST_TIMEOUT', () => {
  it('vertaalt REQUEST_TIMEOUT naar Nederlandse melding', () => {
    const fout = new Error('REQUEST_TIMEOUT')
    const tekst = vertaalFout(fout)
    expect(tekst).toBe('Het verzoek duurde te lang. Controleer je verbinding en probeer het opnieuw.')
  })

  it('bevat "te lang" in de melding', () => {
    const tekst = vertaalFout(new Error('REQUEST_TIMEOUT'))
    expect(tekst).toContain('te lang')
  })

  it('retourneert geen null of undefined', () => {
    const tekst = vertaalFout(new Error('REQUEST_TIMEOUT'))
    expect(tekst).toBeTruthy()
  })

  it('is een andere melding dan de generieke fallback', () => {
    const timeout = vertaalFout(new Error('REQUEST_TIMEOUT'))
    const generiek = vertaalFout(new Error('ONBEKEND'))
    expect(timeout).not.toBe(generiek)
  })

  it('is een andere melding dan de netwerkfout', () => {
    const timeout = vertaalFout(new Error('REQUEST_TIMEOUT'))
    const netwerk = vertaalFout(new Error('NetworkError'))
    expect(timeout).not.toBe(netwerk)
  })
})
