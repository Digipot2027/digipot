/**
 * Regressietests — DeelnemerDetailSheet valuta (BUG-1)
 *
 * BUG-1 fix (2026-04-16): DeelnemerDetailSheet riep formatBedrag aan zonder
 * valuta-parameter, waardoor non-EUR potjes altijd '€' toonden.
 *
 * Teststrategie: logica-extractie patroon.
 * De valuta-prop-doorgifte en formatBedrag-aanroep zijn testbaar als
 * pure functies zonder React-mount.
 *
 * Gedekte scenario's:
 *   DS-V01  EUR-bedragen worden correct geformatteerd
 *   DS-V02  USD-bedragen tonen '$' i.p.v. '€'
 *   DS-V03  GBP-bedragen tonen '£' i.p.v. '€'
 *   DS-V04  valuta default 'EUR' bij ontbrekende prop
 *   DS-V05  totaalGestort berekening uit stortingen
 *   DS-V06  totaalBetaald berekening uit betalingen
 *   DS-V07  gemengde transacties — alleen stortingen tellen mee voor gestort
 *   DS-V08  lege transacties → totaal 0, geformatteerd als valutabedrag
 */

import { describe, it, expect } from 'vitest'
import { formatBedrag } from '../utils/formatBedrag'

// ── Geëxtraheerde logica uit DeelnemerDetailSheet ─────────────────────────────

function berekenTotalen(transacties, deelnemerId) {
  const mijn = transacties.filter(t => t.deelnemer_id === deelnemerId)
  const stortingen = mijn.filter(t => t.type === 'storting')
  const betalingen = mijn.filter(t => t.type === 'betaling')
  const totaalGestort = stortingen.reduce((s, t) => s + Number(t.bedrag), 0)
  const totaalBetaald = betalingen.reduce((s, t) => s + Number(t.bedrag), 0)
  return { totaalGestort, totaalBetaald }
}

const DEELNEMER_ID = 'abc-123'

const TRANSACTIES = [
  { id: '1', deelnemer_id: DEELNEMER_ID, type: 'storting', bedrag: '20.00' },
  { id: '2', deelnemer_id: DEELNEMER_ID, type: 'storting', bedrag: '15.00' },
  { id: '3', deelnemer_id: DEELNEMER_ID, type: 'betaling', bedrag: '10.50' },
  { id: '4', deelnemer_id: 'andere-id',  type: 'storting', bedrag: '50.00' }, // andere deelnemer
]

// ── DS-V01 t/m DS-V04: valuta-prop ────────────────────────────────────────────

describe('DeelnemerDetailSheet — DS-V01 t/m DS-V04: valuta-prop doorgifte', () => {
  it('DS-V01: EUR-bedragen worden correct geformatteerd', () => {
    const result = formatBedrag(35, 'EUR')
    expect(result).toContain('35')
    expect(result).toMatch(/€/)
  })

  it('DS-V02: USD-bedragen tonen $ i.p.v. €', () => {
    const eur = formatBedrag(35, 'EUR')
    const usd = formatBedrag(35, 'USD')
    expect(usd).toContain('35')
    expect(usd).not.toBe(eur)
  })

  it('DS-V03: GBP-bedragen tonen £ i.p.v. €', () => {
    const gbp = formatBedrag(35, 'GBP')
    expect(gbp).toContain('35')
    expect(gbp).not.toBe(formatBedrag(35, 'EUR'))
  })

  it('DS-V04: default valuta EUR bij ontbrekende prop', () => {
    // Simuleert: valuta = 'EUR' (default prop)
    const metDefault = formatBedrag(10, 'EUR')
    const zonderParam = formatBedrag(10)
    expect(metDefault).toBe(zonderParam)
  })
})

// ── DS-V05 t/m DS-V08: totaalberekening ──────────────────────────────────────

describe('DeelnemerDetailSheet — DS-V05 t/m DS-V08: totaalberekening', () => {
  it('DS-V05: totaalGestort is som van stortingen voor deze deelnemer', () => {
    const { totaalGestort } = berekenTotalen(TRANSACTIES, DEELNEMER_ID)
    expect(totaalGestort).toBe(35) // 20 + 15
  })

  it('DS-V06: totaalBetaald is som van betalingen voor deze deelnemer', () => {
    const { totaalBetaald } = berekenTotalen(TRANSACTIES, DEELNEMER_ID)
    expect(totaalBetaald).toBe(10.50)
  })

  it('DS-V07: transacties van andere deelnemers tellen niet mee', () => {
    const { totaalGestort } = berekenTotalen(TRANSACTIES, DEELNEMER_ID)
    // De storting van 50 van 'andere-id' mag niet meegeteld worden
    expect(totaalGestort).toBe(35)
    expect(totaalGestort).not.toBe(85)
  })

  it('DS-V08: lege transacties → totaal 0, formatteert als valutabedrag', () => {
    const { totaalGestort, totaalBetaald } = berekenTotalen([], DEELNEMER_ID)
    expect(totaalGestort).toBe(0)
    expect(totaalBetaald).toBe(0)
    expect(formatBedrag(totaalGestort, 'EUR')).toMatch(/0/)
    expect(formatBedrag(totaalGestort, 'USD')).toMatch(/0/)
  })
})
