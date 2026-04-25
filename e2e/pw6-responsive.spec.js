/**
 * e2e/pw6-responsive.spec.js — PW-6: Responsive gedrag
 * Fase 4 update: identiteitsherkenning via auth.uid() / setAuthInBrowser().
 */

import { test, expect } from '@playwright/test'
import {
  maakSupabaseClient, maakTestPotje, maakDeelnemer, maakTransactie,
  setAuthInBrowser, verwijderTestPotje, nieuweTestDeviceId,
} from './helpers.js'

const VIEWPORTS = [
  { naam: 'klein-mobiel', breedte: 320, hoogte: 568 },
  { naam: 'mobiel',       breedte: 375, hoogte: 812 },
  { naam: 'tablet',       breedte: 768, hoogte: 1024 },
  { naam: 'desktop',      breedte: 1440, hoogte: 900 },
]

test.describe('PW-6: Responsive gedrag', () => {
  let supabase, potje, deelnemer, session, deviceId

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    deviceId = nieuweTestDeviceId()
    potje = await maakTestPotje(supabase, '[E2E] PW-6 Responsive')
    const result = await maakDeelnemer(supabase, potje.id, 'LangeDeelnemersnaam', deviceId)
    deelnemer = result.deelnemer
    session = result.session
    await maakTransactie(potje.id, deelnemer.id, 'storting', 25.00, deviceId)
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  for (const vp of VIEWPORTS) {
    test(`PW-6a [${vp.naam} ${vp.breedte}px]: deelnemerstabel zichtbaar`, async ({ page }) => {
      await page.setViewportSize({ width: vp.breedte, height: vp.hoogte })
      await page.goto('/')
      await setAuthInBrowser(page, session)
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
      await setAuthInBrowser(page, session)
      await page.goto(`/potje/${potje.id}`)
      const stortenKnop = page.getByRole('button', { name: /^Storten$/i })
      const betaalKnop  = page.getByRole('button', { name: /^Betaling$/i })
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
    await setAuthInBrowser(page, session)
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
    await setAuthInBrowser(page, session)
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('cell', { name: /LangeDeelnemersnaam.*jij|jij.*LangeDeelnemersnaam/i })).toBeVisible({ timeout: 8000 })
    const maxRechts = await page.evaluate(() => {
      const kaarten = document.querySelectorAll('.kaart')
      return Math.max(...[...kaarten].map(k => k.getBoundingClientRect().right))
    })
    expect(maxRechts).toBeLessThanOrEqual(379)
  })

  test('PW-6e [klein-mobiel 320px]: action-list rijen zichtbaar en niet overlappend', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto('/')
    await setAuthInBrowser(page, session)
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('cell', { name: /LangeDeelnemersnaam.*jij|jij.*LangeDeelnemersnaam/i })).toBeVisible({ timeout: 8000 })
    const afmeldenKnop = page.getByRole('button', { name: /Afmelden/i })
    const sluitKnop    = page.getByRole('button', { name: /Pot sluiten/i })
    await expect(afmeldenKnop).toBeVisible()
    await expect(sluitKnop).toBeVisible()
    const afmeldenBox = await afmeldenKnop.boundingBox()
    const sluitBox    = await sluitKnop.boundingBox()
    expect(afmeldenBox.y).toBeLessThan(sluitBox.y)
    expect(afmeldenBox.y + afmeldenBox.height).toBeLessThanOrEqual(sluitBox.y + 60)
    expect(afmeldenBox.x + afmeldenBox.width).toBeLessThanOrEqual(322)
    expect(sluitBox.x + sluitBox.width).toBeLessThanOrEqual(322)
  })
})
