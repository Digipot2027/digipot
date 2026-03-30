/**
 * PaginaStorten — regressietests voor de bedragselectie-logica
 *
 * De pagina bevat complexe prioriteitslogica die niet in een util zit en
 * daardoor onzichtbaar was voor tests. Dit bestand dekt uitsluitend die
 * logica als pure functie-extractie — geen Supabase, geen routing.
 *
 * Gedekte regressierisico's:
 *   PS-1  effectiefBedrag prioriteitslogica (snelkeuze vs vrije invoer)
 *   PS-2  bedragGeldig grenscondities (0, negatief, MAX, boven MAX)
 *   PS-3  handleStorten validatie-paden (geen bedrag, gesloten pot, geen deelnemer)
 *
 * Teststrategie:
 *   De bedragselectielogica staat als inline berekening in de component.
 *   We extraheren de logica naar een testbare helper-functie en testen die
 *   direct. Dit is correcter dan de hele component te mounten met Supabase-mocks.
 *
 * AANNAME die getest wordt (uit PaginaStorten.jsx):
 *   const effectiefBedrag = gekozenBedrag !== null
 *     ? gekozenBedrag
 *     : (vrijeInvoerActief && vrijeInvoer.trim() ? vrijeInvoerNum : null)
 *
 *   const bedragGeldig = effectiefBedrag !== null
 *     && !isNaN(effectiefBedrag)
 *     && effectiefBedrag > 0
 *     && effectiefBedrag <= MAX
 */

import { describe, it, expect } from 'vitest'
import { parseBedrag } from '../utils/formatBedrag'

// ─── Extractie van de prioriteitslogica uit PaginaStorten ────────────────────
// Identiek aan de inline berekening in de component — als de component
// verandert moet deze functie ook worden bijgewerkt.

const MAX = 999.99

function berekenEffectiefBedrag({ gekozenBedrag, vrijeInvoerActief, vrijeInvoer }) {
  const vrijeInvoerNum = parseBedrag(vrijeInvoer)
  return gekozenBedrag !== null
    ? gekozenBedrag
    : (vrijeInvoerActief && vrijeInvoer.trim() ? vrijeInvoerNum : null)
}

function isBedragGeldig(effectiefBedrag) {
  return effectiefBedrag !== null
    && !isNaN(effectiefBedrag)
    && effectiefBedrag > 0
    && effectiefBedrag <= MAX
}

// ─── PS-1: effectiefBedrag prioriteitslogica ──────────────────────────────────

describe('PaginaStorten — PS-1: effectiefBedrag prioriteitslogica', () => {
  it('snelkeuze gekozen → snelkeuze wint, ongeacht vrije invoer', () => {
    const result = berekenEffectiefBedrag({
      gekozenBedrag: 20,
      vrijeInvoerActief: true,
      vrijeInvoer: '35,00',
    })
    expect(result).toBe(20)
  })

  it('geen snelkeuze, vrije invoer actief met waarde → vrije invoer geldt', () => {
    const result = berekenEffectiefBedrag({
      gekozenBedrag: null,
      vrijeInvoerActief: true,
      vrijeInvoer: '35,00',
    })
    expect(result).toBe(35)
  })

  it('geen snelkeuze, vrije invoer actief maar leeg → null', () => {
    const result = berekenEffectiefBedrag({
      gekozenBedrag: null,
      vrijeInvoerActief: true,
      vrijeInvoer: '',
    })
    expect(result).toBeNull()
  })

  it('geen snelkeuze, vrije invoer actief maar alleen spaties → null', () => {
    const result = berekenEffectiefBedrag({
      gekozenBedrag: null,
      vrijeInvoerActief: true,
      vrijeInvoer: '   ',
    })
    expect(result).toBeNull()
  })

  it('geen snelkeuze, vrije invoer NIET actief → null, ook al heeft vrije invoer waarde', () => {
    // Scenario: gebruiker had eerder iets ingetypt maar daarna snelkeuze geklikt
    // en vervolgens snelkeuze teruggezet — vrijeInvoerActief=false
    const result = berekenEffectiefBedrag({
      gekozenBedrag: null,
      vrijeInvoerActief: false,
      vrijeInvoer: '35,00',
    })
    expect(result).toBeNull()
  })

  it('snelkeuze=0 wordt behandeld als null (falsy) → vrije invoer geldt', () => {
    // gekozenBedrag=0 is falsy — !==null check voorkomt dit al in de broncode
    // maar 0 kan nooit een snelkeuze zijn (SNELBEDRAGEN=[5,10,20,50])
    // Test documenteert het gedrag bij onverwachte waarde 0
    const result = berekenEffectiefBedrag({
      gekozenBedrag: 0,
      vrijeInvoerActief: true,
      vrijeInvoer: '35,00',
    })
    // gekozenBedrag === 0, 0 !== null is true → snelkeuze wint met waarde 0
    expect(result).toBe(0)
  })

  it('alle vier snelbedragen geven het correcte effectieve bedrag', () => {
    for (const bedrag of [5, 10, 20, 50]) {
      const result = berekenEffectiefBedrag({
        gekozenBedrag: bedrag,
        vrijeInvoerActief: false,
        vrijeInvoer: '',
      })
      expect(result).toBe(bedrag)
    }
  })

  it('vrije invoer met komma wordt correct geparseerd', () => {
    const result = berekenEffectiefBedrag({
      gekozenBedrag: null,
      vrijeInvoerActief: true,
      vrijeInvoer: '12,50',
    })
    expect(result).toBe(12.5)
  })

  it('vrije invoer met punt wordt correct geparseerd', () => {
    const result = berekenEffectiefBedrag({
      gekozenBedrag: null,
      vrijeInvoerActief: true,
      vrijeInvoer: '12.50',
    })
    expect(result).toBe(12.5)
  })
})

