import { createClient } from '@supabase/supabase-js'
import { DEVICE_ID_KEY } from './constants'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase omgevingsvariabelen ontbreken. Controleer je .env.local bestand.')
}

/**
 * Supabase client met automatische x-device-id header.
 *
 * SEC-24 / SEC-26: De RLS-policies voor UPDATE op deelnemers en DELETE op
 * transacties controleren eigenaarschap via de x-device-id request-header.
 * Door de header hier globaal in te stellen hoeven individuele acties
 * (handleUndo, handleAfmelden) de device_id niet zelf door te geven.
 *
 * De header wordt bij elke request dynamisch opgehaald uit localStorage
 * zodat een device_id die na initialisatie wordt aangemaakt alsnog correct
 * wordt meegestuurd.
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
