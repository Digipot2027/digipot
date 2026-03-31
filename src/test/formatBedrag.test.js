import { describe, it, expect } from 'vitest'
import { formatBedrag, parseBedrag, STANDAARD_VALUTA, STANDAARD_LOCALE } from '../utils/formatBedrag'

// Intl.NumberFormat voor EUR/nl-NL produceert een non-breaking space (\u00a0)
// tussen het euroteken en het getal: "€\u00a010,00"
// De tests normaliseren daarom de output zodat ze leesbaar blijven
// en niet breken als de Node/V8 ICU-data minimaal verschilt per omgeving.
//
// Hulpfunctie: verwijdert non-breaking spaces voor vergelijking
function normaliseer(str) {
  return str.replace(/\u00a0/g, ' ').trim()
}

describe('STANDAARD_VALUTA en STANDAARD_LOCALE', () => {
  it('standaard valuta is EUR', () => {
    expect(STANDAARD_VALUTA).toBe('EUR')
  })

  it('standaard locale is nl-NL', () => {
    expect(STANDAARD_LOCALE).toBe('nl-NL')
  })
})

describe('formatBedrag — standaard EUR/nl-NL gedrag', () => {
  it('formatteert een geheel getal correct', () => {
    expect(normaliseer(formatBedrag(10))).toBe('€ 10,00')
  })

  it('formatteert een decimaal bedrag correct', () => {
    expect(normaliseer(formatBedrag(10.5))).toBe('€ 10,50')
  })

  it('formatteert een bedrag met twee decimalen', () => {
    expect(normaliseer(formatBedrag(10.99))).toBe('€ 10,99')
  })

  it('formatteert duizendtallen met punt als scheidingsteken', () => {
    expect(normaliseer(formatBedrag(1049))).toBe('€ 1.049,00')
  })

  it('formatteert nul correct', () => {
    expect(normaliseer(formatBedrag(0))).toBe('€ 0,00')
  })

  it('geeft €0,00 terug bij null', () => {
    expect(normaliseer(formatBedrag(null))).toBe('€ 0,00')
  })

  it('geeft €0,00 terug bij undefined', () => {
    expect(normaliseer(formatBedrag(undefined))).toBe('€ 0,00')
  })

  it('formatteert een string-getal correct', () => {
    expect(normaliseer(formatBedrag('25.50'))).toBe('€ 25,50')
  })

  it('rondt meer dan twee decimalen af', () => {
    expect(normaliseer(formatBedrag(10.999))).toBe('€ 11,00')
  })

  it('bevat altijd het euroteken bij EUR', () => {
    expect(formatBedrag(10)).toContain('€')
  })

  it('bevat altijd een komma als decimaalteken bij nl-NL', () => {
    expect(formatBedrag(10.5)).toContain(',')
  })
})

describe('formatBedrag — multi-currency parameters', () => {
  it('formatteert USD correct in en-US locale', () => {
    const result = formatBedrag(10.5, 'USD', 'en-US')
    expect(result).toContain('10.50')
    expect(result).toMatch(/\$|USD/)
  })

  it('formatteert GBP correct in en-GB locale', () => {
    const result = normaliseer(formatBedrag(10.5, 'GBP', 'en-GB'))
    expect(result).toContain('10.50')
    expect(result).toMatch(/£|GBP/)
  })

  it('standaard valuta en locale worden gebruikt als geen parameters opgegeven', () => {
    const metDefaults = formatBedrag(10)
    const metExplicieteParams = formatBedrag(10, 'EUR', 'nl-NL')
    expect(metDefaults).toBe(metExplicieteParams)
  })

  it('CHF wordt correct weergegeven', () => {
    const result = formatBedrag(10.5, 'CHF', 'de-CH')
    expect(result).toContain('10')
    expect(result).toMatch(/CHF|Fr/)
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
