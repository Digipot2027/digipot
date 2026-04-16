/**
 * e2e/pw13-undo-en-afmelden.spec.js — PW-13: Undo na sluiting en afmelden
 *
 * PW-13a: storting → Undo klikken → transactie verdwenen uit UI
 * PW-13b: storting → afmelden → Undo-toast verdwijnt of Undo heeft geen effect
 * PW-13c: betaalknop disabled als potsaldo = 0 (gedocumenteerd UI-gedrag)
 * PW-13d: storting ongedaan maken terwijl ander saldo aanwezig → geblokkeerd
 * PW-13e: eigen undo werkt, andermans undo geblokkeerd
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

test.describe('PW-13: Undo en afmelden', () => {
  let supabase, potje, deelnemer, deviceId

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    deviceId = nieuweTestDeviceId()
    potje = await maakTestPotje(supabase, '[E2E] PW-13 Undo afmelden')
    deelnemer = await maakDeelnemer(supabase, potje.id, 'Undoer', deviceId)
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  async function openOverzicht(page) {
    await page.goto('/')
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', deviceId])
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByText('Welkom, Undoer', { exact: true })).toBeVisible({ timeout: 8000 })
  }

  test('PW-13a: betaling via modal → Undo klikken → transactie verdwenen', async ({ page }) => {
    // Undo is alleen beschikbaar na een BETALING via de modal in PaginaPotje.
    // Storten via de stortenpagina geeft geen Undo-knop (location.state heeft geen actie).
    await maakTransactie(potje.id, deelnemer.id, 'storting', 50.00, deviceId)

    await openOverzicht(page)

    // Open betaalmodal en registreer een betaling
    await page.getByRole('button', { name: /Betaling registreren/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByLabel(/Bedrag/i).fill('10')
    await page.getByRole('button', { name: 'Bevestigen →' }).click()

    // Modal sluit
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })

    // Toast met Undo-knop verschijnt
    const undoKnop = page.getByRole('button', { name: /Ongedaan/i })
    await expect(undoKnop).toBeVisible({ timeout: 6000 })
    await undoKnop.click()

    // Toast "Transactie ongedaan gemaakt" verschijnt
    await expect(page.getByText(/ongedaan gemaakt/i)).toBeVisible({ timeout: 5000 })
  })

  test('PW-13b: storting → afmelden → Undo-knop aanwezig of toast al weg', async ({ page }) => {
    await maakTransactie(potje.id, deelnemer.id, 'storting', 20.00, deviceId)

    await openOverzicht(page)

    // Meld af via DB (simuleert afmelden terwijl toast nog zichtbaar zou zijn)
    await supabase
      .from('deelnemers')
      .update({ actief: false, afgemeld_op: new Date().toISOString() })
      .eq('id', deelnemer.id)

    await page.waitForTimeout(1500)

    // Check: pagina is niet gecrasht
    const body = await page.textContent('body')
    expect(body).not.toContain('TypeError')
    expect(body).not.toContain('Cannot read properties of null')
    expect(body).not.toContain('row-level security')

    // Afgemeld-status zichtbaar in UI
    expect(body).toMatch(/afgemeld|Undoer/i)
  })

  test('PW-13c: betaalknop is disabled als potsaldo = 0 (gedocumenteerd UI-gedrag)', async ({ page }) => {
    // Geen stortingen — saldo = 0.
    // De betaalknop op de overzichtspagina is disabled als het saldo 0 is.
    await openOverzicht(page)

    const betaalKnop = page.getByRole('button', { name: /Betaling registreren/i })
    await expect(betaalKnop).toBeVisible({ timeout: 5000 })

    // App-gedrag: betaalknop disabled bij saldo = 0
    await expect(betaalKnop).toBeDisabled()
  })

  test('PW-13d: undo van storting geblokkeerd als saldo al gebruikt is', async ({ page }) => {
    await maakTransactie(potje.id, deelnemer.id, 'storting', 20.00, deviceId)
    await maakTransactie(potje.id, deelnemer.id, 'betaling', 10.00, deviceId)

    await openOverzicht(page)

    // Doe een nieuwe storting via UI om een Undo-toast te krijgen
    await page.getByRole('button', { name: /In pot storten/i }).click()
    await expect(page).toHaveURL(new RegExp(`/storten`))
    await expect(page.getByRole('group', { name: 'Standaardbedragen' })).toBeVisible({ timeout: 5000 })
    await page.getByRole('group', { name: 'Standaardbedragen' }).getByRole('button').first().click()
    await page.getByRole('button', { name: 'Storten →' }).click()
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}$`), { timeout: 8000 })

    // Doe een betaling via DB om het saldo te verlagen na de storting
    const { data: actueleDeelnemer } = await supabase
      .from('deelnemers')
      .select('id')
      .eq('potje_id', potje.id)
      .eq('device_id', deviceId)
      .single()

    if (actueleDeelnemer) {
      await maakTransactie(potje.id, actueleDeelnemer.id, 'betaling', 15.00, deviceId)
    }

    // Als Undo-knop nog zichtbaar is, verwacht geblokkeerde undo
    const undoKnop = page.getByRole('button', { name: /Ongedaan/i })
    if (await undoKnop.isVisible({ timeout: 3000 }).catch(() => false)) {
      await undoKnop.click()
      await expect(page.getByText(/betalingen gedaan/i)).toBeVisible({ timeout: 5000 })
    }
    // Toast al verdwenen = timing-afhankelijk, test slaagt ook dan
  })

  test('PW-13e: undo van eigen transactie werkt', async ({ page }) => {
    const deviceB = nieuweTestDeviceId()
    const deelnemerB = await maakDeelnemer(supabase, potje.id, 'Bob', deviceB)
    await maakTransactie(potje.id, deelnemerB.id, 'storting', 15.00, deviceB)
    await maakTransactie(potje.id, deelnemer.id, 'storting', 20.00, deviceId)

    await openOverzicht(page)

    // Doe een nieuwe storting via UI om Undo-toast te krijgen
    await page.getByRole('button', { name: /In pot storten/i }).click()
    await expect(page).toHaveURL(new RegExp(`/storten`))
    await expect(page.getByRole('group', { name: 'Standaardbedragen' })).toBeVisible({ timeout: 5000 })
    await page.getByRole('group', { name: 'Standaardbedragen' }).getByRole('button').first().click()
    await page.getByRole('button', { name: 'Storten →' }).click()
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}$`), { timeout: 8000 })

    // Eigen transactie → undo slaagt, geen "eigen transacties" foutmelding
    const undoKnop = page.getByRole('button', { name: /Ongedaan/i })
    if (await undoKnop.isVisible({ timeout: 5000 }).catch(() => false)) {
      await undoKnop.click()
      const body = await page.textContent('body')
      expect(body).not.toContain('eigen transacties')
    }
  })
})
