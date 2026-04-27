/**
 * e2e/pw4-deelnemen.spec.js — PW-4: Deelnemen-flow
 *
 * SEC-A2 fix (2026-04-27): setAuthInBrowser() toegevoegd zodat
 * supabase.auth.getUser() in handleDeelnemen een geldige userId retourneert
 * op alle browsers. Zonder sessie-injectie retourneerde auth.getUser() null
 * op webkit/firefox/android-chrome door timing-verschillen in bootstrapAnonAuth,
 * waarna de nieuwe deelnemers_insert RLS-policy de INSERT blokkeerde (42501).
 */

import { test, expect } from '@playwright/test'
import {
  maakSupabaseClient, maakTestPotje, verwijderTestPotje,
  setAuthInBrowser,
} from './helpers.js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function laadGedeeldeSessie() {
  const data = readFileSync(resolve(__dirname, '.auth/sessie.json'), 'utf-8')
  return JSON.parse(data)
}

test.describe('PW-4: Deelnemen-flow', () => {
  let supabase, potje, session

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    potje = await maakTestPotje(supabase, '[E2E] PW-4 Deelnemen flow')
    session = laadGedeeldeSessie().session
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  test('PW-4a: nieuwe gebruiker → deelneemscherm → naam invullen → meedoen → stortenpagina', async ({ page }) => {
    await page.goto('/')
    await setAuthInBrowser(page, session)
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })
    await page.getByLabel(/Jouw naam/i).fill('Testdeelnemer')
    await page.getByRole('button', { name: /Meedoen/i }).click()
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}/storten`), { timeout: 8000 })
    await expect(page.getByRole('heading', { name: /Storten/i })).toBeVisible({ timeout: 6000 })
  })

  test('PW-4b: lege naam → Meedoen-knop is disabled', async ({ page }) => {
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('button', { name: /Meedoen/i })).toBeDisabled()
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}$`))
  })

  test('PW-4b2: naam met alleen spaties → Meedoen-knop is disabled (trim)', async ({ page }) => {
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })
    await page.getByLabel(/Jouw naam/i).fill('   ')
    await expect(page.getByRole('button', { name: /Meedoen/i })).toBeDisabled()
  })

  test('PW-4c: naam exact 30 tekens → knop enabled (grenswaarde)', async ({ page }) => {
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })
    await page.getByLabel(/Jouw naam/i).fill('a'.repeat(30))
    await expect(page.getByRole('button', { name: /Meedoen/i })).toBeEnabled()
    const waarde = await page.getByLabel(/Jouw naam/i).inputValue()
    expect(waarde.length).toBe(30)
  })

  test('PW-4d: profielnaam in localStorage → vooraf ingevuld in naam-veld', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('digipot_profiel_naam', 'ProfielNaam'))
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })
    const waarde = await page.getByLabel(/Jouw naam/i).inputValue()
    expect(waarde).toBe('ProfielNaam')
    await expect(page.getByText(/Uit je profiel/i)).toBeVisible()
  })

  test('PW-4e: na meedoen → navigatie naar stortenpagina geslaagd', async ({ page }) => {
    await page.goto('/')
    await setAuthInBrowser(page, session)
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })
    await page.getByLabel(/Jouw naam/i).fill('NieuweDeelnemer')
    await page.getByRole('button', { name: /Meedoen/i }).click()
    await expect(page).toHaveURL(new RegExp(`/storten`), { timeout: 8000 })
    await expect(page.getByRole('group', { name: 'Standaardbedragen' })).toBeVisible({ timeout: 5000 })
  })
})
