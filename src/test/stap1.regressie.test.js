/**
 * Regressietests — Stap 1: constants + hooks (useDeviceId, useFocusTrap)
 *
 * Teststrategie: logica-extractie patroon.
 * Tests verifiëren:
 *   1. constants — correcte waarden, geen typefouten
 *   2. useDeviceId — UUID aanmaken + hergebruik (puur localStorage-contract)
 *   3. useFocusTrap — Escape-callback + Tab-cycling (DOM-interactie via jsdom)
 *
 * Let op (SEC-M1): useDeviceId valideert de opgeslagen UUID tegen het UUID v4-patroon.
 * Testwaarden in localStorage moeten altijd geldige UUID v4's zijn, anders worden
 * ze als ongeldig beschouwd en vervangen door een nieuw UUID.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ── 1. Constants ─────────────────────────────────────────────────────────────

import {
  DEVICE_ID_KEY,
  PROFIEL_NAAM_KEY,
  TEKSTGROOTTE_KEY,
  MAX_NAAM,
  MAX_DEELNEMERS,
  MAX_BEDRAG,
  VALUTA_OPTIES,
} from '../constants'

describe('constants', () => {
  it('localStorage-sleutels zijn correcte strings', () => {
    expect(DEVICE_ID_KEY).toBe('digipot_device_id')
    expect(PROFIEL_NAAM_KEY).toBe('digipot_profiel_naam')
    expect(TEKSTGROOTTE_KEY).toBe('digipot_tekstgrootte')
  })

  it('invoerlimieten kloppen met DB-constraints', () => {
    expect(MAX_NAAM).toBe(30)
    expect(MAX_DEELNEMERS).toBe(20)
    expect(MAX_BEDRAG).toBe(999.99)
  })

  it('VALUTA_OPTIES bevat 7 valuta met waarde + label', () => {
    expect(VALUTA_OPTIES).toHaveLength(7)
    expect(VALUTA_OPTIES[0].waarde).toBe('EUR')
    for (const opt of VALUTA_OPTIES) {
      expect(typeof opt.waarde).toBe('string')
      expect(opt.waarde).toHaveLength(3) // ISO 4217 = altijd 3 tekens
      expect(typeof opt.label).toBe('string')
      expect(opt.label.length).toBeGreaterThan(0)
    }
  })

  it('VALUTA_OPTIES bevat EUR, USD, GBP, CHF, DKK, NOK, SEK in volgorde', () => {
    const waardes = VALUTA_OPTIES.map(o => o.waarde)
    expect(waardes).toEqual(['EUR', 'USD', 'GBP', 'CHF', 'DKK', 'NOK', 'SEK'])
  })
})

// ── 2. useDeviceId ────────────────────────────────────────────────────────────

import { useDeviceId } from '../hooks/useDeviceId'

// Geldige UUID v4-waarden voor gebruik in tests (SEC-M1: validatie vereist echte UUID v4).
// Ongeldige strings zoals 'bestaand-uuid-5678' worden door useDeviceId verworpen.
const GELDIG_UUID_A = 'a1b2c3d4-e5f6-4789-ab12-cd34ef567890'
const GELDIG_UUID_B = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const GELDIG_UUID_STUB = '12345678-1234-4234-8234-123456789abc'

describe('useDeviceId', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => GELDIG_UUID_STUB),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('maakt een nieuw UUID aan als er nog geen staat opgeslagen', () => {
    const { result } = renderHook(() => useDeviceId())
    expect(result.current).toBe(GELDIG_UUID_STUB)
    expect(localStorage.getItem('digipot_device_id')).toBe(GELDIG_UUID_STUB)
  })

  it('hergebruikt het bestaande UUID uit localStorage', () => {
    // SEC-M1: waarde moet een geldig UUID v4 zijn, anders wordt hij verworpen
    localStorage.setItem('digipot_device_id', GELDIG_UUID_A)
    const { result } = renderHook(() => useDeviceId())
    expect(result.current).toBe(GELDIG_UUID_A)
    expect(crypto.randomUUID).not.toHaveBeenCalled()
  })

  it('slaat het nieuwe UUID op in localStorage', () => {
    renderHook(() => useDeviceId())
    expect(localStorage.getItem('digipot_device_id')).toBe(GELDIG_UUID_STUB)
  })

  it('geeft altijd een niet-lege string terug', () => {
    const { result } = renderHook(() => useDeviceId())
    expect(typeof result.current).toBe('string')
    expect(result.current.length).toBeGreaterThan(0)
  })

  it('stabiel over re-renders — geeft hetzelfde UUID terug', () => {
    // SEC-M1: geldige UUID v4 vereist voor hergebruik
    localStorage.setItem('digipot_device_id', GELDIG_UUID_B)
    const { result, rerender } = renderHook(() => useDeviceId())
    const eerste = result.current
    rerender()
    expect(result.current).toBe(eerste)
  })

  it('verwerpt een ongeldige UUID en genereert een nieuwe', () => {
    // Verificatie dat SEC-M1 werkt: ongeldige waarden worden nooit hergebruikt
    localStorage.setItem('digipot_device_id', 'geen-uuid')
    const { result } = renderHook(() => useDeviceId())
    expect(result.current).toBe(GELDIG_UUID_STUB)
    expect(crypto.randomUUID).toHaveBeenCalled()
  })
})

// ── 3. useFocusTrap ───────────────────────────────────────────────────────────

import { useFocusTrap } from '../hooks/useFocusTrap'

/**
 * Bouwt een minimaal DOM-panel met knoppen en registreert de hook.
 * Retourneert elementen en een fireKey-helper.
 */
