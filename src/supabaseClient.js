import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase omgevingsvariabelen ontbreken. Controleer je .env.local bestand.')
}

/**
 * Supabase client.
 *
 * Fase 4 (2026-04-25): x-device-id header en bootstrapDeviceId() verwijderd.
 * RLS gebruikt uitsluitend auth.uid() via is_mijn_deelnemer().
 * De Supabase JS-client beheert de JWT-sessie automatisch via localStorage
 * (sleutel: sb-<project>-auth-token).
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Zorgt dat elke sessie een Supabase anonymous auth-user heeft.
 *
 * Controleert of er al een sessie is; zo niet → signInAnonymously().
 * Supabase slaat de JWT op in localStorage en vernieuwt deze automatisch.
 * Niet-fataal bij netwerk- of configuratiefouten.
 *
 * @returns {Promise<void>}
 */
async function bootstrapAnonAuth() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      const { error } = await supabase.auth.signInAnonymously()
      if (error) {
        console.error('[supabaseClient] bootstrapAnonAuth mislukt:', error.message)
      }
    }
  } catch (e) {
    console.error('[supabaseClient] bootstrapAnonAuth onverwachte fout:', e)
  }
}

bootstrapAnonAuth()
