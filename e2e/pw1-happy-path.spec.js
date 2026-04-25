/**
 * e2e/pw1-happy-path.spec.js — PW-1: Happy path storten
 *
 * Bijgewerkt (2026-04-24):
 * - PW-1c: knop altijd enabled; zonder bedrag volgt inline foutmelding
 * - PW-1d: successtate — knop toont '✓ €X,XX gestort' vóór navigatie
 * - PW-1e: realtime foutmelding bij bedrag boven €999,99
 * - State-toast bestaat niet meer op stortenscherm
 *
 * Bijgewerkt (2026-04-25):
 * - PW-1f: statusmelding bij afkapping 3e decimaal
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

  test('PW-1a: snelknop €10 → storten → saldo zichtbaar op overzicht', async ({ page }) => {
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

    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}$`), { timeout: 8000 })
    await expect(page.getByRole('cell', { name: '€ 10,00' })).toBeVisible({ timeout: 6000 })
  })

  test('PW-1b: vrij bedrag €7,50 → storten → saldo zichtbaar op overzicht', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(
      ([key, id]) => localStorage.setItem(key, id),
      ['digipot_device_id', deviceId]
    )

    await page.goto(`/potje/${potje.id}/storten`)
    await expect(page.getByRole('group', { name: 'Standaardbedragen' })).toBeVisible()

    await page.getByRole('button', { name: /Ander bedrag/ }).click()
    await page.getByLabel(/Ander bedrag/).fill('7,50')
    await page.getByRole('button', { name: /storten →/i }).click()

    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}$`), { timeout: 8000 })
    await expect(page.getByRole('cell', { name: '€ 7,50' })).toBeVisible({ timeout: 6000 })
  })

  test('PW-1c: storten zonder bedrag → inline foutmelding, geen navigatie', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(
      ([key, id]) => localStorage.setItem(key, id),
      ['digipot_device_id', deviceId]
    )

    await page.goto(`/potje/${potje.id}/storten`)
    await expect(page.getByRole('group', { name: 'Standaardbedragen' })).toBeVisible()

    await page.getByRole('button', { name: /storten/i }).first().click()
    await expect(page.getByRole('alert')).toContainText('Kies een bedrag')
    await expect(page).toHaveURL(new RegExp(`/storten$`))
  })

  test('PW-1d: successtate — knop toont bevestiging vóór navigatie', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(
      ([key, id]) => localStorage.setItem(key, id),
      ['digipot_device_id', deviceId]
    )

    await page.goto(`/potje/${potje.id}/storten`)
    await expect(page.getByRole('group', { name: 'Standaardbedragen' })).toBeVisible()

    await page.getByRole('button', { name: '€ 10,00', exact: true }).click()
    await page.getByRole('button', { name: /storten →/i }).click()

    await expect(page.getByRole('button', { name: /gestort/i })).toBeVisible({ timeout: 2000 })
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}$`), { timeout: 5000 })
  })

  test('PW-1e: vrij bedrag boven €999,99 → realtime foutmelding tijdens typen', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(
      ([key, id]) => localStorage.setItem(key, id),
      ['digipot_device_id', deviceId]
    )

    await page.goto(`/potje/${potje.id}/storten`)
    await expect(page.getByRole('group', { name: 'Standaardbedragen' })).toBeVisible()

    await page.getByRole('button', { name: /Ander bedrag/ }).click()
    await page.getByLabel(/Ander bedrag/).fill('9999999999')

    await expect(page.getByRole('alert')).toContainText('999,99')
    await expect(page).toHaveURL(new RegExp(`/storten$`))
  })

  test('PW-1f: 3e decimaal wordt afgekapt en statusmelding verschijnt', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(
      ([key, id]) => localStorage.setItem(key, id),
      ['digipot_device_id', deviceId]
    )

    await page.goto(`/potje/${potje.id}/storten`)
    await expect(page.getByRole('group', { name: 'Standaardbedragen' })).toBeVisible()

    await page.getByRole('button', { name: /Ander bedrag/ }).click()
    const invoer = page.getByLabel(/Ander bedrag/)

    await invoer.fill('12,345')
    await expect(invoer).toHaveValue('12,34')
    await expect(page.getByRole('status')).toContainText('maximaal 2 decimalen')
    await expect(page.getByRole('alert')).not.toBeVisible()

    await invoer.fill('12')
    await expect(page.getByRole('status')).not.toBeVisible()
  })
})
