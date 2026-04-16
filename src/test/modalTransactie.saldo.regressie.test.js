/**
 * Regressietests — ModalTransactie betalingsknop bij potSaldo = 0 (#7)
 *
 * Probleem:
 *   ModalTransactie toont een betaalformulier met een "Bevestigen →" knop.
 *   De knop is disabled als: `laden || !bedrag || !ikBenActief`
 *
 *   Opvallend: `potSaldo === 0` maakt de knop NIET disabled.
 *   Iemand kan een bedrag invullen en op Bevestigen klikken, waarna:
 *     1. valideerTransactieBedrag() geeft foutmelding (saldo-check)
 *     2. onBevestig() gooit SALDO_TE_LAAG na server-side check
 *
 *   Beide paden geven een foutmelding — maar de UX is sub-optimaal:
 *   de knop is enabled terwijl elke invoer gegarandeerd een fout geeft.
 *
 * Gedekte logica (puur als pure-functie extractie):
 *   MB-01  disabled-conditie: laden=false, bedrag aanwezig, actief → knop enabled
 *   MB-02  disabled-conditie: ikBenActief=false → knop altijd disabled
 *   MB-03  disabled-conditie: leeg bedrag → knop disabled
 *   MB-04  potSaldo=0, bedrag ingevuld, actief → knop ENABLED (huidig gedrag)
 *   MB-05  validatielogica bij potSaldo=0: elk bedrag > 0 geeft foutmelding
 *   MB-06  validatielogica bij potSaldo=0: bedrag=0 geeft "voer een bedrag in" fout
 *   MB-07  validatielogica: saldo-check alleen bij betaling, niet bij storting
 *   MB-08  foutmelding SALDO_TE_LAAG bevat het geformatteerde saldo (€0,00)
 *   MB-09  disabled bij laden=true, ongeacht bedrag en actief-status
 *   MB-10  grenswaarde: potSaldo=0.01, bedrag=0.01 → geldig (precies genoeg)
 *   MB-11  grenswaarde: potSaldo=0.01, bedrag=0.02 → fout (één cent te veel)
 */

import { describe, it, expect } from 'vitest'
import { valideerTransactieBedrag } from '../utils/valideer'
import { formatBedrag, parseBedrag } from '../utils/formatBedrag'

// ── Geëxtraheerde knop-disabled logica uit ModalTransactie ───────────────────
// Identiek aan: disabled={laden || !bedrag || !ikBenActief}

function isKnopDisabled({ laden, bedrag, ikBenActief }) {
  return laden || !bedrag || !ikBenActief
}

// ── Hulpfunctie: validatie via de echte valideer-module ───────────────────────

function valideerBetaling(bedragInvoer, potSaldo) {
  const bedragNum = parseBedrag(bedragInvoer)
  return valideerTransactieBedrag(bedragInvoer, bedragNum, {
    isStorting: false,
    potSaldo,
    formatBedrag: (b) => formatBedrag(b, 'EUR'),
    max: 999.99,
  })
}

function valideerStorting(bedragInvoer) {
  const bedragNum = parseBedrag(bedragInvoer)
  return valideerTransactieBedrag(bedragInvoer, bedragNum, {
    isStorting: true,
    potSaldo: 0, // potsaldo irrelevant voor storting
    formatBedrag: (b) => formatBedrag(b, 'EUR'),
    max: 999.99,
  })
}

// ── MB-01 t/m MB-04: knop-disabled logica ────────────────────────────────────

describe('ModalTransactie — MB-01 t/m MB-04: knop-disabled logica', () => {
  it('MB-01: laden=false, bedrag aanwezig, actief=true → knop enabled', () => {
    expect(isKnopDisabled({ laden: false, bedrag: '10', ikBenActief: true })).toBe(false)
  })

  it('MB-02: ikBenActief=false → knop altijd disabled, ongeacht bedrag', () => {
    expect(isKnopDisabled({ laden: false, bedrag: '10', ikBenActief: false })).toBe(true)
    expect(isKnopDisabled({ laden: false, bedrag: '', ikBenActief: false })).toBe(true)
  })

  it('MB-03: leeg bedrag → knop disabled', () => {
    expect(isKnopDisabled({ laden: false, bedrag: '', ikBenActief: true })).toBe(true)
  })

  it('MB-04: potSaldo=0, bedrag ingevuld, actief → knop ENABLED (gedocumenteerd huidig gedrag)', () => {
    // Huidig gedrag: potSaldo is geen input van de disabled-check.
    // De fout verschijnt pas na submit (validatie of server-side).
    // Als in de toekomst potSaldo wordt toegevoegd aan de disabled-check,
    // moet deze test worden herschreven.
    expect(isKnopDisabled({ laden: false, bedrag: '10', ikBenActief: true })).toBe(false)
    // Aanbeveling voor UX-verbetering: disabled={laden || !bedrag || !ikBenActief || (!isStorting && potSaldo === 0)}
  })

  it('MB-09: laden=true → altijd disabled, ongeacht bedrag en actief', () => {
    expect(isKnopDisabled({ laden: true, bedrag: '10', ikBenActief: true })).toBe(true)
    expect(isKnopDisabled({ laden: true, bedrag: '', ikBenActief: false })).toBe(true)
  })
})