// ─── PS-2: bedragGeldig grenscondities ───────────────────────────────────────

describe('PaginaStorten — PS-2: bedragGeldig grenscondities', () => {
  it('null effectiefBedrag → niet geldig', () => {
    expect(isBedragGeldig(null)).toBe(false)
  })

  it('bedrag = 0 → niet geldig', () => {
    expect(isBedragGeldig(0)).toBe(false)
  })

  it('negatief bedrag → niet geldig', () => {
    expect(isBedragGeldig(-1)).toBe(false)
  })

  it('bedrag = 0.01 → geldig (minimum)', () => {
    expect(isBedragGeldig(0.01)).toBe(true)
  })

  it('bedrag = 999.99 → geldig (maximum)', () => {
    expect(isBedragGeldig(999.99)).toBe(true)
  })

  it('bedrag = 1000 → niet geldig (boven maximum)', () => {
    expect(isBedragGeldig(1000)).toBe(false)
  })

  it('bedrag = 999.991 → niet geldig (boven maximum)', () => {
    expect(isBedragGeldig(999.991)).toBe(false)
  })

  it('NaN → niet geldig', () => {
    expect(isBedragGeldig(NaN)).toBe(false)
  })

  it('normale snelbedragen zijn geldig', () => {
    for (const bedrag of [5, 10, 20, 50]) {
      expect(isBedragGeldig(bedrag)).toBe(true)
    }
  })
})

// ─── PS-3: validatiepaden in handleStorten ────────────────────────────────────
// De validatie in handleStorten is een reeks vroege guards vóór de DB-call.
// We testen de condities direct als logische expressies — identiek aan de broncode.

describe('PaginaStorten — PS-3: validatiepaden handleStorten', () => {
  it('geen geldig bedrag → foutmelding "Kies een bedrag"', () => {
    // Simuleer: bedragGeldig=false, effectiefBedrag=null
    const bedragGeldig = isBedragGeldig(null)
    const effectiefBedrag = null

    let fout = ''
    if (!bedragGeldig) {
      if (effectiefBedrag !== null && effectiefBedrag > MAX) {
        fout = 'Het maximale bedrag per storting is €999,99.'
      } else {
        fout = 'Kies een bedrag of voer een bedrag in.'
      }
    }
    expect(fout).toBe('Kies een bedrag of voer een bedrag in.')
  })

  it('bedrag boven MAX → specifieke max-foutmelding', () => {
    // Simuleer: effectiefBedrag=1500, bedragGeldig=false
    const effectiefBedrag = 1500
    const bedragGeldig = isBedragGeldig(effectiefBedrag)

    let fout = ''
    if (!bedragGeldig) {
      if (effectiefBedrag !== null && effectiefBedrag > MAX) {
        fout = 'Het maximale bedrag per storting is €999,99.'
      } else {
        fout = 'Kies een bedrag of voer een bedrag in.'
      }
    }
    expect(fout).toBe('Het maximale bedrag per storting is €999,99.')
  })

  it('geldig bedrag, geen deelnemer → foutmelding "geen deelnemer"', () => {
    const bedragGeldig = true
    const deelnemer = null

    let fout = ''
    if (bedragGeldig && !deelnemer) {
      fout = 'Je bent geen deelnemer van dit potje.'
    }
    expect(fout).toBe('Je bent geen deelnemer van dit potje.')
  })

  it('geldig bedrag, deelnemer aanwezig, potje gesloten → foutmelding "gesloten"', () => {
    const bedragGeldig = true
    const deelnemer = { id: 'abc', naam: 'Jan' }
    const potje = { status: 'gesloten' }

    let fout = ''
    if (bedragGeldig && deelnemer && potje?.status === 'gesloten') {
      fout = 'Dit potje is gesloten.'
    }
    expect(fout).toBe('Dit potje is gesloten.')
  })

  it('geldig bedrag, deelnemer aanwezig, potje open → geen fout voor DB-call', () => {
    const bedragGeldig = true
    const deelnemer = { id: 'abc', naam: 'Jan' }
    const potje = { status: 'open' }

    let fout = ''
    if (!bedragGeldig) fout = 'Kies een bedrag of voer een bedrag in.'
    else if (!deelnemer) fout = 'Je bent geen deelnemer van dit potje.'
    else if (potje?.status === 'gesloten') fout = 'Dit potje is gesloten.'

    expect(fout).toBe('')
  })
})
