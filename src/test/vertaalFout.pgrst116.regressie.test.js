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
 *   LF-116-05  PGRST116 geeft de juiste gebruikerstekst terug
 *
 * RLS/42501 (Sentry REACT-8 / REACT-9, 2026-04-15 + A18 fix 2026-04-20):
 *   VF-RLS-01  "row-level security" → sessie-niet-herkend melding
 *   VF-RLS-02  "42501" → sessie-niet-herkend melding
 *   VF-RLS-03  RLS gaat NIET naar fallback
 *   VF-RLS-04  RLS gaat NIET naar generieke PGRST-melding
 *   VF-RLS-05  42501 gaat vóór fallback
 *   LF-RLS-01  "row-level security" wordt als gebruikersfout behandeld — niet naar Sentry
 *   LF-RLS-02  "42501" zonder "row-level security"-tekst gaat WEL naar Sentry (A18 fix)
 *              vertaalFout() geeft nog steeds de sessie-melding terug (orthogonaal)
 *   LF-RLS-03  RLS geeft de juiste gebruikerstekst terug
 *   LF-RLS-04  geen regressie: SALDO_TE_LAAG gaat nog steeds niet naar Sentry
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
    const fout = new Error('PGRST301: role not found')
    expect(vertaalFout(fout)).toBe(
      'De verbinding met de database is mislukt. Probeer de pagina te verversen.'
    )
  })
})

// ── vertaalFout: RLS/42501-matcher (Sentry REACT-8 / REACT-9) ────────────────

describe('vertaalFout — VF-RLS: row-level security / 42501 herkenning', () => {
  it('VF-RLS-01: "row-level security" → sessie-niet-herkend melding', () => {
    const fout = new Error('new row violates row-level security policy for table "transacties"')
    expect(vertaalFout(fout)).toBe('Je sessie is niet herkend. Ververs de pagina en probeer opnieuw.')
  })

  it('VF-RLS-02: "42501" alleen → sessie-niet-herkend melding', () => {
    const fout = new Error('42501')
    expect(vertaalFout(fout)).toBe('Je sessie is niet herkend. Ververs de pagina en probeer opnieuw.')
  })

  it('VF-RLS-03: RLS gaat NIET naar de algemene fallback', () => {
    const fout = new Error('row-level security policy violated')
    expect(vertaalFout(fout)).not.toBe('Er is iets misgegaan. Probeer het opnieuw.')
  })

  it('VF-RLS-04: RLS gaat NIET naar de generieke PGRST-verbindingsfout', () => {
    const fout = new Error('new row violates row-level security policy for table "transacties"')
    expect(vertaalFout(fout)).not.toBe(
      'De verbinding met de database is mislukt. Probeer de pagina te verversen.'
    )
  })

  it('VF-RLS-05: "42501" in samengesteld bericht → sessie-melding vóór fallback', () => {
    // Supabase stuurt de PostgreSQL-foutcode soms als onderdeel van een groter bericht
    const fout = new Error('ERROR: 42501: permission denied for table transacties')
    expect(vertaalFout(fout)).toBe('Je sessie is niet herkend. Ververs de pagina en probeer opnieuw.')
  })
})

// ── logFout: PGRST116 niet naar Sentry ───────────────────────────────────────

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  init: vi.fn(),
}))

import { logFout } from '../utils/logFout'
import * as Sentry from '@sentry/react'

beforeEach(() => {
  vi.clearAllMocks()
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

// ── logFout: RLS/42501 niet naar Sentry (Sentry REACT-8 / REACT-9) ───────────

describe('logFout — LF-RLS: row-level security / 42501 als gebruikersfout', () => {
  it('LF-RLS-01: "row-level security" wordt NIET naar Sentry gestuurd', () => {
    logFout(
      new Error('new row violates row-level security policy for table "transacties"'),
      { component: 'PaginaStorten', actie: 'storten' }
    )
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('LF-RLS-02: "42501" zonder "row-level security"-tekst gaat WEL naar Sentry (A18 fix, 2026-04-20)', () => {
    // Vóór A18: '42501' was uitgesloten van Sentry. Na A18 is de uitsluiting
    // verwijderd omdat bootstrapDeviceId() stabiel is — 42501-fouten zijn nu bugs.
    // Uitzondering: als de message ook 'row-level security' bevat (de Supabase
    // human-readable tekst), valt hij onder de row-level security matcher
    // en wordt hij alsnog als gebruikersfout behandeld.
    // Dit bericht bevat '42501' maar NIET 'row-level security' → gaat naar Sentry.
    logFout(
      new Error('ERROR: 42501: permission denied'),
      { component: 'ModalTransactie', actie: 'betaling' }
    )
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })

  it('LF-RLS-03: RLS-fout geeft de juiste gebruikerstekst terug', () => {
    const bericht = logFout(
      new Error('new row violates row-level security policy for table "transacties"'),
      { component: 'PaginaStorten', actie: 'storten' }
    )
    expect(bericht).toBe('Je sessie is niet herkend. Ververs de pagina en probeer opnieuw.')
  })

  it('LF-RLS-04: geen regressie — NIET_ACTIEF gaat nog steeds niet naar Sentry', () => {
    logFout(new Error('NIET_ACTIEF'), { component: 'ModalTransactie', actie: 'betaling' })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})
