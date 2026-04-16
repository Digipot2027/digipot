/**
 * valideer.js — unit tests
 *
 * Dekt alle validatielogica die eerder inline stond in ModalDeelnemen,
 * ModalTransactie en PaginaNieuwPotje. Nu getest als pure functies,
 * zonder React, DOM of Supabase.
 *
 * valideerPotjeNaam (geëxtraheerd uit PaginaNieuwPotje, 2026-04-15):
 *   VP-01  lege naam → fout
 *   VP-02  naam met alleen spaties → fout (trim)
 *   VP-03  naam exact 30 tekens → geldig (grenswaarde)
 *   VP-04  naam 31 tekens → fout met het juiste maximum
 *   VP-05  naam 1 teken → geldig (minimum)
 *   VP-06  naam met voorloop-/naspaties → trim, geldig
 *   VP-07  foutmelding bevat het geconfigureerde maximum (dynamisch)
 *   VP-08  volgorde: leeg gaat vóór te lang
 *
 * valideerDeelnemerNaam:
 *   VD-01  lege naam → fout
 *   VD-02  naam met alleen spaties → fout (trim)
 *   VD-03  naam exact 30 tekens → geldig (grenswaarde)
 *   VD-04  naam 31 tekens → fout
 *   VD-05  naam 1 teken → geldig (minimum)
 *   VD-06  naam met voorloop-/naspaties → trim, geldig
 *   VD-07  potje vol (20 deelnemers) → fout
 *   VD-08  potje heeft 19 deelnemers → geldig (grenswaarde)
 *   VD-09  duplicate naam exact match → fout
 *   VD-10  duplicate naam andere casing (jan vs Jan) → fout
 *   VD-11  duplicate naam HOOFDLETTERS → fout
 *   VD-12  naam die lijkt op bestaande maar niet gelijk is → geldig
 *   VD-13  geldige naam, lege deelnemerslijst → geldig
 *   VD-14  foutmelding bevat het maximumaantal (dynamisch)
 *   VD-15  volgorde: leeg gaat vóór te lang
 *   VD-16  volgorde: te lang gaat vóór potje vol
 *   VD-17  volgorde: potje vol gaat vóór duplicate
 *
 * valideerTransactieBedrag:
 *   VT-01  leeg bedrag → fout
 *   VT-02  bedrag = 0 → fout
 *   VT-03  negatief bedrag → fout
 *   VT-04  NaN bedrag → fout
 *   VT-05  bedrag = 0.01 → geldig (minimum)
 *   VT-06  bedrag = 999.99 → geldig (maximum)
 *   VT-07  bedrag = 1000 → fout (boven maximum)
 *   VT-08  bedrag = 999,99 met komma → geldig (Nederlandse invoer)
 *   VT-09  storting boven saldo → geldig (geen saldocheck bij storting)
 *   VT-10  betaling exact gelijk aan saldo → geldig (grenswaarde)
 *   VT-11  betaling één cent boven saldo → fout
 *   VT-12  betaling ver boven saldo → fout met formatBedrag van saldo
 *   VT-13  storting, geen saldo beschikbaar → geldig
 *   VT-14  foutmelding saldo-check bevat geformatteerd saldo
 *   VT-15  volgorde: leeg/NaN gaat vóór boven-max
 *   VT-16  volgorde: boven-max gaat vóór saldo-check
 */

import { describe, it, expect } from 'vitest'
import { valideerPotjeNaam, valideerDeelnemerNaam, valideerTransactieBedrag } from '../utils/valideer'
import { formatBedrag, parseBedrag } from '../utils/formatBedrag'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const maakDeelnemers = (namen) => namen.map((naam, i) => ({ id: String(i), naam }))

function valideerBedrag(invoer, { isStorting, potSaldo, max = 999.99 } = {}) {
  const bedragNum = parseBedrag(invoer)
  return valideerTransactieBedrag(invoer, bedragNum, {
    isStorting,
    potSaldo,
    formatBedrag,
    max,
  })
}

