import { describe, it, expect } from 'vitest'
import { formatBedrag, parseBedrag } from '../utils/formatBedrag'

describe('formatBedrag', () => {
  it('formatteert een geheel getal correct', () => {
    expect(formatBedrag(10)).toBe('€10,00')
  })

  it('formatteert een decimaal bedrag correct', () => {
    expect(formatBedrag(10.5)).toBe('€10,50')
  })

  it('formatteert een bedrag met twee decimalen', () => {
    expect(formatBedrag(10.99)).toBe('€10,99')
  })

  it('formatteert duizendtallen met punt als scheidingsteken', () => {
    expect(formatBedrag(1049)).toBe('€1.049,00')
  })

  it('formatteert nul correct', () => {
    expect(formatBedrag(0)).toBe('€0,00')
  })

  it('geeft €0,00 terug bij null', () => {
    expect(formatBedrag(null)).toBe('€0,00')
  })

  it('geeft €0,00 terug bij undefined', () => {
    expect(formatBedrag(undefined)).toBe('€0,00')
  })

  it('formatteert een string-getal correct', () => {
    expect(formatBedrag('25.50')).toBe('€25,50')
  })

  it('rondt meer dan twee decimalen af', () => {
    expect(formatBedrag(10.999)).toBe('€11,00')
  })
})

describe('parseBedrag', () => {
  it('parseert een getal met punt', () => {
    expect(parseBedrag('10.50')).toBe(10.50)
  })

  it('parseert een getal met komma', () => {
    expect(parseBedrag('10,50')).toBe(10.50)
  })

  it('parseert een geheel getal', () => {
    expect(parseBedrag('25')).toBe(25)
  })

  it('geeft 0 terug bij lege string', () => {
    expect(parseBedrag('')).toBe(0)
  })

  it('geeft 0 terug bij undefined', () => {
    expect(parseBedrag(undefined)).toBe(0)
  })

  it('geeft 0 terug bij null', () => {
    expect(parseBedrag(null)).toBe(0)
  })

  it('parseert een getal als number door', () => {
    expect(parseBedrag(15.75)).toBe(15.75)
  })
})
