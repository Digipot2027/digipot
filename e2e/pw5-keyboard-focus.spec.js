/**
 * e2e/pw5-keyboard-focus.spec.js — PW-5: Keyboard-navigatie en focus management
 *
 * Risico: useFocusTrap wordt gebruikt in 5 modals/sheets. Als Escape of Tab
 * niet werkt, zijn modals niet via toetsenbord sluitbaar (WCAG 2.1.1 kritiek).
 *
 * PW-5c noot: Safari (WebKit/Mobile Safari) focust standaard geen <button>-elementen
 * via Tab — dit is een platformbeperking van macOS/iOS, geen bug in de code.
 * De WCAG-vereiste geldt voor toetsenbordgebruikers die Full Keyboard Access
 * hebben ingeschakeld. De test wordt daarom beperkt tot Chromium voor dit scenario.
 * PW-5b (Tab-focus blijft binnen modal) werkt wel op alle browsers omdat het
 * controleert of focus de modal verlaat, niet of een specifieke knop gefocust is.
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

test.describe('PW-5: Keyboard-navigatie en focus management', () => {
  let supabase, potje, deelnemer, deviceId

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    deviceId = nieuweTestDeviceId()
    potje = await maakTestPotje(supabase, '[E2E] PW-5 Keyboard focus')
    deelnemer = await maakDeelnemer(supabase, potje.id, 'Toetsenborder', deviceId)
    await maakTransactie(potje.id, deelnemer.id, 'storting', 30.00, deviceId)
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  async function openOverzicht(page) {
    await page.goto('/')
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', deviceId])
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByText('Welkom, Toetsenborder', { exact: true })).toBeVisible({ timeout: 8000 })
  }

  test('PW-5a: Escape sluit de betaalmodal', async ({ page }) => {
    await openOverzicht(page)
    await page.getByRole('button', { name: /Betaling registreren/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })
  })

  test('PW-5b: Tab-focus blijft binnen de betaalmodal', async ({ page }) => {
    await openOverzicht(page)
    await page.getByRole('button', { name: /Betaling registreren/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Druk meerdere keren Tab — focus mag de modal nooit verlaten
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
    }

    const focusInDialog = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]')
      return dialog?.contains(document.activeElement) ?? false
    })
    expect(focusInDialog).toBe(true)
  })

  // Safari focust standaard geen knoppen via Tab (platformbeperking macOS/iOS).
  // Dit scenario is daarom alleen relevant voor Chromium.
  test('PW-5c: Annuleren bereikbaar via Tab in betaalmodal (Chromium only)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Safari focust geen knoppen via Tab — platformbeperking, geen codebug')

    await openOverzicht(page)
    await page.getByRole('button', { name: /Betaling registreren/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    let gevonden = false
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      const focusedLabel = await page.evaluate(() => document.activeElement?.textContent?.trim())
      if (focusedLabel === 'Annuleren') { gevonden = true; break }
    }
    expect(gevonden).toBe(true)

    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })
  })

  test('PW-5d: betaalmodal opent met focus op het bedrag-invoerveld', async ({ page }) => {
    await openOverzicht(page)
    await page.getByRole('button', { name: /Betaling registreren/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    const focusId = await page.evaluate(() => document.activeElement?.id)
    expect(focusId).toBe('bedrag-invoer')
  })

  test('PW-5e: Escape sluit de sluitingsmodal', async ({ page }) => {
    await openOverzicht(page)
    await page.getByRole('button', { name: /Pot afsluiten/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })
  })

  test('PW-5f: Enter op deelnemernaam opent detail-sheet', async ({ page }) => {
    await openOverzicht(page)

    const rij = page.getByRole('button', { name: /Details van Toetsenborder/i })
    await rij.focus()
    await page.keyboard.press('Enter')

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 })

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })
  })
})
