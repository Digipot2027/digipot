/**
 * vertaalFout — aanvullende tests voor nieuwe foutcodes
 *
 * Dekt de foutcodes die zijn toegevoegd na de initiële vertaalFout.test.js:
 *   - PostgreSQL-foutcode 42703 (column does not exist)
 *   - PostgreSQL-foutcode 42P01 (relation does not exist)
 *   - Supabase REST API-foutcodes (PGRST, 406, 400)
 *   - SEC-A2: MAX_DEELNEMERS trigger-exceptie (2026-04-07)
 *   - SEC-A8: JWT-matcher te breed gerepareerd (2026-04-07)
 *
 * Gedekte cases:
 *   VF-N-01  42703 → databasefout kolom ontbreekt
 *   VF-N-02  "column ... does not exist" → databasefout kolom ontbreekt
 *   VF-N-03  42703 + "does not exist" samen → zelfde melding
 *   VF-N-04  42P01 → databasefout tabel ontbreekt
 *   VF-N-05  "relation ... does not exist" → databasefout tabel ontbreekt
 *   VF-N-06  PGRST → verbindingsfout
 *   VF-N-07  "(406)" → verbindingsfout
 *   VF-N-08  "(400)" → verbindingsfout
 *   VF-N-09  onbekende PGRST-code → verbindingsfout
 *   VF-N-10  volgorde: 42703 gaat vóór fallback
 *   VF-N-11  volgorde: 42P01 gaat vóór fallback
 *   VF-N-12  bestaande codes werken nog steeds (geen regressie)
 *   VF-MD-01 MAX_DEELNEMERS → correcte gebruikersmelding (SEC-A2)
 *   VF-MD-02 MAX_DEELNEMERS gaat vóór fallback
 *   VF-MD-03 MAX_DEELNEMERS volgorde
 *   VF-JWT-01 "JWT expired" → sessie-melding
 *   VF-JWT-02 "Invalid JWT" → sessie-melding
 *   VF-JWT-03 "JWTExpired" → sessie-melding
 *   VF-JWT-04 "not authenticated" → sessie-melding
 *   VF-JWT-05 "unauthorized action" mag GEEN sessie-melding geven (SEC-A8 false positive fix)
 *   VF-JWT-06 "authentication" als woord mag GEEN sessie-melding geven
 */

import { describe, it, expect } from 'vitest'
import { vertaalFout } from '../utils/vertaalFout'

// ── VF-N-01 t/m VF-N-03: PostgreSQL 42703 (column does not exist) ────────────

describe('vertaalFout — VF-N-01/02/03: PostgreSQL 42703 kolom ontbreekt', () => {
  it('VF-N-01: fout met "42703" geeft databasefout-kolom-melding', () => {
    const fout = new Error('ERROR: 42703: column "aangemaakt_op" of relation "potjes" does not exist')
    expect(vertaalFout(fout)).toBe(
      'Databasefout: een vereiste kolom ontbreekt. Voer de openstaande migraties uit.'
    )
  })

  it('VF-N-02: "column ... does not exist" zonder code geeft zelfde melding', () => {
    const fout = new Error('column "valuta" does not exist')
    expect(vertaalFout(fout)).toBe(
      'Databasefout: een vereiste kolom ontbreekt. Voer de openstaande migraties uit.'
    )
  })

  it('VF-N-03: 42703 én "does not exist" samen → één melding (geen herhaling)', () => {
    const fout = new Error('42703 column does not exist')
    const result = vertaalFout(fout)
    expect(result).toBe(
      'Databasefout: een vereiste kolom ontbreekt. Voer de openstaande migraties uit.'
    )
  })
})

// ── VF-N-04 t/m VF-N-05: PostgreSQL 42P01 (relation does not exist) ──────────

describe('vertaalFout — VF-N-04/05: PostgreSQL 42P01 tabel ontbreekt', () => {
  it('VF-N-04: fout met "42P01" geeft databasefout-tabel-melding', () => {
    const fout = new Error('ERROR: 42P01: relation "deelnemers" does not exist')
    expect(vertaalFout(fout)).toBe(
      'Databasefout: een vereiste tabel ontbreekt. Voer de openstaande migraties uit.'
    )
  })

  it('VF-N-05: "relation ... does not exist" zonder code geeft zelfde melding', () => {
    const fout = new Error('relation "potjes" does not exist')
    expect(vertaalFout(fout)).toBe(
      'Databasefout: een vereiste tabel ontbreekt. Voer de openstaande migraties uit.'
    )
  })
})

// ── VF-N-06 t/m VF-N-09: Supabase PGRST / HTTP 406 / HTTP 400 ───────────────

describe('vertaalFout — VF-N-06/07/08/09: Supabase API-fouten', () => {
  it('VF-N-06: fout met "PGRST" geeft verbindingsfout-melding', () => {
    const fout = new Error('PGRST116: The result contains 0 rows')
    expect(vertaalFout(fout)).toBe(
      'De verbinding met de database is mislukt. Probeer de pagina te verversen.'
    )
  })

  it('VF-N-07: fout met "(406)" geeft verbindingsfout-melding', () => {
    const fout = new Error('INSERT deelnemers (406): not acceptable')
    expect(vertaalFout(fout)).toBe(
      'De verbinding met de database is mislukt. Probeer de pagina te verversen.'
    )
  })

  it('VF-N-08: fout met "(400)" geeft verbindingsfout-melding', () => {
    const fout = new Error('SELECT potjes (400): bad request')
    expect(vertaalFout(fout)).toBe(
      'De verbinding met de database is mislukt. Probeer de pagina te verversen.'
    )
  })

  it('VF-N-09: PGRST301 (onbekende PGRST-variant) geeft verbindingsfout-melding', () => {
    const fout = new Error('PGRST301: role not found')
    expect(vertaalFout(fout)).toBe(
      'De verbinding met de database is mislukt. Probeer de pagina te verversen.'
    )
  })
})

