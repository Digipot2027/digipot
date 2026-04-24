/**
 * e2e/pw1-happy-path.spec.js — PW-1: Happy path storten
 *
 * Bijgewerkt (2026-04-24):
 * - PW-1c: knop is nu altijd enabled; zonder bedrag volgt inline foutmelding
 *   i.p.v. disabled-staat (UX-review 2026-04-24).
 * - Commentaar over state-toast verwijderd — toast bestaat niet meer op
 *   stortenscherm; succescheck via URL-redirect + saldo in tabel.
 */

import { test, expect } from '@playwright/test'
import {
  maakSupabaseClient,
  maakTestPotje,
  maakDeelnemer,
  verwijderTestPotje,
  nieuweTestDeviceId,
} from './helpers.js'

test.describe('PW-1: Happy path storten', () => {
  let supabase
  let potje
  let deviceId

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    deviceId = nieuweTestDeviceId()
    potje = await maakTestPotje(supabase, '[E2E] PW-1 Happy path storten')
    await maakDeelnemer(supabase, potje.id, 'Testgebruiker', deviceId)
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  test('snelknop €10 → storten → saldo zichtbaar op overzicht', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(
      ([key, id]) => localStorage.setItem(key, id),
      ['digipot_device_id', deviceId]
    )

    await page.goto(`/potje/${potje.id}/storten`)
    await expect(page.getByRole('group', { name: 'Standaardbedragen' })).toBeVisible()

    await page.getByRole('button', { name: '€ 10,00', exact: true }).click()
    await expect(page.getByRole('button', { name: '€ 10,00', exact: true })).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('button', { name: /storten →/i }).click()

    // Wacht op redirect naar overzicht (inline successtate 1,2s, daarna navigate)
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}$`), { timeout: 8000 })

    // Primaire check: storting is verwerkt — saldo zichtbaar in de tabel.
    await expect(page.getByRole('cell', { name: '€ 10,00' })).toBeVisible({ timeout: 6000 })
  })

  test('vrij bedrag €7,50 → storten → saldo zichtbaar op overzicht', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(
      ([key, id]) => localStorage.setItem(key, id),
      ['digipot_device_id', deviceId]
    )

    await page.goto(`/potje/${potje.id}/storten`)
    await expect(page.getByRole('group', { name: 'Standaardbedragen' })).toBeVisible()

    await page.getByRole('button', { name: /Ander bedrag invoeren/ }).click()
    await page.getByLabel(/Ander bedrag/).fill('7,50')

    await page.getByRole('button', { name: /storten →/i }).click()

    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}$`), { timeout: 8000 })

    // Saldo €7,50 verschijnt in de deelnemerstabel
    await expect(page.getByRole('cell', { name: '€ 7,50' })).toBeVisible({ timeout: 6000 })
  })

  test('storten zonder bedrag → inline foutmelding, geen navigatie', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(
      ([key, id]) => localStorage.setItem(key, id),
      ['digipot_device_id', deviceId]
    )

    await page.goto(`/potje/${potje.id}/storten`)
    await expect(page.getByRole('group', { name: 'Standaardbedragen' })).toBeVisible()

    // Knop is altijd enabled — klikken zonder bedrag toont inline foutmelding
    await page.getByRole('button', { name: /storten/i }).first().click()
    await expect(page.getByRole('alert')).toContainText('Kies een bedrag')
    await expect(page).toHaveURL(new RegExp(`/storten$`))
  })
})
