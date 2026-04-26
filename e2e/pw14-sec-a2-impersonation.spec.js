/**
 * e2e/pw14-sec-a2-impersonation.spec.js — SEC-A2: deelnemers_insert eigenaar-check
 *
 * Doel: borgen dat de aangescherpte deelnemers_insert RLS-policy
 * (2026-04-26) impersonation- en weesdeelnemer-aanvallen blokkeert.
 *
 * Drie aanvalsscenario's, elk via een anon-client met geldige auth-sessie:
 *
 * SA2-E1  user_id = NULL → moet RLS-error 42501 teruggeven
 * SA2-E2  user_id = <vreemde UUID> → moet RLS-error 42501 teruggeven
 * SA2-E3  user_id = auth.uid() (legitiem) → slaagt (controle-test)
 *
 * Werkt met de gedeelde sessie uit global-setup.js. We gebruiken een
 * verse anon-client (createClient + setSession) i.p.v. de browser zodat
 * we exact de payload kunnen sturen die een aanvaller zou sturen.
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { readFileSync } from 'fs'
import { maakTestPotje, verwijderTestPotje, maakSupabaseClient } from './helpers.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const ANON_KEY     = process.env.VITE_SUPABASE_ANON_KEY

function laadGedeeldeSessie() {
  const data = readFileSync(resolve(__dirname, '.auth/sessie.json'), 'utf-8')
  return JSON.parse(data)
}

/**
 * Bouwt een anon-client met de gedeelde auth-sessie geladen.
 * Simuleert een aanvaller die geldig is ingelogd maar willekeurige payloads stuurt.
 */
async function maakAuthAnonClient() {
  const { session } = laadGedeeldeSessie()
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  return client
}

test.describe('SEC-A2: deelnemers_insert eigenaar-check', () => {
  let serviceClient, potje

  test.beforeEach(async () => {
    serviceClient = maakSupabaseClient()
    potje = await maakTestPotje(serviceClient, '[E2E] SEC-A2 impersonation')
  })

  test.afterEach(async () => {
    if (potje) await verwijderTestPotje(serviceClient, potje.id)
  })

  test('SA2-E1: INSERT met user_id=NULL wordt geblokkeerd door RLS', async () => {
    const client = await maakAuthAnonClient()
    const { error } = await client.from('deelnemers').insert({
      potje_id: potje.id,
      naam: 'WeesAanvaller',
      user_id: null,
    })
    expect(error).not.toBeNull()
    // RLS WITH CHECK violation → SQLSTATE 42501
    expect(error.code).toBe('42501')
  })

  test('SA2-E2: INSERT met user_id=<vreemde UUID> wordt geblokkeerd door RLS', async () => {
    const client = await maakAuthAnonClient()
    const vreemdeUserId = '99999999-8888-4777-8666-555555555555'
    const { error } = await client.from('deelnemers').insert({
      potje_id: potje.id,
      naam: 'ImpersonateAanvaller',
      user_id: vreemdeUserId,
    })
    expect(error).not.toBeNull()
    expect(error.code).toBe('42501')
  })

  test('SA2-E3: INSERT met eigen user_id slaagt (controle)', async () => {
    const { userId } = laadGedeeldeSessie()
    const client = await maakAuthAnonClient()
    const { data, error } = await client.from('deelnemers').insert({
      potje_id: potje.id,
      naam: 'LegitiemeDeelnemer',
      user_id: userId,
    }).select().single()
    expect(error).toBeNull()
    expect(data.user_id).toBe(userId)
    expect(data.naam).toBe('LegitiemeDeelnemer')
  })

  test('SA2-E4: INSERT zonder user_id-veld (impliciet NULL) wordt geblokkeerd', async () => {
    // PostgREST stuurt ontbrekende velden als NULL. Dit moet identiek
    // worden afgehandeld als expliciet user_id: null.
    const client = await maakAuthAnonClient()
    const { error } = await client.from('deelnemers').insert({
      potje_id: potje.id,
      naam: 'ZonderUserIdVeld',
    })
    expect(error).not.toBeNull()
    expect(error.code).toBe('42501')
  })
})
