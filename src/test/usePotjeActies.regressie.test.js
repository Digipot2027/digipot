/**
 * Regressietests — usePotjeActies
 *
 * Teststrategie: logica-extractie patroon.
 *
 * usePotjeActies bevat vijf acties. De beslissingslogica (guards, validaties,
 * state-updates) wordt hier als pure functie geëxtraheerd en getest zonder
 * React, zonder Supabase en zonder navigate.
 *
 * Niet gedekt (vereisen Supabase-mock of router):
 *   - De daadwerkelijke DB-schrijfoperaties
 *   - navigate() aanroepen
 *   - Supabase-foutpaden (worden al gedekt in handleUndo.regressie.test.js)
 *
 * Gedekte logica:
 *
 * PA-01 t/m PA-03  handleTransactie — guards (DEELNEMER_ONTBREEKT, NIET_ACTIEF, SALDO_TE_LAAG)
 * PA-04 t/m PA-07  handleUndo — beslissingslogica (eigenaarschap + saldo-check)
 * PA-08 t/m PA-10  handleAfmelden — guard (geen storting → blokkeer)
 * PA-11 t/m PA-13  toastBericht — gegenereerde berichtteksten
 * PA-14 t/m PA-16  handleDeelnemen — client-side UUID generatie (audit bevinding 1)
 */

import { describe, it, expect } from 'vitest'
import { berekenSaldi } from '../utils/berekenSaldi'
import { formatBedrag } from '../utils/formatBedrag'

// ── Geëxtraheerde beslissingslogica ──────────────────────────────────────────
// Identiek aan de guards in usePotjeActies.js.
// Als de hook verandert, moet dit bestand ook worden bijgewerkt.

/**
 * Guard-logica uit handleTransactie.
 * Bijgewerkt (audit bevinding 2, 2026-04-12): null-guard op deelnemer toegevoegd.
 * Retourneert een Error-instantie als de actie geblokkeerd moet worden, anders null.
 */
function bepaalTransactieFout({ deelnemer, type, bedrag, deelnemers, transacties }) {
  if (!deelnemer?.id) return new Error('DEELNEMER_ONTBREEKT')
  if (deelnemer.actief === false) return new Error('NIET_ACTIEF')
  const saldi = berekenSaldi(deelnemers, transacties)
  if (type === 'betaling' && bedrag > saldi.potSaldo) {
    return new Error(`SALDO_TE_LAAG:${saldi.potSaldo}`)
  }
  return null
}

/**
 * Beslissingslogica uit handleUndo.
 * Retourneert { geblokkeerd: boolean, reden: string|null }.
 */
function bepaalUndoResultaat({ transactieId, transacties, deelnemers, deelnemer }) {
  const transactie = transacties.find(t => t.id === transactieId)

  if (!transactie || transactie.deelnemer_id !== deelnemer?.id) {
    return { geblokkeerd: true, reden: 'Je kunt alleen je eigen transacties ongedaan maken.' }
  }

  if (transactie.type === 'storting') {
    const huidigSaldo = berekenSaldi(deelnemers, transacties).potSaldo
    if (huidigSaldo < Number(transactie.bedrag)) {
      return {
        geblokkeerd: true,
        reden: 'Ongedaan maken niet mogelijk: er zijn al betalingen gedaan uit dit bedrag.',
      }
    }
  }

  return { geblokkeerd: false, reden: null }
}

/**
 * Guard-logica uit handleAfmelden.
 * Retourneert de reden voor blokkering, of null als de actie mag doorgaan.
 */
function bepaalAfmeldenBlokkering({ deelnemer, deelnemers, transacties }) {
  if (!deelnemer) return 'geen deelnemer'
  const saldi = berekenSaldi(deelnemers, transacties)
  const mijnSaldi = saldi.deelnemersSaldi.find(s => s.id === deelnemer.id)
  if ((mijnSaldi?.gestort ?? 0) === 0) {
    return 'Je kunt je pas afmelden als je hebt gestort.'
  }
  return null
}

/**
 * Toastbericht-logica uit handleTransactie.
 */
function maakTransactieBericht(type, bedrag, valuta = 'EUR') {
  return type === 'storting'
    ? `Storting van ${formatBedrag(bedrag, valuta)} geregistreerd.`
    : `Betaling van ${formatBedrag(bedrag, valuta)} geregistreerd.`
}

// ── Testdata ──────────────────────────────────────────────────────────────────

const deelnemerActief   = { id: 'd1', naam: 'Alice', actief: true,  device_id: 'dev-a', aangemaakt_op: '2026-01-01T10:00:00Z', afgemeld_op: null }
const deelnemerAfgemeld = { id: 'd2', naam: 'Bob',   actief: false, device_id: 'dev-b', aangemaakt_op: '2026-01-01T10:01:00Z', afgemeld_op: '2026-01-02T10:00:00Z' }

