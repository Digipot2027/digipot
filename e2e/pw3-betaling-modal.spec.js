/**
 * e2e/pw3-betaling-modal.spec.js — PW-3: Betaling via ModalTransactie
 *
 * Fix t.o.v. v2:
 * - getByText('Betaler') matcht strict mode violation: zowel
 *   <p>Welkom, Betaler</p> als <span>Betaler (jij)</span>.
 *   Oplossing: wacht op de subtitel-paragraaf met exacte tekst
 *   "Welkom, Betaler" — uniek op de overzichtspagina.
 * - Toast-check: net als PW-1 wachten we op een UI-effect
 *   (modal verdwenen) als betrouwbaarder signaal dan toast-timing.
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
    // Storting aanmaken MET device_id header zodat RLS-policy wordt gepasseerd
    await maakTransactie(potje.id, deelnemer.id, 'storting', 25.00, deviceId)
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  // Helper: wacht tot de overzichtspagina volledig geladen is voor deze deelnemer.
  // Wacht op de subtitel "Welkom, Betaler" — uniek element, geen strict mode conflict.
  async function wachtOpOverzicht(page) {
    await expect(
      page.getByText('Welkom, Betaler', { exact: true })
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

    await page.getByRole('button', { name: /Betaling registreren|Rondje betaald/i }).click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Betaling registreren/i })).toBeVisible()

    await page.getByLabel(/Betaald bedrag/i).fill('12,50')
    await page.getByRole('button', { name: 'Bevestigen' }).click()

    // Modal sluit als de betaling gelukt is
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })

    // Pagina toont geen technische foutmeldingen
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

    await page.getByRole('button', { name: /Betaling registreren|Rondje betaald/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Saldo is €25 — invoer van €999 moet worden geblokkeerd
    await page.getByLabel(/Betaald bedrag/i).fill('999')
    await page.getByRole('button', { name: 'Bevestigen' }).click()

    // Modal moet open blijven met foutmelding
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

    await page.getByRole('button', { name: /Betaling registreren|Rondje betaald/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.getByRole('button', { name: 'Annuleren' }).click()

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}$`))
  })
})
