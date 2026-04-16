import { STANDAARD_VALUTA } from '../constants'

/**
 * Standaard locale voor valuta-opmaak.
 * EUR → nl-NL (komma als decimaalteken, punt als duizendtallen-scheider)
 * Bij multi-language wordt dit afgeleid van de gebruikersinstelling.
 */
export const STANDAARD_LOCALE = 'nl-NL'

/**
 * Formatteert een bedrag als valuta.
 *
 * TECH-1 fix (2026-04-16): STANDAARD_VALUTA niet meer lokaal gedefinieerd —
 * geïmporteerd uit constants.js. Eén bron van waarheid.
 *
 * @param {number|string|null} bedrag - Het te formatteren bedrag
 * @param {string} [valuta=STANDAARD_VALUTA] - ISO 4217 valutacode (bijv. 'EUR', 'USD', 'GBP')
 * @param {string} [locale=STANDAARD_LOCALE] - BCP 47 locale (bijv. 'nl-NL', 'en-GB')
 * @returns {string} Geformatteerd bedrag met valutasymbool
 */
export function formatBedrag(bedrag, valuta = STANDAARD_VALUTA, locale = STANDAARD_LOCALE) {
  if (bedrag === null || bedrag === undefined) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: valuta,
    }).format(0)
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: valuta,
  }).format(Number(bedrag))
}

/**
 * Parseert een bedrag string naar number.
 * Accepteert zowel komma als punt als decimaalteken.
 *
 * Let op: bij multi-language moet dit worden uitgebreid voor locales
 * waar punt het duizendtallenscheidingsteken is (bijv. 'de-DE': 1.234,56).
 * Voor nu is de huidige aanpak correct voor nl-NL en en-GB/en-US.
 *
 * @param {string|number|null} waarde - De te parsen invoer
 * @returns {number}
 */
export function parseBedrag(waarde) {
  if (!waarde) return 0
  return parseFloat(String(waarde).replace(',', '.'))
}
