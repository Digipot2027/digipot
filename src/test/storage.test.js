/**
 * Unit tests — src/utils/storage.js
 *
 * Gedekte scenario's:
 *   STR-01  getItem retourneert de opgeslagen waarde
 *   STR-02  getItem retourneert null voor een onbekende sleutel
 *   STR-03  setItem slaat de waarde correct op
 *   STR-04  removeItem verwijdert de sleutel
 *   STR-05  removeItem op een niet-bestaande sleutel gooit geen fout
 *   STR-06  getItem retourneert null als localStorage een fout gooit
 *   STR-07  setItem logt console.error als localStorage een fout gooit
 *   STR-08  removeItem logt console.error als localStorage een fout gooit
 *   STR-09  setItem overschrijft een bestaande waarde
 *   STR-10  meerdere sleutels interfereren niet met elkaar
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getItem, setItem, removeItem } from '../utils/storage'

describe('storage — getItem / setItem / removeItem', () => {

  const originalLocalStorage = window.localStorage

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: originalLocalStorage, writable: true, configurable: true })
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', { value: originalLocalStorage, writable: true, configurable: true })
  })

  // ── Basisgedrag ────────────────────────────────────────────────────────────

  it('STR-01: getItem retourneert de opgeslagen waarde', () => {
    localStorage.setItem('test-sleutel', 'hallo')
    expect(getItem('test-sleutel')).toBe('hallo')
  })

  it('STR-02: getItem retourneert null voor een onbekende sleutel', () => {
    expect(getItem('bestaat-niet')).toBeNull()
  })

  it('STR-03: setItem slaat de waarde op en is terug te lezen via getItem', () => {
    setItem('mijn-sleutel', 'mijn-waarde')
    expect(getItem('mijn-sleutel')).toBe('mijn-waarde')
  })

  it('STR-04: removeItem verwijdert de sleutel', () => {
    setItem('te-verwijderen', 'waarde')
    removeItem('te-verwijderen')
    expect(getItem('te-verwijderen')).toBeNull()
  })

  it('STR-05: removeItem op een niet-bestaande sleutel gooit geen fout', () => {
    expect(() => removeItem('bestaat-niet')).not.toThrow()
  })

  it('STR-09: setItem overschrijft een bestaande waarde', () => {
    setItem('sleutel', 'oud')
    setItem('sleutel', 'nieuw')
    expect(getItem('sleutel')).toBe('nieuw')
  })

  it('STR-10: meerdere sleutels interfereren niet met elkaar', () => {
    setItem('a', 'waarde-a')
    setItem('b', 'waarde-b')
    expect(getItem('a')).toBe('waarde-a')
    expect(getItem('b')).toBe('waarde-b')
    removeItem('a')
    expect(getItem('a')).toBeNull()
    expect(getItem('b')).toBe('waarde-b')
  })

  // ── Foutafhandeling: localStorage niet beschikbaar ─────────────────────────

  it('STR-06: getItem retourneert null als localStorage een fout gooit', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const stub = { getItem: () => { throw new Error('Toegang geweigerd') } }
    Object.defineProperty(window, 'localStorage', { value: stub, writable: true, configurable: true })
    const resultaat = getItem('sleutel')
    expect(resultaat).toBeNull()
    expect(consoleSpy).toHaveBeenCalledOnce()
    expect(consoleSpy.mock.calls[0][0]).toContain('[storage] getItem("sleutel") mislukt')
  })

  it('STR-07: setItem logt console.error als localStorage een fout gooit', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const stub = { setItem: () => { throw new Error('QuotaExceededError') } }
    Object.defineProperty(window, 'localStorage', { value: stub, writable: true, configurable: true })
    expect(() => setItem('sleutel', 'waarde')).not.toThrow()
    expect(consoleSpy).toHaveBeenCalledOnce()
    expect(consoleSpy.mock.calls[0][0]).toContain('[storage] setItem("sleutel") mislukt')
  })

  it('STR-08: removeItem logt console.error als localStorage een fout gooit', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const stub = { removeItem: () => { throw new Error('Toegang geweigerd') } }
    Object.defineProperty(window, 'localStorage', { value: stub, writable: true, configurable: true })
    expect(() => removeItem('sleutel')).not.toThrow()
    expect(consoleSpy).toHaveBeenCalledOnce()
    expect(consoleSpy.mock.calls[0][0]).toContain('[storage] removeItem("sleutel") mislukt')
  })

})
