/**
 * e2e/pw6-responsive.spec.js — PW-6: Responsive gedrag op kritieke viewports
 *
 * Fix v2: potjenaam verkort tot max 30 tekens (DB-constraint potjes_naam_check).
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

const VIEWPORTS = [
  { naam: 'klein-mobiel', breedte: 320, hoogte: 568 },
  { naam: 'mobiel',       breedte: 375, hoogte: 812 },
  { naam: 'tablet',       breedte: 768, hoogte: 1024 },
  { naam: 'desktop',      breedte: 1440, hoogte: 900 },
]

test.describe('PW-6: Responsive gedrag', () => {
  let supabase, potje, deelnemer, deviceId

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    deviceId = nieuweTestDeviceId()
    // Naam max 30 tekens (DB-constraint)
    potje = await maakTestPotje(supabase, '[E2E] PW-6 Responsive')
    deelnemer = await maakDeelnemer(supabase, potje.id, 'LangeDeelnemersnaam', deviceId)
    await maakTransactie(potje.id, deelnemer.id, 'storting', 25.00, deviceId)
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  for (const vp of VIEWPORTS) {
    test(`PW-6a [${vp.naam} ${vp.breedte}px]: deelnemerstabel zichtbaar`, async ({ page }) => {
      await page.setViewportSize({ width: vp.breedte, height: vp.hoogte })
      await page.goto('/')
      await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', deviceId])
      await page.goto(`/potje/${potje.id}`)

      await expect(page.getByRole('table', { name: 'Deelnemersoverzicht' })).toBeVisible({ timeout: 8000 })

      const tabelBreedte = await page.evaluate(() => {
        const tabel = document.querySelector('table[aria-label="Deelnemersoverzicht"]')
        return tabel?.getBoundingClientRect().width ?? 0
      })
      expect(tabelBreedte).toBeGreaterThan(0)
      expect(tabelBreedte).toBeLessThanOrEqual(vp.breedte)
    })

    test(`PW-6b [${vp.naam} ${vp.breedte}px]: storten- en betaalknop zichtbaar en niet overlappend`, async ({ page }) => {
      await page.setViewportSize({ width: vp.breedte, height: vp.hoogte })
      await page.goto('/')
      await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', deviceId])
      await page.goto(`/potje/${potje.id}`)

      const stortenKnop = page.getByRole('button', { name: /In pot storten/i })
      const betaalKnop  = page.getByRole('button', { name: /Betaling registreren/i })

      await expect(stortenKnop).toBeVisible({ timeout: 8000 })
      await expect(betaalKnop).toBeVisible()

      const stortenBox = await stortenKnop.boundingBox()
      const betaalBox  = await betaalKnop.boundingBox()
      expect(stortenBox).not.toBeNull()
      expect(betaalBox).not.toBeNull()

      const overlapt = stortenBox.x + stortenBox.width > betaalBox.x + 2 &&
                       betaalBox.x + betaalBox.width > stortenBox.x + 2 &&
                       stortenBox.y + stortenBox.height > betaalBox.y + 2 &&
                       betaalBox.y + betaalBox.height > stortenBox.y + 2
      expect(overlapt).toBe(false)
    })
  }

  test('PW-6c [klein-mobiel 320px]: stortenpagina — snelknoppen zichtbaar', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto('/')
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', deviceId])
    await page.goto(`/potje/${potje.id}/storten`)

    const groep = page.getByRole('group', { name: 'Standaardbedragen' })
    await expect(groep).toBeVisible({ timeout: 8000 })

    const knoppen = groep.getByRole('button')
    await expect(knoppen).toHaveCount(4)

    const eersteBox = await knoppen.first().boundingBox()
    expect(eersteBox.x).toBeGreaterThanOrEqual(0)
    expect(eersteBox.x + eersteBox.width).toBeLessThanOrEqual(322)
  })

  test('PW-6d [mobiel 375px]: kaarten steken niet buiten viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', deviceId])
    await page.goto(`/potje/${potje.id}`)

    await expect(page.getByText('Welkom, LangeDeelnemersnaam')).toBeVisible({ timeout: 8000 })

    const maxRechts = await page.evaluate(() => {
      const kaarten = document.querySelectorAll('.kaart')
      return Math.max(...[...kaarten].map(k => k.getBoundingClientRect().right))
    })
    expect(maxRechts).toBeLessThanOrEqual(379) // 375 + 4px marge
  })
})
