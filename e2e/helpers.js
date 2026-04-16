/**
 * e2e/helpers.js — Gedeelde hulpfuncties voor Digipot Playwright-tests
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env.local') })

/**
 * Maakt een Supabase-client aan met een specifieke device_id als header.
 * Vereist voor INSERT op transacties — de RLS-policy controleert x-device-id.
 *
 * @param {string} [deviceId] - Optionele device_id voor de x-device-id header.
 *   Geef de device_id van de deelnemer mee die de transactie aanmaakt.
 */
export function maakSupabaseClient(deviceId) {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY zijn vereist.\n' +
      'Controleer je .env.local bestand.'
    )
  }
  return createClient(url, key, deviceId ? {
    global: { headers: { 'x-device-id': deviceId } },
  } : undefined)
}

/**
 * Maakt een testpotje aan. Gebruik altijd een [E2E]-prefix in de naam
 * zodat testdata herkenbaar is in het Supabase-dashboard.
 */
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
 * Voegt een deelnemer toe aan een potje met een specifieke device_id.
 * Die device_id wordt daarna in localStorage van de browser gezet
 * zodat de app de deelnemer herkent.
 */
export async function maakDeelnemer(supabase, potjeId, naam, deviceId) {
  const { data, error } = await supabase
    .from('deelnemers')
    .insert({ potje_id: potjeId, naam, device_id: deviceId })
    .select()
    .single()
  if (error) throw new Error(`maakDeelnemer mislukt: ${error.message}`)
  return data
}

/**
 * Voegt een transactie toe aan een potje namens een deelnemer.
 * Gebruikt een aparte Supabase-client met de device_id van de deelnemer
 * zodat de RLS-policy (x-device-id check) wordt gepasseerd.
 *
 * @param {string} potjeId
 * @param {string} deelnemerId
 * @param {'storting'|'betaling'} type
 * @param {number} bedrag
 * @param {string} deviceId - device_id van de deelnemer die de transactie aanmaakt
 */
export async function maakTransactie(potjeId, deelnemerId, type, bedrag, deviceId) {
  const supabase = maakSupabaseClient(deviceId)
  const { data, error } = await supabase
    .from('transacties')
    .insert({ potje_id: potjeId, deelnemer_id: deelnemerId, type, bedrag })
    .select()
    .single()
  if (error) throw new Error(`maakTransactie mislukt (${type} €${bedrag}): ${error.message}`)
  return data
}

/**
 * Ruimt een testpotje op. Deelnemers en transacties worden via
 * CASCADE automatisch mee verwijderd.
 */
export async function verwijderTestPotje(supabase, potjeId) {
  await supabase.from('potjes').delete().eq('id', potjeId)
}

/**
 * Wacht op een toast die een specifieke substring bevat.
 * Voorkomt dat "Verbinding hersteld." wordt teruggegeven als de
 * gewenste toast nog niet zichtbaar is.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} verwachteTekst - Substring die de toast moet bevatten
 * @param {number} timeout - maximale wachttijd in ms (default 8000)
 */
export async function wachtOpToastMetTekst(page, verwachteTekst, timeout = 8000) {
  const toast = page.locator('[role="status"], [role="alert"]').filter({ hasText: verwachteTekst })
  await toast.waitFor({ state: 'visible', timeout })
  return toast.textContent()
}

/**
 * Wacht op een willekeurige toast (eerste die verschijnt).
 * Gebruik wachtOpToastMetTekst() als je een specifieke toast verwacht.
 */
export async function wachtOpToast(page, timeout = 6000) {
  const toast = page.locator('[role="status"], [role="alert"]').first()
  await toast.waitFor({ state: 'visible', timeout })
  return toast.textContent()
}

export function nieuweTestDeviceId() {
  return crypto.randomUUID()
}
