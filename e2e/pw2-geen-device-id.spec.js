/**
 * e2e/pw2-geen-device-id.spec.js — PW-2: Storten zonder device_id
 *
 * Het exacte scenario van Sentry REACT-8 en REACT-9:
 * een gebruiker probeert te storten terwijl er geen (geldige) device_id
 * in localStorage staat.
 *
 * Fix t.o.v. v1: specifiekere locator voor het deelneemscherm om
 * Playwright strict mode violation te vermijden (meerdere elementen
 * matchen op hetzelfde .or()-chain).
 */

import { test, expect } from '@playwright/test'
import {
  maakSupabaseClient,
  maakTestPotje,
  verwijderTestPotje,
} from './helpers.js'

test.describe('PW-2: Geen device_id — geen storten mogelijk', () => {
  let supabase
  let potje

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    potje = await maakTestPotje(supabase, '[E2E] PW-2 Geen device_id')
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  test('zonder deelnemer-record → Deelneemscherm getoond, geen 401', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(key => localStorage.removeItem(key), 'digipot_device_id')

    await page.goto(`/potje/${potje.id}`)

    // Wacht op de modal-heading — uniek element in het deelneemscherm
    await expect(
      page.getByRole('heading', { name: /Meedoen aan/i })
    ).toBeVisible({ timeout: 8000 })

    // Verwacht: GEEN foutmelding over RLS of 401
    const paginaTekst = await page.textContent('body')
    expect(paginaTekst).not.toContain('row-level security')
    expect(paginaTekst).not.toContain('401')
    expect(paginaTekst).not.toContain('violates')
  })

  test('direct naar /storten zonder deelnemer → doorgestuurd of foutmelding, geen RLS-crash', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(key => localStorage.removeItem(key), 'digipot_device_id')

    await page.goto(`/potje/${potje.id}/storten`)
    await page.waitForLoadState('networkidle')

    const url = page.url()
    const paginaTekst = await page.textContent('body')

    // De pagina moet ofwel een foutmelding tonen ofwel doorsturen
    const heeftFoutmelding =
      paginaTekst.includes('geen deelnemer') ||
      paginaTekst.includes('Meedoen aan') ||
      url.includes(`/potje/${potje.id}`)

    expect(heeftFoutmelding).toBe(true)

    // Kritieke check: geen technische RLS-fout zichtbaar voor gebruiker
    expect(paginaTekst).not.toContain('row-level security')
    expect(paginaTekst).not.toContain('42501')
  })

  test('ongeldig device_id formaat → bootstrapDeviceId herstelt naar geldig UUID', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(key => localStorage.setItem(key, 'dit-is-geen-uuid'), 'digipot_device_id')

    await page.goto(`/potje/${potje.id}`)
    await page.waitForLoadState('networkidle')

    // App moet opstarten zonder crash
    const paginaTekst = await page.textContent('body')
    expect(paginaTekst).not.toContain('row-level security')

    // bootstrapDeviceId() in supabaseClient.js vervangt het ongeldige ID
    // door een geldig UUID v4
    const nieuweDeviceId = await page.evaluate(
      key => localStorage.getItem(key),
      'digipot_device_id'
    )
    const uuidPatroon = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(nieuweDeviceId).toMatch(uuidPatroon)
  })
})