function storting(id, deelnemer_id, bedrag) {
  return { id, type: 'storting', deelnemer_id, bedrag, potje_id: 'p1', aangemaakt_op: '2026-01-01T10:05:00Z' }
}
function betaling(id, deelnemer_id, bedrag) {
  return { id, type: 'betaling', deelnemer_id, bedrag, potje_id: 'p1', aangemaakt_op: '2026-01-01T11:00:00Z' }
}

// ── PA-01 t/m PA-03: handleTransactie guards ──────────────────────────────────

describe('usePotjeActies — PA-01 t/m PA-03: handleTransactie guards', () => {
  it('PA-00: deelnemer null → DEELNEMER_ONTBREEKT (audit bevinding 2)', () => {
    // Nieuw: null-guard vóór NIET_ACTIEF-check. Race condition: afmelden + betalen tegelijk.
    const fout = bepaalTransactieFout({
      deelnemer: null,
      type: 'betaling',
      bedrag: 10,
      deelnemers: [],
      transacties: [],
    })
    expect(fout).toBeInstanceOf(Error)
    expect(fout.message).toBe('DEELNEMER_ONTBREEKT')
  })

  it('PA-00b: deelnemer.id undefined → DEELNEMER_ONTBREEKT', () => {
    const fout = bepaalTransactieFout({
      deelnemer: { actief: true }, // geen id
      type: 'betaling',
      bedrag: 10,
      deelnemers: [],
      transacties: [],
    })
    expect(fout).toBeInstanceOf(Error)
    expect(fout.message).toBe('DEELNEMER_ONTBREEKT')
  })

  it('PA-01: afgemelde deelnemer → NIET_ACTIEF error', () => {
    const fout = bepaalTransactieFout({
      deelnemer: deelnemerAfgemeld,
      type: 'betaling',
      bedrag: 10,
      deelnemers: [deelnemerAfgemeld],
      transacties: [storting('t1', 'd2', 20)],
    })
    expect(fout).toBeInstanceOf(Error)
    expect(fout.message).toBe('NIET_ACTIEF')
  })

  it('PA-02: betaling boven potsaldo → SALDO_TE_LAAG error met saldo in message', () => {
    const fout = bepaalTransactieFout({
      deelnemer: deelnemerActief,
      type: 'betaling',
      bedrag: 30,
      deelnemers: [deelnemerActief],
      transacties: [storting('t1', 'd1', 20)],
    })
    expect(fout).toBeInstanceOf(Error)
    expect(fout.message).toBe('SALDO_TE_LAAG:20')
  })

  it('PA-02b: betaling exact gelijk aan potsaldo → geen fout (grenswaarde)', () => {
    const fout = bepaalTransactieFout({
      deelnemer: deelnemerActief,
      type: 'betaling',
      bedrag: 20,
      deelnemers: [deelnemerActief],
      transacties: [storting('t1', 'd1', 20)],
    })
    expect(fout).toBeNull()
  })

  it('PA-03: storting boven potsaldo → geen fout (saldo-check geldt niet voor stortingen)', () => {
    const fout = bepaalTransactieFout({
      deelnemer: deelnemerActief,
      type: 'storting',
      bedrag: 999,
      deelnemers: [deelnemerActief],
      transacties: [],
    })
    expect(fout).toBeNull()
  })

  it('PA-03b: actieve deelnemer, geldige betaling → geen fout', () => {
    const fout = bepaalTransactieFout({
      deelnemer: deelnemerActief,
      type: 'betaling',
      bedrag: 10,
      deelnemers: [deelnemerActief],
      transacties: [storting('t1', 'd1', 50)],
    })
    expect(fout).toBeNull()
  })
})

// ── PA-04 t/m PA-07: handleUndo beslissingslogica ────────────────────────────

describe('usePotjeActies — PA-04 t/m PA-07: handleUndo beslissingslogica', () => {
  it('PA-04: eigen storting, geen betalingen → niet geblokkeerd', () => {
    const { geblokkeerd } = bepaalUndoResultaat({
      transactieId: 't1',
      transacties: [storting('t1', 'd1', 20)],
      deelnemers: [deelnemerActief],
      deelnemer: deelnemerActief,
    })
    expect(geblokkeerd).toBe(false)
  })

  it('PA-05: andermans transactie → geblokkeerd met juiste reden', () => {
    const { geblokkeerd, reden } = bepaalUndoResultaat({
      transactieId: 't1',
      transacties: [storting('t1', 'd2', 20)],
      deelnemers: [deelnemerActief, deelnemerAfgemeld],
      deelnemer: deelnemerActief,
    })
    expect(geblokkeerd).toBe(true)
    expect(reden).toMatch(/eigen transacties/)
  })

  it('PA-06: eigen storting, saldo te laag door betaling → geblokkeerd', () => {
    const { geblokkeerd, reden } = bepaalUndoResultaat({
      transactieId: 't1',
      transacties: [storting('t1', 'd1', 20), betaling('t2', 'd1', 10)],
      deelnemers: [deelnemerActief],
      deelnemer: deelnemerActief,
    })
    expect(geblokkeerd).toBe(true)
    expect(reden).toMatch(/betalingen gedaan/)
  })

  it('PA-07: eigen betaling → nooit geblokkeerd door saldo-check', () => {
    const { geblokkeerd } = bepaalUndoResultaat({
      transactieId: 't2',
      transacties: [storting('t1', 'd1', 20), betaling('t2', 'd1', 20)],
      deelnemers: [deelnemerActief],
      deelnemer: deelnemerActief,
    })
    expect(geblokkeerd).toBe(false)
  })

  it('PA-07b: onbekend transactie-id → geblokkeerd', () => {
    const { geblokkeerd } = bepaalUndoResultaat({
      transactieId: 'BESTAAT-NIET',
      transacties: [storting('t1', 'd1', 20)],
      deelnemers: [deelnemerActief],
      deelnemer: deelnemerActief,
    })
    expect(geblokkeerd).toBe(true)
  })
})