// ── VF-N-10 t/m VF-N-11: volgorde — nieuwe codes vóór fallback ───────────────

describe('vertaalFout — VF-N-10/11: nieuwe codes gaan vóór fallback', () => {
  it('VF-N-10: 42703 vóór "Er is iets misgegaan" fallback', () => {
    const fout = new Error('42703')
    const result = vertaalFout(fout)
    expect(result).not.toBe('Er is iets misgegaan. Probeer het opnieuw.')
    expect(result).toContain('kolom ontbreekt')
  })

  it('VF-N-11: 42P01 vóór "Er is iets misgegaan" fallback', () => {
    const fout = new Error('42P01')
    const result = vertaalFout(fout)
    expect(result).not.toBe('Er is iets misgegaan. Probeer het opnieuw.')
    expect(result).toContain('tabel ontbreekt')
  })
})

// ── VF-N-12: geen regressie op bestaande codes ───────────────────────────────

describe('vertaalFout — VF-N-12: geen regressie op bestaande codes', () => {
  it('SALDO_TE_LAAG geeft nog steeds null', () => {
    expect(vertaalFout(new Error('SALDO_TE_LAAG:10'))).toBeNull()
  })

  it('duplicate key naam geeft nog steeds correcte melding', () => {
    const fout = new Error('duplicate key value violates unique constraint "deelnemers_potje_id_naam"')
    expect(vertaalFout(fout)).toBe('Deze naam is al bezet in dit potje. Kies een andere naam.')
  })

  it('JWT expired geeft nog steeds sessie-melding', () => {
    expect(vertaalFout(new Error('JWT expired'))).toBe('Sessie verlopen. Ververs de pagina.')
  })

  it('fetch failed geeft nog steeds verbindingsmelding', () => {
    expect(vertaalFout(new Error('fetch failed'))).toContain('Verbinding verbroken')
  })

  it('onbekende fout geeft nog steeds fallback', () => {
    expect(vertaalFout(new Error('totaal onbekend'))).toBe('Er is iets misgegaan. Probeer het opnieuw.')
  })
})

// ── SEC-A2: MAX_DEELNEMERS trigger-fout ──────────────────────────────────────

describe('vertaalFout — SEC-A2: MAX_DEELNEMERS trigger', () => {
  it('VF-MD-01: MAX_DEELNEMERS geeft correcte gebruikersmelding', () => {
    const fout = new Error('MAX_DEELNEMERS: dit potje heeft het maximum van 20 deelnemers bereikt')
    expect(vertaalFout(fout)).toBe('Dit potje heeft het maximum van 20 deelnemers bereikt.')
  })

  it('VF-MD-02: MAX_DEELNEMERS gaat vóór de fallback-melding', () => {
    const fout = new Error('MAX_DEELNEMERS')
    expect(vertaalFout(fout)).not.toBe('Er is iets misgegaan. Probeer het opnieuw.')
  })

  it('VF-MD-03: MAX_DEELNEMERS gaat vóór duplicate-key-melding (volgorde)', () => {
    // Triggerfout bevat ook 'deelnemers_potje_id_naam' nooit tegelijk,
    // maar puur als volgorde-check: MAX_DEELNEMERS staat eerder in de functie
    const fout = new Error('MAX_DEELNEMERS triggerfout')
    expect(vertaalFout(fout)).toBe('Dit potje heeft het maximum van 20 deelnemers bereikt.')
  })
})

// ── SEC-A8: te brede auth-matcher vervangen door specifieke JWT-checks ─────────

describe('vertaalFout — SEC-A8: JWT-matcher niet te breed', () => {
  it('VF-JWT-01: "JWT expired" geeft sessie-melding', () => {
    expect(vertaalFout(new Error('JWT expired'))).toBe('Sessie verlopen. Ververs de pagina.')
  })

  it('VF-JWT-02: "Invalid JWT" geeft sessie-melding', () => {
    expect(vertaalFout(new Error('Invalid JWT'))).toBe('Sessie verlopen. Ververs de pagina.')
  })

  it('VF-JWT-03: "JWTExpired" geeft sessie-melding', () => {
    expect(vertaalFout(new Error('JWTExpired'))).toBe('Sessie verlopen. Ververs de pagina.')
  })

  it('VF-JWT-04: "not authenticated" geeft sessie-melding', () => {
    expect(vertaalFout(new Error('not authenticated'))).toBe('Sessie verlopen. Ververs de pagina.')
  })

  it('VF-JWT-05: "unauthorized action" mag GEEN sessie-melding geven (false positive fix)', () => {
    // Vóór SEC-A8 matchte "auth" op "unauthorized" → valse sessie-melding
    const result = vertaalFout(new Error('unauthorized action on table'))
    expect(result).not.toBe('Sessie verlopen. Ververs de pagina.')
  })

  it('VF-JWT-06: "authentication" als woord mag GEEN sessie-melding geven', () => {
    const result = vertaalFout(new Error('authentication method not supported'))
    expect(result).not.toBe('Sessie verlopen. Ververs de pagina.')
  })
})
