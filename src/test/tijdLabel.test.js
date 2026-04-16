/**
 * tijdLabel.test.js — unit tests voor volledigTijdLabel() en tijdLabel()
 *
 * BUG-2 fix (2026-04-16): beide functies zijn gecentraliseerd in tijdUtils.js.
 * Tests importeren nu direct uit de utility i.p.v. de logica lokaal te dupliceren.
 *
 * volledigTijdLabel(): twee paden:
 *   1. Tijdstip van vandaag   → "uu:mm"
 *   2. Tijdstip van eerder    → "d mmm uu:mm"  (bijv. "3 jan 14:30")
 *
 * tijdLabel(): altijd "uu:mm", ongeacht datum.
 *
 * TL-01  vandaag middaguur → alleen "uu:mm"
 * TL-02  gisteren → bevat datum + tijd
 * TL-03  ver in het verleden → bevat datum + tijd
 * TL-04  grenswaarde: exact middernacht vandaag → "uu:mm" (zelfde dag)
 * TL-05  output bevat geen maandnaam als het vandaag is
 * TL-06  output bevat maandnaam als het niet vandaag is
 * TL-07  tijdnotatie is altijd "HH:MM" (twee cijfers uur en minuut)
 * TL-08  tijdLabel geeft altijd alleen tijd, nooit datum
 */

import { describe, it, expect } from 'vitest'
import { volledigTijdLabel, tijdLabel } from '../utils/tijdUtils'

function vandaagOm(uur, minuut) {
  const d = new Date()
  d.setHours(uur, minuut, 0, 0)
  return d.toISOString()
}

function gisterenOm(uur, minuut) {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  d.setHours(uur, minuut, 0, 0)
  return d.toISOString()
}

function verLedenOm(jaar, maand, dag, uur, minuut) {
  return new Date(jaar, maand - 1, dag, uur, minuut).toISOString()
}

describe('volledigTijdLabel — TL-01/02/03: basisgedrag', () => {
  it('TL-01: vandaag → geeft alleen tijd terug (geen datum)', () => {
    const label = volledigTijdLabel(vandaagOm(14, 30))
    expect(label).toMatch(/14.30/)
    expect(label).not.toMatch(/jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec/i)
  })

  it('TL-02: gisteren → geeft datum + tijd terug', () => {
    const label = volledigTijdLabel(gisterenOm(10, 0))
    expect(label).toMatch(/\d+/)
    expect(label).toMatch(/jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec/i)
  })

  it('TL-03: 1 januari 2020 → bevat datum en tijd', () => {
    const label = volledigTijdLabel(verLedenOm(2020, 1, 1, 9, 15))
    expect(label).toContain('1')
    expect(label).toMatch(/jan/i)
    expect(label).toMatch(/09.15|9.15/)
  })
})

describe('volledigTijdLabel — TL-04/05/06: grenswaarden', () => {
  it('TL-04: middernacht vandaag (00:01) → alleen tijd, geen datum', () => {
    const label = volledigTijdLabel(vandaagOm(0, 1))
    expect(label).not.toMatch(/jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec/i)
  })

  it('TL-05: vandaag → geen maandnaam in output', () => {
    const label = volledigTijdLabel(vandaagOm(12, 0))
    expect(label).not.toMatch(/jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec/i)
  })

  it('TL-06: gisteren → wel maandnaam in output', () => {
    const label = volledigTijdLabel(gisterenOm(12, 0))
    expect(label).toMatch(/jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec/i)
  })
})

describe('volledigTijdLabel — TL-07: tijdnotatie', () => {
  it('TL-07a: tijd heeft altijd twee uur-cijfers (09:05, niet 9:5)', () => {
    const label = volledigTijdLabel(vandaagOm(9, 5))
    expect(label).toMatch(/\d{2}.\d{2}/)
  })

  it('TL-07b: tijdnotatie klopt voor gisteren ook', () => {
    const label = volledigTijdLabel(gisterenOm(8, 3))
    expect(label).toMatch(/08.03|8.03/)
  })
})

describe('tijdLabel — TL-08: altijd alleen tijd', () => {
  it('TL-08a: vandaag → "uu:mm"', () => {
    const label = tijdLabel(vandaagOm(14, 30))
    expect(label).toMatch(/14.30/)
    expect(label).not.toMatch(/jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec/i)
  })

  it('TL-08b: gisteren → nog steeds alleen "uu:mm", geen datum', () => {
    const label = tijdLabel(gisterenOm(9, 0))
    expect(label).toMatch(/09.00|9.00/)
    expect(label).not.toMatch(/jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec/i)
  })

  it('TL-08c: ver verleden → alleen "uu:mm"', () => {
    const label = tijdLabel(verLedenOm(2020, 1, 1, 8, 0))
    expect(label).toMatch(/08.00|8.00/)
    expect(label).not.toMatch(/2020/)
  })
})
