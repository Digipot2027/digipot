/**
 * e2e/helpers.js — Gedeelde hulpfuncties voor Digipot Playwright-tests
 *
 * Fase 4 / rate-limit-fix (2026-04-25):
 * Eén gedeelde auth-sessie via global-setup.js — geen rate limits.
 *
 * maakDeelnemer(supabase, potjeId, naam, deviceId, gebruikGedeeldeUser = true)
 *   Als gebruikGedeeldeUser = true (default): koppelt de gedeelde userId.
 *   Als gebruikGedeeldeUser = false: maakt een deelnemer zonder user_id (null).
 *   Dit is nodig voor tests die meerdere deelnemers per potje aanmaken —
 *   de partial unique index staat maar één deelnemer per userId per potje toe.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { readFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const ANON_KEY     = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error('VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY zijn vereist.')
}

function laadGedeeldeSessie() {
  try {
    const data = readFileSync(resolve(__dirname, '.auth/sessie.json'), 'utf-8')
    return JSON.parse(data)
  } catch {
    throw new Error('Gedeelde auth-sessie niet gevonden. Controleer globalSetup in playwright.config.js.')
  }
}

export function maakSupabaseClient() {
  return createClient(SUPABASE_URL, ANON_KEY)
}

export function maakServiceClient() {
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY ontbreekt in .env.local.')
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function maakTestPotje(supabase, naam = '[E2E] Testpotje') {
  const { data, error } = await supabase
    .from('potjes')
    .insert({ naam, status: 'open', valuta: 'EUR' })
    .select()
    .single()
  if (error) throw new Error(`maakTestPotje mislukt: ${error.message}`)
  return data
}

/**
 * Maakt een deelnemer aan.
 *
 * @param {boolean} gebruikGedeeldeUser
 *   true (default) — koppelt de gedeelde userId aan de deelnemer.
 *                    Gebruik dit voor de "hoofd"-deelnemer in een test.
 *   false          — maakt deelnemer zonder user_id (null).
 *                    Gebruik dit voor extra/secundaire deelnemers in dezelfde test,
 *                    om de unique constraint (potje_id, user_id) te omzeilen.
 *
 * @returns {{ deelnemer, session, deviceId }}
 */
export async function maakDeelnemer(supabase, potjeId, naam, deviceId, gebruikGedeeldeUser = true) {
  const { session, userId } = laadGedeeldeSessie()

  const service = maakServiceClient()
  const { data, error } = await service
    .from('deelnemers')
    .insert({
      potje_id: potjeId,
      naam,
      device_id: deviceId,
      user_id: gebruikGedeeldeUser ? userId : null,
    })
    .select()
    .single()
  if (error) throw new Error(`maakDeelnemer mislukt: ${error.message}`)

  return { deelnemer: data, session, deviceId }
}

export async function setAuthInBrowser(page, session) {
  if (!session) return
  const storageKey = `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [storageKey, JSON.stringify(session)]
  )
}

export async function maakTransactie(potjeId, deelnemerId, type, bedrag, deviceId) {
  const service = maakServiceClient()
  const { data, error } = await service
    .from('transacties')
    .insert({ potje_id: potjeId, deelnemer_id: deelnemerId, type, bedrag })
    .select()
    .single()
  if (error) throw new Error(`maakTransactie mislukt (${type} €${bedrag}): ${error.message}`)
  return data
}

export async function verwijderTestPotje(supabase, potjeId) {
  const service = maakServiceClient()
  await service.from('potjes').delete().eq('id', potjeId)
}

export async function wachtOpToastMetTekst(page, verwachteTekst, timeout = 8000) {
  const toast = page.locator('[role="status"], [role="alert"]').filter({ hasText: verwachteTekst })
  await toast.waitFor({ state: 'visible', timeout })
  return toast.textContent()
}

export async function wachtOpToast(page, timeout = 6000) {
  const toast = page.locator('[role="status"], [role="alert"]').first()
  await toast.waitFor({ state: 'visible', timeout })
  return toast.textContent()
}

export function nieuweTestDeviceId() {
  return crypto.randomUUID()
}
