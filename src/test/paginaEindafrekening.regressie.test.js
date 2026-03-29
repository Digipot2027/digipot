/**
 * PaginaEindafrekening — regressietests voor sluitingstekst-logica
 *
 * De component toont een andere tekst afhankelijk van hoe het potje is gesloten:
 *   - gesloten_door === null  → automatisch gesloten door het systeem (lifecycle stap 19)
 *   - gesloten_door !== null  → handmatig gesloten door een deelnemer
 *
 * De component heeft een Supabase/routing-dependency en wordt niet gemount.
 * De beslissingslogica is een pure conditie die direct getest wordt.
 *
 * Gedekte regressierisico's:
 *   EA-1  gesloten_door === null → tekst "Automatisch gesloten op [datum]"
 *   EA-2  gesloten_door === null → infoparagraaf zichtbaar (7-dagenmelding)
 *   EA-3  gesloten_door !== null (deelnemer-id) → tekst "Gesloten op [datum]"
 *   EA-4  gesloten_door !== null → infoparagraaf NIET zichtbaar
 *   EA-5  gesloten_door === undefined → behandeld als handmatig (niet null)
 *   EA-6  datumopmaak is correct Nederlands formaat
 */

import { describe, it, expect } from 'vitest'

// ─── Extractie sluitingstekst-logica uit PaginaEindafrekening ────────────────
// Identiek aan de inline conditie in de component. Als de component
// verandert moet deze functie ook worden bijgewerkt.

function bepaalSluitingsTekst({ gesloten_door, gesloten_op }) {
  const gesloten = new Date(gesloten_op)
  const sluitDatum = gesloten.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const isAutomatisch = gesloten_door === null
  return {
    subtitel: isAutomatisch
      ? `Automatisch gesloten op ${sluitDatum}`
      : `Gesloten op ${sluitDatum}`,
    toonInfoParagraaf: isAutomatisch,
    sluitDatum,
  }
}

// ─── EA-1 + EA-2: automatisch gesloten (gesloten_door === null) ───────────────

describe('PaginaEindafrekening — EA-1/EA-2: automatisch gesloten', () => {
  const potje = {
    gesloten_door: null,
    gesloten_op: new Date(2026, 2, 29, 3, 0).toISOString(), // 29 maart 2026 03:00
  }

  it('EA-1: subtitel bevat "Automatisch gesloten op"', () => {
    const { subtitel } = bepaalSluitingsTekst(potje)
    expect(subtitel).toMatch(/^Automatisch gesloten op/)
  })

  it('EA-2: toonInfoParagraaf is true bij gesloten_door === null', () => {
    const { toonInfoParagraaf } = bepaalSluitingsTekst(potje)
    expect(toonInfoParagraaf).toBe(true)
  })

  it('EA-1b: subtitel bevat NIET het woord "Gesloten op" als prefix', () => {
    const { subtitel } = bepaalSluitingsTekst(potje)
    // Mag niet beginnen met "Gesloten op" zonder "Automatisch"
    expect(subtitel.startsWith('Gesloten op')).toBe(false)
  })
})

// ─── EA-3 + EA-4: handmatig gesloten (gesloten_door = deelnemer-id) ──────────

describe('PaginaEindafrekening — EA-3/EA-4: handmatig gesloten', () => {
  const potje = {
    gesloten_door: 'deelnemer-uuid-abc123',
    gesloten_op: new Date(2026, 2, 29, 20, 0).toISOString(),
  }

  it('EA-3: subtitel begint met "Gesloten op"', () => {
    const { subtitel } = bepaalSluitingsTekst(potje)
    expect(subtitel).toMatch(/^Gesloten op/)
  })

  it('EA-4: toonInfoParagraaf is false bij gesloten_door !== null', () => {
    const { toonInfoParagraaf } = bepaalSluitingsTekst(potje)
    expect(toonInfoParagraaf).toBe(false)
  })

  it('EA-3b: subtitel bevat NIET het woord "Automatisch"', () => {
    const { subtitel } = bepaalSluitingsTekst(potje)
    expect(subtitel).not.toMatch(/Automatisch/)
  })
})

// ─── EA-5: gesloten_door === undefined → behandeld als handmatig ──────────────

describe('PaginaEindafrekening — EA-5: gesloten_door undefined', () => {
  it('undefined wordt NIET als null beschouwd → handmatig gedrag', () => {
    // In de component staat gesloten_door === null (strikte vergelijking).
    // undefined === null is false → valt door naar handmatig pad.
    const { toonInfoParagraaf } = bepaalSluitingsTekst({
      gesloten_door: undefined,
      gesloten_op: new Date(2026, 2, 29, 20, 0).toISOString(),
    })
    expect(toonInfoParagraaf).toBe(false)
  })

  it('subtitel begint met "Gesloten op" bij undefined gesloten_door', () => {
    const { subtitel } = bepaalSluitingsTekst({
      gesloten_door: undefined,
      gesloten_op: new Date(2026, 2, 29, 20, 0).toISOString(),
    })
    expect(subtitel).toMatch(/^Gesloten op/)
  })
})

// ─── EA-6: datumopmaak Nederlands formaat ─────────────────────────────────────

describe('PaginaEindafrekening — EA-6: datumopmaak', () => {
  it('datum is opgemaakt in Nederlands long-formaat (dag maand jaar)', () => {
    const { sluitDatum } = bepaalSluitingsTekst({
      gesloten_door: null,
      gesloten_op: new Date(2026, 2, 29, 3, 0).toISOString(), // 29 maart 2026
    })
    // nl-NL long formaat: "29 maart 2026"
    expect(sluitDatum).toMatch(/29/)
    expect(sluitDatum).toMatch(/2026/)
    expect(sluitDatum).toMatch(/maart/)
  })

  it('datum is opgemaakt in Nederlands long-formaat (andere maand)', () => {
    const { sluitDatum } = bepaalSluitingsTekst({
      gesloten_door: null,
      gesloten_op: new Date(2026, 5, 15, 12, 0).toISOString(), // 15 juni 2026
    })
    expect(sluitDatum).toMatch(/15/)
    expect(sluitDatum).toMatch(/2026/)
    expect(sluitDatum).toMatch(/juni/)
  })

  it('subtitel bevat de volledige geformatteerde datum', () => {
    const { subtitel, sluitDatum } = bepaalSluitingsTekst({
      gesloten_door: null,
      gesloten_op: new Date(2026, 2, 29, 3, 0).toISOString(),
    })
    expect(subtitel).toContain(sluitDatum)
  })
})
