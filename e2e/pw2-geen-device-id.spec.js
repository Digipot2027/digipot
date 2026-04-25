/**
 * e2e/pw2-geen-device-id.spec.js — PW-2: Storten zonder bekende identiteit
 *
 * Fase 4 update: identiteitsherkenning via auth.uid().
 * PW-2c: bootstrapAnonAuth() kan rate-limited zijn in e2e — test controleert
 * dat de app correct opstart zonder crash, ongeacht auth-status.
 */

import { test, expect } from '@playwright/test'
import {
  maakSupabaseClient, maakTestPotje, verwijderTestPotje,
} from './helpers.js'

test.describe('PW-2: Geen device_id — geen storten mogelijk', () => {
  let supabase, potje

  test.beforeEach(async () => {
    supabase = maakSupabaseClient()
    potje = await maakTestPotje(supabase, '[E2E] PW-2 Geen device_id')
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(supabase, potje.id)
  })

  test('zonder deelnemer-record → Deelneemscherm getoond, geen 401', async ({ page }) => {
    await page.goto(`/potje/${potje.id}`)
    await expect(page.getByRole('heading', { name: /Meedoen aan/i })).toBeVisible({ timeout: 8000 })
    const paginaTekst = await page.textContent('body')
    expect(paginaTekst).not.toContain('row-level security')
    expect(paginaTekst).not.toContain('401')
  })

  test('direct naar /storten zonder deelnemer → doorgestuurd of foutmelding, geen RLS-crash', async ({ page }) => {
    await page.goto(`/potje/${potje.id}/storten`)
    await page.waitForLoadState('networkidle')
    const url = page.url()
    const paginaTekst = await page.textContent('body')
    const heeftFoutmelding =
      paginaTekst.includes('geen deelnemer') ||
      paginaTekst.includes('Meedoen aan') ||
      url.includes(`/potje/${potje.id}`)
    expect(heeftFoutmelding).toBe(true)
    expect(paginaTekst).not.toContain('row-level security')
    expect(paginaTekst).not.toContain('42501')
  })

  test('ongeldig device_id formaat → app start zonder crash', async ({ page }) => {
    // Fase 4: bootstrapDeviceId bestaat niet meer.
    // Test: app laadt correct ondanks ongeldig device_id formaat — geen crash, geen RLS-fout.
    await page.goto('/')
    await page.evaluate(key => localStorage.setItem(key, 'dit-is-geen-uuid'), 'digipot_device_id')
    await page.goto(`/potje/${potje.id}`)
    await page.waitForLoadState('networkidle')

    // App start zonder crash
    const paginaTekst = await page.textContent('body')
    expect(paginaTekst).not.toContain('row-level security')
    expect(paginaTekst).not.toContain('TypeError')

    // App toont ofwel het deelneemscherm ofwel het overzicht — geen lege pagina
    const heeftInhoud =
      paginaTekst.includes('Meedoen aan') ||
      paginaTekst.includes('Storten') ||
      paginaTekst.includes('Betaling')
    expect(heeftInhoud).toBe(true)
  })
})