// ─── valideerPotjeNaam ────────────────────────────────────────────────────────

describe('valideerPotjeNaam — VP-01 t/m VP-06: naam-inhoud', () => {
  it('VP-01: lege naam geeft foutmelding', () => {
    expect(valideerPotjeNaam('')).toBe('Geef het potje een naam.')
  })

  it('VP-02: naam met alleen spaties geeft foutmelding (trim)', () => {
    expect(valideerPotjeNaam('   ')).toBe('Geef het potje een naam.')
  })

  it('VP-03: naam van exact 30 tekens is geldig (grenswaarde)', () => {
    expect(valideerPotjeNaam('a'.repeat(30))).toBeNull()
  })

  it('VP-04: naam van 31 tekens geeft foutmelding', () => {
    expect(valideerPotjeNaam('a'.repeat(31)))
      .toBe('De naam van het potje mag maximaal 30 tekens zijn.')
  })

  it('VP-05: naam van 1 teken is geldig (minimum)', () => {
    expect(valideerPotjeNaam('a')).toBeNull()
  })

  it('VP-06: naam met voorloop- en naspaties wordt getrimd en is geldig', () => {
    expect(valideerPotjeNaam('  vrijmibo  ')).toBeNull()
  })
})

describe('valideerPotjeNaam — VP-07 t/m VP-08: dynamisch maximum en volgorde', () => {
  it('VP-07: foutmelding bevat het geconfigureerde maximum', () => {
    const fout = valideerPotjeNaam('a'.repeat(26), { maxNaam: 25 })
    expect(fout).toBe('De naam van het potje mag maximaal 25 tekens zijn.')
  })

  it('VP-08: lege naam gaat vóór te-lang-check', () => {
    // Lege naam retourneert altijd de lege-naam-fout
    expect(valideerPotjeNaam('')).toBe('Geef het potje een naam.')
  })
})

// ─── valideerDeelnemerNaam ────────────────────────────────────────────────────

describe('valideerDeelnemerNaam — VD-01 t/m VD-06: naam-inhoud', () => {
  it('VD-01: lege naam geeft foutmelding', () => {
    expect(valideerDeelnemerNaam('', [])).toBe('Vul je naam in om deel te nemen.')
  })

  it('VD-02: naam met alleen spaties geeft foutmelding (trim)', () => {
    expect(valideerDeelnemerNaam('   ', [])).toBe('Vul je naam in om deel te nemen.')
  })

  it('VD-03: naam van exact 30 tekens is geldig (grenswaarde)', () => {
    const naam = 'a'.repeat(30)
    expect(valideerDeelnemerNaam(naam, [])).toBeNull()
  })

  it('VD-04: naam van 31 tekens geeft foutmelding', () => {
    const naam = 'a'.repeat(31)
    expect(valideerDeelnemerNaam(naam, [])).toBe('Je naam mag maximaal 30 tekens zijn.')
  })

  it('VD-05: naam van 1 teken is geldig (minimum)', () => {
    expect(valideerDeelnemerNaam('a', [])).toBeNull()
  })

  it('VD-06: naam met voorloop- en naspaties wordt getrimd en is geldig', () => {
    expect(valideerDeelnemerNaam('  Jan  ', [])).toBeNull()
  })
})

describe('valideerDeelnemerNaam — VD-07 t/m VD-08: potje vol', () => {
  it('VD-07: potje vol (20 deelnemers) geeft foutmelding', () => {
    const deelnemers = maakDeelnemers(Array(20).fill('').map((_, i) => `Deelnemer${i}`))
    const fout = valideerDeelnemerNaam('Nieuw', deelnemers)
    expect(fout).toBe('Dit potje heeft het maximum van 20 deelnemers bereikt.')
  })

  it('VD-08: potje heeft 19 deelnemers, twintigste mag meedoen (grenswaarde)', () => {
    const deelnemers = maakDeelnemers(Array(19).fill('').map((_, i) => `Deelnemer${i}`))
    expect(valideerDeelnemerNaam('Nieuw', deelnemers)).toBeNull()
  })
})

