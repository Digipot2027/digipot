/**
 * Regressietests — handleSluiten bij al-gesloten potje (0 rijen, silent) (#12)
 *
 * Probleem:
 *   handleSluiten voert de volgende UPDATE uit:
 *
 *     supabase.from('potjes')
 *       .update({ status: 'gesloten', gesloten_op: ..., gesloten_door: ... })
 *       .eq('id', potjeId)
 *       .eq('status', 'open')    ← alleen bijwerken als het potje nog open is
 *
 *   Als twee deelnemers tegelijkertijd op "Potje sluiten" klikken:
 *     - Deelnemer A wint → UPDATE raakt 1 rij → status = 'gesloten', gesloten_door = A
 *     - Deelnemer B verliest → UPDATE raakt 0 rijen (status ≠ 'open' meer)
 *
 *   Wat doet Supabase bij 0 rijen? Geen fout, geen error-object.
 *   De code checkt alleen `if (error) throw error` — bij 0 rijen is er geen error.
 *   Gevolg: de ModalSluiten wordt gesloten (setModaal(null)) zonder feedback.
 *   De gebruiker denkt dat HET potje gesloten is — maar dat had de ander al gedaan.
 *
 *   Het potje wordt wel gesloten (door A), dus functioneel is het correct.
 *   Maar de UX is onduidelijk: B ziet geen bevestiging, en de realtime-update
 *   triggert setPotje(payload.new) via het potjes-abonnement — dat herstelt de UI.
 *
 * Gedekte scenarios:
 *   HS-01  handleSluiten guard: deelnemer null → DEELNEMER_ONTBREEKT (al gedekt in kritiek-3)
 *   HS-02  handleSluiten: UPDATE succesvol (1 rij geraakt) → setModaal(null)
 *   HS-03  handleSluiten: UPDATE 0 rijen (potje al gesloten) → geen error, setModaal(null)
 *   HS-04  handleSluiten: DB-error → gooit door naar try/catch aanroeper
 *   HS-05  race-condition tijdlijn: A sluit, B probeert ook → beide calls gedocumenteerd
 *   HS-06  UPDATE-payload bevat gesloten_op als ISO string
 *   HS-07  UPDATE-payload bevat gesloten_door als deelnemer.id
 *   HS-08  gesloten_op is maximaal enkele seconden afwijkend van werkelijk tijdstip
 */

import { describe, it, expect, vi } from 'vitest'

// ── Geëxtraheerde guard-logica uit handleSluiten ──────────────────────────────
// Identiek aan de guard in usePotjeActies.handleSluiten.

function voerSluitenGuardUit(deelnemer) {
  if (!deelnemer?.id) throw new Error('DEELNEMER_ONTBREEKT')
  return 'doorgaan'
}

// ── Gesimuleerde Supabase-respons logica ─────────────────────────────────────
// Simuleert de twee uitkomsten van de UPDATE-query.

function simuleerUpdateResultaat(aantalRijen, error = null) {
  // Supabase retourneert: { data, error, count }
  // Bij .eq('status', 'open') + potje al gesloten: count = 0, error = null
  return { data: aantalRijen > 0 ? [{}] : [], error, count: aantalRijen }
}

function verwerkSluitenResultaat({ error }, { setModaal }) {
  // Exacte kopie van de verwerking in handleSluiten
  if (error) throw error
  setModaal(null)
  // GEDOCUMENTEERD GAT: count wordt niet gecheckt.
  // Bij count=0 (potje al gesloten door andere deelnemer) wordt setModaal(null)
  // aangeroepen zonder feedback aan de gebruiker.
}

// ── Payload-constructie ───────────────────────────────────────────────────────

function maakSluitenPayload(deelnemer) {
  const gesloten_op = new Date().toISOString()
  return {
    status: 'gesloten',
    gesloten_op,
    gesloten_door: deelnemer.id,
  }
}

// ── HS-01: guard deelnemer null (al gedekt in kritiek-3, hier als regressie) ──

describe('handleSluiten — HS-01: deelnemer-guard (regressie kritiek-3)', () => {
  it('HS-01a: deelnemer null → DEELNEMER_ONTBREEKT', () => {
    expect(() => voerSluitenGuardUit(null)).toThrow('DEELNEMER_ONTBREEKT')
  })

  it('HS-01b: deelnemer zonder id → DEELNEMER_ONTBREEKT', () => {
    expect(() => voerSluitenGuardUit({ naam: 'Alice' })).toThrow('DEELNEMER_ONTBREEKT')
  })

  it('HS-01c: geldige deelnemer → doorgaan', () => {
    expect(voerSluitenGuardUit({ id: 'd1', naam: 'Alice' })).toBe('doorgaan')
  })
})

// ── HS-02: UPDATE succesvol (1 rij geraakt) ───────────────────────────────────

describe('handleSluiten — HS-02: succesvolle UPDATE (1 rij)', () => {
  it('UPDATE 1 rij, geen error → setModaal(null) aangeroepen', () => {
    const setModaal = vi.fn()
    const resultaat = simuleerUpdateResultaat(1)
    verwerkSluitenResultaat(resultaat, { setModaal })
    expect(setModaal).toHaveBeenCalledWith(null)
  })

  it('UPDATE 1 rij → geen error gegooid', () => {
    const setModaal = vi.fn()
    expect(() =>
      verwerkSluitenResultaat(simuleerUpdateResultaat(1), { setModaal })
    ).not.toThrow()
  })
})

