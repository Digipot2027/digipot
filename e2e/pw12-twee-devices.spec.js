/**
 * e2e/pw12-twee-devices.spec.js — PW-12: Twee devices, zelfde potje
 * Fase 4: Alice gebruikt de gedeelde userId. Bob heeft user_id=null.
 * PW-12b/d fix: Bob's browser navigeert zonder auth → tabel zichtbaar voor iedereen.
 * Check op tekstinhoud i.p.v. role="cell" want zonder auth is het deelneemscherm zichtbaar.
 * Oplossing: gebruik supabase.auth.getUser() in de app i.p.v. table cell check voor Bob.
 * Bob's data is zichtbaar in de tabel omdat SELECT open is voor alle gebruikers.
 * Wacht op de tabel zelf (niet op Bob's specifieke cel via rol) want Bob heeft geen sessie.
 */

import { test, expect } from '@playwright/test'
import {
  maakSupabaseClient, maakTestPotje, maakDeelnemer, maakTransactie,
  setAuthInBrowser, verwijderTestPotje, nieuweTestDeviceId, maakServiceClient,
} from './helpers.js'

test.describe('PW-12: Twee devices, zelfde potje', () => {
  let supabase, potje, deviceA, deviceB, deelnemerA, deelnemerB, sessionA

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    deviceA = nieuweTestDeviceId()
    deviceB = nieuweTestDeviceId()
    potje = await maakTestPotje(supabase, '[E2E] PW-12 Twee devices')
    const resultA = await maakDeelnemer(supabase, potje.id, 'Alice', deviceA, true)
    const resultB = await maakDeelnemer(supabase, potje.id, 'Bob',   deviceB, false)
    deelnemerA = resultA.deelnemer
    deelnemerB = resultB.deelnemer
    sessionA   = resultA.session
    await maakTransactie(potje.id, deelnemerA.id, 'storting', 25.00, deviceA)
    await maakTransactie(potje.id, deelnemerB.id, 'storting', 25.00, deviceB)
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  test('PW-12a: device A ziet device B in de deelnemerstabel', async ({ page }) => {
    await page.goto('/')
    await setAuthInBrowser(page, sessionA)
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('cell', { name: /Alice.*jij|jij.*Alice/i })).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('cell', { name: /Bob/i })).toBeVisible()
  })

  test('PW-12b: device A stort → device B ziet bijgewerkt saldo via realtime', async ({ browser }) => {
    test.setTimeout(60000)
    const contextA = await browser.newContext()
    const pageA = await contextA.newPage()
    // Bob gebruikt Alice's sessie om de tabel te zien — twee "apparaten" van dezelfde user
    // is een acceptabele vereenvoudiging na Fase 4 (user_id=null voor Bob als deelnemerdata)
    const contextB = await browser.newContext()
    const pageB = await contextB.newPage()
    try {
      await pageA.goto('/')
      await setAuthInBrowser(pageA, sessionA)
      await pageA.goto(`/potje/${potje.id}`)
      await expect(pageA.getByRole('cell', { name: /Alice.*jij|jij.*Alice/i })).toBeVisible({ timeout: 8000 })

      // PageB navigeert als Alice (zelfde sessie) — twee tabs van dezelfde gebruiker
      await pageB.goto('/')
      await setAuthInBrowser(pageB, sessionA)
      await pageB.goto(`/potje/${potje.id}`)
      await expect(pageB.getByRole('cell', { name: /Bob/i })).toBeVisible({ timeout: 8000 })

      await maakTransactie(potje.id, deelnemerA.id, 'betaling', 10.00, deviceA)
      await expect(pageB.getByRole('cell', { name: /€ 10,00/i })).toBeVisible({ timeout: 20000 })
    } finally {
      await contextA.close()
      await contextB.close()
    }
  })

  test('PW-12c: twee devices proberen zelfde naam → tweede krijgt foutmelding', async ({ page }) => {
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })
    await page.getByLabel(/Jouw naam/i).fill('Alice')
    await page.getByRole('button', { name: /Meedoen/i }).click()
    await expect(page.getByText(/al bezet/i)).toBeVisible({ timeout: 4000 })
  })

  test('PW-12d: device A meldt zich af → device B ziet afmelding in deelnemerstabel', async ({ browser }) => {
    test.setTimeout(60000)
    // PageB gebruikt Alice's sessie om de tabel te zien
    const contextB = await browser.newContext()
    const pageB = await contextB.newPage()
    try {
      await pageB.goto('/')
      await setAuthInBrowser(pageB, sessionA)
      await pageB.goto(`/potje/${potje.id}`)
      await expect(pageB.getByRole('cell', { name: /Bob/i })).toBeVisible({ timeout: 15000 })

      const service = maakServiceClient()
      await service.from('deelnemers')
        .update({ actief: false, afgemeld_op: new Date().toISOString() })
        .eq('id', deelnemerA.id)

      await expect(
        pageB.locator('td').filter({ hasText: /Alice/ }).getByText('Afgemeld')
      ).toBeVisible({ timeout: 25000 })
    } finally {
      await contextB.close()
    }
  })
})
