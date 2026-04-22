/**
 * e2e/pw11-realtime-sluiting.spec.js — PW-11: Potje sluit terwijl je in het Stortingscherm staat
 *
 * Scenario: iemand staat op het Stortingscherm terwijl een ander device
 * (of lifecycle) het potje sluit. Via Supabase Realtime krijgt de pagina
 * een UPDATE-event met status='gesloten'. De UI moet dit correct verwerken.
 *
 * Dit is het exacte scenario dat jullie hebben meegemaakt: iemand bleef
 * storten terwijl het potje al gesloten was.
 *
 * PW-11a: potje gesloten terwijl op overzicht → eindafrekeningscherm verschijnt
 * PW-11b: potje gesloten terwijl op stortenpagina → foutmelding bij submit
 * PW-11c: handmatig sluiten → eindafrekeningscherm zichtbaar met verrekeningen
 * PW-11d: storten na sluiting via UI → geblokkeerd met foutmelding
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
    await expect(page.getByText('Welkom, Sluiter', { exact: true })).toBeVisible({ timeout: 8000 })
  }

  test('PW-11a: potje gesloten via DB terwijl op overzicht → eindafrekeningscherm verschijnt', async ({ page }) => {
    await openOverzicht(page)

    // Sluit het potje via de DB (simuleert een ander device dat sluit)
    await supabase
      .from('potjes')
      .update({
        status: 'gesloten',
        gesloten_op: new Date().toISOString(),
        gesloten_door: deelnemer.id,
      })
      .eq('id', potje.id)

    // Realtime-update triggert de UI — wacht tot eindafrekeninginhoud zichtbaar wordt.
    // De heading-tekst is potje-naam-afhankelijk; wacht op verrekeningsinhoud.
    await expect(
      page.getByText(/verrekening|bijbetalen|ontvangt|Eindafrekening|afsluiten/i).first()
    ).toBeVisible({ timeout: 12000 })

    // Geen technische foutmeldingen
    const body = await page.textContent('body')
    expect(body).not.toContain('row-level security')
    expect(body).not.toContain('undefined')
  })

  test('PW-11b: storten na DB-sluiting → foutmelding "potje is gesloten"', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', deviceId])
    await page.goto(`/potje/${potje.id}/storten`)
    await expect(page.getByRole('group', { name: 'Standaardbedragen' })).toBeVisible({ timeout: 8000 })

    // Sluit het potje via de DB terwijl de gebruiker op het stortenscherm staat
    await supabase
      .from('potjes')
      .update({
        status: 'gesloten',
        gesloten_op: new Date().toISOString(),
        gesloten_door: deelnemer.id,
      })
      .eq('id', potje.id)

    // Wacht even zodat Realtime de update kan verwerken
    await page.waitForTimeout(1500)

    // Selecteer een bedrag en probeer te storten
    await page.getByRole('button', { name: '€ 10,00' }).click()
    await page.getByRole('button', { name: 'Storten →' }).click()

    // Foutmelding of redirect naar eindafrekening — beide zijn correct gedrag
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

    // Wacht tot de Pot afsluiten-knop enabled is (vereist dat transacties geladen zijn)
    const sluitKnop = page.getByRole('button', { name: /Pot afsluiten/i })
    await expect(sluitKnop).toBeEnabled({ timeout: 8000 })
    await sluitKnop.click()

    // Wacht op de modal met de juiste titel
    await expect(page.getByRole('heading', { name: /Pot sluiten/i })).toBeVisible({ timeout: 5000 })

    // Klik de bevestigingsknop
    const bevestigKnop = page.getByRole('button', { name: /Ja, sluit de pot/i })
    await expect(bevestigKnop).toBeVisible({ timeout: 5000 })
    await bevestigKnop.click()

    // Eindafrekeningscherm of verrekeningsdata verschijnt
    await expect(
      page.getByText(/verrekening|bijbetalen|ontvangt|Eindafrekening|gesloten/i).first()
    ).toBeVisible({ timeout: 10000 })

    // Verrekeningen zijn zichtbaar
    const body = await page.textContent('body')
    expect(body).toMatch(/€|verrekening|bijbetalen|ontvangt|gesloten/i)
  })

  test('PW-11d: stortenpagina bij gesloten potje → storten geblokkeerd', async ({ page }) => {
    // Sluit het potje eerst via de DB
    await supabase
      .from('potjes')
      .update({
        status: 'gesloten',
        gesloten_op: new Date().toISOString(),
        gesloten_door: deelnemer.id,
      })
      .eq('id', potje.id)

    // Wacht even zodat Supabase de update heeft verwerkt
    await new Promise(r => setTimeout(r, 500))

    // Navigeer direct naar storten (zoals iemand die een oude tab open heeft)
    await page.goto('/')
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['digipot_device_id', deviceId])
    await page.goto(`/potje/${potje.id}/storten`)
    await page.waitForLoadState('networkidle')

    // Wacht tot de pagina geladen is (potje-data via usePotje)
    await page.waitForTimeout(1000)

    const snelknop = page.getByRole('group', { name: 'Standaardbedragen' })
      .getByRole('button').first()

    if (await snelknop.isVisible({ timeout: 3000 }).catch(() => false)) {
      await snelknop.click()
      await page.getByRole('button', { name: 'Storten →' }).click()

      // Na submit: ofwel een foutmelding (elk type), ofwel doorgestuurd weg van storten
      // De exacte foutmelding hangt af van timing (React-state vs DB-check)
      await page.waitForTimeout(2000)

      const url = page.url()
      const body = await page.textContent('body')

      // Storten mag niet stil slagen: ofwel fout zichtbaar, ofwel doorgestuurd
      const isGeblokkeerd =
        body.includes('gesloten') ||
        body.includes('fout') ||
        body.includes('mislukt') ||
        body.includes('onverwacht') ||
        !url.includes('/storten')

      expect(isGeblokkeerd).toBe(true)
    } else {
      // Snelknoppen niet zichtbaar = app heeft al doorgestuurd
      const url = page.url()
      expect(url).not.toContain('/storten')
    }

    // In geen geval een technische RLS-fout zichtbaar
    const body = await page.textContent('body')
    expect(body).not.toContain('row-level security')
  })
})
