/**
 * Regressietests — PGRST116 "niet gevonden" foutafhandeling
 *
 * Gedekt door Sentry-issue #17a27ebc (2026-04-10):
 * Verouderde potje-links (lifecycle-verwijderd) gaven "Cannot coerce the result
 * to a single JSON object" als Sentry-ruis i.p.v. een nette gebruikersmelding.
 *
 * Root cause: .single() op een lege resultaatset gooit PostgREST PGRST116.
 * vertaalFout had geen specifieke matcher voor PGRST116 — viel door naar de
 * generieke PGRST-catch ("verbindingsfout"), en logFout stuurde hem naar Sentry
 * als bug.
 *
 * Fix: PGRST116 herkend als gebruikerssituatie in zowel vertaalFout als logFout.
 *
 * Gedekte cases:
 *   VF-116-01  PGRST116 in bericht → "niet gevonden"-melding
 *   VF-116-02  letterlijke PostgREST-tekst → "niet gevonden"-melding
 *   VF-116-03  "Cannot coerce..." (Sentry-titel) → "niet gevonden"-melding
 *   VF-116-04  PGRST116 gaat NIET naar generieke PGRST-melding
 *   VF-116-05  PGRST116 gaat vóór de fallback-melding
 *   VF-116-06  PGRST116 is specifiek genoeg — PGRST301 gaat nog steeds naar verbindingsfout
 *   LF-116-01  PGRST116 wordt als gebruikersfout behandeld — niet naar Sentry
 *   LF-116-02  "Cannot coerce..." wordt als gebruikersfout behandeld — niet naar Sentry
 *   LF-116-03  een echte onbekende fout gaat WEL naar Sentry (controle)
 *   LF-116-04  SALDO_TE_LAAG gaat nog steeds niet naar Sentry (geen regressie)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { vertaalFout } from '../utils/vertaalFout'

// ── vertaalFout: PGRST116-matcher ────────────────────────────────────────────

describe('vertaalFout — VF-116: PGRST116 niet-gevonden herkenning', () => {
  it('VF-116-01: "PGRST116" in bericht → niet-gevonden melding', () => {
    const fout = new Error('PGRST116: The result contains 0 rows')
    expect(vertaalFout(fout)).toBe(
      'Dit potje bestaat niet of is verwijderd. Controleer de link.'
    )
  })

  it('VF-116-02: PostgREST-variant "JSON object requested, multiple (or no) rows returned"', () => {
    const fout = new Error('JSON object requested, multiple (or no) rows returned')
    expect(vertaalFout(fout)).toBe(
      'Dit potje bestaat niet of is verwijderd. Controleer de link.'
    )
  })

  it('VF-116-03: Sentry-titeltekst "Cannot coerce the result to a single JSON object"', () => {
    // Dit is de letterlijke foutmelding die in Sentry als titel verscheen.
    const fout = new Error('Cannot coerce the result to a single JSON object')
    expect(vertaalFout(fout)).toBe(
      'Dit potje bestaat niet of is verwijderd. Controleer de link.'
    )
  })

  it('VF-116-04: PGRST116 gaat NIET naar de generieke PGRST-verbindingsfout', () => {
    const fout = new Error('PGRST116: The result contains 0 rows')
    expect(vertaalFout(fout)).not.toBe(
      'De verbinding met de database is mislukt. Probeer de pagina te verversen.'
    )
  })

  it('VF-116-05: PGRST116 gaat vóór de fallback-melding', () => {
    const fout = new Error('PGRST116')
    expect(vertaalFout(fout)).not.toBe('Er is iets misgegaan. Probeer het opnieuw.')
    expect(vertaalFout(fout)).toContain('bestaat niet of is verwijderd')
  })

  it('VF-116-06: PGRST301 (andere code) gaat nog steeds naar verbindingsfout (geen over-match)', () => {
    // PGRST116-matcher is specifiek genoeg — andere PGRST-codes vallen door
    // naar de generieke PGRST-catch.
    const fout = new Error('PGRST301: role not found')
    expect(vertaalFout(fout)).toBe(
      'De verbinding met de database is mislukt. Probeer de pagina te verversen.'
    )
  })
})

// ── logFout: PGRST116 niet naar Sentry ───────────────────────────────────────
//
// We mocken @sentry/react zodat we kunnen verifiëren of captureException
// wordt aangeroepen of niet.

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  init: vi.fn(),
}))

// logFout importeren NA de mock zodat de mock actief is.
// Dynamic import nodig omdat top-level imports al geresolved zijn.
// Alternatief: importeer logFout als eerste en vertrouw op vi.mock hoisting.
import { logFout } from '../utils/logFout'
import * as Sentry from '@sentry/react'

beforeEach(() => {
  vi.clearAllMocks()
  // Simuleer productieomgeving zodat Sentry-aanroepen plaatsvinden
  vi.stubGlobal('import.meta', { env: { PROD: true, DEV: false } })
})

describe('logFout — LF-116: PGRST116 als gebruikersfout', () => {
  it('LF-116-01: PGRST116 wordt NIET naar Sentry gestuurd', () => {
    logFout(new Error('PGRST116: The result contains 0 rows'), {
      component: 'usePotje',
      actie: 'laadData',
    })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('LF-116-02: "Cannot coerce..." wordt NIET naar Sentry gestuurd', () => {
    logFout(new Error('Cannot coerce the result to a single JSON object'), {
      component: 'usePotje',
      actie: 'laadData',
    })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('LF-116-03: een echte onbekende fout gaat WEL naar Sentry (controle)', () => {
    logFout(new Error('totally unexpected crash XYZ'), {
      component: 'usePotje',
      actie: 'laadData',
    })
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })

  it('LF-116-04: SALDO_TE_LAAG gaat nog steeds niet naar Sentry (geen regressie)', () => {
    logFout(new Error('SALDO_TE_LAAG:20'), {
      component: 'usePotjeActies',
      actie: 'handleTransactie',
    })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('LF-116-05: PGRST116 geeft de juiste gebruikerstekst terug', () => {
    const bericht = logFout(new Error('PGRST116'), {
      component: 'usePotje',
      actie: 'laadData',
    })
    expect(bericht).toBe('Dit potje bestaat niet of is verwijderd. Controleer de link.')
  })
})