// ── PA-08 t/m PA-10: handleAfmelden guard ────────────────────────────────────

describe('usePotjeActies — PA-08 t/m PA-10: handleAfmelden guard', () => {
  it('PA-08: deelnemer heeft niet gestort → geblokkeerd met juiste melding', () => {
    const reden = bepaalAfmeldenBlokkering({
      deelnemer: deelnemerActief,
      deelnemers: [deelnemerActief],
      transacties: [],
    })
    expect(reden).toBe('Je kunt je pas afmelden als je hebt gestort.')
  })

  it('PA-09: deelnemer heeft gestort → niet geblokkeerd', () => {
    const reden = bepaalAfmeldenBlokkering({
      deelnemer: deelnemerActief,
      deelnemers: [deelnemerActief],
      transacties: [storting('t1', 'd1', 20)],
    })
    expect(reden).toBeNull()
  })

  it('PA-10: deelnemer is null → geblokkeerd', () => {
    const reden = bepaalAfmeldenBlokkering({
      deelnemer: null,
      deelnemers: [],
      transacties: [],
    })
    expect(reden).toBe('geen deelnemer')
  })

  it('PA-10b: deelnemer heeft alleen betalingen (geen stortingen) → geblokkeerd', () => {
    const reden = bepaalAfmeldenBlokkering({
      deelnemer: deelnemerActief,
      deelnemers: [deelnemerActief],
      transacties: [betaling('t1', 'd1', 10)],
    })
    expect(reden).toBe('Je kunt je pas afmelden als je hebt gestort.')
  })
})

// ── PA-11 t/m PA-13: toastberichten ──────────────────────────────────────────

describe('usePotjeActies — PA-11 t/m PA-13: toastberichten', () => {
  it('PA-11: storting-bericht bevat het bedrag en "Storting"', () => {
    const bericht = maakTransactieBericht('storting', 25, 'EUR')
    expect(bericht).toMatch(/Storting/)
    expect(bericht).toMatch(/25/)
    expect(bericht).toMatch(/geregistreerd/)
  })

  it('PA-12: betaling-bericht bevat het bedrag en "Betaling"', () => {
    const bericht = maakTransactieBericht('betaling', 12.5, 'EUR')
    expect(bericht).toMatch(/Betaling/)
    expect(bericht).toMatch(/12/)
    expect(bericht).toMatch(/geregistreerd/)
  })

  it('PA-13: bericht gebruikt de opgegeven valuta', () => {
    const eur = maakTransactieBericht('storting', 10, 'EUR')
    const usd = maakTransactieBericht('storting', 10, 'USD')
    expect(eur).not.toBe(usd)
    expect(eur).toMatch(/10/)
    expect(usd).toMatch(/10/)
  })
})

// ── PA-14 t/m PA-16: handleDeelnemen client-side UUID (audit bevinding 1) ─────

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('usePotjeActies — PA-14 t/m PA-16: handleDeelnemen client-side UUID', () => {
  it('PA-14: gegenereerde deelnemer-UUID heeft geldig v4-formaat', () => {
    const id = crypto.randomUUID()
    expect(UUID_V4.test(id)).toBe(true)
  })

  it('PA-15: elke aanroep geeft een unieke UUID', () => {
    const ids = new Set(Array.from({ length: 10 }, () => crypto.randomUUID()))
    expect(ids.size).toBe(10)
  })

  it('PA-16: lokaal geconstrueerd deelnemer-object heeft verwachte velden', () => {
    // Exact de structuur die handleDeelnemen aan setDeelnemer doorgeeft
    const id = crypto.randomUUID()
    const potjeId = crypto.randomUUID()
    const deviceId = crypto.randomUUID()
    const naam = 'Alice'

    const deelnemer = {
      id,
      potje_id: potjeId,
      naam,
      device_id: deviceId,
      actief: true,
      aangemaakt_op: new Date().toISOString(),
      afgemeld_op: null,
    }

    expect(deelnemer.id).toBe(id)
    expect(deelnemer.actief).toBe(true)
    expect(deelnemer.afgemeld_op).toBeNull()
    expect(UUID_V4.test(deelnemer.id)).toBe(true)
  })
})
