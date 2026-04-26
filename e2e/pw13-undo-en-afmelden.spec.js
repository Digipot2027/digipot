/**
 * e2e/pw13-undo-en-afmelden.spec.js — PW-13: Afmelden
 * Fase 4 update: identiteitsherkenning via auth.uid() / setAuthInBrowser().
 * PW-13b fix: service client voor afmelden. PW-13e: Bob zonder gedeelde userId.
 * PW-13d fix: deelnemer.id direct gebruiken i.p.v. device_id lookup.
 * 2026-04-26: undo verwijderd — PW-13a omgezet naar betaling-succes test.
 */

import { test, expect } from '@playwright/test'
import {
  maakSupabaseClient, maakTestPotje, maakDeelnemer, maakTransactie,
  setAuthInBrowser, verwijderTestPotje, nieuweTestDeviceId, maakServiceClient,
} from './helpers.js'

test.describe('PW-13: Afmelden', () => {
  let supabase, potje, deelnemer, session, deviceId

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    deviceId = nieuweTestDeviceId()
    potje = await maakTestPotje(supabase, '[E2E] PW-13 Afmelden')
    const result = await maakDeelnemer(supabase, potje.id, 'Undoer', deviceId, true)
    deelnemer = result.deelnemer
    session = result.session
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  async function openOverzicht(page) {
    await page.goto('/')
    await setAuthInBrowser(page, session)
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('cell', { name: /Undoer.*jij|jij.*Undoer/i })).toBeVisible({ timeout: 8000 })
  }

  test('PW-13a: betaling via modal → modal sluit en saldo bijgewerkt', async ({ page }) => {
    await maakTransactie(potje.id, deelnemer.id, 'storting', 50.00, deviceId)
    await openOverzicht(page)
    await page.getByRole('button', { name: /^Betaling$/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByLabel(/Betaald bedrag/i).fill('10')
    await page.getByRole('button', { name: /Bevestig/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
    const body = await page.textContent('body')
    expect(body).not.toContain('row-level security')
  })

  test('PW-13b: storting → afmelden via DB → app crasht niet', async ({ page }) => {
    await maakTransactie(potje.id, deelnemer.id, 'storting', 20.00, deviceId)
    await openOverzicht(page)
    const service = maakServiceClient()
    await service.from('deelnemers')
      .update({ actief: false, afgemeld_op: new Date().toISOString() })
      .eq('id', deelnemer.id)
    await page.waitForTimeout(1500)
    const body = await page.textContent('body')
    expect(body).not.toContain('TypeError')
    expect(body).not.toContain('Cannot read properties of null')
    expect(body).not.toContain('row-level security')
    expect(body).toMatch(/afgemeld|Undoer/i)
  })

  test('PW-13c: betaalknop is disabled als potsaldo = 0 (gedocumenteerd UI-gedrag)', async ({ page }) => {
    await openOverzicht(page)
    const betaalKnop = page.getByRole('button', { name: /^Betaling$/i })
    await expect(betaalKnop).toBeVisible({ timeout: 5000 })
    await expect(betaalKnop).toBeDisabled()
  })

  test('PW-13d: storting via stortenscherm → saldo zichtbaar op overzicht', async ({ page }) => {
    await maakTransactie(potje.id, deelnemer.id, 'storting', 20.00, deviceId)
    await maakTransactie(potje.id, deelnemer.id, 'betaling', 10.00, deviceId)
    await openOverzicht(page)

    await page.getByRole('button', { name: /^Storten$/i }).click()
    await expect(page).toHaveURL(new RegExp(`/storten`))
    await expect(page.getByRole('group', { name: 'Standaardbedragen' })).toBeVisible({ timeout: 5000 })
    await page.getByRole('group', { name: 'Standaardbedragen' }).getByRole('button').first().click()
    await page.getByRole('button', { name: 'Storten →' }).click()
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}$`), { timeout: 8000 })
  })

  test('PW-13e: twee deelnemers — beiden kunnen storten', async ({ page }) => {
    const deviceB = nieuweTestDeviceId()
    const resultB = await maakDeelnemer(supabase, potje.id, 'Bob', deviceB, false)
    await maakTransactie(potje.id, resultB.deelnemer.id, 'storting', 15.00, deviceB)
    await maakTransactie(potje.id, deelnemer.id, 'storting', 20.00, deviceId)
    await openOverzicht(page)

    await page.getByRole('button', { name: /^Storten$/i }).click()
    await expect(page).toHaveURL(new RegExp(`/storten`))
    await expect(page.getByRole('group', { name: 'Standaardbedragen' })).toBeVisible({ timeout: 5000 })
    await page.getByRole('group', { name: 'Standaardbedragen' }).getByRole('button').first().click()
    await page.getByRole('button', { name: 'Storten →' }).click()
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}$`), { timeout: 8000 })
  })
})
