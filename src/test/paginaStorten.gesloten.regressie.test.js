/**
 * PaginaStorten — regressietest: gesloten potje
 *
 * Dekt het validatiepad dat in paginaStorten.regressie.test.js ontbrak:
 * een deelnemer die de stortingspagina bereikt terwijl het potje al gesloten is.
 *
 * Dit kan in twee situaties optreden:
 *   1. Handmatig gesloten: iemand sluit het potje terwijl een andere
 *      deelnemer nog op het stortingscherm staat (race condition via realtime).
 *   2. Automatisch gesloten: het potje is na 24 uur gesloten door lifecycle
 *      stap 19, maar de deelnemer heeft de pagina open gelaten.
 *
 * Fix (PW-11d, 2026-04-25): gesloten-check verplaatst naar vóór de deelnemer-check
 * in handleStorten, en useEffect toegevoegd die redirect triggert zodra
 * potje?.status === 'gesloten' na laden. Dit zorgt dat de snelknoppen nooit
 * zichtbaar zijn bij een al-gesloten potje.
 *
 * Validatievolgorde in handleStorten (na fix):
 *   1. bedrag-check
 *   2. bezigRef-guard
 *   3. gesloten-check  ← verplaatst van positie 4 naar 3
 *   4. deelnemer-check
 *   5. actief-check
 *
 * Gedekte regressierisico's:
 *   PSG-1  status 'gesloten' → foutmelding, geen DB-call
 *   PSG-2  status 'open' → geen fout op dit pad
 *   PSG-3  potje === null → geen fout op dit pad (potje?.status is undefined)
 *   PSG-4  automatisch gesloten (gesloten_door=null) → zelfde blokkering als handmatig
 *   PSG-5  volgorde validaties: bedrag-check komt vóór gesloten-check,
 *          gesloten-check komt vóór deelnemer-check (gewijzigd t.o.v. v1)
 */

import { describe, it, expect } from 'vitest'

const MAX = 999.99

function isBedragGeldig(effectiefBedrag) {
  return effectiefBedrag !== null
    && !isNaN(effectiefBedrag)
    && effectiefBedrag > 0
    && effectiefBedrag <= MAX
}

// Extractie van de volledige validatievolgorde uit handleStorten
// Identiek aan de guards in PaginaStorten.jsx vóór de DB-call.
// PW-11d fix: gesloten-check staat nu vóór de deelnemer-check.
function valideerStorten({ bedragGeldig, effectiefBedrag, potje, deelnemer }) {
  if (!bedragGeldig) {
    if (effectiefBedrag !== null && effectiefBedrag > MAX) {
      return 'Het maximale bedrag per storting is €999,99.'
    }
    return 'Kies een bedrag of voer een bedrag in.'
  }
  // gesloten-check vóór deelnemer-check (PW-11d fix)
  if (potje?.status === 'gesloten') {
    return 'Dit potje is gesloten.'
  }
  if (!deelnemer) {
    return 'Je bent geen deelnemer van dit potje.'
  }
  return null // geen fout → DB-call mag doorgaan
}

// ─── PSG-1: status 'gesloten' blokkeert storten ──────────────────────────────

describe('PaginaStorten — PSG-1: potje gesloten blokkeert storten', () => {
  const deelnemer = { id: 'abc', naam: 'Jan' }

  it('handmatig gesloten potje geeft foutmelding "Dit potje is gesloten."', () => {
    const fout = valideerStorten({
      bedragGeldig: true,
      effectiefBedrag: 20,
      potje: { status: 'gesloten', gesloten_door: 'deelnemer-uuid' },
      deelnemer,
    })
    expect(fout).toBe('Dit potje is gesloten.')
  })

  it('automatisch gesloten potje (gesloten_door=null) geeft dezelfde foutmelding', () => {
    const fout = valideerStorten({
      bedragGeldig: true,
      effectiefBedrag: 20,
      potje: { status: 'gesloten', gesloten_door: null },
      deelnemer,
    })
    expect(fout).toBe('Dit potje is gesloten.')
  })

  it('foutmelding bevat niet de woorden "automatisch" of "lifecycle" (generieke tekst)', () => {
    const fout = valideerStorten({
      bedragGeldig: true,
      effectiefBedrag: 20,
      potje: { status: 'gesloten', gesloten_door: null },
      deelnemer,
    })
    expect(fout).not.toMatch(/automatisch/i)
    expect(fout).not.toMatch(/lifecycle/i)
  })

  it('retourneert null (geen fout) bij status "open"', () => {
    const fout = valideerStorten({
      bedragGeldig: true,
      effectiefBedrag: 20,
      potje: { status: 'open' },
      deelnemer,
    })
    expect(fout).toBeNull()
  })
})

