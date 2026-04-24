/**
 * e2e/pw3-betaling-modal.spec.js — PW-3: Betaling via ModalTransactie
 *
 * Selector-update (2026-04-24): "Welkom, [naam]" verwijderd uit UI.
 * Nieuwe anchor: tabelcel met naam + "(jij)" — uniek op het overzichtscherm.
 * Knoplabels bijgewerkt: "In pot storten" → "Storten", "Betaling registreren" → "Betaling".
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

test.describe('PW-3: Betaling via modal', () => {
  let supabase
  let potje
  let deelnemer
  let deviceId

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    deviceId = nieuweTestDeviceId()
    potje = await maakTestPotje(supabase, '[E2E] PW-3 Betaling modal')
    deelnemer = await maakDeelnemer(supabase, potje.id, 'Betaler', deviceId)
    await maakTransactie(potje.id, deelnemer.id, 'storting', 25.00, deviceId)
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  // Helper: wacht tot de overzichtspagina volledig geladen is voor deze deelnemer.
  // Anchor: tabelcel met naam "(jij)" — uniek op het overzichtscherm.
  async function wachtOpOverzicht(page) {
    await expect(
      page.getByRole('cell', { name: /Betaler.*jij|jij.*Betaler/i })
    ).toBeVisible({ timeout: 8000 })
  }

  test('betaalknop → modal opent → bedrag invoeren → bevestigen → modal sluit', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(
      ([key, id]) => localStorage.setItem(key, id),
      ['digipot_device_id', deviceId]
    )

    await page.goto(`/potje/${potje.id}`)
    await wachtOpOverzicht(page)

    await page.getByRole('button', { name: /^Betaling$/i }).click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Betaling registreren/i })).toBeVisible()

    await page.getByLabel(/Betaald bedrag/i).fill('12,50')
    await page.getByRole('button', { name: 'Bevestigen' }).click()

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })

    const paginaTekst = await page.textContent('body')
    expect(paginaTekst).not.toContain('row-level security')
    expect(paginaTekst).not.toContain('42501')
  })

  test('betaling boven saldo → foutmelding in modal, modal blijft open', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(
      ([key, id]) => localStorage.setItem(key, id),
      ['digipot_device_id', deviceId]
    )

    await page.goto(`/potje/${potje.id}`)
    await wachtOpOverzicht(page)

    await page.getByRole('button', { name: /^Betaling$/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.getByLabel(/Betaald bedrag/i).fill('999')
    await page.getByRole('button', { name: 'Bevestigen' }).click()

    await expect(page.getByRole('dialog')).toBeVisible()
    const modalTekst = await page.getByRole('dialog').textContent()
    expect(modalTekst).toMatch(/saldo|maximum|beschikbaar/i)
  })

  test('modal sluiten met Annuleren → modal verdwijnt, URL ongewijzigd', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(
      ([key, id]) => localStorage.setItem(key, id),
      ['digipot_device_id', deviceId]
    )

    await page.goto(`/potje/${potje.id}`)
    await wachtOpOverzicht(page)

    await page.getByRole('button', { name: /^Betaling$/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.getByRole('button', { name: 'Annuleren' }).click()

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}$`))
  })
})
