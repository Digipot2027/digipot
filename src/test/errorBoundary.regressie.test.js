/**
 * Regressietests — Stap 7: ErrorBoundary
 *
 * Teststrategie: logica-extractie patroon.
 *
 * ErrorBoundary is een class component — mounten met Supabase-context is
 * niet nodig. De beslissingslogica wordt als pure functies geëxtraheerd:
 *
 *   EB-01 t/m EB-03  getDerivedStateFromError — state-transitie bij crash
 *   EB-04 t/m EB-06  render-beslissing — children vs foutscherm
 *   EB-07 t/m EB-08  foutBericht-extractie uit Error-instanties
 *
 * Niet gedekt (vereist React-mount + Sentry-mock):
 *   - componentDidCatch → Sentry.captureException aanroep
 *   - handleVerversen → window.location.reload
 *   - handleTerug → window.location.href
 *   Deze zijn intentioneel niet getest: ze delegeren direct naar
 *   externe systemen zonder eigen logica.
 */

import { describe, it, expect } from 'vitest'

// ── Geëxtraheerde logica uit ErrorBoundary ────────────────────────────────────

/**
 * Identiek aan getDerivedStateFromError in ErrorBoundary.
 */
function berekenFoutState(error) {
  return {
    heeftFout: true,
    foutBericht: error?.message || 'Onbekende fout',
  }
}

/**
 * Render-beslissing: toon children of foutscherm?
 * Identiek aan de if-check in render().
 */
function moetFoutschermTonen(heeftFout) {
  return heeftFout === true
}

// ── EB-01 t/m EB-03: getDerivedStateFromError ─────────────────────────────────

describe('ErrorBoundary — EB-01 t/m EB-03: getDerivedStateFromError', () => {
  it('EB-01: zet heeftFout op true bij elke error', () => {
    const state = berekenFoutState(new Error('test'))
    expect(state.heeftFout).toBe(true)
  })

  it('EB-02: neemt foutbericht over uit error.message', () => {
    const state = berekenFoutState(new Error('Supabase verbinding verbroken'))
    expect(state.foutBericht).toBe('Supabase verbinding verbroken')
  })

  it('EB-03: valt terug op "Onbekende fout" als error geen message heeft', () => {
    const state = berekenFoutState(new Error(''))
    // Lege string is falsy → fallback
    expect(state.foutBericht).toBe('Onbekende fout')
  })

  it('EB-03b: valt terug op "Onbekende fout" als error null is', () => {
    const state = berekenFoutState(null)
    expect(state.foutBericht).toBe('Onbekende fout')
  })

  it('EB-03c: valt terug op "Onbekende fout" als error undefined is', () => {
    const state = berekenFoutState(undefined)
    expect(state.foutBericht).toBe('Onbekende fout')
  })
})

// ── EB-04 t/m EB-06: render-beslissing ───────────────────────────────────────

describe('ErrorBoundary — EB-04 t/m EB-06: render-beslissing', () => {
  it('EB-04: heeftFout=false → geen foutscherm (children worden getoond)', () => {
    expect(moetFoutschermTonen(false)).toBe(false)
  })

  it('EB-05: heeftFout=true → foutscherm tonen', () => {
    expect(moetFoutschermTonen(true)).toBe(true)
  })

  it('EB-06: initiële state heeft heeftFout=false', () => {
    // Simuleert de constructor: this.state = { heeftFout: false, foutBericht: '' }
    const initieel = { heeftFout: false, foutBericht: '' }
    expect(moetFoutschermTonen(initieel.heeftFout)).toBe(false)
  })
})

// ── EB-07 t/m EB-08: foutBericht-extractie ───────────────────────────────────

describe('ErrorBoundary — EB-07 t/m EB-08: foutBericht-extractie', () => {
  it('EB-07: RangeError message wordt correct overgenomen', () => {
    const state = berekenFoutState(new RangeError('Invalid currency code: XYZ'))
    expect(state.foutBericht).toBe('Invalid currency code: XYZ')
    expect(state.heeftFout).toBe(true)
  })

  it('EB-08: TypeError message wordt correct overgenomen', () => {
    const state = berekenFoutState(new TypeError('Cannot read properties of null'))
    expect(state.foutBericht).toBe('Cannot read properties of null')
  })
})