function setupFocusTrap(selector) {
  const onSluiten = vi.fn()

  const panelEl = document.createElement('div')
  const knop1 = document.createElement('button')
  const knop2 = document.createElement('button')
  knop1.textContent = 'Annuleren'
  knop2.textContent = 'Bevestigen'
  panelEl.appendChild(knop1)
  panelEl.appendChild(knop2)
  document.body.appendChild(panelEl)

  const ref = { current: panelEl }
  const opties = selector ? { selector } : undefined
  renderHook(() => useFocusTrap(ref, onSluiten, opties))

  function fireKey(key, shiftKey = false) {
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }))
    })
  }

  return { panelEl, knop1, knop2, onSluiten, fireKey }
}

describe('useFocusTrap', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('roept onSluiten aan bij Escape', () => {
    const { onSluiten, fireKey } = setupFocusTrap()
    fireKey('Escape')
    expect(onSluiten).toHaveBeenCalledOnce()
  })

  it('reageert niet op andere toetsen', () => {
    const { onSluiten, fireKey } = setupFocusTrap()
    fireKey('Enter')
    fireKey('Space')
    fireKey('ArrowDown')
    expect(onSluiten).not.toHaveBeenCalled()
  })

  it('Tab vanaf laatste knop springt naar eerste knop', () => {
    const { knop1, knop2, fireKey } = setupFocusTrap()
    knop2.focus()
    expect(document.activeElement).toBe(knop2)
    fireKey('Tab', false)
    expect(document.activeElement).toBe(knop1)
  })

  it('Shift+Tab vanaf eerste knop springt naar laatste knop', () => {
    const { knop1, knop2, fireKey } = setupFocusTrap()
    knop1.focus()
    expect(document.activeElement).toBe(knop1)
    fireKey('Tab', true)
    expect(document.activeElement).toBe(knop2)
  })

  it('Tab midden in panel wikkelt niet (cycling alleen op eerste/laatste)', () => {
    const onSluiten = vi.fn()
    const panelEl = document.createElement('div')
    const knoppen = ['A', 'B', 'C'].map(t => {
      const b = document.createElement('button')
      b.textContent = t
      panelEl.appendChild(b)
      return b
    })
    document.body.appendChild(panelEl)
    renderHook(() => useFocusTrap({ current: panelEl }, onSluiten))

    knoppen[1].focus()
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    })
    // Geen cycling bij middelste knop — activeElement ongewijzigd
    expect(document.activeElement).toBe(knoppen[1])
    expect(onSluiten).not.toHaveBeenCalled()
  })

  it('werkt met aangepaste selector', () => {
    const { onSluiten, fireKey } = setupFocusTrap('button:not([disabled])')
    fireKey('Escape')
    expect(onSluiten).toHaveBeenCalledOnce()
  })

  it('verwijdert de event-listener bij unmount — geen geheugenlek', () => {
    const panelEl = document.createElement('div')
    const k1 = document.createElement('button')
    const k2 = document.createElement('button')
    panelEl.appendChild(k1)
    panelEl.appendChild(k2)
    document.body.appendChild(panelEl)

    const spy = vi.fn()
    const { unmount } = renderHook(() => useFocusTrap({ current: panelEl }, spy))
    unmount()

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(spy).not.toHaveBeenCalled()
  })
})
