/**
 * e2e/pw10-naambotsing.spec.js — PW-10: Naambotsing bij meedoen
 *
 * Scenario: iemand probeert mee te doen met een naam die al bezet is.
 * Drie varianten uit de praktijk:
 *
 * PW-10a: naam al bezet → foutmelding zichtbaar, geen navigatie
 * PW-10b: profielnaam pre-ingevuld, naam bezet → fout na directe submit
 * PW-10c: na fout naam aanpassen → fout verdwijnt, knop enabled
 * PW-10d: naam met spaties rondom → na trim bezet → foutmelding
 * PW-10e: naam bezet andere casing → foutmelding (case-insensitief)
 */

import { test, expect } from '@playwright/test'
import {
  maakSupabaseClient,
  maakTestPotje,
  maakDeelnemer,
  verwijderTestPotje,
  nieuweTestDeviceId,
} from './helpers.js'

test.describe('PW-10: Naambotsing bij meedoen', () => {
  let supabase, potje

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    potje = await maakTestPotje(supabase, '[E2E] PW-10 Naambotsing')
    // Bestaande deelnemer met naam 'Jan'
    const bestaandDevice = nieuweTestDeviceId()
    await maakDeelnemer(supabase, potje.id, 'Jan', bestaandDevice)
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  async function openAlsNieuwDevice(page) {
    const nieuwDeviceId = nieuweTestDeviceId()
    await page.goto('/')
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', nieuwDeviceId])
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })
  }

  test('PW-10a: bezette naam → foutmelding zichtbaar, geen navigatie', async ({ page }) => {
    await openAlsNieuwDevice(page)

    await page.getByLabel(/Jouw naam/i).fill('Jan')
    await page.getByRole('button', { name: /Meedoen/i }).click()

    // Foutmelding zichtbaar
    await expect(page.getByText(/al bezet/i)).toBeVisible({ timeout: 4000 })

    // URL ongewijzigd — geen navigatie naar stortenpagina
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}$`))
  })

  test('PW-10b: profielnaam pre-ingevuld maar bezet → fout na directe submit', async ({ page }) => {
    const nieuwDeviceId = nieuweTestDeviceId()
    await page.goto('/')
    await page.evaluate(([k, v]) => {
      localStorage.setItem(k[0], v[0])
      localStorage.setItem(k[1], v[1])
    }, [['digipot_device_id', 'digipot_profiel_naam'], [nieuwDeviceId, 'Jan']])

    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })

    // Veld staat al ingevuld op 'Jan' (uit profielnaam)
    await expect(page.getByLabel(/Jouw naam/i)).toHaveValue('Jan')

    // Direct op Meedoen klikken
    await page.getByRole('button', { name: /Meedoen/i }).click()

    // Foutmelding verschijnt
    await expect(page.getByText(/al bezet/i)).toBeVisible({ timeout: 4000 })
  })

  test('PW-10c: na fout naam aanpassen → fout verdwijnt, meedoen lukt', async ({ page }) => {
    await openAlsNieuwDevice(page)

    // Bezette naam invoeren
    await page.getByLabel(/Jouw naam/i).fill('Jan')
    await page.getByRole('button', { name: /Meedoen/i }).click()
    await expect(page.getByText(/al bezet/i)).toBeVisible({ timeout: 4000 })

    // Naam aanpassen → fout verdwijnt
    await page.getByLabel(/Jouw naam/i).fill('Marie')
    await expect(page.getByText(/al bezet/i)).not.toBeVisible({ timeout: 2000 })

    // Meedoen met nieuwe naam lukt
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
