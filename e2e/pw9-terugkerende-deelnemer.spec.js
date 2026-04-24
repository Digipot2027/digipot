/**
 * e2e/pw9-terugkerende-deelnemer.spec.js — PW-9: Terugkerende deelnemer
 *
 * Selector-update (2026-04-24): "Welkom, [naam]" verwijderd uit UI.
 * Nieuwe anchor: tabelcel met naam "(jij)".
 * Knoplabels bijgewerkt: "In pot storten" → "Storten", "Jezelf afmelden" → "Afmelden".
 */

import { test, expect } from '@playwright/test'
import {
  maakSupabaseClient,
  maakTestPotje,
  maakDeelnemer,
  maakTransactie,
  verwijderTestPotje,
  nieuweTestDeviceId,
} from './helpers.js'

test.describe('PW-9: Terugkerende deelnemer', () => {
  let supabase, potje, deelnemer, deviceId

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    deviceId = nieuweTestDeviceId()
    potje = await maakTestPotje(supabase, '[E2E] PW-9 Terugkerende')
    deelnemer = await maakDeelnemer(supabase, potje.id, 'Terugkomer', deviceId)
    await maakTransactie(potje.id, deelnemer.id, 'storting', 20.00, deviceId)
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  async function setDeviceId(page) {
    await page.goto('/')
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', deviceId])
  }

  // Anchor: tabelcel met "(jij)" — vervangt "Welkom, [naam]"
  async function wachtOpOverzicht(page) {
    await expect(
      page.getByRole('cell', { name: /Terugkomer.*jij|jij.*Terugkomer/i })
    ).toBeVisible({ timeout: 8000 })
  }

  test('PW-9a: terugkerende deelnemer → direct overzicht, geen deelneemscherm', async ({ page }) => {
    await setDeviceId(page)
    await page.goto(`/potje/${potje.id}`)

    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).not.toBeVisible({ timeout: 3000 })
    await wachtOpOverzicht(page)
  })

  test('PW-9b: terugkerende deelnemer → eigen naam zichtbaar met "(jij)" badge', async ({ page }) => {
    await setDeviceId(page)
    await page.goto(`/potje/${potje.id}`)

    await wachtOpOverzicht(page)
    await expect(page.getByText(/Terugkomer.*jij|jij.*Terugkomer/i)).toBeVisible()
  })

  test('PW-9c: terugkerende deelnemer → storten-knop aanwezig en klikbaar', async ({ page }) => {
    await setDeviceId(page)
    await page.goto(`/potje/${potje.id}`)

    await wachtOpOverzicht(page)

    const stortenKnop = page.getByRole('button', { name: /^Storten$/i })
    await expect(stortenKnop).toBeVisible()
    await expect(stortenKnop).toBeEnabled()

    await stortenKnop.click()
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}/storten`))
  })

  test('PW-9d: ander device, zelfde potje → deelneemscherm getoond', async ({ page }) => {
    const anderDeviceId = nieuweTestDeviceId()
    await page.goto('/')
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', anderDeviceId])

    await page.goto(`/potje/${potje.id}`)

    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })
  })

  test('PW-9e: afgemelde deelnemer → storten-knop disabled (via UI-afmeldflow)', async ({ page }) => {
    const andereDeviceId = nieuweTestDeviceId()
    const tweedeDeelnemer = await maakDeelnemer(supabase, potje.id, 'Medewerker', andereDeviceId)
    await maakTransactie(potje.id, tweedeDeelnemer.id, 'storting', 10.00, andereDeviceId)

    await setDeviceId(page)
    await page.goto(`/potje/${potje.id}`)
    await wachtOpOverzicht(page)

    await page.getByRole('button', { name: /^Afmelden$/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: /Ja, meld me af/i }).click()

    await expect(page.locator('.badge.badge-afgemeld').first()).toBeVisible({ timeout: 8000 })

    await expect(page.getByRole('button', { name: /^Storten$/i })).toBeDisabled()
  })

  test('PW-9f: afgemelde deelnemer → URL-hack /storten → actief-guard toont foutmelding', async ({ page }) => {
    const andereDeviceId = nieuweTestDeviceId()
    const tweedeDeelnemer = await maakDeelnemer(supabase, potje.id, 'Medewerker', andereDeviceId)
    await maakTransactie(potje.id, tweedeDeelnemer.id, 'storting', 10.00, andereDeviceId)

    await setDeviceId(page)
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
