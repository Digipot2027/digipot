/**
 * formulierBuffer.js — tijdelijke opslag van formulierdata bij netwerkstoringen
 *
 * DOEL
 *   Bij een Supabase-timeout (REQUEST_TIMEOUT) of netwerkfout gaat ingevulde
 *   formulierdata verloren zodra de gebruiker de pagina ververst of wegnavigeert.
 *   Deze module bewaart de data in sessionStorage zodat de gebruiker bij
 *   terugkeer zijn invoer niet opnieuw hoeft in te voeren.
 *
 *   sessionStorage is bewust gekozen boven localStorage:
 *   - Data vervalt automatisch bij het sluiten van het tabblad
 *   - Geen persistentie tussen sessies — geen PII-risico bij gedeelde apparaten
 *   - Per-tab geïsoleerd — twee gelijktijdige potje-tabs storen elkaar niet
 *
 * API
 *   slaagFormulierOp(sleutel, data)  → void   — schrijf data naar sessionStorage
 *   laadFormulier(sleutel)           → object|null — lees en verwijder data
 *   wisFormulier(sleutel)            → void   — verwijder zonder te lezen
 *
 * SLEUTELS
 *   Gebruik potje-ID of modal-type als onderdeel van de sleutel om conflicten
 *   tussen schermen te voorkomen. Aanbevolen formaat:
 *     `digipot:storten:${potjeId}`
 *     `digipot:betaling:${potjeId}`
 *
 * GEBRUIK
 *   // Bij submit-fout opslaan:
 *   slaagFormulierOp(`digipot:storten:${id}`, { bedrag: effectiefBedrag })
 *
 *   // Bij mount inladen en buffer direct wissen:
 *   const herstel = laadFormulier(`digipot:storten:${id}`)
 *   if (herstel) setVrijeInvoer(String(herstel.bedrag))
 *
 * FOUTAFHANDELING
 *   sessionStorage kan niet beschikbaar zijn in private-browsing op sommige
 *   browsers. Alle methoden vangen StorageError stil op — het is een best-effort
 *   hulpmiddel, geen kritiek pad.
 *
 * @module formulierBuffer
 */

/**
 * Bewaart formulierdata in sessionStorage.
 *
 * @param {string} sleutel - Unieke sleutel voor dit formulier (bijv. `digipot:storten:${id}`)
 * @param {object} data    - Te bewaren data; moet JSON-serialiseerbaar zijn
 */
export function slaagFormulierOp(sleutel, data) {
  try {
    sessionStorage.setItem(sleutel, JSON.stringify(data))
  } catch {
    // sessionStorage niet beschikbaar (private mode, vol) — stil doorgaan
  }
}

/**
 * Laadt bewaarde formulierdata en verwijdert de buffer direct daarna.
 * Eenmalige lezing voorkomt dat verouderde data bij een volgende sessie
 * opnieuw aangeboden wordt.
 *
 * @param {string} sleutel - Dezelfde sleutel als gebruikt bij slaagFormulierOp()
 * @returns {object|null} De bewaarde data, of null als niets gevonden
 */
export function laadFormulier(sleutel) {
  try {
    const opgeslagen = sessionStorage.getItem(sleutel)
    if (!opgeslagen) return null
    sessionStorage.removeItem(sleutel)
    return JSON.parse(opgeslagen)
  } catch {
    return null
  }
}

/**
 * Verwijdert de buffer voor een sleutel zonder de data te lezen.
 * Aanroepen na een succesvolle submit om verouderde buffers op te ruimen.
 *
 * @param {string} sleutel - De te verwijderen sleutel
 */
export function wisFormulier(sleutel) {
  try {
    sessionStorage.removeItem(sleutel)
  } catch {
    // stil doorgaan
  }
}