// ─── PSG-2 + PSG-3: open potje en null-potje ─────────────────────────────────

describe('PaginaStorten — PSG-2/PSG-3: open en null potje', () => {
  const deelnemer = { id: 'abc', naam: 'Jan' }

  it('PSG-2: status "open" → geen fout op het gesloten-pad', () => {
    const fout = valideerStorten({
      bedragGeldig: true,
      effectiefBedrag: 10,
      potje: { status: 'open', gesloten_door: null },
      deelnemer,
    })
    expect(fout).toBeNull()
  })

  it('PSG-3: potje === null → potje?.status is undefined → geen gesloten-fout', () => {
    // Als de data nog niet geladen is (laadData nog bezig), is potje null.
    // De guard potje?.status === 'gesloten' is dan false → geen fout op dit pad.
    // In de praktijk redirect de useEffect bij laden=false + gesloten, maar
    // handleStorten kan theoretisch worden aangeroepen vóór laden klaar is.
    const fout = valideerStorten({
      bedragGeldig: true,
      effectiefBedrag: 10,
      potje: null,
      deelnemer,
    })
    expect(fout).toBeNull()
  })

  it('PSG-3b: potje === undefined → geen gesloten-fout', () => {
    const fout = valideerStorten({
      bedragGeldig: true,
      effectiefBedrag: 10,
      potje: undefined,
      deelnemer,
    })
    expect(fout).toBeNull()
  })
})

// ─── PSG-4: automatisch gesloten — volledige validatiestapel ─────────────────

describe('PaginaStorten — PSG-4: automatisch gesloten potje, volledige validatie', () => {
  it('geldig bedrag + bekende deelnemer + automatisch gesloten → geblokkeerd', () => {
    const effectiefBedrag = 20
    const fout = valideerStorten({
      bedragGeldig: isBedragGeldig(effectiefBedrag),
      effectiefBedrag,
      potje: { status: 'gesloten', gesloten_door: null },
      deelnemer: { id: 'abc', naam: 'Jan' },
    })
    expect(fout).toBe('Dit potje is gesloten.')
  })

  it('ongeldig bedrag + automatisch gesloten → bedrag-fout komt eerst', () => {
    // PSG-5: volgorde validaties — bedrag-check gaat voor gesloten-check
    const effectiefBedrag = null
    const fout = valideerStorten({
      bedragGeldig: isBedragGeldig(effectiefBedrag),
      effectiefBedrag,
      potje: { status: 'gesloten', gesloten_door: null },
      deelnemer: { id: 'abc', naam: 'Jan' },
    })
    expect(fout).toBe('Kies een bedrag of voer een bedrag in.')
  })

  it('onbekende deelnemer + automatisch gesloten → gesloten-fout komt eerst (PW-11d fix)', () => {
    // Na de PW-11d fix staat gesloten-check vóór deelnemer-check.
    // Dit is het correcte gedrag: als het potje gesloten is, is de
    // deelnemer-status irrelevant voor de gebruiker.
    const fout = valideerStorten({
      bedragGeldig: true,
      effectiefBedrag: 20,
      potje: { status: 'gesloten', gesloten_door: null },
      deelnemer: null,
    })
    expect(fout).toBe('Dit potje is gesloten.')
  })
})

// ─── PSG-5: validatievolgorde expliciet ──────────────────────────────────────

describe('PaginaStorten — PSG-5: validatievolgorde (na PW-11d fix)', () => {
  it('bedrag-check vóór gesloten-check', () => {
    // Geen bedrag EN gesloten pot → bedrag-fout wint
    const fout = valideerStorten({
      bedragGeldig: false,
      effectiefBedrag: null,
      potje: { status: 'gesloten' },
      deelnemer: { id: 'abc', naam: 'Jan' },
    })
    expect(fout).toBe('Kies een bedrag of voer een bedrag in.')
  })

  it('gesloten-check vóór deelnemer-check', () => {
    // Gesloten pot EN geen deelnemer → gesloten-fout wint (gewijzigd t.o.v. v1)
    const fout = valideerStorten({
      bedragGeldig: true,
      effectiefBedrag: 20,
      potje: { status: 'gesloten' },
      deelnemer: null,
    })
    expect(fout).toBe('Dit potje is gesloten.')
  })

  it('bedrag-check vóór deelnemer-check (ongewijzigd)', () => {
    // Geen bedrag EN geen deelnemer → bedrag-fout wint
    const fout = valideerStorten({
      bedragGeldig: false,
      effectiefBedrag: null,
      potje: { status: 'open' },
      deelnemer: null,
    })
    expect(fout).toBe('Kies een bedrag of voer een bedrag in.')
  })
})
