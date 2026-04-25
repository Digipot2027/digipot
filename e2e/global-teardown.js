/**
 * e2e/global-teardown.js — Globale teardown na de volledige e2e-testrun
 *
 * Fase 4 fix: gebruikt service client (bypast RLS) want de anon client
 * heeft geen rechten om potjes te verwijderen.
 *
 * Ruimt ook de gedeelde auth-testgebruiker op (aangemaakt door global-setup.js).
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { readFileSync, unlinkSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env.local') })

export default async function globalTeardown() {
  const url        = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return

  const service = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verwijder testpotjes
  const { data: testPotjes } = await service
    .from('potjes')
    .select('id, naam')
    .or('naam.ilike.[E2E]%,naam.ilike.[HEALTH]%,naam.ilike.PW-%')

  if (testPotjes?.length) {
    for (const potje of testPotjes) {
      await service.from('potjes').delete().eq('id', potje.id)
    }
    console.log(`[teardown] ${testPotjes.length} testpotje(s) opgeruimd.`)
  }

  // Verwijder de gedeelde testgebruiker
  const sessieBestand = resolve(__dirname, '.auth/sessie.json')
  try {
    const { userId } = JSON.parse(readFileSync(sessieBestand, 'utf-8'))
    await service.auth.admin.deleteUser(userId)
    unlinkSync(sessieBestand)
    console.log('[teardown] Gedeelde testgebruiker verwijderd.')
  } catch {
    // Sessiebestand ontbreekt of gebruiker al verwijderd — geen actie nodig
  }
}
