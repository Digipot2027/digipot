import { createClient } from '@supabase/supabase-js'
import { DEVICE_ID_KEY, UUID_V4_PATROON } from './constants'
import { getItem, setItem } from './utils/storage'

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
 *
 * MIGRATIE-NOOT (Fase 1, 2026-04-25):
 * bootstrapDeviceId() blijft aanwezig zolang de huidige RLS-policies
 * nog op x-device-id steunen. Wordt verwijderd in Fase 4 nadat Fase 3
 * (RLS → auth.uid()) volledig is uitgerold.
 */
function bootstrapDeviceId() {
  const opgeslagen = getItem(DEVICE_ID_KEY)
  if (opgeslagen && UUID_V4_PATROON.test(opgeslagen)) return opgeslagen
  const nieuw = crypto.randomUUID()
  setItem(DEVICE_ID_KEY, nieuw)
  return nieuw
}

bootstrapDeviceId()

/**
 * Supabase client met automatische x-device-id header.
 *
 * SEC-24 / SEC-26: RLS-policies controleren eigenaarschap via x-device-id.
 * Na bootstrapDeviceId() is de localStorage-waarde gegarandeerd aanwezig.
 *
 * Auth-sessie (Fase 1, 2026-04-25):
 * bootstrapAnonAuth() wordt na createClient() asynchroon aangeroepen.
 * De functie logt in als Supabase anonymous user als er nog geen sessie is.
 * Dit geeft elke browser-sessie een stabiele auth.uid() (UUID), beheerd
 * door Supabase en persistent via de ingebouwde auth-storage van de JS-client
 * (standaard localStorage, sleutel: sb-<project>-auth-token).
 *
 * De anonymous-sessie overleeft gewone localStorage-wipen NIET als Safari
 * ook de auth-token wist — maar dat is exact hetzelfde probleem als nu.
 * De échte fix (persistentie) volgt in Fase 5 via e-mailkoppeling.
 * Fase 1 is de technische fundering: auth.uid() beschikbaar maken voor Fase 2–4.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      get 'x-device-id'() {
        return getItem(DEVICE_ID_KEY) ?? ''
      },
    },
  },
})

/**
 * Zorgt dat elke sessie een Supabase anonymous auth-user heeft.
 *
 * Werkwijze:
 * 1. Controleer of er al een sessie is via getSession().
 * 2. Zo niet → signInAnonymously(). Supabase maakt een anonymous user aan
 *    en slaat de JWT op in localStorage (sb-<project>-auth-token).
 * 3. Bij een netwerk- of configuratiefout wordt gelogd naar console.error
 *    maar de applicatie blijft werken — de huidige device_id RLS is ongewijzigd.
 *
 * Bewuste keuzes:
 * - Async: de huidige device_id-RLS werkt synchroon; de auth-bootstrap
 *   hoeft niet geblokkeerd te worden. Supabase voegt de JWT pas toe aan
 *   requests zodra de sessie beschikbaar is — dat is oké voor Fase 1 omdat
 *   de bestaande RLS nog op x-device-id werkt, niet op auth.uid().
 * - Geen await op module-niveau: zou Vite's ESM-evaluatie blokkeren.
 * - Geen retry-loop: Supabase-client handelt token-refresh intern af.
 *
 * @returns {Promise<void>}
 */
async function bootstrapAnonAuth() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      const { error } = await supabase.auth.signInAnonymously()
      if (error) {
        // Niet fataal in Fase 1 — log voor diagnose, gooi niet verder.
        console.error('[supabaseClient] bootstrapAnonAuth mislukt:', error.message)
      }
    }
  } catch (e) {
    console.error('[supabaseClient] bootstrapAnonAuth onverwachte fout:', e)
  }
}

// Kick off zonder await — zie JSDoc hierboven.
bootstrapAnonAuth()
