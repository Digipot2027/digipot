/**
 * e2e/pw9-terugkerende-deelnemer.spec.js — PW-9: Terugkerende deelnemer
 *
 * Scenario: iemand opent een potje-link opnieuw op hetzelfde device.
 * De device_id staat al in localStorage én in de DB — de app moet de
 * deelnemer herkennen en direct het overzicht tonen, zonder deelneemscherm.
 *
 * Dit is het meest voorkomende scenario bij meerdere sessies over meerdere
 * dagen: je hebt gisteren meegedaan, opent de link vandaag opnieuw.
 *
 * PW-9a: terugkerende deelnemer → direct overzicht, geen modal
 * PW-9b: terugkerende deelnemer → naam zichtbaar in UI
 * PW-9c: terugkerende deelnemer → storten-knop bereikbaar (niet geblokkeerd)
 * PW-9d: ander device, zelfde potje → deelneemscherm getoond (nieuwe deelnemer)
 * PW-9e: terugkerende afgemelde deelnemer → overzicht zichtbaar, knoppen disabled
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

    // Deelneemscherm mag NIET verschijnen
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).not.toBeVisible({ timeout: 3000 })

    // Overzicht WEL zichtbaar
    await expect(page.getByText('Welkom, Terugkomer', { exact: true })).toBeVisible({ timeout: 8000 })
  })

  test('PW-9b: terugkerende deelnemer → eigen naam zichtbaar met "(jij)" badge', async ({ page }) => {
    await setDeviceId(page)
    await page.goto(`/potje/${potje.id}`)

    await expect(page.getByText('Welkom, Terugkomer', { exact: true })).toBeVisible({ timeout: 8000 })

    // Naam met (jij)-suffix staat in de deelnemerstabel
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
    // Nieuw device_id — dit device kent het potje niet
    const anderDeviceId = nieuweTestDeviceId()
    await page.goto('/')
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', anderDeviceId])

    await page.goto(`/potje/${potje.id}`)

    // Deelneemscherm MOET verschijnen voor het nieuwe device
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })
  })

  test('PW-9e: terugkerende afgemelde deelnemer → overzicht zichtbaar, storten-knop afwezig of geblokkeerd', async ({ page }) => {
    // Meld de deelnemer af via de DB
    await supabase
      .from('deelnemers')
      .update({ actief: false, afgemeld_op: new Date().toISOString() })
      .eq('id', deelnemer.id)

    await setDeviceId(page)
    await page.goto(`/potje/${potje.id}`)

    // Overzicht WEL zichtbaar (afgemelde deelnemers zien het overzicht nog)
    await expect(page.getByText('Welkom, Terugkomer', { exact: true })).toBeVisible({ timeout: 8000 })

    // Storten-knop is afwezig of leidt niet naar het stortenscherm.
    // De app verbergt de knop voor afgemelde deelnemers (ikBenActief = false).
    // Als de knop toch zichtbaar is, mag navigeren naar /storten niet tot een
    // werkend formulier leiden.
    const stortenKnop = page.getByRole('button', { name: /In pot storten/i })
    const knopZichtbaar = await stortenKnop.isVisible({ timeout: 2000 }).catch(() => false)
    if (knopZichtbaar) {
      // Knop zichtbaar → klik erop en verwacht dat storten geblokkeerd wordt
      await stortenKnop.click()
      // Na klik: ofwel op stortenpagina maar formulier uitgeschakeld,
      // ofwel geen navigatie
      await page.waitForTimeout(1000)
      const url = page.url()
      if (url.includes('/storten')) {
        // Storten-knop op de stortenpagina zelf moet disabled zijn
        await expect(page.getByRole('button', { name: 'Storten →' })).toBeDisabled()
      }
    }
    // Knop afwezig = correct gedrag, test slaagt
  })
})
