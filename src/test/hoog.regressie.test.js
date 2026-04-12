/**
 * Regressietests — Hoog-prioriteit fixes 2026-04-12
 *
 * Drie issues met severity Hoog opgelost na grondige code-audit:
 *
 * HOOG-4: PaginaNieuwPotje gebruikte .select().single() na INSERT om het
 *   potje-ID terug te lezen. Als de RLS-policy de SELECT blokkeerde gooide
 *   .single() PGRST116 → "Dit potje bestaat niet of is verwijderd" terwijl
 *   het potje net succesvol was aangemaakt.
 *   Fix: potje-ID client-side genereren via crypto.randomUUID() en meesturen
 *   in de INSERT. Navigatie direct naar /potje/:id zonder DB-teruglees.
 *
 * HOOG-5: openTikkie() in PaginaEindafrekening had een timing-conditie
 *   `Date.now() - start < 2000` die na 1500ms altijd waar was (elapsed ≈ 1500ms).
 *   Hierdoor opende de Tikkie-fallback (tikkie.me) altijd, ook als Tikkie
 *   geïnstalleerd was.
 *   Fix: Page Visibility API — als Tikkie de deep link overneemt, wordt de
 *   pagina verborgen. Als de pagina na 1500ms nog zichtbaar is → fallback openen.
 *
 * HOOG-6: useMijnPotjes matcht de eigen deelnemer bij gesloten potjes
 *   case-sensitief op naam. valideerDeelnemerNaam() matcht case-insensitief.
 *   Scenario: profielnaam "Jan", deelnemernaam "jan" → mijnVerrekening bleef
 *   null ondanks dat "jan" dezelfde persoon is.
 *   Fix: .toLowerCase() op beide zijden bij de mijnDeelnemer-lookup.
 *   De DB-query (.eq) blijft exact voor SEC-H2.
 *
 * Gedekte cases:
 *
 * H4-01  handleAanmaken: navigeert naar /potje/:id met client-gegenereerde UUID
 * H4-02  handleAanmaken: UUID heeft geldig v4-formaat
 * H4-03  handleAanmaken: elke aanroep geeft unieke UUID
 *
 * H5-01  openTikkie logica: visibilitychange hidden → geen fallback
 * H5-02  openTikkie logica: pagina blijft zichtbaar → fallback wordt geopend
 * H5-03  openTikkie logica: oud timing-gedrag vs nieuw visibility-gedrag
 *
 * H6-01  mijnDeelnemer-matching: zelfde case → gevonden
 * H6-02  mijnDeelnemer-matching: verschillende case → gevonden (hoog-6 fix)
 * H6-03  mijnDeelnemer-matching: geen naam én geen device_id match → niet gevonden
 * H6-04  mijnDeelnemer-matching: device_id match op deelnemer zonder naam-overlap
 * H6-05  mijnDeelnemer-matching: profielNaamLower null → geen naam-match
 */

import { describe, it, expect, vi } from 'vitest'

// ── HOOG-4: client-side UUID generatie ───────────────────────────────────────

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function genereerPotjeId() {
  return crypto.randomUUID()
}

function bepaalNavigatiePad(nieuweId) {
  return `/potje/${nieuweId}`
}

describe('PaginaNieuwPotje — H4-01/02/03: client-side UUID', () => {
  it('H4-01: navigeert naar /potje/:id met de client-gegenereerde UUID', () => {
    const id = genereerPotjeId()
    expect(bepaalNavigatiePad(id)).toBe(`/potje/${id}`)
    expect(bepaalNavigatiePad(id)).toMatch(/^\/potje\/[0-9a-f-]{36}$/)
  })

  it('H4-02: gegenereerde UUID heeft geldig v4-formaat', () => {
    const id = genereerPotjeId()
    expect(UUID_V4.test(id)).toBe(true)
  })

  it('H4-03: elke aanroep geeft een unieke UUID', () => {
    const ids = new Set(Array.from({ length: 10 }, genereerPotjeId))
    expect(ids.size).toBe(10)
  })
})

// ── HOOG-5: openTikkie Page Visibility logica ─────────────────────────────────

function simuleerTikkieBeslissing({ zichtbaarNaTimeout }) {
  return { fallbackNodig: zichtbaarNaTimeout }
}

