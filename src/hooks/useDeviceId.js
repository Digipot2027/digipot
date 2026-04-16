import { useMemo } from 'react'
import { DEVICE_ID_KEY, UUID_V4_PATROON } from '../constants'
import { getItem, setItem } from '../utils/storage'

/**
 * Levert het unieke device-ID voor dit apparaat.
 *
 * - Leest de UUID uit localStorage (`digipot_device_id`).
 * - Valideert de opgeslagen waarde tegen UUID_V4_PATROON uit constants.js (SEC-M1).
 *   Een ongeldige waarde (bijv. gemanipuleerd door een browserextensie of XSS)
 *   wordt genegeerd en vervangen door een nieuw UUID.
 * - Maakt bij afwezigheid of ongeldige waarde een nieuw UUID aan en slaat het op.
 * - Resultaat is stabiel voor de gehele levensduur van de component
 *   (useMemo met lege dependencies — UUID verandert nooit per sessie).
 *
 * Relatie met bootstrapDeviceId (supabaseClient.js):
 *   bootstrapDeviceId() draait synchroon bij module-load, vóór React mount,
 *   zodat de x-device-id header bij createClient() al een geldig UUID bevat.
 *   Deze hook doet daarna exact hetzelfde — defense-in-depth. Verwijder de hook
 *   NIET als "redundant": zonder bootstrapDeviceId() treedt Sentry REACT-8/9 op
 *   (lege header → RLS 42501 op INSERT). Beide lagen zijn noodzakelijk.
 *   UUID_V4_PATROON komt uit constants.js — één bron voor beide (SEC-1 fix).
 *
 * @returns {string} UUID v4 — altijd een geldige, niet-lege string
 */
export function useDeviceId() {
  return useMemo(() => {
    const opgeslagen = getItem(DEVICE_ID_KEY)
    if (opgeslagen && UUID_V4_PATROON.test(opgeslagen)) {
      return opgeslagen
    }
    // Geen of ongeldige UUID: genereer nieuw en sla op
    const nieuw = crypto.randomUUID()
    setItem(DEVICE_ID_KEY, nieuw)
    return nieuw
  }, [])
}
