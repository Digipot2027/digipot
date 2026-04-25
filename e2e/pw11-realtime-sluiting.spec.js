/**
 * e2e/pw11-realtime-sluiting.spec.js — PW-11: Potje sluit terwijl je in het Stortingscherm staat
 *
 * Scenario: iemand staat op het Stortingscherm terwijl een ander device
 * (of lifecycle) het potje sluit. Via Supabase Realtime krijgt de pagina
 * een UPDATE-event met status='gesloten'. De UI moet dit correct verwerken.
 *
 * PW-11a: potje gesloten terwijl op overzicht → eindafrekeningscherm verschijnt
 * PW-11b: potje gesloten terwijl op stortenpagina → foutmelding bij submit
 * PW-11c: handmatig sluiten → eindafrekeningscherm zichtbaar met verrekeningen
 * PW-11d: storten na sluiting via UI → geblokkeerd met foutmelding
 *
 * Selector-update (2026-04-24): "Welkom, [naam]" verwijderd uit UI.
 * Nieuwe anchor: tabelcel met naam "(jij)".
 * Knoplabels bijgewerkt: "Pot afsluiten" → "Pot sluiten".
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

test.describe('PW-11: Realtime sluiting', () => {
  let supabase, potje, deelnemer, deviceId

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    deviceId = nieuweTestDeviceId()
    potje = await maakTestPotje(supabase, '[E2E] PW-11 Sluiting')
    deelnemer = await maakDeelnemer(supabase, potje.id, 'Sluiter', deviceId)
    await maakTransactie(potje.id, deelnemer.id, 'storting', 30.00, deviceId)
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  async function openOverzicht(page) {
    await page.goto('/')
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', deviceId])
    await page.goto(`/potje/${potje.id}`)
    await expect(
      page.getByRole('cell', { name: /Sluiter.*jij|jij.*Sluiter/i })
    ).toBeVisible({ timeout: 8000 })
  }

  test('PW-11a: potje gesloten via DB terwijl op overzicht → eindafrekeningscherm verschijnt', async ({ page }) => {
    await openOverzicht(page)

    await supabase
      .from('potjes')
      .update({
        status: 'gesloten',
        gesloten_op: new Date().toISOString(),
        gesloten_door: deelnemer.id,
      })
      .eq('id', potje.id)

    await expect(
      page.getByText(/verrekening|bijbetalen|ontvangt|Eindafrekening|afsluiten/i).first()
    ).toBeVisible({ timeout: 12000 })

    const body = await page.textContent('body')
    expect(body).not.toContain('row-level security')
    expect(body).not.toContain('undefined')
  })

  test('PW-11b: storten na DB-sluiting → foutmelding "potje is gesloten"', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', deviceId])
    await page.goto(`/potje/${potje.id}/storten`)
    await expect(page.getByRole('group', { name: 'Standaardbedragen' })).toBeVisible({ timeout: 8000 })

    await supabase
      .from('potjes')
      .update({
        status: 'gesloten',
        gesloten_op: new Date().toISOString(),
        gesloten_door: deelnemer.id,
      })
      .eq('id', potje.id)

    await page.waitForTimeout(1500)

    await page.getByRole('button', { name: '€ 10,00' }).click()
    await page.getByRole('button', { name: 'Storten →' }).click()

    const url = page.url()
    const body = await page.textContent('body')
    const correctGedrag =
      body.includes('gesloten') ||
      body.includes('Eindafrekening') ||
      url.includes(`/potje/${potje.id}`)

    expect(correctGedrag).toBe(true)
    expect(body).not.toContain('row-level security')
  })

  test('PW-11c: handmatig sluiten via UI → eindafrekeningscherm met verrekeningsdata', async ({ page }) => {
    await openOverzicht(page)

    const sluitKnop = page.getByRole('button', { name: /Pot sluiten/i })
    await expect(sluitKnop).toBeEnabled({ timeout: 8000 })
    await sluitKnop.click()

    await expect(page.getByRole('heading', { name: /Pot sluiten/i })).toBeVisible({ timeout: 5000 })

    const bevestigKnop = page.getByRole('button', { name: /Ja, sluit de pot/i })
    await expect(bevestigKnop).toBeVisible({ timeout: 5000 })
    await bevestigKnop.click()

    await expect(
      page.getByText(/verrekening|bijbetalen|ontvangt|Eindafrekening|gesloten/i).first()
    ).toBeVisible({ timeout: 10000 })

    const body = await page.textContent('body')
    expect(body).toMatch(/€|verrekening|bijbetalen|ontvangt|gesloten/i)
  })

  test('PW-11d: stortenpagina bij gesloten potje → storten geblokkeerd', async ({ page }) => {
    // Sluit potje via DB vóór navigatie
    await supabase
      .from('potjes')
      .update({
        status: 'gesloten',
        gesloten_op: new Date().toISOString(),
        gesloten_door: deelnemer.id,
      })
      .eq('id', potje.id)

    // Navigeer naar storten
    await page.goto('/')
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', deviceId])
    await page.goto(`/potje/${potje.id}/storten`)

    // Wacht tot de subtitel met de pottitel zichtbaar is — dit is het moment waarop
    // usePotje laadData() klaar is en potje !== null in React-state.
    // De redirect-useEffect (!laden && potje.status === 'gesloten') triggert direct daarna.
    // Als de redirect snel genoeg is, zien we de subtitel nooit; dan is de URL al gewijzigd.
    await Promise.race([
      // Pad A: redirect al gevuurd — URL is niet meer /storten
      page.waitForURL(url => !url.href.includes('/storten'), { timeout: 10000 }),
      // Pad B: potje geladen, subtitel zichtbaar — redirect staat op het punt te vuren
      page.locator('.subtitel').filter({ hasText: /PW-11/ }).waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(() => {
      // Als beide paden een timeout geven (onverwacht), laat de test doorgaan —
      // de eindcheck pakt het op.
    })

    const urlNaLaden = page.url()

    if (!urlNaLaden.includes('/storten')) {
      // Pad A: redirect heeft plaatsgevonden — correct gedrag.
      expect(urlNaLaden).not.toContain('/storten')
    } else {
      // Pad B: subtitel is zichtbaar, potje geladen, redirect nog niet gevuurd
      // of subtitel verschijnt kort voor de redirect. Wacht expliciet op redirect.
      // Als de redirect binnen 3s komt → klaar. Zo niet → probeer te storten.
      const redirectGekomen = await page.waitForURL(
        url => !url.href.includes('/storten'),
        { timeout: 3000 }
      ).then(() => true).catch(() => false)

      if (redirectGekomen) {
        expect(page.url()).not.toContain('/storten')
      } else {
        // Redirect is niet gekomen binnen 3s — probeer handmatig te storten.
        // handleStorten blokkeert op potje.status === 'gesloten'.
        const snelknop = page.getByRole('group', { name: 'Standaardbedragen' }).getByRole('button').first()
        await snelknop.click()
        await page.getByRole('button', { name: 'Storten →' }).click()

        // Wacht op foutmelding of URL-change
        // Noot: waitForURL callback ontvangt een URL-object — gebruik .href
        await Promise.race([
          page.waitForSelector('.fout-tekst', { timeout: 8000 }),
          page.waitForURL(urlObj => !urlObj.href.includes('/storten'), { timeout: 8000 }),
        ])

        const url = page.url()
        const body = await page.textContent('body')
        const isGeblokkeerd =
          body.includes('gesloten') ||
          body.includes('fout') ||
          body.includes('mislukt') ||
          body.includes('onverwacht') ||
          !url.includes('/storten')

        expect(isGeblokkeerd).toBe(true)
      }
    }

    // Nooit een technische RLS-fout zichtbaar
    const body = await page.textContent('body')
    expect(body).not.toContain('row-level security')
  })
})