// ── MB-05 t/m MB-08: validatielogica bij potSaldo = 0 ────────────────────────

describe('ModalTransactie — MB-05 t/m MB-08: validatie bij potSaldo = 0', () => {
  it('MB-05: potSaldo=0, bedrag=10 → foutmelding "niet genoeg saldo"', () => {
    const fout = valideerBetaling('10', 0)
    expect(fout).toContain('niet genoeg saldo')
  })

  it('MB-05b: potSaldo=0, bedrag=0.01 (minimum) → foutmelding "niet genoeg saldo"', () => {
    const fout = valideerBetaling('0.01', 0)
    expect(fout).toContain('niet genoeg saldo')
  })

  it('MB-06: potSaldo=0, bedrag=0 → foutmelding "minimaal €0,01" (bedrag-check eerst)', () => {
    // Volgorde: bedrag-check gaat vóór saldo-check
    const fout = valideerBetaling('0', 0)
    expect(fout).toBe('Voer een bedrag in van minimaal €0,01.')
  })

  it('MB-06b: potSaldo=0, bedrag leeg → foutmelding "minimaal €0,01"', () => {
    const fout = valideerBetaling('', 0)
    expect(fout).toBe('Voer een bedrag in van minimaal €0,01.')
  })

  it('MB-07: storting bij potSaldo=0 → GEEN saldo-fout (storting mag altijd)', () => {
    const fout = valideerStorting('10')
    expect(fout).toBeNull()
  })

  it('MB-08: foutmelding saldo-check bij potSaldo=0 bevat geformatteerd nul-bedrag', () => {
    // formatBedrag(0, 'EUR') geeft iets als "€\u202F0,00" (narrow no-break space, Node/jsdom-afhankelijk)
    // Controleer op de onderdelen die localeafhankelijk stabiel zijn
    const fout = valideerBetaling('5', 0)
    expect(fout).toContain('Maximaal beschikbaar')
    expect(fout).toMatch(/0,00/)
  })
})

// ── MB-10 t/m MB-11: grenswaarden rondom minimaal saldo ──────────────────────

describe('ModalTransactie — MB-10 t/m MB-11: grenswaarden potSaldo = 0.01', () => {
  it('MB-10: potSaldo=0.01, bedrag=0.01 → geldig (precies genoeg saldo)', () => {
    const fout = valideerBetaling('0.01', 0.01)
    expect(fout).toBeNull()
  })

  it('MB-11: potSaldo=0.01, bedrag=0.02 → fout (één cent te veel)', () => {
    const fout = valideerBetaling('0.02', 0.01)
    expect(fout).toContain('niet genoeg saldo')
    expect(fout).toMatch(/0,01/)
  })

  it('MB-11b: potSaldo=0.01, bedrag=999.99 → fout (ver boven saldo)', () => {
    const fout = valideerBetaling('999.99', 0.01)
    expect(fout).toContain('niet genoeg saldo')
  })
})

// ── MB-12: SALDO_TE_LAAG server-side foutafhandeling ─────────────────────────

describe('ModalTransactie — MB-12: SALDO_TE_LAAG foutparsering', () => {
  // Simuleert de foutafhandeling in handleSubmit bij een server-side SALDO_TE_LAAG error.
  // De server stuurt: new Error('SALDO_TE_LAAG:15.50')
  // De component parst dit naar: formatBedrag(15.50, valuta)

  function verwerkSaldoTelaagFout(errorMessage, valuta = 'EUR') {
    if (!errorMessage?.includes('SALDO_TE_LAAG')) return null
    const saldoStr = errorMessage.split(':')[1]
    return `Het potje heeft niet genoeg saldo. Maximaal beschikbaar: ${formatBedrag(saldoStr, valuta)}.`
  }

  it('MB-12a: SALDO_TE_LAAG:15.50 → geformatteerd bedrag in foutmelding', () => {
    const fout = verwerkSaldoTelaagFout('SALDO_TE_LAAG:15.50')
    expect(fout).toContain('15,50')
    expect(fout).toContain('Maximaal beschikbaar')
  })

  it('MB-12b: SALDO_TE_LAAG:0 → geformatteerd nul-bedrag in foutmelding', () => {
    // Spatie tussen euroteken en cijfer is locale/runtime-afhankelijk (U+0020 of U+202F)
    const fout = verwerkSaldoTelaagFout('SALDO_TE_LAAG:0')
    expect(fout).toMatch(/0,00/)
    expect(fout).toContain('Maximaal beschikbaar')
  })

  it('MB-12c: geen SALDO_TE_LAAG in message → null (niet dit pad)', () => {
    const fout = verwerkSaldoTelaagFout('NETWORK_ERROR')
    expect(fout).toBeNull()
  })

  it('MB-12d: valuta USD wordt doorgegeven aan formatBedrag', () => {
    const eur = verwerkSaldoTelaagFout('SALDO_TE_LAAG:10', 'EUR')
    const usd = verwerkSaldoTelaagFout('SALDO_TE_LAAG:10', 'USD')
    expect(eur).not.toBe(usd)
  })
})
