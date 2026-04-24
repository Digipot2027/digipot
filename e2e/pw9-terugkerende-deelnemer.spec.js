/**
 * e2e/pw9-terugkerende-deelnemer.spec.js — PW-9: Terugkerende deelnemer
 *
 * PW-9a: terugkerende deelnemer → direct overzicht, geen deelneemscherm
 * PW-9b: terugkerende deelnemer → naam zichtbaar in UI
 * PW-9c: terugkerende deelnemer → storten-knop bereikbaar
 * PW-9d: ander device, zelfde potje → deelneemscherm getoond
 * PW-9e: afgemelde deelnemer → storten-knop disabled (via UI-afmeldflow)
 * PW-9f: afgemelde deelnemer → URL-hack /storten → actief-guard toont foutmelding
 *
 * Bijgewerkt (2026-04-24):
 * - PW-9e en PW-9f: tweede deelnemer toegevoegd zodat afmelden het potje
 *   niet sluit (zombie-preventie trigger). Zonder tweede deelnemer sluit
 *   de DB-trigger het potje direct bij afmelding van de laatste actieve
 *   deelnemer, waarna de app naar de eindafrekening navigeert.
 * - PW-9f: afmelden via UI (niet via directe DB-update) — realtime vanuit
 *   test-client triggert de app-subscriptie niet betrouwbaar.
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

  test('PW-9a: terugkerende deelnemer → direct overzicht, geen deelneemscherm', async ({ page }) => {
    await setDeviceId(page)
    await page.goto(`/potje/${potje.id}`)

    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).not.toBeVisible({ timeout: 3000 })
    await expect(page.getByText('Welkom, Terugkomer', { exact: true })).toBeVisible({ timeout: 8000 })
  })

  test('PW-9b: terugkerende deelnemer → eigen naam zichtbaar met "(jij)" badge', async ({ page }) => {
    await setDeviceId(page)
    await page.goto(`/potje/${potje.id}`)

    await expect(page.getByText('Welkom, Terugkomer', { exact: true })).toBeVisible({ timeout: 8000 })
    await expect(page.getByText(/Terugkomer.*jij|jij.*Terugkomer/i)).toBeVisible()
  })

  test('PW-9c: terugkerende deelnemer → storten-knop aanwezig en klikbaar', async ({ page }) => {
    await setDeviceId(page)
    await page.goto(`/potje/${potje.id}`)

    await expect(page.getByText('Welkom, Terugkomer', { exact: true })).toBeVisible({ timeout: 8000 })

    const stortenKnop = page.getByRole('button', { name: /In pot storten/i })
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
    // Voeg een tweede deelnemer toe zodat afmelden het potje niet sluit.
    // Zonder tweede deelnemer triggert de zombie-preventie DB-trigger en
    // navigeert de app naar de eindafrekening in plaats van het overzicht.
    const andereDeviceId = nieuweTestDeviceId()
    const tweedeDeelnemer = await maakDeelnemer(supabase, potje.id, 'Medewerker', andereDeviceId)
    await maakTransactie(potje.id, tweedeDeelnemer.id, 'storting', 10.00, andereDeviceId)

    await setDeviceId(page)
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByText('Welkom, Terugkomer', { exact: true })).toBeVisible({ timeout: 8000 })

    // Afmelden via de UI — de app doet de DB-update, React-state wordt direct bijgewerkt
    await page.getByRole('button', { name: /Jezelf afmelden/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: /Ja, meld me af/i }).click()

    // Wacht op de afgemeld-badge in de header-kaart (specifieke selector)
    await expect(page.locator('.badge.badge-afgemeld').first()).toBeVisible({ timeout: 8000 })

    // Storten-knop is nu disabled
    await expect(page.getByRole('button', { name: /In pot storten/i })).toBeDisabled()
  })

  test('PW-9f: afgemelde deelnemer → URL-hack /storten → actief-guard toont foutmelding', async ({ page }) => {
    // Tweede deelnemer zodat afmelden het potje niet sluit
    const andereDeviceId = nieuweTestDeviceId()
    const tweedeDeelnemer = await maakDeelnemer(supabase, potje.id, 'Medewerker', andereDeviceId)
    await maakTransactie(potje.id, tweedeDeelnemer.id, 'storting', 10.00, andereDeviceId)

    await setDeviceId(page)
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByText('Welkom, Terugkomer', { exact: true })).toBeVisible({ timeout: 8000 })

    // Afmelden via UI — betrouwbaarder dan directe DB-update voor realtime
    await page.getByRole('button', { name: /Jezelf afmelden/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: /Ja, meld me af/i }).click()

    // Wacht op afgemeld-staat
    await expect(page.locator('.badge.badge-afgemeld').first()).toBeVisible({ timeout: 8000 })

    // Navigeer direct naar stortenpagina (URL-hack)
    await page.goto(`/potje/${potje.id}/storten`)
    await expect(page.getByRole('group', { name: 'Standaardbedragen' })).toBeVisible()

    // Kies bedrag en probeer te storten
    await page.getByRole('button', { name: '€ 10,00', exact: true }).click()
    await page.getByRole('button', { name: /storten →/i }).click()

    // Actief-guard toont foutmelding — geen navigatie
    await expect(page.getByRole('alert')).toContainText('afgemeld')
    await expect(page).toHaveURL(new RegExp(`/storten$`))
  })
})
