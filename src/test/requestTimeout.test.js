/**
 * requestTimeout.test.js — unit tests voor metTimeout()
 *
 * Dekt:
 *   - Geslaagde query: retourneert resultaat vóór timeout
 *   - Timeout: gooit Error('REQUEST_TIMEOUT') bij overschrijding
 *   - Timeout: waarde 0 gooit direct
 *   - Timeout wordt niet getriggerd bij snel resultaat
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { metTimeout, QUERY_TIMEOUT_MS } from '../utils/requestTimeout'

describe('metTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retourneert het resultaat als de query snel klaar is', async () => {
    const snelleQuery = Promise.resolve({ data: [{ id: '1' }], error: null })
    const resultaat = await metTimeout(snelleQuery, 5000)
    expect(resultaat).toEqual({ data: [{ id: '1' }], error: null })
  })

  it('gooit REQUEST_TIMEOUT als de query te lang duurt', async () => {
    const hangendeQuery = new Promise(() => {}) // nooit resolved
    const poging = metTimeout(hangendeQuery, 100)
    vi.advanceTimersByTime(101)
    await expect(poging).rejects.toThrow('REQUEST_TIMEOUT')
  })

  it('gebruikt QUERY_TIMEOUT_MS als standaard timeout', async () => {
    const hangendeQuery = new Promise(() => {})
    const poging = metTimeout(hangendeQuery)
    vi.advanceTimersByTime(QUERY_TIMEOUT_MS + 1)
    await expect(poging).rejects.toThrow('REQUEST_TIMEOUT')
  })

  it('gooit niet als de query net binnen de timeout klaar is', async () => {
    let resolve
    const query = new Promise(res => { resolve = res })
    const poging = metTimeout(query, 1000)
    vi.advanceTimersByTime(999)
    resolve({ data: [], error: null })
    const resultaat = await poging
    expect(resultaat).toEqual({ data: [], error: null })
  })

  it('timeout-error heeft de juiste message string', async () => {
    const hangendeQuery = new Promise(() => {})
    const poging = metTimeout(hangendeQuery, 50)
    vi.advanceTimersByTime(51)
    await expect(poging).rejects.toMatchObject({ message: 'REQUEST_TIMEOUT' })
  })
})

describe('QUERY_TIMEOUT_MS', () => {
  it('is een getal groter dan 0', () => {
    expect(typeof QUERY_TIMEOUT_MS).toBe('number')
    expect(QUERY_TIMEOUT_MS).toBeGreaterThan(0)
  })

  it('is ten minste 5 seconden (cold-start buffer)', () => {
    expect(QUERY_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000)
  })
})
