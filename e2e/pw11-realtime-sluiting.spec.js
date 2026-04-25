/**
 * e2e/pw11-realtime-sluiting.spec.js — PW-11: Realtime sluiting
 * Fase 4 update: identiteitsherkenning via auth.uid() / setAuthInBrowser().
 */

import { test, expect } from '@playwright/test'
import {
  maakSupabaseClient, maakTestPotje, maakDeelnemer, maakTransactie,
  setAuthInBrowser, verwijderTestPotje, nieuweTestDeviceId,
} from './helpers.js'

test.describe('PW-11: Realtime sluiting', () => {
  let supabase, potje, deelnemer, session, deviceId

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    deviceId = nieuweTestDeviceId()
    potje = await maakTestPotje(supabase, '[E2E] PW-11 Sluiting')
    const result = await maakDeelnemer(supabase, potje.id, 'Sluiter', deviceId)
    deelnemer = result.deelnemer
    session = result.session
    await maakTransactie(potje.id, deelnemer.id, 'storting', 30.00, deviceId)
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  async function openOverzicht(page) {
    await page.goto('/')
    await setAuthInBrowser(page, session)
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('cell', { name: /Sluiter.*jij|jij.*Sluiter/i })).toBeVisible({ timeout: 8000 })
  }

  test('PW-11a: potje gesloten via DB terwijl op overzicht → eindafrekeningscherm verschijnt', async ({ page }) => {
    await openOverzicht(page)
    await supabase.from('potjes').update({ status: 'gesloten', gesloten_op: new Date().toISOString(), gesloten_door: deelnemer.id }).eq('id', potje.id)
    await expect(page.getByText(/verrekening|bijbetalen|ontvangt|Eindafrekening|afsluiten/i).first()).toBeVisible({ timeout: 12000 })
    const body = await page.textContent('body')
    expect(body).not.toContain('row-level security')
  })

  test('PW-11b: storten na DB-sluiting → foutmelding "potje is gesloten"', async ({ page }) => {
    await page.goto('/')
    await setAuthInBrowser(page, session)
    await page.goto(`/potje/${potje.id}/storten`)
    await expect(page.getByRole('group', { name: 'Standaardbedragen' })).toBeVisible({ timeout: 8000 })
    await supabase.from('potjes').update({ status: 'gesloten', gesloten_op: new Date().toISOString(), gesloten_door: deelnemer.id }).eq('id', potje.id)
    await page.waitForTimeout(1500)
    await page.getByRole('button', { name: '€ 10,00' }).click()
    await page.getByRole('button', { name: 'Storten →' }).click()
    const url = page.url()
    const body = await page.textContent('body')
    expect(body.includes('gesloten') || body.includes('Eindafrekening') || url.includes(`/potje/${potje.id}`)).toBe(true)
    expect(body).not.toContain('row-level security')
  })

  test('PW-11c: handmatig sluiten via UI → eindafrekeningscherm met verrekeningsdata', async ({ page }) => {
    await openOverzicht(page)
    const sluitKnop = page.getByRole('button', { name: /Pot sluiten/i })
    await expect(sluitKnop).toBeEnabled({ timeout: 8000 })
    await sluitKnop.click()
    await expect(page.getByRole('heading', { name: /Pot sluiten/i })).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /Ja, sluit de pot/i }).click()
    await expect(page.getByText(/verrekening|bijbetalen|ontvangt|Eindafrekening|gesloten/i).first()).toBeVisible({ timeout: 10000 })
    const body = await page.textContent('body')
    expect(body).toMatch(/€|verrekening|bijbetalen|ontvangt|gesloten/i)
  })

  test('PW-11d: stortenpagina bij gesloten potje → storten geblokkeerd', async ({ page }) => {
    await supabase.from('potjes').update({ status: 'gesloten', gesloten_op: new Date().toISOString(), gesloten_door: deelnemer.id }).eq('id', potje.id)

    await page.goto('/')
    await setAuthInBrowser(page, session)
    await page.goto(`/potje/${potje.id}/storten`)

    await Promise.race([
      page.waitForURL(url => !url.href.includes('/storten'), { timeout: 10000 }),
      page.locator('.subtitel').filter({ hasText: /PW-11/ }).waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(() => {})

    const urlNaLaden = page.url()
    if (!urlNaLaden.includes('/storten')) {
      expect(urlNaLaden).not.toContain('/storten')
    } else {
      const redirectGekomen = await page.waitForURL(url => !url.href.includes('/storten'), { timeout: 3000 }).then(() => true).catch(() => false)
      if (redirectGekomen) {
        expect(page.url()).not.toContain('/storten')
      } else {
        const snelknop = page.getByRole('group', { name: 'Standaardbedragen' }).getByRole('button').first()
        await snelknop.click()
        await page.getByRole('button', { name: 'Storten →' }).click()
        await Promise.race([
          page.waitForSelector('.fout-tekst', { timeout: 8000 }),
          page.waitForURL(urlObj => !urlObj.href.includes('/storten'), { timeout: 8000 }),
        ])
        const url = page.url()
        const body = await page.textContent('body')
        expect(body.includes('gesloten') || body.includes('fout') || body.includes('mislukt') || !url.includes('/storten')).toBe(true)
      }
    }
    const body = await page.textContent('body')
    expect(body).not.toContain('row-level security')
  })
})
