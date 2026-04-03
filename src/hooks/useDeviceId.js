import { useMemo } from 'react'
import { DEVICE_ID_KEY } from '../constants'

// UUID v4 patroon: 8-4-4-4-12 hexadecimale tekens, derde groep begint met 4,
// vierde groep begint met 8, 9, a of b.
const UUID_PATROON = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Levert het unieke device-ID voor dit apparaat.
 *
 * - Leest de UUID uit localStorage (`digipot_device_id`).
 * - Valideert de opgeslagen waarde tegen het UUID v4-patroon (SEC-M1).
 *   Een ongeldige waarde (bijv. gemanipuleerd door een browserextensie of XSS)
 *   wordt genegeerd en vervangen door een nieuw UUID.
 * - Maakt bij afwezigheid of ongeldige waarde een nieuw UUID aan en slaat het op.
 * - Resultaat is stabiel voor de gehele levensduur van de component
 *   (useMemo met lege dependencies — UUID verandert nooit per sessie).
 *
 * @returns {string} UUID v4 — altijd een geldige, niet-lege string
 */
export function useDeviceId() {
  return useMemo(() => {
    const opgeslagen = localStorage.getItem(DEVICE_ID_KEY)
    if (opgeslagen && UUID_PATROON.test(opgeslagen)) {
      return opgeslagen
    }
    // Geen of ongeldige UUID: genereer nieuw en sla op
    const nieuw = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, nieuw)
    return nieuw
  }, [])
}
