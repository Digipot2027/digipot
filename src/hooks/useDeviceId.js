import { useMemo } from 'react'
import { DEVICE_ID_KEY } from '../constants'

/**
 * Levert het unieke device-ID voor dit apparaat.
 *
 * - Leest de UUID uit localStorage (`digipot_device_id`).
 * - Maakt bij afwezigheid een nieuw UUID aan en slaat het op.
 * - Resultaat is stabiel voor de gehele levensduur van de component
 *   (useMemo met lege dependencies — UUID verandert nooit per sessie).
 *
 * Vervangt de IIFE die eerder gekopieerd stond in PaginaPotje en PaginaStorten.
 *
 * @returns {string} UUID — altijd een niet-lege string
 */
export function useDeviceId() {
  return useMemo(() => {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  }, [])
}
