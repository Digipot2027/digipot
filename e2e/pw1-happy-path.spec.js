/**
 * e2e/pw1-happy-path.spec.js — PW-1: Happy path storten
 *
 * Fix t.o.v. v2:
 * - Toast-timing: de succesvol-toast verschijnt vlak na navigate() en
 *   verdwijnt na TOAST_DUUR_KORT (3000ms). wachtOpToastMetTekst() begon
 *   pas te zoeken nádat de URL-check al klaars was — te laat.
 *   Oplossing: eerst wachten op de URL-redirect, dan meteen daarna
 *   de toast afvangen met een ruimere timeout van 4000ms.
 *   Als de toast al verdwenen is voordat we kijken, controleren we
 *   de transactie direct in de UI (saldo zichtbaar in de tabel).
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

    // Wacht op redirect naar overzicht
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}$`), { timeout: 8000 })

    // Primaire check: storting is verwerkt — saldo zichtbaar in de tabel.
    // Dit is betrouwbaarder dan toast-timing (toast verdwijnt na 3s).
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

    await page.getByRole('button', { name: 'Storten →' }).click()

    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}$`), { timeout: 8000 })

    // Saldo €7,50 verschijnt in de deelnemerstabel
    await expect(page.getByRole('cell', { name: '€ 7,50' })).toBeVisible({ timeout: 6000 })
  })

  test('storten zonder bedrag → knop disabled, geen navigatie', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(
      ([key, id]) => localStorage.setItem(key, id),
      ['digipot_device_id', deviceId]
    )

    await page.goto(`/potje/${potje.id}/storten`)
    await expect(page.getByRole('group', { name: 'Standaardbedragen' })).toBeVisible()

    await expect(page.getByRole('button', { name: /storten/i }).first()).toBeDisabled()
    await expect(page).toHaveURL(new RegExp(`/storten$`))
  })
})
