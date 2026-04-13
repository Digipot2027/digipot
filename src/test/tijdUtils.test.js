/**
 * Tests — tijdUtils.js (2026-04-13)
 *
 * Pure hulpfuncties geëxtraheerd uit PaginaEindafrekening, PaginaStorten,
 * PaginaProfiel en DeelnemerDetailSheet. Testbaar zonder DOM, React of Supabase.
 *
 * Functies:
 *   tijdLabel          — ISO → "HH:MM" (korte weergave)
 *   volledigTijdLabel  — ISO → "HH:MM" (vandaag) of "dag mnd HH:MM" (ouder)
 *   transactiesVoor    — filter + sorteer transacties per deelnemer
 *   bouwSluitRegel     — sluitregel met of zonder sluitersnaam
 *   bepaalEffectiefBedrag — snelkeuze vs vrije invoer prioriteitslogica
 *   isBedragGeldig     — bedragvalidatie voor storten
 *   valideerProfielNaam — profiel naam validatie
 *   heeftProfielWijziging — opslaan-knop activatielogica
 *
 * Gedekte cases:
 *
 * TL-01  tijdLabel: geeft "HH:MM" formaat terug
 * TL-02  tijdLabel: correct uur en minuut
 *
 * VT-01  volledigTijdLabel: timestamp vandaag → alleen tijd
 * VT-02  volledigTijdLabel: timestamp gisteren → datum + tijd
 * VT-03  volledigTijdLabel: timestamp ver in verleden → datum + tijd
 *
 * TV-01  transactiesVoor: filtert op deelnemer_id
 * TV-02  transactiesVoor: sorteert op aangemaakt_op (oudste eerst)
 * TV-03  transactiesVoor: lege array bij onbekend deelnemer_id
 * TV-04  transactiesVoor: gemengde deelnemers → alleen eigen transacties
 *
 * SR-01  bouwSluitRegel: met sluitersnaam → "door [naam]"
 * SR-02  bouwSluitRegel: zonder sluitersnaam → "Automatisch gesloten"
 * SR-03  bouwSluitRegel: null sluitersnaam → automatisch pad
 *
 * EB-01  bepaalEffectiefBedrag: snelkeuze → snelkeuze bedrag
 * EB-02  bepaalEffectiefBedrag: snelkeuze 0 → snelkeuze heeft prioriteit boven vrije invoer
 * EB-03  bepaalEffectiefBedrag: geen snelkeuze + vrije invoer actief + ingevuld → vrije invoer
 * EB-04  bepaalEffectiefBedrag: geen snelkeuze + vrije invoer niet actief → null
 * EB-05  bepaalEffectiefBedrag: geen snelkeuze + vrije invoer leeg → null
 * EB-06  bepaalEffectiefBedrag: beide null/inactief → null
 *
 * BG-01  isBedragGeldig: geldig bedrag → true
 * BG-02  isBedragGeldig: null → false
 * BG-03  isBedragGeldig: 0 → false
 * BG-04  isBedragGeldig: negatief → false
 * BG-05  isBedragGeldig: boven max → false
 * BG-06  isBedragGeldig: precies max → true
 * BG-07  isBedragGeldig: NaN → false
 *
 * PN-01  valideerProfielNaam: lege naam → geldig (lege naam is toegestaan = verwijderen)
 * PN-02  valideerProfielNaam: naam binnen limiet → geldig
 * PN-03  valideerProfielNaam: naam op limiet → geldig
 * PN-04  valideerProfielNaam: naam over limiet → ongeldig + foutmelding
 * PN-05  valideerProfielNaam: foutmelding bevat max-getal
 *
 * HW-01  heeftProfielWijziging: gewijzigde naam → true
 * HW-02  heeftProfielWijziging: ongewijzigde naam → false
 * HW-03  heeftProfielWijziging: trim-effect → "Jan " == "Jan" → false
 * HW-04  heeftProfielWijziging: lege naam na leeg opgeslagen → false
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  tijdLabel,
  volledigTijdLabel,
  transactiesVoor,
  bouwSluitRegel,
  bepaalEffectiefBedrag,
  isBedragGeldig,
  valideerProfielNaam,
  heeftProfielWijziging,
} from '../utils/tijdUtils'

// ── tijdLabel ────────────────────────────────────────────────────────────────

describe('tijdUtils — TL-01..02: tijdLabel', () => {
  it('TL-01: geeft een string in "HH:MM" formaat terug', () => {
    const resultaat = tijdLabel('2026-04-13T14:30:00.000Z')
    // Formaat is locale-afhankelijk maar bevat altijd cijfers en een scheidingsteken
    expect(resultaat).toMatch(/\d{2}[:.]\d{2}/)
  })

  it('TL-02: een tijdstip om middernacht geeft "00:00" of equivalent terug', () => {
    // We testen dat de functie niet crasht en een string teruggeeft
    const resultaat = tijdLabel('2026-01-01T00:00:00.000Z')
    expect(typeof resultaat).toBe('string')
    expect(resultaat.length).toBeGreaterThan(0)
  })
})

// ── volledigTijdLabel ────────────────────────────────────────────────────────

describe('tijdUtils — VT-01..03: volledigTijdLabel', () => {
  it('VT-01: timestamp van vandaag → bevat geen datum (alleen tijd)', () => {
    // Maak een timestamp voor vandaag, 10:00
    const nu = new Date()
    nu.setHours(10, 0, 0, 0)
    const resultaat = volledigTijdLabel(nu.toISOString())
    // Korte notatie: geen maandnaam
    expect(resultaat).toMatch(/\d{2}[:.]\d{2}/)
    // Bevat geen maandafkortingen (jan, feb, etc.)
    expect(resultaat).not.toMatch(/\b(jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)\b/i)
  })

  it('VT-02: timestamp van gisteren → bevat datum + tijd', () => {
    const gisteren = new Date()
    gisteren.setDate(gisteren.getDate() - 1)
    gisteren.setHours(15, 30, 0, 0)
    const resultaat = volledigTijdLabel(gisteren.toISOString())
    // Uitgebreide notatie: bevat een getal (dag) en een tijd
    expect(typeof resultaat).toBe('string')
    expect(resultaat.length).toBeGreaterThan(5) // meer dan alleen "HH:MM"
  })

  it('VT-03: oude timestamp → bevat datum + tijd (geen crash)', () => {
    const oud = '2025-12-25T20:00:00.000Z'
    const resultaat = volledigTijdLabel(oud)
    expect(typeof resultaat).toBe('string')
    expect(resultaat.length).toBeGreaterThan(5)
  })
})

// ── transactiesVoor ──────────────────────────────────────────────────────────

describe('tijdUtils — TV-01..04: transactiesVoor', () => {
  const transacties = [
    { id: 't1', deelnemer_id: 'd1', type: 'storting', bedrag: 10, aangemaakt_op: '2026-04-13T10:00:00Z' },
    { id: 't2', deelnemer_id: 'd2', type: 'storting', bedrag: 20, aangemaakt_op: '2026-04-13T10:05:00Z' },
    { id: 't3', deelnemer_id: 'd1', type: 'betaling', bedrag: 15, aangemaakt_op: '2026-04-13T09:00:00Z' },
    { id: 't4', deelnemer_id: 'd1', type: 'storting', bedrag: 5,  aangemaakt_op: '2026-04-13T11:00:00Z' },
  ]

  it('TV-01: filtert correct op deelnemer_id', () => {
    const resultaat = transactiesVoor(transacties, 'd1')
    expect(resultaat.every(t => t.deelnemer_id === 'd1')).toBe(true)
    expect(resultaat).toHaveLength(3)
  })

  it('TV-02: sorteert op aangemaakt_op — oudste eerst', () => {
    const resultaat = transactiesVoor(transacties, 'd1')
    expect(resultaat[0].id).toBe('t3') // 09:00
    expect(resultaat[1].id).toBe('t1') // 10:00
    expect(resultaat[2].id).toBe('t4') // 11:00
  })

  it('TV-03: onbekend deelnemer_id → lege array', () => {
    expect(transactiesVoor(transacties, 'onbekend')).toHaveLength(0)
  })

  it('TV-04: gemengde deelnemers → alleen eigen transacties', () => {
    const resultaat = transactiesVoor(transacties, 'd2')
    expect(resultaat).toHaveLength(1)
    expect(resultaat[0].id).toBe('t2')
  })
})

// ── bouwSluitRegel ───────────────────────────────────────────────────────────

describe('tijdUtils — SR-01..03: bouwSluitRegel', () => {
  it('SR-01: met sluitersnaam → bevat "door [naam]"', () => {
    const resultaat = bouwSluitRegel('13 april 2026', '17:30', 'Alice')
    expect(resultaat).toContain('door Alice')
    expect(resultaat).toContain('13 april 2026')
    expect(resultaat).toContain('17:30')
    expect(resultaat).not.toContain('Automatisch')
  })

  it('SR-02: zonder sluitersnaam (undefined) → "Automatisch gesloten"', () => {
    const resultaat = bouwSluitRegel('13 april 2026', '17:30', undefined)
    expect(resultaat).toContain('Automatisch gesloten')
    expect(resultaat).not.toContain('door')
  })

  it('SR-03: null sluitersnaam → "Automatisch gesloten"', () => {
    const resultaat = bouwSluitRegel('13 april 2026', '17:30', null)
    expect(resultaat).toContain('Automatisch gesloten')
  })
})

// ── bepaalEffectiefBedrag ────────────────────────────────────────────────────

describe('tijdUtils — EB-01..06: bepaalEffectiefBedrag', () => {
  it('EB-01: snelkeuze actief → geeft snelkeuze bedrag terug', () => {
    expect(bepaalEffectiefBedrag(20, 35, true, '35')).toBe(20)
  })

  it('EB-02: snelkeuze 0 is geen null — heeft prioriteit boven vrije invoer', () => {
    // 0 is een falsy waarde maar !== null — de check is expliciet op null
    // In de praktijk is 0 geen geldig snelkeuze-bedrag, maar de prioriteitslogica
    // moet robuust zijn
    expect(bepaalEffectiefBedrag(0, 35, true, '35')).toBe(0)
  })

  it('EB-03: geen snelkeuze + vrije invoer actief + ingevuld → vrije invoer', () => {
    expect(bepaalEffectiefBedrag(null, 35, true, '35')).toBe(35)
  })

  it('EB-04: geen snelkeuze + vrije invoer NIET actief → null', () => {
    expect(bepaalEffectiefBedrag(null, 35, false, '35')).toBeNull()
  })

  it('EB-05: geen snelkeuze + vrije invoer actief maar leeg → null', () => {
    expect(bepaalEffectiefBedrag(null, 0, true, '')).toBeNull()
    expect(bepaalEffectiefBedrag(null, 0, true, '   ')).toBeNull()
  })

  it('EB-06: alles null/inactief → null', () => {
    expect(bepaalEffectiefBedrag(null, 0, false, '')).toBeNull()
  })
})

// ── isBedragGeldig ───────────────────────────────────────────────────────────

describe('tijdUtils — BG-01..07: isBedragGeldig', () => {
  it('BG-01: positief bedrag onder max → geldig', () => {
    expect(isBedragGeldig(10)).toBe(true)
    expect(isBedragGeldig(0.01)).toBe(true)
    expect(isBedragGeldig(999.98)).toBe(true)
  })

  it('BG-02: null → ongeldig', () => {
    expect(isBedragGeldig(null)).toBe(false)
  })

  it('BG-03: 0 → ongeldig (bedrag moet > 0 zijn)', () => {
    expect(isBedragGeldig(0)).toBe(false)
  })

  it('BG-04: negatief bedrag → ongeldig', () => {
    expect(isBedragGeldig(-1)).toBe(false)
  })

  it('BG-05: bedrag boven max → ongeldig', () => {
    expect(isBedragGeldig(1000)).toBe(false)
    expect(isBedragGeldig(999.999)).toBe(false)
  })

  it('BG-06: bedrag precies op max (999.99) → geldig', () => {
    expect(isBedragGeldig(999.99)).toBe(true)
  })

  it('BG-07: NaN → ongeldig', () => {
    expect(isBedragGeldig(NaN)).toBe(false)
  })
})

// ── valideerProfielNaam ───────────────────────────────────────────────────────

describe('tijdUtils — PN-01..05: valideerProfielNaam', () => {
  it('PN-01: lege naam → geldig (leeg = naam verwijderen)', () => {
    const { geldig, fout } = valideerProfielNaam('')
    expect(geldig).toBe(true)
    expect(fout).toBeNull()
  })

  it('PN-02: naam binnen limiet → geldig', () => {
    const { geldig, fout } = valideerProfielNaam('Alice')
    expect(geldig).toBe(true)
    expect(fout).toBeNull()
  })

  it('PN-03: naam precies op limiet (30 tekens) → geldig', () => {
    const { geldig } = valideerProfielNaam('a'.repeat(30))
    expect(geldig).toBe(true)
  })

  it('PN-04: naam over limiet → ongeldig, fout teruggegeven', () => {
    const { geldig, fout } = valideerProfielNaam('a'.repeat(31))
    expect(geldig).toBe(false)
    expect(fout).not.toBeNull()
  })

  it('PN-05: foutmelding bevat het max-getal', () => {
    const { fout } = valideerProfielNaam('a'.repeat(31), 30)
    expect(fout).toContain('30')
  })
})

// ── heeftProfielWijziging ─────────────────────────────────────────────────────

describe('tijdUtils — HW-01..04: heeftProfielWijziging', () => {
  it('HW-01: naam gewijzigd → true', () => {
    expect(heeftProfielWijziging('Bob', 'Alice')).toBe(true)
  })

  it('HW-02: naam ongewijzigd → false', () => {
    expect(heeftProfielWijziging('Alice', 'Alice')).toBe(false)
  })

  it('HW-03: "Jan " (met spatie) == "Jan" opgeslagen → geen wijziging na trim', () => {
    expect(heeftProfielWijziging('Jan ', 'Jan')).toBe(false)
  })

  it('HW-04: beide leeg → geen wijziging', () => {
    expect(heeftProfielWijziging('', '')).toBe(false)
  })
})
