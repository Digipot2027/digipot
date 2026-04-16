/**
 * Validatiefuncties voor gebruikersinvoer.
 *
 * Bewust losgekoppeld van componenten zodat deze functies unit-testbaar zijn
 * zonder React, zonder DOM en zonder Supabase.
 *
 * Gebruik:
 *   import { valideerDeelnemerNaam, valideerTransactieBedrag, valideerPotjeNaam } from '../utils/valideer'
 *
 * Alle functies retourneren:
 *   - null   → invoer is geldig, geen fout
 *   - string → foutmelding voor de gebruiker
 */

/**
 * Valideert de naam van een nieuw potje.
 *
 * Volgorde van checks (identiek aan de volgorde in PaginaNieuwPotje):
 *   1. Naam mag niet leeg zijn (na trim)
 *   2. Naam mag maximaal maxNaam tekens zijn (na trim)
 *
 * @param {string} naam - De ingevoerde naam (nog niet getrimd)
 * @param {Object} [opties]
 * @param {number} [opties.maxNaam=30] - Maximale naamlengte
 * @returns {string|null} Foutmelding of null bij geldige invoer
 */
export function valideerPotjeNaam(naam, { maxNaam = 30 } = {}) {
  const naamTrimmed = naam.trim()

  if (!naamTrimmed) {
    return 'Geef het potje een naam.'
  }

  if (naamTrimmed.length > maxNaam) {
    return `De naam van het potje mag maximaal ${maxNaam} tekens zijn.`
  }

  return null
}

/**
 * Valideert de naam die een deelnemer invoert bij het meedoen aan een potje.
 *
 * Volgorde van checks (identiek aan de oorspronkelijke volgorde in ModalDeelnemen):
 *   1. Naam mag niet leeg zijn (na trim)
 *   2. Naam mag maximaal MAX_NAAM tekens zijn (na trim)
 *   3. Potje mag maximaal MAX_DEELNEMERS deelnemers hebben
 *   4. Naam mag niet al bezet zijn (case-insensitief)
 *
 * @param {string} naam - De ingevoerde naam (nog niet getrimd)
 * @param {Array<{naam: string}>} deelnemers - Bestaande deelnemers van het potje
 * @param {Object} [opties]
 * @param {number} [opties.maxNaam=30] - Maximale naamlengte
 * @param {number} [opties.maxDeelnemers=20] - Maximaal aantal deelnemers
 * @returns {string|null} Foutmelding of null bij geldige invoer
 */
export function valideerDeelnemerNaam(naam, deelnemers, { maxNaam = 30, maxDeelnemers = 20 } = {}) {
  const naamTrimmed = naam.trim()

  if (!naamTrimmed) {
    return 'Vul je naam in om deel te nemen.'
  }

  if (naamTrimmed.length > maxNaam) {
    return `Je naam mag maximaal ${maxNaam} tekens zijn.`
  }

  if (deelnemers.length >= maxDeelnemers) {
    return `Dit potje heeft het maximum van ${maxDeelnemers} deelnemers bereikt.`
  }

  const bestaatAl = deelnemers.some(
    d => d.naam.toLowerCase() === naamTrimmed.toLowerCase()
  )
  if (bestaatAl) {
    return 'Deze naam is al bezet in dit potje. Kies een andere naam.'
  }

  return null
}

/**
 * Valideert het bedrag dat een gebruiker invoert voor een storting of betaling.
 *
 * Volgorde van checks (identiek aan de oorspronkelijke volgorde in ModalTransactie):
 *   1. Bedrag moet aanwezig, numeriek en groter dan 0 zijn
 *   2. Bedrag mag niet boven MAX uitkomen
 *   3. Bij betaling: bedrag mag het potsaldo niet overschrijden (client-side check)
 *
 * @param {string} bedragInvoer - De ruwe invoerstring uit het tekstveld
 * @param {number} bedragNum - Het geparseerde getal (via parseBedrag)
 * @param {Object} opties
 * @param {boolean} opties.isStorting - true = storting, false = betaling
 * @param {number} opties.potSaldo - Huidig potsaldo (alleen relevant bij betaling)
 * @param {Function} opties.formatBedrag - Formatteringsfunctie voor bedragen in foutmeldingen
 * @param {number} [opties.max=999.99] - Maximaal toegestaan bedrag
 * @returns {string|null} Foutmelding of null bij geldige invoer
 */
export function valideerTransactieBedrag(bedragInvoer, bedragNum, { isStorting, potSaldo, formatBedrag, max = 999.99 }) {
  if (!bedragInvoer || isNaN(bedragNum) || bedragNum <= 0) {
    return 'Voer een bedrag in van minimaal €0,01.'
  }

  if (bedragNum > max) {
    return 'Het maximale bedrag per transactie is €999,99.'
  }

  if (!isStorting && bedragNum > potSaldo) {
    return `Het potje heeft niet genoeg saldo. Maximaal beschikbaar: ${formatBedrag(potSaldo)}.`
  }

  return null
}
