/**
 * e2e/pw7-profiel-instellingen.spec.js — PW-7: Profiel en Instellingen flows
 *
 * Fix PW-7g v2: radiogroep-knoppen hebben role="radio" via een <button>-element.
 * Playwright's getByRole('radio') werkt hier — maar de naam matcht op de
 * tekstinhoud inclusief de "A"-letter en het label. Gebruik expliciete
 * attribute-selector als fallback.
 */

import { test, expect } from '@playwright/test'

test.describe('PW-7: Profiel en Instellingen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.removeItem('digipot_profiel_naam')
      localStorage.removeItem('digipot_tekstgrootte')
    })
  })

  test('PW-7a: profielnaam opslaan → succesmelding verschijnt', async ({ page }) => {
    await page.goto('/instellingen/profiel')
    await page.getByLabel(/Jouw naam/i).fill('Testpersoon')
    await page.getByRole('button', { name: /Opslaan/i }).click()

    await expect(page.getByRole('button', { name: /Opgeslagen/i })).toBeVisible({ timeout: 3000 })

    const opgeslagen = await page.evaluate(() => localStorage.getItem('digipot_profiel_naam'))
    expect(opgeslagen).toBe('Testpersoon')
  })

  test('PW-7b: profielnaam verwijderen → verwijderknop verdwijnt', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('digipot_profiel_naam', 'TeVerwijderen'))

    await page.goto('/instellingen/profiel')
    await expect(page.getByRole('button', { name: /Naam verwijderen/i })).toBeVisible()

    await page.getByRole('button', { name: /Naam verwijderen/i }).click()

    await expect(page.getByRole('button', { name: /Naam verwijderen/i })).not.toBeVisible()

    const opgeslagen = await page.evaluate(() => localStorage.getItem('digipot_profiel_naam'))
    expect(opgeslagen).toBeNull()
  })

  test('PW-7c: naam langer dan 30 tekens → veld accepteert max 30', async ({ page }) => {
    await page.goto('/instellingen/profiel')
    const veld = page.getByLabel(/Jouw naam/i)
    await veld.fill('a'.repeat(35))
    const waarde = await veld.inputValue()
    expect(waarde.length).toBeLessThanOrEqual(30)
  })

  test('PW-7d: opgeslagen naam zichtbaar als subtekst op Instellingen', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('digipot_profiel_naam', 'ZichtbaarePersoon'))
    await page.goto('/instellingen')
    await expect(page.getByText(/Ingesteld als "ZichtbaarePersoon"/)).toBeVisible()
  })

  test('PW-7e: Instellingen → Open potjes navigeert correct', async ({ page }) => {
    await page.goto('/instellingen')
    await page.getByRole('button', { name: /Open potjes/i }).click()
    await expect(page).toHaveURL(/\/instellingen\/open/)
    await expect(page.getByRole('heading', { name: /Open potjes/i })).toBeVisible()
  })

  test('PW-7f: Instellingen → Gesloten potjes navigeert correct', async ({ page }) => {
    await page.goto('/instellingen')
    await page.getByRole('button', { name: /Gesloten potjes/i }).click()
    await expect(page).toHaveURL(/\/instellingen\/gesloten/)
    await expect(page.getByRole('heading', { name: /Gesloten potjes/i })).toBeVisible()
  })

  test('PW-7g: tekstgrootte radiogroep — aria-checked verandert bij klik', async ({ page }) => {
    await page.goto('/instellingen/profiel')

    // De radiogroup is aanwezig
    await expect(page.getByRole('radiogroup', { name: /Tekstgrootte/i })).toBeVisible()

    // Normaal is standaard geselecteerd (aria-checked="true")
    const normaalKnop = page.locator('[role="radio"][aria-checked="true"]').filter({ hasText: /Normaal/i })
    await expect(normaalKnop).toBeVisible()

    // Klik op Groot via aria-checked="false" knop met tekst Groot
    const grootKnop = page.locator('[role="radio"]').filter({ hasText: /^A\s*Groot$/i })
      .or(page.locator('[role="radio"]').filter({ hasText: 'Groot' }).first())

    // Alternatief: klik op de tweede radio-knop (index 1 = Groot)
    const alleRadios = page.locator('[role="radio"]')
    await alleRadios.nth(1).click()

    // Tweede knop moet nu aria-checked="true" zijn
    await expect(alleRadios.nth(1)).toHaveAttribute('aria-checked', 'true')
    // Eerste knop moet nu aria-checked="false" zijn
    await expect(alleRadios.nth(0)).toHaveAttribute('aria-checked', 'false')

    // LocalStorage bevat de nieuwe instelling
    const tekstgrootte = await page.evaluate(() => localStorage.getItem('digipot_tekstgrootte'))
    expect(tekstgrootte).toBe('groot')
  })

  test('PW-7h: Terug-knop op Profiel navigeert terug', async ({ page }) => {
    await page.goto('/instellingen')
    await page.goto('/instellingen/profiel')
    await page.getByRole('button', { name: /Terug/i }).click()
    await expect(page).toHaveURL(/\/instellingen/)
  })
})