// ── HS-03: UPDATE 0 rijen (potje al gesloten) — gedocumenteerd silent pad ─────

describe('handleSluiten — HS-03: UPDATE 0 rijen bij al-gesloten potje (silent)', () => {
  it('UPDATE 0 rijen, geen error → setModaal(null) toch aangeroepen (silent)', () => {
    // HUIDIG GEDRAG: 0 rijen geraakt → geen error → setModaal(null)
    // De gebruiker ziet geen specifieke melding dat "een ander al gesloten heeft".
    // De realtime-update (potjes UPDATE-abonnement) triggert de UI-update.
    const setModaal = vi.fn()
    verwerkSluitenResultaat(simuleerUpdateResultaat(0), { setModaal })
    expect(setModaal).toHaveBeenCalledWith(null)
  })

  it('UPDATE 0 rijen → geen fout gegooid (silent pad gedocumenteerd)', () => {
    const setModaal = vi.fn()
    expect(() =>
      verwerkSluitenResultaat(simuleerUpdateResultaat(0), { setModaal })
    ).not.toThrow()
  })

  it('0 rijen heeft count=0 en geen error — identiek aan lege succesvol', () => {
    // Documenteert dat Supabase bij 0 gerichte rijen geen onderscheid maakt
    // van een succesvolle query. Code kan dit onderscheid alleen maken via count.
    const nulRijen = simuleerUpdateResultaat(0)
    const eenRij   = simuleerUpdateResultaat(1)
    expect(nulRijen.error).toBeNull()
    expect(eenRij.error).toBeNull()
    expect(nulRijen.count).toBe(0)
    expect(eenRij.count).toBe(1)
  })
})

// ── HS-04: DB-error → gooit door naar aanroeper ───────────────────────────────

describe('handleSluiten — HS-04: DB-error wordt doorgegoooid', () => {
  it('error aanwezig → gooit de error door', () => {
    const setModaal = vi.fn()
    const dbError = new Error('connection reset')
    expect(() =>
      verwerkSluitenResultaat({ error: dbError }, { setModaal })
    ).toThrow('connection reset')
    expect(setModaal).not.toHaveBeenCalled()
  })

  it('error aanwezig → setModaal NIET aangeroepen', () => {
    const setModaal = vi.fn()
    try {
      verwerkSluitenResultaat({ error: new Error('timeout') }, { setModaal })
    } catch (_) { /* verwacht */ }
    expect(setModaal).not.toHaveBeenCalled()
  })
})

// ── HS-05: Race-condition tijdlijn — A sluit, B probeert ook ─────────────────

describe('handleSluiten — HS-05: race-condition tijdlijn gedocumenteerd', () => {
  it('A sluit (1 rij) → B probeert ook (0 rijen) → beide calls lopen zonder crash', () => {
    const setModaalA = vi.fn()
    const setModaalB = vi.fn()

    // A wint: UPDATE raakt 1 rij
    verwerkSluitenResultaat(simuleerUpdateResultaat(1), { setModaal: setModaalA })
    expect(setModaalA).toHaveBeenCalledWith(null)

    // B verliest: UPDATE raakt 0 rijen (potje al gesloten)
    verwerkSluitenResultaat(simuleerUpdateResultaat(0), { setModaal: setModaalB })
    expect(setModaalB).toHaveBeenCalledWith(null) // ook null, maar geen bevestiging gegeven
  })

  it('beide aanroepen gooien geen error', () => {
    expect(() => verwerkSluitenResultaat(simuleerUpdateResultaat(1), { setModaal: vi.fn() })).not.toThrow()
    expect(() => verwerkSluitenResultaat(simuleerUpdateResultaat(0), { setModaal: vi.fn() })).not.toThrow()
  })
})

// ── HS-06 t/m HS-08: UPDATE-payload validatie ────────────────────────────────

describe('handleSluiten — HS-06/07/08: UPDATE-payload correctheid', () => {
  const deelnemer = { id: 'd1', naam: 'Alice' }
  const ISO_PATROON = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

  it('HS-06: gesloten_op is een geldige ISO 8601 datetime string', () => {
    const payload = maakSluitenPayload(deelnemer)
    expect(typeof payload.gesloten_op).toBe('string')
    expect(ISO_PATROON.test(payload.gesloten_op)).toBe(true)
  })

  it('HS-07: gesloten_door is het id van de aanroepende deelnemer', () => {
    const payload = maakSluitenPayload(deelnemer)
    expect(payload.gesloten_door).toBe('d1')
  })

  it('HS-07b: gesloten_door is niet de naam maar het id', () => {
    const payload = maakSluitenPayload(deelnemer)
    expect(payload.gesloten_door).not.toBe('Alice')
    expect(payload.gesloten_door).toBe(deelnemer.id)
  })

  it('HS-08: gesloten_op wijkt maximaal 1 seconde af van aanroepmoment', () => {
    const voor = Date.now()
    const payload = maakSluitenPayload(deelnemer)
    const na = Date.now()
    const verschil = Math.abs(new Date(payload.gesloten_op).getTime() - voor)
    expect(verschil).toBeLessThanOrEqual(na - voor + 100) // 100ms marge voor traagheid
  })

  it('HS-06b: status in payload is altijd "gesloten"', () => {
    const payload = maakSluitenPayload(deelnemer)
    expect(payload.status).toBe('gesloten')
  })
})
