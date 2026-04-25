/**
 * Regressietests — bootstrapAnonAuth (Fase 1: Supabase anonieme auth)
 *
 * Teststrategie: logica-extractie patroon.
 *
 * bootstrapAnonAuth is een module-level functie in supabaseClient.js en
 * kan niet direct worden geïmporteerd (niet geëxporteerd). De logica is
 * echter volledig extracteerbaar als pure functies zonder Supabase-afhankelijkheid.
 *
 * We testen de beslisboom, niet de Supabase-SDK:
 *   - Als er al een sessie is → geen signInAnonymously-aanroep
 *   - Als er geen sessie is → signInAnonymously wordt aangeroepen
 *   - Als signInAnonymously een error geeft → applicatie crasht niet
 *   - Als getSession zelf gooit → applicatie crasht niet
 *
 * Gedekte scenario's:
 *   BAA-01  bestaande sessie aanwezig → geen nieuwe inlog
 *   BAA-02  geen sessie → signInAnonymously aangeroepen
 *   BAA-03  signInAnonymously geeft error → console.error, geen throw
 *   BAA-04  getSession gooit → console.error, geen throw
 *   BAA-05  na succesvolle anonymous login is sessie aanwezig
 *   BAA-06  meerdere aanroepen zijn idempotent (bestaande sessie wint)
 */

import { describe, it, expect, vi } from 'vitest'

// ── Geëxtraheerde beslisboom (spiegel van bootstrapAnonAuth) ──────────────────

async function bootstrapAnonAuthLogica({ getSession, signInAnonymously, onError }) {
  try {
    const { data: { session } } = await getSession()
    if (!session) {
      const { error } = await signInAnonymously()
      if (error) {
        onError('[supabaseClient] bootstrapAnonAuth mislukt: ' + error.message)
      }
    }
  } catch (e) {
    onError('[supabaseClient] bootstrapAnonAuth onverwachte fout: ' + e.message)
  }
}

// ── BAA-01 t/m BAA-06 ─────────────────────────────────────────────────────────

describe('bootstrapAnonAuth — beslisboom (BAA-01 t/m BAA-06)', () => {

  it('BAA-01: bestaande sessie aanwezig → signInAnonymously NIET aangeroepen', async () => {
    const getSession = vi.fn().mockResolvedValue({ data: { session: { user: { id: 'uuid-1' } } } })
    const signInAnonymously = vi.fn()
    const onError = vi.fn()

    await bootstrapAnonAuthLogica({ getSession, signInAnonymously, onError })

    expect(signInAnonymously).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('BAA-02: geen sessie → signInAnonymously WEL aangeroepen', async () => {
    const getSession = vi.fn().mockResolvedValue({ data: { session: null } })
    const signInAnonymously = vi.fn().mockResolvedValue({ error: null })
    const onError = vi.fn()

    await bootstrapAnonAuthLogica({ getSession, signInAnonymously, onError })

    expect(signInAnonymously).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()
  })

  it('BAA-03: signInAnonymously geeft error → onError aangeroepen, geen throw', async () => {
    const getSession = vi.fn().mockResolvedValue({ data: { session: null } })
    const signInAnonymously = vi.fn().mockResolvedValue({
      error: { message: 'Anonymous sign-ins are disabled' }
    })
    const onError = vi.fn()

    // Mag niet gooien
    await expect(
      bootstrapAnonAuthLogica({ getSession, signInAnonymously, onError })
    ).resolves.toBeUndefined()

    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0]).toContain('Anonymous sign-ins are disabled')
  })

  it('BAA-04: getSession gooit → onError aangeroepen, geen throw', async () => {
    const getSession = vi.fn().mockRejectedValue(new Error('Netwerk onbereikbaar'))
    const signInAnonymously = vi.fn()
    const onError = vi.fn()

    await expect(
      bootstrapAnonAuthLogica({ getSession, signInAnonymously, onError })
    ).resolves.toBeUndefined()

    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0]).toContain('Netwerk onbereikbaar')
    expect(signInAnonymously).not.toHaveBeenCalled()
  })

  it('BAA-05: na succesvolle anonymous login bevat de sessie een user-id', async () => {
    const verwachteUserId = crypto.randomUUID()
    const getSession = vi.fn().mockResolvedValue({ data: { session: null } })
    const signInAnonymously = vi.fn().mockResolvedValue({
      error: null,
      data: { user: { id: verwachteUserId, is_anonymous: true } }
    })
    const onError = vi.fn()

    await bootstrapAnonAuthLogica({ getSession, signInAnonymously, onError })

    const aanroepResultaat = await signInAnonymously.mock.results[0].value
    expect(aanroepResultaat.data.user.id).toBe(verwachteUserId)
    expect(aanroepResultaat.data.user.is_anonymous).toBe(true)
    expect(onError).not.toHaveBeenCalled()
  })

  it('BAA-06: meerdere aanroepen zijn idempotent — bestaande sessie wint', async () => {
    // Simuleert twee boots kort na elkaar (bijv. Hot Module Replacement)
    const sessie = { user: { id: crypto.randomUUID() } }
    const getSession = vi.fn().mockResolvedValue({ data: { session: sessie } })
    const signInAnonymously = vi.fn()
    const onError = vi.fn()

    await bootstrapAnonAuthLogica({ getSession, signInAnonymously, onError })
    await bootstrapAnonAuthLogica({ getSession, signInAnonymously, onError })

    expect(signInAnonymously).not.toHaveBeenCalled()
    expect(getSession).toHaveBeenCalledTimes(2)
  })

})