describe('valideerDeelnemerNaam — VD-09 t/m VD-12: duplicate naam', () => {
  it('VD-09: exact dezelfde naam geeft foutmelding', () => {
    const deelnemers = maakDeelnemers(['Jan'])
    expect(valideerDeelnemerNaam('Jan', deelnemers))
      .toBe('Deze naam is al bezet in dit potje. Kies een andere naam.')
  })

  it('VD-10: zelfde naam andere casing (jan vs Jan) geeft foutmelding', () => {
    const deelnemers = maakDeelnemers(['Jan'])
    expect(valideerDeelnemerNaam('jan', deelnemers))
      .toBe('Deze naam is al bezet in dit potje. Kies een andere naam.')
  })

  it('VD-11: zelfde naam volledig in hoofdletters geeft foutmelding', () => {
    const deelnemers = maakDeelnemers(['jan'])
    expect(valideerDeelnemerNaam('JAN', deelnemers))
      .toBe('Deze naam is al bezet in dit potje. Kies een andere naam.')
  })

  it('VD-12: naam die lijkt op bestaande maar niet gelijk is, is geldig', () => {
    const deelnemers = maakDeelnemers(['Jan'])
    expect(valideerDeelnemerNaam('Jana', deelnemers)).toBeNull()
  })
})

describe('valideerDeelnemerNaam — VD-13 t/m VD-14: overige gevallen', () => {
  it('VD-13: geldige naam in lege deelnemerslijst geeft null', () => {
    expect(valideerDeelnemerNaam('Jan', [])).toBeNull()
  })

  it('VD-14: foutmelding bij te lange naam bevat het geconfigureerde maximum', () => {
    const fout = valideerDeelnemerNaam('a'.repeat(51), [], { maxNaam: 50 })
    expect(fout).toBe('Je naam mag maximaal 50 tekens zijn.')
  })

  it('VD-14b: foutmelding bij potje vol bevat het geconfigureerde maximum', () => {
    const deelnemers = maakDeelnemers(Array(5).fill('').map((_, i) => `D${i}`))
    const fout = valideerDeelnemerNaam('Nieuw', deelnemers, { maxDeelnemers: 5 })
    expect(fout).toBe('Dit potje heeft het maximum van 5 deelnemers bereikt.')
  })
})

describe('valideerDeelnemerNaam — VD-15 t/m VD-17: volgorde van checks', () => {
  it('VD-15: lege naam gaat vóór te-lang-check', () => {
    expect(valideerDeelnemerNaam('', [])).toBe('Vul je naam in om deel te nemen.')
  })

  it('VD-16: te-lange naam gaat vóór potje-vol-check', () => {
    const deelnemers = maakDeelnemers(Array(20).fill('').map((_, i) => `D${i}`))
    const fout = valideerDeelnemerNaam('a'.repeat(31), deelnemers)
    expect(fout).toBe('Je naam mag maximaal 30 tekens zijn.')
  })

  it('VD-17: potje-vol-check gaat vóór duplicate-check', () => {
    const namen = Array(20).fill('').map((_, i) => `D${i}`)
    const deelnemers = maakDeelnemers(namen)
    const fout = valideerDeelnemerNaam('D0', deelnemers)
    expect(fout).toBe('Dit potje heeft het maximum van 20 deelnemers bereikt.')
  })
})

// ─── valideerTransactieBedrag ─────────────────────────────────────────────────

