/**
 * e2e/pw10-naambotsing.spec.js — PW-10: Naambotsing bij meedoen
 * Fase 4 update: maakDeelnemer destructureren.
 */

import { test, expect } from '@playwright/test'
import {
  maakSupabaseClient, maakTestPotje, maakDeelnemer,
  verwijderTestPotje, nieuweTestDeviceId,
} from './helpers.js'

test.describe('PW-10: Naambotsing bij meedoen', () => {
  let supabase, potje

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    potje = await maakTestPotje(supabase, '[E2E] PW-10 Naambotsing')
    const bestaandDevice = nieuweTestDeviceId()
    await maakDeelnemer(supabase, potje.id, 'Jan', bestaandDevice)
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  async function openAlsNieuwDevice(page) {
    // Geen auth-sessie → browser is een nieuw onbekend apparaat
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })
  }

  test('PW-10a: bezette naam → foutmelding zichtbaar, geen navigatie', async ({ page }) => {
    await openAlsNieuwDevice(page)
    await page.getByLabel(/Jouw naam/i).fill('Jan')
    await page.getByRole('button', { name: /Meedoen/i }).click()
    await expect(page.getByText(/al bezet/i)).toBeVisible({ timeout: 4000 })
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}$`))
  })

  test('PW-10b: profielnaam pre-ingevuld maar bezet → fout na directe submit', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(k => localStorage.setItem(k, 'Jan'), 'digipot_profiel_naam')
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })
    await expect(page.getByLabel(/Jouw naam/i)).toHaveValue('Jan')
    await page.getByRole('button', { name: /Meedoen/i }).click()
    await expect(page.getByText(/al bezet/i)).toBeVisible({ timeout: 4000 })
  })

  test('PW-10c: na fout naam aanpassen → fout verdwijnt, meedoen lukt', async ({ page }) => {
    await openAlsNieuwDevice(page)
    await page.getByLabel(/Jouw naam/i).fill('Jan')
    await page.getByRole('button', { name: /Meedoen/i }).click()
    await expect(page.getByText(/al bezet/i)).toBeVisible({ timeout: 4000 })
    await page.getByLabel(/Jouw naam/i).fill('Marie')
    await expect(page.getByText(/al bezet/i)).not.toBeVisible({ timeout: 2000 })
    await page.getByRole('button', { name: /Meedoen/i }).click()
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}/storten`), { timeout: 8000 })
  })

  test('PW-10d: naam met spaties rondom → na trim bezet → foutmelding', async ({ page }) => {
    await openAlsNieuwDevice(page)
    await page.getByLabel(/Jouw naam/i).fill('  Jan  ')
    await page.getByRole('button', { name: /Meedoen/i }).click()
    await expect(page.getByText(/al bezet/i)).toBeVisible({ timeout: 4000 })
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}$`))
  })

  test('PW-10e: naam bezet andere casing → foutmelding (case-insensitief)', async ({ page }) => {
    await openAlsNieuwDevice(page)
    await page.getByLabel(/Jouw naam/i).fill('JAN')
    await page.getByRole('button', { name: /Meedoen/i }).click()
    await expect(page.getByText(/al bezet/i)).toBeVisible({ timeout: 4000 })
  })
})
