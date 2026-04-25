/**
 * e2e/pw3-betaling-modal.spec.js — PW-3: Betaling via ModalTransactie
 * Fase 4 update: identiteitsherkenning via auth.uid() / setAuthInBrowser().
 */

import { test, expect } from '@playwright/test'
import {
  maakSupabaseClient, maakTestPotje, maakDeelnemer, maakTransactie,
  setAuthInBrowser, verwijderTestPotje, nieuweTestDeviceId,
} from './helpers.js'

test.describe('PW-3: Betaling via modal', () => {
  let supabase, potje, deelnemer, session, deviceId

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    deviceId = nieuweTestDeviceId()
    potje = await maakTestPotje(supabase, '[E2E] PW-3 Betaling modal')
    const result = await maakDeelnemer(supabase, potje.id, 'Betaler', deviceId)
    deelnemer = result.deelnemer
    session = result.session
    await maakTransactie(potje.id, deelnemer.id, 'storting', 25.00, deviceId)
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  async function openOverzicht(page) {
    await page.goto('/')
    await setAuthInBrowser(page, session)
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('cell', { name: /Betaler.*jij|jij.*Betaler/i })).toBeVisible({ timeout: 8000 })
  }

  test('betaalknop → modal opent → bedrag invoeren → bevestigen → modal sluit', async ({ page }) => {
    await openOverzicht(page)
    await page.getByRole('button', { name: /^Betaling$/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByLabel(/Betaald bedrag/i).fill('12,50')
    await page.getByRole('button', { name: 'Bevestigen' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })
    const body = await page.textContent('body')
    expect(body).not.toContain('row-level security')
  })

  test('betaling boven saldo → foutmelding in modal, modal blijft open', async ({ page }) => {
    await openOverzicht(page)
    await page.getByRole('button', { name: /^Betaling$/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByLabel(/Betaald bedrag/i).fill('999')
    await page.getByRole('button', { name: 'Bevestigen' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    const modalTekst = await page.getByRole('dialog').textContent()
    expect(modalTekst).toMatch(/saldo|maximum|beschikbaar/i)
  })

  test('modal sluiten met Annuleren → modal verdwijnt, URL ongewijzigd', async ({ page }) => {
    await openOverzicht(page)
    await page.getByRole('button', { name: /^Betaling$/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Annuleren' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}$`))
  })
})
