/**
 * e2e/pw12-twee-devices.spec.js — PW-12: Zelfde potje, twee devices
 *
 * Scenario: twee verschillende mensen (of dezelfde persoon op twee devices)
 * doen mee aan hetzelfde potje. Elk device heeft een unieke device_id en
 * krijgt een eigen deelnemerrecord.
 *
 * Dit dekt de situatie waarbij iemand de link naar anderen stuurt en zij
 * allemaal meedoen — het basisgebruikspatroon van Digipot.
 *
 * PW-12a: twee devices doen mee → beide zien de ander in de deelnemerstabel
 * PW-12b: device A stort → device B ziet saldo via realtime
 * PW-12c: device A en B proberen zelfde naam → tweede krijgt foutmelding
 * PW-12d: device A meldt zich af → device B ziet de afmelding
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

test.describe('PW-12: Twee devices, zelfde potje', () => {
  let supabase, potje, deviceA, deviceB, deelnemerA, deelnemerB

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    deviceA = nieuweTestDeviceId()
    deviceB = nieuweTestDeviceId()
    potje = await maakTestPotje(supabase, '[E2E] PW-12 Twee devices')
    deelnemerA = await maakDeelnemer(supabase, potje.id, 'Alice', deviceA)
    deelnemerB = await maakDeelnemer(supabase, potje.id, 'Bob', deviceB)
    await maakTransactie(potje.id, deelnemerA.id, 'storting', 25.00, deviceA)
    await maakTransactie(potje.id, deelnemerB.id, 'storting', 25.00, deviceB)
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  test('PW-12a: device A ziet device B in de deelnemerstabel', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', deviceA])
    await page.goto(`/potje/${potje.id}`)

    await expect(page.getByText('Welkom, Alice', { exact: true })).toBeVisible({ timeout: 8000 })

    // Bob staat ook in de tabel
    await expect(page.getByRole('cell', { name: /Bob/i })).toBeVisible()
  })

  test('PW-12b: device A stort → device B ziet bijgewerkt saldo via realtime', async ({ browser }) => {
    test.setTimeout(60000) // Realtime kan in CI trager zijn
    // Open twee browsers: één als Alice, één als Bob
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    try {
      // Beide devices naar het overzicht
      await pageA.goto('/')
      await pageA.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', deviceA])
      await pageA.goto(`/potje/${potje.id}`)
      await expect(pageA.getByText('Welkom, Alice', { exact: true })).toBeVisible({ timeout: 8000 })

      await pageB.goto('/')
      await pageB.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', deviceB])
      await pageB.goto(`/potje/${potje.id}`)
      await expect(pageB.getByText('Welkom, Bob', { exact: true })).toBeVisible({ timeout: 8000 })

      // Alice doet een betaling
      await maakTransactie(potje.id, deelnemerA.id, 'betaling', 10.00, deviceA)

      // Bob's pagina moet via realtime de betaling zien (saldo daalt)
      // Wacht op een UI-update die de betaling weerspiegelt
      await expect(pageB.getByRole('cell', { name: /€ 10,00/i })).toBeVisible({ timeout: 20000 })
    } finally {
      await contextA.close()
      await contextB.close()
    }
  })

  test('PW-12c: twee devices proberen zelfde naam → tweede krijgt foutmelding', async ({ page }) => {
    // Maak een derde device dat probeert te deelnemen als "Alice" (al bezet)
    const deviceC = nieuweTestDeviceId()
    await page.goto('/')
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', deviceC])
    await page.goto(`/potje/${potje.id}`)

    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })

    await page.getByLabel(/Jouw naam/i).fill('Alice')
    await page.getByRole('button', { name: /Meedoen/i }).click()

    // Foutmelding: naam al bezet
    await expect(page.getByText(/al bezet/i)).toBeVisible({ timeout: 4000 })
    await expect(page).toHaveURL(new RegExp(`/potje/${potje.id}$`))
  })

  test('PW-12d: device A meldt zich af → device B ziet afmelding in deelnemerstabel', async ({ browser }) => {
    test.setTimeout(60000) // Realtime kan in CI trager zijn
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    try {
      // Bob opent het overzicht
      await pageB.goto('/')
      await pageB.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', deviceB])
      await pageB.goto(`/potje/${potje.id}`)
      await expect(pageB.getByText('Welkom, Bob', { exact: true })).toBeVisible({ timeout: 8000 })

      // Alice meldt zich af via de DB — client met Alice's device_id voor RLS
      const supabaseAlice = maakSupabaseClient(deviceA)
      await supabaseAlice
        .from('deelnemers')
        .update({ actief: false, afgemeld_op: new Date().toISOString() })
        .eq('id', deelnemerA.id)

      // Bob's pagina moet via realtime de afmelding van Alice zien.
      // De <tr> van Alice krijgt de CSS-klasse deelnemer-rij--afgemeld.
      // Realtime kan in CI 5-10s nodig hebben om de wijziging te propageren.
      await expect(
        pageB.locator('tr.deelnemer-rij--afgemeld').filter({ hasText: /Alice/i })
      ).toBeVisible({ timeout: 25000 })
    } finally {
      await contextA.close()
      await contextB.close()
    }
  })
})
