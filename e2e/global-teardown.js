/**
 * e2e/global-teardown.js — Globale teardown na de volledige e2e-testrun
 *
 * Verwijdert alle testpotjes die door de tests zijn aangemaakt maar niet zijn
 * opgeruimd — bijvoorbeeld bij gefaalde tests waarbij afterEach niet wordt bereikt.
 *
 * Herkent testpotjes aan de naam-prefixen:
 *   [E2E]    — door helpers.maakTestPotje() aangemaakt
 *   [HEALTH] — door de GitHub Actions health check aangemaakt
 *   PW-      — door tests die direct een naam opgeven (bijv. PW-8g Testaanmaak)
 *
 * Echte potjes worden nooit aangeraakt.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env.local') })

export default async function globalTeardown() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return

  const supabase = createClient(url, key)

  const { data: testPotjes, error } = await supabase
    .from('potjes')
    .select('id, naam')
    .or('naam.ilike.[E2E]%,naam.ilike.[HEALTH]%,naam.ilike.PW-%')

  if (error || !testPotjes?.length) return

  for (const potje of testPotjes) {
    await supabase.from('potjes').delete().eq('id', potje.id)
  }

  console.log(`[teardown] ${testPotjes.length} testpotje(s) opgeruimd.`)
}
