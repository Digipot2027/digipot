/**
 * e2e/pw8-potjeslijsten-en-routing.spec.js — PW-8: Potjeslijsten, lege staat, 404
 *
 * Risico: lege staat en fout+retry zijn de twee meest zichtbare UI-staten
 * voor een nieuwe gebruiker. Als die kapot zijn ziet de gebruiker een
 * lege pagina zonder uitleg. Nooit eerder getest.
 *
 * Scenario's:
 *   PW-8a: Open potjes — lege staat toont uitleg + startknop
 *   PW-8b: Gesloten potjes — lege staat toont uitleg + startknop
 *   PW-8c: Open potjes — potje verschijnt in lijst na aanmaken + deelnemen
 *   PW-8d: 404 — onbekende route toont foutpagina met terugknop
 *   PW-8e: 404 terugknop → navigeert naar home
 *   PW-8f: Potje aanmaken — formulier disabled bij lege naam
 *   PW-8g: Potje aanmaken — succesvol aanmaken navigeert naar potje
 */

import { test, expect } from '@playwright/test'
import {
  maakSupabaseClient,
  maakTestPotje,
  maakDeelnemer,
  verwijderTestPotje,
  nieuweTestDeviceId,
} from './helpers.js'

test.describe('PW-8: Potjeslijsten en routing', () => {
  test('PW-8a: Open potjes — lege staat zichtbaar voor nieuw apparaat', async ({ page }) => {
    await page.goto('/')
    // Nieuw device_id — geen bekende potjes
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
    const potje = await maakTestPotje(supabase, '[E2E] PW-8c Open potjeslijst')
    await maakDeelnemer(supabase, potje.id, 'Lijstgebruiker', deviceId)

    await page.goto('/')
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', deviceId])

    await page.goto('/instellingen/open')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('PW-8c Open potjeslijst')).toBeVisible({ timeout: 8000 })

    // Klik op het potje → navigeert naar het potje
    await page.getByText('PW-8c Open potjeslijst').click()
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}`))

    await verwijderTestPotje(supabase, potje.id)
  })

  test('PW-8d: onbekende route toont 404-pagina', async ({ page }) => {
    await page.goto('/deze-pagina-bestaat-absoluut-niet')

    await expect(page.getByRole('heading', { name: /Pagina niet gevonden/i })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/bestaat niet/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Terug naar home/i })).toBeVisible()
  })

  test('PW-8e: 404 terugknop navigeert naar home', async ({ page }) => {
    await page.goto('/bestaat-niet')
    await page.getByRole('button', { name: /Terug naar home/i }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: /Digipot/i })).toBeVisible()
  })

  test('PW-8f: potje aanmaken — knop disabled bij lege naam', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /Potje aanmaken/i })).toBeDisabled()
  })

  test('PW-8g: potje aanmaken — succesvol aanmaken navigeert naar potje', async ({ page }) => {
    await page.goto('/')

    await page.getByLabel(/Naam van het potje/i).fill('PW-8g Testaanmaak')
    await expect(page.getByRole('button', { name: /Potje aanmaken/i })).toBeEnabled()
    await page.getByRole('button', { name: /Potje aanmaken/i }).click()

    // Navigeert naar het nieuwe potje (UUID in URL)
    await expect(page).toHaveURL(/\/potje\/[0-9a-f-]{36}/, { timeout: 8000 })

    // Deelneemscherm verschijnt (nog niet deelnemer van dit potje)
    await expect(page.getByRole('heading', { name: /Meedoen aan PW-8g Testaanmaak/i })).toBeVisible()
  })
})
