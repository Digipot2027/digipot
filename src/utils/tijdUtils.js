/**
 * Pure hulpfuncties voor weergave van tijden en transacties.
 *
 * Geëxtraheerd uit PaginaEindafrekening en DeelnemerDetailSheet zodat
 * deze functies unit-testbaar zijn zonder DOM, zonder React en zonder Supabase.
 *
 * @module tijdUtils
 */

/**
 * Formatteert een ISO-timestamp naar "uu:mm" (korte notatie binnen een potje).
 * Gebruikt in PaginaEindafrekening voor transactieregels.
 *
 * @param {string} iso - ISO 8601 datumstring
 * @returns {string} Tijdnotatie in "HH:MM" formaat
 */
export function tijdLabel(iso) {
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Formatteert een ISO-timestamp naar "uu:mm" als vandaag, of "dag mnd uu:mm" als ouder.
 * Gebruikt in DeelnemerDetailSheet voor transactieregels.
 *
 * @param {string} iso - ISO 8601 datumstring
 * @returns {string} Tijdnotatie — kort als vandaag, uitgebreid als ouder
 */
export function volledigTijdLabel(iso) {
  const d = new Date(iso)
  const nu = new Date()
  const ouderDanVandaag = d.toDateString() !== nu.toDateString()
  if (ouderDanVandaag) {
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) +
      ' ' + d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Filtert en sorteert transacties voor één deelnemer.
 * Gebruikt in PaginaEindafrekening.
 *
 * @param {Array} transacties - Alle transacties van het potje
 * @param {string} deelnemerId - UUID van de deelnemer
 * @returns {Array} Gesorteerde transacties voor deze deelnemer (oudste eerst)
 */
export function transactiesVoor(transacties, deelnemerId) {
  return transacties
    .filter(t => t.deelnemer_id === deelnemerId)
    .sort((a, b) => new Date(a.aangemaakt_op) - new Date(b.aangemaakt_op))
}

/**
 * Bouwt de sluitregel voor de eindafrekening-header.
 * Gebruikt in PaginaEindafrekening.
 *
 * @param {string} sluitDatum - Geformatteerde sluitdatum (nl-NL)
 * @param {string} sluitTijd - Geformatteerde sluittijd (nl-NL)
 * @param {string|null} sluiterNaam - Naam van de sluiter, of null bij automatisch sluiten
 * @returns {string} Volledige sluitregel
 */
export function bouwSluitRegel(sluitDatum, sluitTijd, sluiterNaam) {
  return sluiterNaam
    ? `Gesloten op ${sluitDatum} door ${sluiterNaam} om ${sluitTijd}.`
    : `Automatisch gesloten op ${sluitDatum} om ${sluitTijd}.`
}

/**
 * Berekent het effectieve stortingsbedrag op basis van snelkeuze of vrije invoer.
 * Snelkeuze heeft altijd prioriteit boven vrije invoer.
 * Gebruikt in PaginaStorten.
 *
 * @param {number|null} gekozenBedrag - Snelkeuze bedrag, of null als niet gekozen
 * @param {number} vrijeInvoerNum - Geparseerd vrij invoerbedrag
 * @param {boolean} vrijeInvoerActief - Of het vrije invoerveld actief is
 * @param {string} vrijeInvoer - De ruwe vrije invoerstring (voor leegheidcheck)
 * @returns {number|null} Het effectieve bedrag, of null als geen geldig bedrag
 */
export function bepaalEffectiefBedrag(gekozenBedrag, vrijeInvoerNum, vrijeInvoerActief, vrijeInvoer) {
  if (gekozenBedrag !== null) return gekozenBedrag
  if (vrijeInvoerActief && vrijeInvoer.trim()) return vrijeInvoerNum
  return null
}

/**
 * Bepaalt of een bedrag geldig is voor een storting.
 *
 * @param {number|null} effectiefBedrag
 * @param {number} max - Maximaal toegestaan bedrag (standaard 999.99)
 * @returns {boolean}
 */
export function isBedragGeldig(effectiefBedrag, max = 999.99) {
  return effectiefBedrag !== null
    && !isNaN(effectiefBedrag)
    && effectiefBedrag > 0
    && effectiefBedrag <= max
}

/**
 * Berekent de profielnaam-opslaan logica voor PaginaProfiel.
 *
 * @param {string} naam - Ingevoerde naam (niet getrimd)
 * @param {number} maxNaam - Maximale naamlengte
 * @returns {{ geldig: boolean, naamTrimmed: string, fout: string|null }}
 */
export function valideerProfielNaam(naam, maxNaam = 30) {
  const naamTrimmed = naam.trim()
  if (naamTrimmed.length > maxNaam) {
    return { geldig: false, naamTrimmed, fout: `Je naam mag maximaal ${maxNaam} tekens zijn.` }
  }
  return { geldig: true, naamTrimmed, fout: null }
}

/**
 * Bepaalt of de opslaan-knop actief is in PaginaProfiel.
 *
 * @param {string} naam - Huidige invoerwaarde
 * @param {string} opgeslagenNaamState - Laatste opgeslagen naam
 * @returns {boolean}
 */
export function heeftProfielWijziging(naam, opgeslagenNaamState) {
  return naam.trim() !== opgeslagenNaamState
}
