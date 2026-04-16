import { createClient } from '@supabase/supabase-js'
import { DEVICE_ID_KEY, UUID_V4_PATROON } from './constants'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase omgevingsvariabelen ontbreken. Controleer je .env.local bestand.')
}

/**
 * Initialiseert de device-id synchroon bij module-load.
 *
 * BUG-FIX (Sentry REACT-8 / REACT-9, 2026-04-15):
 * De @supabase/postgrest-js laag evalueert het global.headers-object
 * eenmalig bij createClient(). Als localStorage op dat moment leeg is
 * (eerste load, vóórdat useDeviceId() heeft gedraaid), stuurt elke
 * request een lege x-device-id header → RLS-policy stap 25 blokkeert
 * → 401 op alle INSERT-calls naar transacties.
 *
 * Oplossing: device-id synchroon ophalen/aanmaken vóór createClient().
 *
 * Validatie via UUID_V4_PATROON uit constants.js — zelfde patroon als
 * useDeviceId(). Eén bron van waarheid; geen duplicatie meer (SEC-1 fix).
 */
function bootstrapDeviceId() {
  const opgeslagen = localStorage.getItem(DEVICE_ID_KEY)
  if (opgeslagen && UUID_V4_PATROON.test(opgeslagen)) return opgeslagen
  const nieuw = crypto.randomUUID()
  localStorage.setItem(DEVICE_ID_KEY, nieuw)
  return nieuw
}

bootstrapDeviceId()

/**
 * Supabase client met automatische x-device-id header.
 *
 * SEC-24 / SEC-26: RLS-policies controleren eigenaarschap via x-device-id.
 * Na bootstrapDeviceId() is de localStorage-waarde gegarandeerd aanwezig.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      get 'x-device-id'() {
        return localStorage.getItem(DEVICE_ID_KEY) ?? ''
      },
    },
  },
})
