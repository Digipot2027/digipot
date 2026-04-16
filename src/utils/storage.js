/**
 * Centrale localStorage-abstractielaag voor Digipot.
 *
 * DOEL
 *   Alle toegang tot localStorage verloopt via deze module — nooit meer
 *   localStorage.getItem/setItem/removeItem direct in componenten of hooks.
 *   Dit maakt de opslaglaag eenvoudig mockbaar in tests en vervangbaar
 *   (bijv. naar sessionStorage of IndexedDB) zonder componenten aan te raken.
 *
 * API
 *   getItem(key)          → string | null
 *   setItem(key, value)   → void
 *   removeItem(key)       → void
 *
 * FOUTAFHANDELING
 *   localStorage kan niet beschikbaar zijn in:
 *   - private-browsing modi waarbij storage geblokkeerd is
 *   - ingesloten iframes met restrictieve permissions
 *   - omgevingen waarbij storage vol is (QuotaExceededError)
 *   Alle methoden vangen deze fouten op en loggen naar console.error.
 *   getItem retourneert null bij een fout (identiek aan "sleutel niet gevonden").
 *
 * GEBRUIK
 *   import { getItem, setItem, removeItem } from '../utils/storage'
 *   const id = getItem(DEVICE_ID_KEY)
 *   setItem(PROFIEL_NAAM_KEY, naam)
 *   removeItem(PROFIEL_NAAM_KEY)
 *
 * @module storage
 */

/**
 * Leest een waarde uit localStorage.
 *
 * @param {string} key - De sleutel om op te zoeken.
 * @returns {string|null} De opgeslagen waarde, of null als de sleutel niet
 *   bestaat of localStorage niet beschikbaar is.
 */
export function getItem(key) {
  try {
    return localStorage.getItem(key)
  } catch (e) {
    console.error(`[storage] getItem("${key}") mislukt:`, e)
    return null
  }
}

/**
 * Schrijft een waarde naar localStorage.
 *
 * @param {string} key   - De sleutel.
 * @param {string} value - De te bewaren waarde.
 * @returns {void}
 */
export function setItem(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch (e) {
    console.error(`[storage] setItem("${key}") mislukt:`, e)
  }
}

/**
 * Verwijdert een sleutel uit localStorage.
 *
 * @param {string} key - De sleutel om te verwijderen.
 * @returns {void}
 */
export function removeItem(key) {
  try {
    localStorage.removeItem(key)
  } catch (e) {
    console.error(`[storage] removeItem("${key}") mislukt:`, e)
  }
}