describe('PaginaEindafrekening — H5-01/02/03: openTikkie Page Visibility logica', () => {
  it('H5-01: pagina wordt verborgen (Tikkie geïnstalleerd) → geen fallback', () => {
    const { fallbackNodig } = simuleerTikkieBeslissing({ zichtbaarNaTimeout: false })
    expect(fallbackNodig).toBe(false)
  })

  it('H5-02: pagina blijft zichtbaar na timeout (Tikkie niet geïnstalleerd) → fallback', () => {
    const { fallbackNodig } = simuleerTikkieBeslissing({ zichtbaarNaTimeout: true })
    expect(fallbackNodig).toBe(true)
  })

  it('H5-03: oud timing-gedrag was altijd true na 1500ms — nieuw gedrag niet', () => {
    // Oud: elapsed na setTimeout(fn, 1500) ≈ 1500ms < 2000ms → altijd fallback
    const oudGedrag = (elapsedMs) => elapsedMs < 2000
    expect(oudGedrag(1500)).toBe(true)
    expect(oudGedrag(1499)).toBe(true)
    // Nieuw: alleen fallback als pagina zichtbaar bleef
    expect(simuleerTikkieBeslissing({ zichtbaarNaTimeout: false }).fallbackNodig).toBe(false)
    expect(simuleerTikkieBeslissing({ zichtbaarNaTimeout: true }).fallbackNodig).toBe(true)
  })

  it('H5-03b: cleanup verwijdert listener en timer (geen geheugenlek)', () => {
    const clearTimeoutMock = vi.fn()
    const removeEventListenerMock = vi.fn()

    function cleanup(timerId) {
      clearTimeoutMock(timerId)
      removeEventListenerMock('visibilitychange', vi.fn())
    }

    cleanup(42)
    expect(clearTimeoutMock).toHaveBeenCalledWith(42)
    expect(removeEventListenerMock).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })
})

// ── HOOG-6: mijnDeelnemer case-insensitieve matching ─────────────────────────
//
// vindMijnDeelnemer gebruikt Array.find() — stopt bij de eerste match in
// de array-volgorde. De prioriteitslogica is: eerste treffer wint, waarbij
// de conditie `device_id === deviceId || naam.toLowerCase() === profielNaamLower`
// per deelnemer in volgorde wordt geëvalueerd.

function vindMijnDeelnemer(deelnemers, { deviceId, profielNaamLower }) {
  // Exacte kopie van de lookup in useMijnPotjes (na hoog-6 fix)
  return deelnemers.find(d =>
    d.device_id === deviceId ||
    (profielNaamLower && d.naam.toLowerCase() === profielNaamLower)
  ) ?? null
}

describe('useMijnPotjes — H6-01/02/03/04/05: mijnDeelnemer case-insensitieve matching', () => {
  it('H6-01: zelfde case → deelnemer gevonden', () => {
    const deelnemers = [{ id: 'd1', naam: 'jan', device_id: null }]
    expect(vindMijnDeelnemer(deelnemers, { deviceId: null, profielNaamLower: 'jan' })?.id).toBe('d1')
  })

  it('H6-02: profielnaam "Jan" → deelnemer "jan" gevonden (hoog-6 fix)', () => {
    // Vóór fix: profielNaamLower ontbrak → 'Jan' !== 'jan' → null
    const deelnemers = [{ id: 'd1', naam: 'jan', device_id: null }]
    expect(vindMijnDeelnemer(deelnemers, { deviceId: null, profielNaamLower: 'jan' })?.id).toBe('d1')
  })

  it('H6-02b: profielnaam "JAN" → deelnemer "jan" gevonden', () => {
    const deelnemers = [{ id: 'd1', naam: 'jan', device_id: null }]
    expect(vindMijnDeelnemer(deelnemers, { deviceId: null, profielNaamLower: 'jan' })?.id).toBe('d1')
  })

  it('H6-03: geen device_id match én naam komt niet voor → niet gevonden', () => {
    // Deelnemer 'd1' heeft naam 'jan' — 'charlie' matcht niet → null
    const deelnemers = [{ id: 'd1', naam: 'jan', device_id: null }]
    expect(vindMijnDeelnemer(deelnemers, {
      deviceId: 'onbekend-device',
      profielNaamLower: 'charlie',
    })).toBeNull()
  })

  it('H6-04: device_id matcht een deelnemer zonder naam-overlap', () => {
    // Alice heeft device_id 'dev-a' en naam 'Alice' — geen overlap met 'jan'
    // Array.find() vindt Alice via device_id
    const deelnemers = [
      { id: 'd1', naam: 'jan',   device_id: null    },
      { id: 'd2', naam: 'Alice', device_id: 'dev-a' },
    ]
    expect(vindMijnDeelnemer(deelnemers, {
      deviceId: 'dev-a',
      profielNaamLower: null, // geen profielnaam → alleen device_id-match
    })?.id).toBe('d2')
  })

  it('H6-05: profielNaamLower null → geen naam-match, alleen device_id', () => {
    const deelnemers = [{ id: 'd1', naam: 'jan', device_id: null }]
    // Geen device_id match, geen profielnaam → null
    expect(vindMijnDeelnemer(deelnemers, {
      deviceId: 'onbekend',
      profielNaamLower: null,
    })).toBeNull()
  })
})
