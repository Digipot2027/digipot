/**
 * Regressietests — berekenAchtergelatenBedrag
 *
 * Achtergrond:
 *   Wanneer een deelnemer zich afmeldt terwijl er nog een positief potsaldo
 *   aanwezig is, laat hij een deel van dat saldo achter. Dat deel is
 *   evenredig aan zijn bijdrage aan het totaal gestorte bedrag:
 *
 *     aandeel = (eigen gestort / potTotaal) × potSaldo
 *
 *   Wordt het aandeel kleiner dan de drempel (standaard €2), dan wordt 0
 *   geretourneerd en verschijnt er geen waarschuwing in de modal.
 *
 * Teststrategie: pure functie, geen DOM, geen React, geen Supabase.
 * De drempel van €2 is een bewuste UX-keuze: verwaarloosbare bedragen
 * veroorzaken alleen onnodige ongerustheid.
 */

import { describe, it, expect } from 'vitest'
import { berekenAchtergelatenBedrag } from '../utils/berekenSaldi'

// Hulpfunctie: bouw een minimale deelnemersSaldi-rij
function maakSaldi(id, gestort) {
  return { id, gestort }
}

describe('berekenAchtergelatenBedrag — happy path', () => {
  it('AB-01: één deelnemer, alles nog in de pot → volledig aandeel', () => {
    // Deelnemer heeft €30 gestort, potTotaal = €30, potSaldo = €30
    // aandeel = (30/30) × 30 = 30 → boven drempel → retourneer 30
    const saldi = [maakSaldi('a', 30)]
    expect(berekenAchtergelatenBedrag(saldi, 'a', 30, 30)).toBe(30)
  })

  it('AB-02: twee gelijke deelnemers, helft van het saldo kwijt', () => {
    // Elk heeft €20 gestort, potTotaal = €40, potSaldo = €10
    // aandeel = (20/40) × 10 = 5 → boven drempel → retourneer 5
    const saldi = [maakSaldi('a', 20), maakSaldi('b', 20)]
    expect(berekenAchtergelatenBedrag(saldi, 'a', 10, 40)).toBe(5)
  })

  it('AB-03: ongelijke bijdragen — groter aandeel voor grotere storter', () => {
    // a: €60, b: €40, potTotaal = €100, potSaldo = €20
    // aandeel a = (60/100) × 20 = 12
    const saldi = [maakSaldi('a', 60), maakSaldi('b', 40)]
    expect(berekenAchtergelatenBedrag(saldi, 'a', 20, 100)).toBe(12)
  })

  it('AB-04: aandeel exact op de drempel → tonen (≥ 2)', () => {
    // aandeel = (10/10) × 2 = 2.00 → gelijk aan drempel → retourneer 2
    const saldi = [maakSaldi('a', 10)]
    expect(berekenAchtergelatenBedrag(saldi, 'a', 2, 10)).toBe(2)
  })
})

describe('berekenAchtergelatenBedrag — onder de drempel', () => {
  it('AB-05: aandeel net onder €2 → retourneer 0 (geen waarschuwing)', () => {
    // aandeel = (10/100) × 10 = 1.00 < 2 → 0
    const saldi = [maakSaldi('a', 10)]
    expect(berekenAchtergelatenBedrag(saldi, 'a', 10, 100)).toBe(0)
  })

  it('AB-06: aandeel €0.01 → retourneer 0', () => {
    const saldi = [maakSaldi('a', 1)]
    expect(berekenAchtergelatenBedrag(saldi, 'a', 0.1, 100)).toBe(0)
  })

  it('AB-07: custom drempel €5 — aandeel €4 → retourneer 0', () => {
    const saldi = [maakSaldi('a', 20)]
    expect(berekenAchtergelatenBedrag(saldi, 'a', 20, 100, 5)).toBe(0)
  })

  it('AB-08: custom drempel €5 — aandeel €5 → retourneer 5', () => {
    const saldi = [maakSaldi('a', 25)]
    expect(berekenAchtergelatenBedrag(saldi, 'a', 20, 100, 5)).toBe(5)
  })
})

describe('berekenAchtergelatenBedrag — randgevallen', () => {
  it('AB-09: potSaldo = 0 → retourneer 0 (niets te verliezen)', () => {
    const saldi = [maakSaldi('a', 30)]
    expect(berekenAchtergelatenBedrag(saldi, 'a', 0, 30)).toBe(0)
  })

  it('AB-10: potTotaal = 0 → retourneer 0 (geen storting geweest)', () => {
    const saldi = [maakSaldi('a', 0)]
    expect(berekenAchtergelatenBedrag(saldi, 'a', 10, 0)).toBe(0)
  })

  it('AB-11: potSaldo negatief → retourneer 0', () => {
    // Zou niet kunnen voorkomen in de reguliere flow, maar defensief
    const saldi = [maakSaldi('a', 30)]
    expect(berekenAchtergelatenBedrag(saldi, 'a', -5, 30)).toBe(0)
  })

  it('AB-12: deelnemer niet gevonden in saldi → retourneer 0', () => {
    const saldi = [maakSaldi('b', 30)]
    expect(berekenAchtergelatenBedrag(saldi, 'onbekend-id', 30, 30)).toBe(0)
  })

  it('AB-13: lege saldi-array → retourneer 0', () => {
    expect(berekenAchtergelatenBedrag([], 'a', 30, 30)).toBe(0)
  })

  it('AB-14: deelnemer heeft gestort = 0 → retourneer 0', () => {
    const saldi = [maakSaldi('a', 0)]
    expect(berekenAchtergelatenBedrag(saldi, 'a', 30, 30)).toBe(0)
  })

  it('AB-15: floating point — afronden op 2 decimalen', () => {
    // (1/3) × 10 = 3.3333... → afgerond naar 3.33
    const saldi = [maakSaldi('a', 1), maakSaldi('b', 1), maakSaldi('c', 1)]
    const resultaat = berekenAchtergelatenBedrag(saldi, 'a', 10, 3)
    expect(resultaat).toBe(3.33)
  })
})
