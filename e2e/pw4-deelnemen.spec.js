/**
 * e2e/pw4-deelnemen.spec.js — PW-4: Deelnemen-flow
 *
 * Test de volledige flow voor een nieuwe gebruiker die een gedeelde
 * potje-link opent en voor het eerst deelneemt.
 *
 * Fix PW-4b (v2): de Meedoen-knop is disabled als het naamveld leeg is
 * (disabled={laden || !naam.trim()}). De test probeerde een disabled knop
 * te klikken — dat is een Playwright-timeout, geen bug in de app.
 * Correct gedrag: controleer dat de knop disabled is bij lege invoer.
 */

import { test, expect } from '@playwright/test'
import {
  maakSupabaseClient,
  maakTestPotje,
  verwijderTestPotje,
} from './helpers.js'

test.describe('PW-4: Deelnemen-flow', () => {
  let supabase
  let potje

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    potje = await maakTestPotje(supabase, '[E2E] PW-4 Deelnemen flow')
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  test('PW-4a: nieuwe gebruiker → deelneemscherm → naam invullen → meedoen → stortenpagina', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(key => localStorage.removeItem(key), 'digipot_device_id')

    await page.goto(`/potje/${potje.id}`)

    await expect(
      page.getByRole('heading', { name: /Meedoen aan/i })
    ).toBeVisible({ timeout: 8000 })

    await page.getByLabel(/Jouw naam/i).fill('Testdeelnemer')
    await page.getByRole('button', { name: /Meedoen/i }).click()

    await expect(page).toHaveURL(
      new RegExp(`/potje/${potje.id}/storten`),
      { timeout: 8000 }
    )
    await expect(page.getByText('Testdeelnemer')).toBeVisible({ timeout: 6000 })
  })

  test('PW-4b: lege naam → Meedoen-knop is disabled', async ({ page }) => {
    // De knop is disabled zolang !naam.trim() — dit is de juiste UI-beveiliging.
    // Een lege naam kan nooit worden ingediend via de knop.
    await page.goto('/')
    await page.evaluate(key => localStorage.removeItem(key), 'digipot_device_id')

    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })

    // Naamveld is leeg — knop moet disabled zijn
    await expect(page.getByRole('button', { name: /Meedoen/i })).toBeDisabled()

    // Pagina-URL mag niet veranderd zijn
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}$`))
  })

  test('PW-4b2: naam met alleen spaties → Meedoen-knop is disabled (trim)', async ({ page }) => {
    // naam.trim() geeft lege string terug bij alleen spaties → knop disabled
    await page.goto('/')
    await page.evaluate(key => localStorage.removeItem(key), 'digipot_device_id')

    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })

    await page.getByLabel(/Jouw naam/i).fill('   ')

    // Knop moet nog steeds disabled zijn (spaties tellen niet als geldige naam)
    await expect(page.getByRole('button', { name: /Meedoen/i })).toBeDisabled()
  })

  test('PW-4c: naam exact 30 tekens → knop enabled (grenswaarde)', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(key => localStorage.removeItem(key), 'digipot_device_id')

    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })

    // Vul exact 30 tekens in — het maximale aantal dat de input toelaat
    await page.getByLabel(/Jouw naam/i).fill('a'.repeat(30))

    // Knop moet enabled zijn bij 30 tekens
    await expect(page.getByRole('button', { name: /Meedoen/i })).toBeEnabled()

    // HTML maxLength verhindert meer dan 30 tekens
    const waarde = await page.getByLabel(/Jouw naam/i).inputValue()
    expect(waarde.length).toBe(30)
  })

  test('PW-4d: profielnaam in localStorage → vooraf ingevuld in naam-veld', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.removeItem('digipot_device_id')
      localStorage.setItem('digipot_profiel_naam', 'ProfielNaam')
    })

    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })

    const waarde = await page.getByLabel(/Jouw naam/i).inputValue()
    expect(waarde).toBe('ProfielNaam')

    await expect(page.getByText(/Uit je profiel/i)).toBeVisible()
  })

  test('PW-4e: na meedoen → device_id opgeslagen in localStorage', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(key => localStorage.removeItem(key), 'digipot_device_id')

    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })

    await page.getByLabel(/Jouw naam/i).fill('NieuweDeelnemer')
    await page.getByRole('button', { name: /Meedoen/i }).click()

    await expect(page).toHaveURL(new RegExp(`/storten`), { timeout: 8000 })

    const deviceId = await page.evaluate(key => localStorage.getItem(key), 'digipot_device_id')
    const uuidPatroon = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(deviceId).toMatch(uuidPatroon)
  })
})
