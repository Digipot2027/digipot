/**
 * e2e/pw10-naambotsing.spec.js — PW-10: Naambotsing bij meedoen
 *
 * Fase 4 update: maakDeelnemer destructureren.
 *
 * SEC-A2 fix (2026-04-27): openAlsNieuwDevice injecteert nu de gedeelde
 * auth-sessie via setAuthInBrowser(). Dit is nodig omdat handleDeelnemen
 * supabase.auth.getUser() aanroept om user_id te bepalen, en de nieuwe
 * deelnemers_insert RLS-policy user_id = auth.uid() vereist.
 *
 * "Nieuw apparaat" betekent: geen bestaand deelnemer-record voor deze userId
 * in dit potje. De gedeelde userId is onbekend voor het potje (er is immers
 * geen maakDeelnemer() aanroep met die userId), dus het deelneemscherm
 * verschijnt correct — het sessie-injecteren verandert dat gedrag niet.
 */

import { test, expect } from '@playwright/test'
import {
  maakSupabaseClient, maakTestPotje, maakDeelnemer,
  verwijderTestPotje, nieuweTestDeviceId, setAuthInBrowser,
} from './helpers.js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function laadGedeeldeSessie() {
  const data = readFileSync(resolve(__dirname, '.auth/sessie.json'), 'utf-8')
  return JSON.parse(data)
}

test.describe('PW-10: Naambotsing bij meedoen', () => {
  let supabase, potje, session

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    potje = await maakTestPotje(supabase, '[E2E] PW-10 Naambotsing')
    session = laadGedeeldeSessie().session
    // Maak een bezette deelnemer aan met gebruikGedeeldeUser=false zodat
    // de gedeelde userId vrij blijft voor de browser-deelname in de test.
    const bestaandDevice = nieuweTestDeviceId()
    await maakDeelnemer(supabase, potje.id, 'Jan', bestaandDevice, false)
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  async function openAlsNieuwDevice(page) {
    // Injecteer de gedeelde sessie zodat auth.getUser() een geldige userId
    // retourneert bij handleDeelnemen (vereist door SEC-A2 RLS-policy).
    // De browser is "nieuw" in de zin dat er geen bestaand deelnemer-record
    // voor deze userId in dit potje bestaat.
    await page.goto('/')
    await setAuthInBrowser(page, session)
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
    await setAuthInBrowser(page, session)
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
