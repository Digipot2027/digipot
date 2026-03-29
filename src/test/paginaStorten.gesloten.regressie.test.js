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
 * De validatie in handleStorten blokkeert beide gevallen identiek:
 *   if (potje?.status === 'gesloten') { setInvoerFout('Dit potje is gesloten.') }
 *
 * Gedekte regressierisico's:
 *   PSG-1  status 'gesloten' → foutmelding, geen DB-call
 *   PSG-2  status 'open' → geen fout op dit pad
 *   PSG-3  potje === null → geen fout op dit pad (potje?.status is undefined)
 *   PSG-4  automatisch gesloten (gesloten_door=null) → zelfde blokkering als handmatig
 *   PSG-5  volgorde validaties: bedrag-check komt vóór gesloten-check
 */

import { describe, it, expect } from 'vitest'
import { parseBedrag } from '../utils/formatBedrag'

const MAX = 999.99

function isBedragGeldig(effectiefBedrag) {
  return effectiefBedrag !== null
    && !isNaN(effectiefBedrag)
    && effectiefBedrag > 0
    && effectiefBedrag <= MAX
}

// Extractie van de volledige validatievolgorde uit handleStorten
// Identiek aan de guards in PaginaStorten.jsx vóór de DB-call.
function valideerStorten({ bedragGeldig, effectiefBedrag, deelnemer, potje }) {
  if (!bedragGeldig) {
    if (effectiefBedrag !== null && effectiefBedrag > MAX) {
      return 'Het maximale bedrag per storting is €999,99.'
    }
    return 'Kies een bedrag of voer een bedrag in.'
  }
  if (!deelnemer) {
    return 'Je bent geen deelnemer van dit potje.'
  }
  if (potje?.status === 'gesloten') {
    return 'Dit potje is gesloten.'
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
      deelnemer,
      potje: { status: 'gesloten', gesloten_door: 'deelnemer-uuid' },
    })
    expect(fout).toBe('Dit potje is gesloten.')
  })

  it('automatisch gesloten potje (gesloten_door=null) geeft dezelfde foutmelding', () => {
    // Lifecycle stap 19 zet gesloten_door=null — de blokkering is identiek
    const fout = valideerStorten({
      bedragGeldig: true,
      effectiefBedrag: 20,
      deelnemer,
      potje: { status: 'gesloten', gesloten_door: null },
    })
    expect(fout).toBe('Dit potje is gesloten.')
  })

  it('foutmelding bevat niet de woorden "automatisch" of "lifecycle" (generieke tekst)', () => {
    const fout = valideerStorten({
      bedragGeldig: true,
      effectiefBedrag: 20,
      deelnemer,
      potje: { status: 'gesloten', gesloten_door: null },
    })
    expect(fout).not.toMatch(/automatisch/i)
    expect(fout).not.toMatch(/lifecycle/i)
  })

  it('retourneert null (geen fout) bij status "open"', () => {
    const fout = valideerStorten({
      bedragGeldig: true,
      effectiefBedrag: 20,
      deelnemer,
      potje: { status: 'open' },
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
      deelnemer,
      potje: { status: 'open', gesloten_door: null },
    })
    expect(fout).toBeNull()
  })

  it('PSG-3: potje === null → potje?.status is undefined → geen gesloten-fout', () => {
    // Als de data nog niet geladen is (laadData nog bezig), is potje null.
    // De guard potje?.status === 'gesloten' is dan false → geen fout op dit pad.
    // (In de praktijk toont de component een skeleton loader — handleStorten
    //  kan dan niet worden aangeroepen, maar we testen de guard zelf.)
    const fout = valideerStorten({
      bedragGeldig: true,
      effectiefBedrag: 10,
      deelnemer,
      potje: null,
    })
    expect(fout).toBeNull()
  })

  it('PSG-3b: potje === undefined → geen gesloten-fout', () => {
    const fout = valideerStorten({
      bedragGeldig: true,
      effectiefBedrag: 10,
      deelnemer,
      potje: undefined,
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
      deelnemer: { id: 'abc', naam: 'Jan' },
      potje: { status: 'gesloten', gesloten_door: null },
    })
    expect(fout).toBe('Dit potje is gesloten.')
  })

  it('ongeldig bedrag + automatisch gesloten → bedrag-fout komt eerst', () => {
    // PSG-5: volgorde validaties — bedrag-check gaat voor gesloten-check
    const effectiefBedrag = null
    const fout = valideerStorten({
      bedragGeldig: isBedragGeldig(effectiefBedrag),
      effectiefBedrag,
      deelnemer: { id: 'abc', naam: 'Jan' },
      potje: { status: 'gesloten', gesloten_door: null },
    })
    expect(fout).toBe('Kies een bedrag of voer een bedrag in.')
  })

  it('onbekende deelnemer + automatisch gesloten → deelnemer-fout komt eerst', () => {
    // PSG-5: volgorde — deelnemer-check gaat voor gesloten-check
    const fout = valideerStorten({
      bedragGeldig: true,
      effectiefBedrag: 20,
      deelnemer: null,
      potje: { status: 'gesloten', gesloten_door: null },
    })
    expect(fout).toBe('Je bent geen deelnemer van dit potje.')
  })
})

// ─── PSG-5: validatievolgorde expliciet ──────────────────────────────────────

describe('PaginaStorten — PSG-5: validatievolgorde', () => {
  it('bedrag-check vóór deelnemer-check', () => {
    // Geen bedrag EN geen deelnemer → bedrag-fout wint
    const fout = valideerStorten({
      bedragGeldig: false,
      effectiefBedrag: null,
      deelnemer: null,
      potje: { status: 'open' },
    })
    expect(fout).toBe('Kies een bedrag of voer een bedrag in.')
  })

  it('bedrag-check vóór gesloten-check', () => {
    // Geen bedrag EN gesloten pot → bedrag-fout wint
    const fout = valideerStorten({
      bedragGeldig: false,
      effectiefBedrag: null,
      deelnemer: { id: 'abc', naam: 'Jan' },
      potje: { status: 'gesloten' },
    })
    expect(fout).toBe('Kies een bedrag of voer een bedrag in.')
  })

  it('deelnemer-check vóór gesloten-check', () => {
    // Geen deelnemer EN gesloten pot → deelnemer-fout wint
    const fout = valideerStorten({
      bedragGeldig: true,
      effectiefBedrag: 20,
      deelnemer: null,
      potje: { status: 'gesloten' },
    })
    expect(fout).toBe('Je bent geen deelnemer van dit potje.')
  })
})
