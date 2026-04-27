/**
 * Regressietest — SEC-A2 (Critical IDOR)
 *
 * Probleem: de oude deelnemers_insert RLS-policy controleerde alleen dat het
 * potje open was. Een geauthenticeerde anon-gebruiker kon een deelnemer
 * invoegen met:
 *   - user_id = NULL (kapt eigenaarschap af)
 *   - user_id = <UUID van een andere gebruiker> (impersonation)
 *
 * Fix (DB-kant): policy aangevuld met `auth.uid() IS NOT NULL AND
 * deelnemers.user_id = auth.uid()`.
 *
 * Fix (frontend-kant): handleDeelnemen in usePotjeActies.js zet user_id al
 * via supabase.auth.getUser() — zonder deze test kon een toekomstige refactor
 * het stilletjes weglaten, waardoor INSERT met user_id=null gestuurd zou
 * worden en alle deelname zou breken (RLS 42501).
 *
 * Deze test borgt de samenstelling van de INSERT-payload.
 *
 * Gedekte cases:
 *
 * SA2-01  payload bevat user_id uit auth.getUser()
 * SA2-02  user_id = null als auth.getUser() geen user retourneert
 *         (defense-in-depth — RLS blokkeert de INSERT alsnog met 42501)
 * SA2-03  payload bevat naam, potje_id, en gegenereerde id (UUID v4)
 * SA2-04  payload bevat geen device_id (Fase 4: device_id is verwijderd)
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const UUID_V4_PATROON = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Geëxtraheerde payload-bouw uit handleDeelnemen.
 * Identiek aan de samenstelling in usePotjeActies.js.
 *
 * Als usePotjeActies.handleDeelnemen verandert, MOET deze functie ook worden
 * bijgewerkt. De test bewaakt de structuur van de payload.
 */
function bouwDeelnemerPayload({ potjeId, naam, authUser }) {
  const nieuweDeelnemerId = crypto.randomUUID()
  const userId = authUser?.id ?? null
  return {
    id: nieuweDeelnemerId,
    potje_id: potjeId,
    naam,
    user_id: userId,
  }
}

describe('SEC-A2 — handleDeelnemen payload-borging', () => {
  it('SA2-01: payload bevat user_id uit auth.getUser()', () => {
    const authUser = { id: '11111111-2222-4333-8444-555555555555' }
    const payload = bouwDeelnemerPayload({
      potjeId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      naam: 'Jan',
      authUser,
    })
    expect(payload.user_id).toBe(authUser.id)
  })

  it('SA2-02: user_id = null wanneer auth-user ontbreekt', () => {
    // Defense-in-depth: client stuurt null door, RLS blokkeert dan met 42501.
    // Zonder deze fallback zou de payload "user_id: undefined" sturen, wat
    // PostgREST anders behandelt dan een expliciete null.
    const payload = bouwDeelnemerPayload({
      potjeId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      naam: 'Jan',
      authUser: null,
    })
    expect(payload.user_id).toBeNull()
  })

  it('SA2-02b: user_id = null wanneer authUser leeg object is', () => {
    const payload = bouwDeelnemerPayload({
      potjeId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      naam: 'Jan',
      authUser: {},
    })
    expect(payload.user_id).toBeNull()
  })

  it('SA2-03: payload bevat geldig UUID v4 als id', () => {
    const payload = bouwDeelnemerPayload({
      potjeId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      naam: 'Jan',
      authUser: { id: '11111111-2222-4333-8444-555555555555' },
    })
    expect(payload.id).toMatch(UUID_V4_PATROON)
  })

  it('SA2-03b: payload bevat naam en potje_id ongewijzigd', () => {
    const payload = bouwDeelnemerPayload({
      potjeId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      naam: 'Marieke',
      authUser: { id: '11111111-2222-4333-8444-555555555555' },
    })
    expect(payload.naam).toBe('Marieke')
    expect(payload.potje_id).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
  })

  it('SA2-04: payload bevat geen device_id (Fase 4: verwijderd)', () => {
    const payload = bouwDeelnemerPayload({
      potjeId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      naam: 'Jan',
      authUser: { id: '11111111-2222-4333-8444-555555555555' },
    })
    expect(payload).not.toHaveProperty('device_id')
  })

  it('SA2-04b: payload heeft exact 4 velden (id, potje_id, naam, user_id)', () => {
    const payload = bouwDeelnemerPayload({
      potjeId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      naam: 'Jan',
      authUser: { id: '11111111-2222-4333-8444-555555555555' },
    })
    expect(Object.keys(payload).sort()).toEqual(['id', 'naam', 'potje_id', 'user_id'])
  })
})

// ── Bron-borging ─────────────────────────────────────────────────────────────
//
// Bevestigt dat usePotjeActies.handleDeelnemen daadwerkelijk user_id zet.
// Een refactor die supabase.auth.getUser() weglaat zou deze test breken.

describe('SEC-A2 — broncode-borging usePotjeActies', () => {
  it('SA2-05: handleDeelnemen-broncode bevat auth.getUser() en user_id', () => {
    const bron = readFileSync(
      resolve(__dirname, '../hooks/usePotjeActies.js'),
      'utf8'
    )
    expect(bron).toMatch(/supabase\.auth\.getUser\(\)/)
    expect(bron).toMatch(/user_id:\s*userId/)
  })
})
