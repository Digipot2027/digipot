/**
 * e2e/pw8-potjeslijsten-en-routing.spec.js — PW-8: Potjeslijsten, lege staat, 404
 * Fase 4 update: setAuthInBrowser + profielnaam voor useMijnPotjes.
 * PW-8c fix: unieke UUID in pottitel om strict mode conflict te vermijden.
 */

import { test, expect } from '@playwright/test'
import {
  maakSupabaseClient, maakTestPotje, maakDeelnemer,
  setAuthInBrowser, verwijderTestPotje, nieuweTestDeviceId,
} from './helpers.js'

test.describe('PW-8: Potjeslijsten en routing', () => {
  test('PW-8a: Open potjes — lege staat zichtbaar voor nieuw apparaat', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.removeItem('digipot_device_id')
      localStorage.removeItem('digipot_profiel_naam')
    })
    await page.goto('/instellingen/open')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/Geen open potjes/i)).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('button', { name: /Nieuw potje starten/i })).toBeVisible()
  })

  test('PW-8b: Gesloten potjes — lege staat zichtbaar voor nieuw apparaat', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.removeItem('digipot_device_id')
      localStorage.removeItem('digipot_profiel_naam')
    })
    await page.goto('/instellingen/gesloten')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/Geen gesloten potjes/i)).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('button', { name: /Nieuw potje starten/i })).toBeVisible()
  })

  test('PW-8c: Open potjes — potje verschijnt in lijst na deelnemen', async ({ page }) => {
    const supabase = maakSupabaseClient()
    const deviceId = nieuweTestDeviceId()
    const naam = 'Lijstgebruiker'
    // Unieke UUID in pottitel voorkomt strict mode conflict bij meerdere runs
    const uniekeSuffix = crypto.randomUUID().slice(0, 8)
    const pottitel = `[E2E] PW-8c ${uniekeSuffix}`
    const potje = await maakTestPotje(supabase, pottitel)
    const result = await maakDeelnemer(supabase, potje.id, naam, deviceId, true)

    await page.goto('/')
    await setAuthInBrowser(page, result.session)
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_profiel_naam', naam])

    await page.goto('/instellingen/open')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(pottitel).first()).toBeVisible({ timeout: 8000 })
    await page.getByText(pottitel).first().click()
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}`))
    await verwijderTestPotje(supabase, potje.id)
  })

  test('PW-8d: onbekende route toont 404-pagina', async ({ page }) => {
    await page.goto('/deze-pagina-bestaat-absoluut-niet')
    await expect(page.getByRole('heading', { name: /Pagina niet gevonden/i })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /Terug naar home/i })).toBeVisible()
  })

  test('PW-8e: 404 terugknop navigeert naar home', async ({ page }) => {
    await page.goto('/bestaat-niet')
    await page.getByRole('button', { name: /Terug naar home/i }).click()
    await expect(page).toHaveURL('/')
  })

  test('PW-8f: potje aanmaken — knop disabled bij lege naam', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /Potje aanmaken/i })).toBeDisabled()
  })

  test('PW-8g: potje aanmaken — succesvol aanmaken navigeert naar potje', async ({ page }) => {
    const supabase = maakSupabaseClient()
    await page.goto('/')
    await page.getByLabel(/Naam van het potje/i).fill('PW-8g Testaanmaak')
    await page.getByRole('button', { name: /Potje aanmaken/i }).click()
    await expect(page).toHaveURL(/\/potje\/[0-9a-f-]{36}/, { timeout: 8000 })
    await expect(page.getByRole('heading', { name: /Meedoen aan PW-8g Testaanmaak/i })).toBeVisible()
    const url = page.url()
    const match = url.match(/\/potje\/([0-9a-f-]{36})/)
    if (match) await verwijderTestPotje(supabase, match[1])
  })
})