describe('valideerTransactieBedrag — VT-01 t/m VT-04: ongeldige invoer', () => {
  it('VT-01: leeg bedrag geeft foutmelding', () => {
    expect(valideerBedrag('', { isStorting: true, potSaldo: 100 }))
      .toBe('Voer een bedrag in van minimaal €0,01.')
  })

  it('VT-02: bedrag = 0 geeft foutmelding', () => {
    expect(valideerBedrag('0', { isStorting: true, potSaldo: 100 }))
      .toBe('Voer een bedrag in van minimaal €0,01.')
  })

  it('VT-03: negatief bedrag geeft foutmelding', () => {
    expect(valideerBedrag('-5', { isStorting: true, potSaldo: 100 }))
      .toBe('Voer een bedrag in van minimaal €0,01.')
  })

  it('VT-04: niet-numerieke invoer geeft foutmelding', () => {
    expect(valideerBedrag('abc', { isStorting: true, potSaldo: 100 }))
      .toBe('Voer een bedrag in van minimaal €0,01.')
  })
})

describe('valideerTransactieBedrag — VT-05 t/m VT-08: grenzen', () => {
  it('VT-05: bedrag = 0.01 is geldig (minimum)', () => {
    expect(valideerBedrag('0.01', { isStorting: true, potSaldo: 100 })).toBeNull()
  })

  it('VT-06: bedrag = 999.99 is geldig (maximum)', () => {
    expect(valideerBedrag('999.99', { isStorting: true, potSaldo: 0 })).toBeNull()
  })

  it('VT-07: bedrag = 1000 geeft foutmelding (boven maximum)', () => {
    expect(valideerBedrag('1000', { isStorting: true, potSaldo: 0 }))
      .toBe('Het maximale bedrag per transactie is €999,99.')
  })

  it('VT-08: bedrag = 999,99 met komma is geldig (Nederlandse invoer)', () => {
    expect(valideerBedrag('999,99', { isStorting: true, potSaldo: 0 })).toBeNull()
  })
})

describe('valideerTransactieBedrag — VT-09 t/m VT-14: saldocheck bij betaling', () => {
  it('VT-09: storting boven saldo is altijd geldig (geen saldocheck)', () => {
    expect(valideerBedrag('500', { isStorting: true, potSaldo: 10 })).toBeNull()
  })

  it('VT-10: betaling exact gelijk aan saldo is geldig (grenswaarde)', () => {
    expect(valideerBedrag('50', { isStorting: false, potSaldo: 50 })).toBeNull()
  })

  it('VT-11: betaling één cent boven saldo geeft foutmelding', () => {
    const fout = valideerBedrag('50.01', { isStorting: false, potSaldo: 50 })
    expect(fout).toContain('niet genoeg saldo')
  })

  it('VT-12: betaling ver boven saldo geeft foutmelding', () => {
    const fout = valideerBedrag('200', { isStorting: false, potSaldo: 50 })
    expect(fout).toContain('niet genoeg saldo')
  })

  it('VT-13: storting bij leeg saldo (potSaldo = 0) is geldig', () => {
    expect(valideerBedrag('10', { isStorting: true, potSaldo: 0 })).toBeNull()
  })

  it('VT-14: foutmelding saldo-check bevat het geformatteerde saldo', () => {
    const fout = valideerBedrag('100', { isStorting: false, potSaldo: 25.5 })
    expect(fout).toContain('25,50')
    expect(fout).toContain('niet genoeg saldo')
  })
})

describe('valideerTransactieBedrag — VT-15 t/m VT-16: volgorde van checks', () => {
  it('VT-15: leeg bedrag gaat vóór boven-max-check', () => {
    const fout = valideerBedrag('', { isStorting: true, potSaldo: 0 })
    expect(fout).toBe('Voer een bedrag in van minimaal €0,01.')
  })

  it('VT-16: boven-max gaat vóór saldo-check bij betaling', () => {
    const fout = valideerBedrag('1000', { isStorting: false, potSaldo: 500 })
    expect(fout).toBe('Het maximale bedrag per transactie is €999,99.')
  })
})
