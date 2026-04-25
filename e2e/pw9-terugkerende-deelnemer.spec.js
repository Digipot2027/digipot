/**
 * e2e/pw9-terugkerende-deelnemer.spec.js — PW-9: Terugkerende deelnemer
 * Fase 4 update: identiteitsherkenning via auth.uid() / setAuthInBrowser().
 * PW-9e/f: extra deelnemer 'Medewerker' zonder gedeelde userId (gebruikGedeeldeUser=false).
 */

import { test, expect } from '@playwright/test'
import {
  maakSupabaseClient, maakTestPotje, maakDeelnemer, maakTransactie,
  setAuthInBrowser, verwijderTestPotje, nieuweTestDeviceId,
} from './helpers.js'

test.describe('PW-9: Terugkerende deelnemer', () => {
  let supabase, potje, deelnemer, session, deviceId

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    deviceId = nieuweTestDeviceId()
    potje = await maakTestPotje(supabase, '[E2E] PW-9 Terugkerende')
    const result = await maakDeelnemer(supabase, potje.id, 'Terugkomer', deviceId, true)
    deelnemer = result.deelnemer
    session = result.session
    await maakTransactie(potje.id, deelnemer.id, 'storting', 20.00, deviceId)
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  async function wachtOpOverzicht(page) {
    await expect(page.getByRole('cell', { name: /Terugkomer.*jij|jij.*Terugkomer/i })).toBeVisible({ timeout: 8000 })
  }

  test('PW-9a: terugkerende deelnemer → direct overzicht, geen deelneemscherm', async ({ page }) => {
    await page.goto('/')
    await setAuthInBrowser(page, session)
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).not.toBeVisible({ timeout: 3000 })
    await wachtOpOverzicht(page)
  })

  test('PW-9b: terugkerende deelnemer → eigen naam zichtbaar met "(jij)" badge', async ({ page }) => {
    await page.goto('/')
    await setAuthInBrowser(page, session)
    await page.goto(`/potje/${potje.id}`)
    await wachtOpOverzicht(page)
    await expect(page.getByText(/Terugkomer.*jij|jij.*Terugkomer/i)).toBeVisible()
  })

  test('PW-9c: terugkerende deelnemer → storten-knop aanwezig en klikbaar', async ({ page }) => {
    await page.goto('/')
    await setAuthInBrowser(page, session)
    await page.goto(`/potje/${potje.id}`)
    await wachtOpOverzicht(page)
    const stortenKnop = page.getByRole('button', { name: /^Storten$/i })
    await expect(stortenKnop).toBeEnabled()
    await stortenKnop.click()
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}/storten`))
  })

  test('PW-9d: ander device (geen auth-sessie), zelfde potje → deelneemscherm getoond', async ({ page }) => {
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })
  })

  test('PW-9e: afgemelde deelnemer → storten-knop disabled (via UI-afmeldflow)', async ({ page }) => {
    // Extra deelnemer zonder gedeelde userId — anders unique constraint fout
    const deviceB = nieuweTestDeviceId()
    const resultB = await maakDeelnemer(supabase, potje.id, 'Medewerker', deviceB, false)
    await maakTransactie(potje.id, resultB.deelnemer.id, 'storting', 10.00, deviceB)

    await page.goto('/')
    await setAuthInBrowser(page, session)
    await page.goto(`/potje/${potje.id}`)
    await wachtOpOverzicht(page)

    await page.getByRole('button', { name: /^Afmelden$/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: /Ja, meld me af/i }).click()
    await expect(page.locator('.badge.badge-afgemeld').first()).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('button', { name: /^Storten$/i })).toBeDisabled()
  })

  test('PW-9f: afgemelde deelnemer → URL-hack /storten → actief-guard toont foutmelding', async ({ page }) => {
    const deviceB = nieuweTestDeviceId()
    const resultB = await maakDeelnemer(supabase, potje.id, 'Medewerker', deviceB, false)
    await maakTransactie(potje.id, resultB.deelnemer.id, 'storting', 10.00, deviceB)

    await page.goto('/')
    await setAuthInBrowser(page, session)
    await page.goto(`/potje/${potje.id}`)
    await wachtOpOverzicht(page)

    await page.getByRole('button', { name: /^Afmelden$/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: /Ja, meld me af/i }).click()
    await expect(page.locator('.badge.badge-afgemeld').first()).toBeVisible({ timeout: 8000 })

    await page.goto(`/potje/${potje.id}/storten`)
    await expect(page.getByRole('group', { name: 'Standaardbedragen' })).toBeVisible()
    await page.getByRole('button', { name: '€ 10,00', exact: true }).click()
    await page.getByRole('button', { name: /storten →/i }).click()
    await expect(page.getByRole('alert')).toContainText('afgemeld')
    await expect(page).toHaveURL(new RegExp(`/storten$`))
  })
})
