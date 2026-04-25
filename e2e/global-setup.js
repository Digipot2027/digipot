/**
 * e2e/global-setup.js — Eenmalige setup voor alle e2e-tests
 *
 * Maakt één gedeelde Supabase auth-sessie aan via de Admin API (geen rate limit).
 * De sessie wordt opgeslagen in e2e/.auth/sessie.json en hergebruikt door alle tests.
 *
 * Waarom gedeeld: Supabase Free tier heeft een strenge rate limit op alle
 * auth endpoints (signInAnonymously, verifyOtp, etc.). Met 76 tests die elk
 * een eigen sessie aanmaken, raken we de limiet altijd.
 *
 * Aanpak: één anonieme admin-user aanmaken, sessie ophalen via email+password
 * (geen OTP rate limit), en opslaan. Tests injecteren deze sessie via
 * setAuthInBrowser() in localStorage.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { writeFileSync, mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const ANON_KEY     = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function globalSetup() {
  const service = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Maak een test-gebruiker aan met email+password (geen OTP, geen rate limit)
  const email    = `e2e-shared-${Date.now()}@digipot-e2e.test`
  const password = crypto.randomUUID()

  const { data: userData, error: userError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (userError) throw new Error(`global-setup: createUser mislukt: ${userError.message}`)

  // Log in met email+password — geen rate limit op signInWithPassword
  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: sessionData, error: sessionError } = await anonClient.auth.signInWithPassword({
    email,
    password,
  })
  if (sessionError) throw new Error(`global-setup: signIn mislukt: ${sessionError.message}`)

  // Sla sessie en userId op voor gebruik in tests
  const authDir = resolve(__dirname, '.auth')
  mkdirSync(authDir, { recursive: true })
  writeFileSync(
    resolve(authDir, 'sessie.json'),
    JSON.stringify({
      session: sessionData.session,
      userId: userData.user.id,
    })
  )

  console.log(`[global-setup] Auth-sessie aangemaakt voor ${email}`)
}
