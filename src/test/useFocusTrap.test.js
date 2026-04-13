/**
 * Tests — useFocusTrap hook (2026-04-13)
 *
 * useFocusTrap vangt toetsenbordfocus op binnen een modal of sheet.
 * Gebruikt in 5 componenten: ModalAfmelden, ModalDeelnemen, ModalTransactie,
 * ModalSluiten, DeelnemerDetailSheet.
 *
 * WCAG 2.1.1 — alle functionaliteit bereikbaar via toetsenbord.
 * WCAG 2.4.3 — focusvolgorde behouden binnen modaldialoog.
 *
 * Testmethode: renderHook + fireEvent via @testing-library/react en jsdom.
 * DOM-elementen worden handmatig aangemaakt om het panelRef te simuleren.
 *
 * Gedekte cases:
 *
 * FT-01  Escape-toets roept onSluiten aan
 * FT-02  Niet-Tab/Escape toetsen worden genegeerd (geen fout, geen actie)
 * FT-03  Tab op laatste element → focus naar eerste element
 * FT-04  Shift+Tab op eerste element → focus naar laatste element
 * FT-05  Tab op niet-laatste element → standaard browsergedrag (geen override)
 * FT-06  Shift+Tab op niet-eerste element → standaard browsergedrag (geen override)
 * FT-07  Minder dan 2 focusbare elementen → geen Tab-trap (geen crash)
 * FT-08  Leeg panel (geen focusbare elementen) → geen crash
 * FT-09  Cleanup: eventlistener verwijderd bij unmount
 * FT-10  Aangepaste selector wordt doorgegeven en toegepast
 * FT-11  Tab op laatste element → preventDefault aangeroepen
 * FT-12  Shift+Tab op eerste element → preventDefault aangeroepen
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { useRef } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'

// ── Hulpfunctie: maak een panel met n knoppen ────────────────────────────────

function maakPanel(aantalKnoppen = 2) {
  const panel = document.createElement('div')
  const knoppen = Array.from({ length: aantalKnoppen }, (_, i) => {
    const knop = document.createElement('button')
    knop.textContent = `Knop ${i + 1}`
    panel.appendChild(knop)
    return knop
  })
  document.body.appendChild(panel)
  return { panel, knoppen }
}

function ruimOp(panel) {
  document.body.removeChild(panel)
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useFocusTrap — FT-01..12: toetsenbord-focusbeheer', () => {
  let panel
  let knoppen
  let onSluiten

  beforeEach(() => {
    const resultaat = maakPanel(2)
    panel = resultaat.panel
    knoppen = resultaat.knoppen
    onSluiten = vi.fn()
  })

  afterEach(() => {
    ruimOp(panel)
  })

  it('FT-01: Escape-toets roept onSluiten aan', () => {
    const panelRef = { current: panel }
    renderHook(() => useFocusTrap(panelRef, onSluiten))

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onSluiten).toHaveBeenCalledOnce()
  })

  it('FT-02: andere toetsen (bijv. Enter, a) worden genegeerd', () => {
    const panelRef = { current: panel }
    renderHook(() => useFocusTrap(panelRef, onSluiten))

    fireEvent.keyDown(document, { key: 'Enter' })
    fireEvent.keyDown(document, { key: 'a' })
    fireEvent.keyDown(document, { key: 'ArrowDown' })

    expect(onSluiten).not.toHaveBeenCalled()
  })

  it('FT-03: Tab op laatste element → focus naar eerste element', () => {
    const panelRef = { current: panel }
    renderHook(() => useFocusTrap(panelRef, onSluiten))

    // Zet focus op het laatste element
    knoppen[1].focus()
    expect(document.activeElement).toBe(knoppen[1])

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: false })

    expect(document.activeElement).toBe(knoppen[0])
  })

  it('FT-04: Shift+Tab op eerste element → focus naar laatste element', () => {
    const panelRef = { current: panel }
    renderHook(() => useFocusTrap(panelRef, onSluiten))

    // Zet focus op het eerste element
    knoppen[0].focus()
    expect(document.activeElement).toBe(knoppen[0])

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })

    expect(document.activeElement).toBe(knoppen[1])
  })

  it('FT-05: Tab op niet-laatste element → geen focus-override', () => {
    // Maak panel met 3 knoppen zodat de middelste knop "niet-laatste" is
    ruimOp(panel)
    const { panel: panel3, knoppen: knoppen3 } = maakPanel(3)
    panel = panel3
    knoppen = knoppen3

    const panelRef = { current: panel }
    renderHook(() => useFocusTrap(panelRef, onSluiten))

    // Focus op middelste knop (index 1) — Tab zou naar index 2 gaan (browser-default)
    knoppen[1].focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: false })

    // useFocusTrap doet niets — focus blijft op index 1 in jsdom (geen native Tab)
    expect(document.activeElement).toBe(knoppen[1])
  })

  it('FT-06: Shift+Tab op niet-eerste element → geen focus-override', () => {
    ruimOp(panel)
    const { panel: panel3, knoppen: knoppen3 } = maakPanel(3)
    panel = panel3
    knoppen = knoppen3

    const panelRef = { current: panel }
    renderHook(() => useFocusTrap(panelRef, onSluiten))

    // Focus op middelste knop — Shift+Tab zou naar index 0 gaan (browser-default)
    knoppen[1].focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })

    // useFocusTrap doet niets — focus blijft op index 1 in jsdom
    expect(document.activeElement).toBe(knoppen[1])
  })

  it('FT-07: slechts 1 focusbaar element → geen Tab-trap, geen crash', () => {
    ruimOp(panel)
    const { panel: panel1, knoppen: knoppen1 } = maakPanel(1)
    panel = panel1
    knoppen = knoppen1

    const panelRef = { current: panel }
    expect(() => {
      renderHook(() => useFocusTrap(panelRef, onSluiten))
      fireEvent.keyDown(document, { key: 'Tab' })
    }).not.toThrow()
  })

  it('FT-08: leeg panel (geen focusbare elementen) → geen crash', () => {
    ruimOp(panel)
    const leegPanel = document.createElement('div')
    document.body.appendChild(leegPanel)
    panel = leegPanel

    const panelRef = { current: leegPanel }
    expect(() => {
      renderHook(() => useFocusTrap(panelRef, onSluiten))
      fireEvent.keyDown(document, { key: 'Tab' })
      fireEvent.keyDown(document, { key: 'Escape' })
    }).not.toThrow()
  })

  it('FT-09: eventlistener verwijderd bij unmount (geen geheugenlek)', () => {
    const panelRef = { current: panel }
    const removeListenerSpy = vi.spyOn(document, 'removeEventListener')

    const { unmount } = renderHook(() => useFocusTrap(panelRef, onSluiten))
    unmount()

    expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    removeListenerSpy.mockRestore()
  })

  it('FT-10: aangepaste selector wordt gebruikt voor focusbare elementen', () => {
    // Maak panel met input én button — test met input-only selector
    ruimOp(panel)
    const gemengdPanel = document.createElement('div')
    const invoer1 = document.createElement('input')
    const invoer2 = document.createElement('input')
    const knop = document.createElement('button')
    gemengdPanel.appendChild(invoer1)
    gemengdPanel.appendChild(invoer2)
    gemengdPanel.appendChild(knop)
    document.body.appendChild(gemengdPanel)
    panel = gemengdPanel

    const panelRef = { current: gemengdPanel }
    // Gebruik aangepaste selector — alleen inputs, geen button
    renderHook(() => useFocusTrap(panelRef, onSluiten, { selector: 'input' }))

    // Tab op laatste input → focus naar eerste input (niet naar button)
    invoer2.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: false })

    expect(document.activeElement).toBe(invoer1)
  })

  it('FT-11: Tab op laatste element → preventDefault aangeroepen', () => {
    const panelRef = { current: panel }
    renderHook(() => useFocusTrap(panelRef, onSluiten))

    knoppen[1].focus()
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false, bubbles: true, cancelable: true })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    document.dispatchEvent(event)

    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('FT-12: Shift+Tab op eerste element → preventDefault aangeroepen', () => {
    const panelRef = { current: panel }
    renderHook(() => useFocusTrap(panelRef, onSluiten))

    knoppen[0].focus()
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    document.dispatchEvent(event)

    expect(preventDefaultSpy).toHaveBeenCalled()
  })
})
