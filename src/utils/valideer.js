/**
 * Validatiefuncties voor gebruikersinvoer.
 *
 * Bewust losgekoppeld van componenten zodat deze functies unit-testbaar zijn
 * zonder React, zonder DOM en zonder Supabase.
 *
 * Gebruik:
 *   import { valideerDeelnemerNaam, valideerTransactieBedrag, valideerPotjeNaam, beperkDecimalen } from '../utils/valideer'
 *
 * Alle functies retourneren:
 *   - null   → invoer is geldig, geen fout
 *   - string → foutmelding voor de gebruiker
 *
 * beperkDecimalen retourneert een string (de al-dan-niet afgekorte invoer).
 */

/**
 * Beperkt een bedrag-invoerstring tot maximaal 2 decimalen.
 *
 * Bedoeld voor gebruik in onChange-handlers van bedragsveldem. Voorkomt dat de
 * gebruiker meer dan 2 cijfers na de komma (of punt) invoert. Accepteert zowel
 * komma als punt als decimaalteken (nl-NL én en-US stijl).
 *
 * Gedrag:
 *   - Geen decimaalteken aanwezig → waarde ongewijzigd teruggegeven
 *   - 0, 1 of 2 decimalen → ongewijzigd
 *   - 3 of meer decimalen → afgekapt tot 2 decimalen (niet afgerond)
 *   - Niet-string invoer → omgezet naar string vóór verwerking
 *
 * @param {string} waarde - De ruwe invoerstring uit het tekstveld
 * @returns {string} De invoerstring met maximaal 2 decimalen
 */
export function beperkDecimalen(waarde) {
  const s = String(waarde ?? '')
  // Zoek het eerste komma- of puntscheidingsteken
  const scheidingsIndex = s.search(/[,.]/);
  if (scheidingsIndex === -1) return s
  // Alles vóór het scheidingsteken + het scheidingsteken zelf + max 2 tekens erna
  return s.slice(0, scheidingsIndex + 3)
}

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
 * Valideert een bedrag-invoerstring realtime (tijdens typen).
 *
 * Bedoeld voor gebruik in onChange-handlers. Geeft alleen een fout terug
 * als het bedrag boven MAX uitkomt — lege of onvolledige invoer geeft null
 * zodat de gebruiker rustig kan typen.
 *
 * @param {string} invoer - De ruwe invoerstring
 * @param {number} [max=999.99] - Maximaal toegestaan bedrag
 * @returns {string|null} Foutmelding of null
 */
export function valideerBedragRealtime(invoer, max = 999.99) {
  const s = String(invoer ?? '').trim()
  if (!s) return null
  const num = Number(s.replace(',', '.'))
  if (isNaN(num)) return null
  if (num > max) return 'Het maximale bedrag per storting is €999,99.'
  return null
}

/**
 * Valideert het bedrag dat een gebruiker invoert voor een storting of betaling.
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

  // Verdediging in de diepte: meer dan 2 decimalen is geen geldig eurobedrag.
  // Normaal gesproken filtert beperkDecimalen() dit al op invoerniveau weg;
  // deze check vangt edge-cases op zoals programmatisch ingestelde waarden.
  const decDeel = String(bedragInvoer).replace(',', '.').split('.')[1]
  if (decDeel !== undefined && decDeel.length > 2) {
    return 'Voer maximaal 2 cijfers achter de komma in.'
  }

  if (bedragNum > max) {
    return 'Het maximale bedrag per transactie is €999,99.'
  }

  if (!isStorting && bedragNum > potSaldo) {
    return `Het potje heeft niet genoeg saldo. Maximaal beschikbaar: ${formatBedrag(potSaldo)}.`
  }

  return null
}
