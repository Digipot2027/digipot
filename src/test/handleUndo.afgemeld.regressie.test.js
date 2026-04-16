/**
 * Regressietests — handleUndo met afgemelde deelnemer-snapshot (#8)
 *
 * Probleem:
 *   handleTransactie maakt een snapshot van `deelnemer` op het moment van
 *   de transactie en geeft die mee als `deelnemerOverride` aan handleUndo.
 *   Dit lost de stale-closure bug op (UD-9 in handleUndo.regressie.test.js).
 *
 *   Maar: als de deelnemer NADAT de snapshot is genomen wordt afgemeld,
 *   heeft de snapshot nog `actief: true`. handleUndo checkt eigenaarschap
 *   via `deelnemerOverride.id` — niet via `deelnemerOverride.actief`.
 *
 *   Scenario (tijdlijn):
 *     T=0s  Alice doet storting €25 → toast met Undo-knop verschijnt (10s)
 *           snapshot: { id: 'alice', actief: true }
 *     T=3s  Alice meldt zich af → deelnemer.actief wordt false (realtime)
 *     T=8s  Alice klikt Undo in de toast
 *           deelnemerOverride = snapshot = { id: 'alice', actief: true }
 *
 *   Vraag: wordt de undo toegestaan?
 *   Antwoord (huidig gedrag): JA — actief wordt niet gecheckt in handleUndo.
 *
 *   Is dit een bug? Gedeeltelijk. De DB-trigger blokkeert misschien niet
 *   (undo is een DELETE op transacties, niet een INSERT). De UI geeft geen
 *   expliciete foutmelding als de undo op een afgemelde deelnemer slaat.
 *
 * Gedekte scenarios:
 *   UA-01  Undo met actieve snapshot → toegestaan (normaal pad)
 *   UA-02  Undo met afgemelde snapshot (actief=false) → HUIDIG GEDRAG: toegestaan
 *   UA-03  Undo met afgemelde snapshot, saldo te laag → geblokkeerd (saldo wint)
 *   UA-04  Undo zonder snapshot, deelnemer inmiddels afgemeld → eigenaarschap check
 *   UA-05  Snapshot actief=true vs closure actief=false → snapshot prevaleert
 *   UA-06  Twee transacties: één vóór afmelden (met snapshot), één na (geen snapshot)
 *   UA-07  deelnemerOverride.actief wordt niet gecheckt — gedocumenteerde beperking
 */

import { describe, it, expect } from 'vitest'
import { berekenSaldi } from '../utils/berekenSaldi'

// ── Geëxtraheerde beslissingslogica ──────────────────────────────────────────
// Exacte kopie van handleUndo in usePotjeActies.js.
// actief-check is bewust NIET aanwezig — dat is het gedocumenteerde gat.

function bepaalUndoToegestaan({ transactie, transacties, deelnemer, deelnemerOverride }) {
  const actiefDeelnemer = deelnemerOverride ?? deelnemer

  if (!transactie || transactie.deelnemer_id !== actiefDeelnemer?.id) {
    return { toegestaan: false, reden: 'Je kunt alleen je eigen transacties ongedaan maken.' }
  }

  if (transactie.type === 'storting') {
    const hulpDeelnemers = [{
      id: actiefDeelnemer.id,
      naam: actiefDeelnemer.naam ?? 'x',
      aangemaakt_op: new Date(2026, 0, 1).toISOString(),
      actief: true,
      afgemeld_op: null,
    }]
    const huidigSaldo = berekenSaldi(hulpDeelnemers, transacties).potSaldo
    if (huidigSaldo < Number(transactie.bedrag)) {
      return {
        toegestaan: false,
        reden: 'Ongedaan maken niet mogelijk: er zijn al betalingen gedaan uit dit bedrag.',
      }
    }
  }

  return { toegestaan: true, reden: null }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function maakStorting(id, deelnemer_id, bedrag) {
  return { id, type: 'storting', deelnemer_id, bedrag, potje_id: 'p1', aangemaakt_op: new Date().toISOString() }
}

function maakBetaling(id, deelnemer_id, bedrag) {
  return { id, type: 'betaling', deelnemer_id, bedrag, potje_id: 'p1', aangemaakt_op: new Date().toISOString() }
}

const aliceActief    = { id: 'alice', naam: 'Alice', actief: true,  afgemeld_op: null }
const aliceAfgemeld  = { id: 'alice', naam: 'Alice', actief: false, afgemeld_op: new Date().toISOString() }

// ── UA-01: Undo met actieve snapshot → toegestaan (normaal pad) ───────────────

describe('handleUndo — UA-01: actieve snapshot, normaal pad', () => {
  it('eigen storting, snapshot actief=true, saldo voldoende → toegestaan', () => {
    const transacties = [maakStorting('tx-1', 'alice', 25)]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', 'alice', 25),
      transacties,
      deelnemer: aliceActief,
      deelnemerOverride: aliceActief,
    })
    expect(toegestaan).toBe(true)
  })

  it('eigen betaling, snapshot actief=true → toegestaan (geen saldo-check)', () => {
    const transacties = [
      maakStorting('tx-1', 'alice', 25),
      maakBetaling('tx-2', 'alice', 20),
    ]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakBetaling('tx-2', 'alice', 20),
      transacties,
      deelnemer: aliceActief,
      deelnemerOverride: aliceActief,
    })
    expect(toegestaan).toBe(true)
  })
})

// ── UA-02: Undo met afgemelde snapshot → huidig gedrag: toegestaan ────────────

describe('handleUndo — UA-02: afgemelde snapshot, HUIDIG GEDRAG gedocumenteerd', () => {
  it('snapshot actief=false, storting eigen, saldo voldoende → TOEGESTAAN (actief niet gecheckt)', () => {
    // Tijdlijn: storting → afmelden → undo binnen 10s
    // Snapshot was actief=true, maar deelnemer is inmiddels afgemeld (actief=false).
    // handleUndo checkt eigenaarschap (id match) — NIET actief-status.
    // Huidig gedrag: toegestaan. Als in de toekomst actief-check wordt toegevoegd,
    // faalt deze test — dat is het gewenste signaal.
    const transacties = [maakStorting('tx-1', 'alice', 25)]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', 'alice', 25),
      transacties,
      deelnemer: aliceAfgemeld,      // closure: inmiddels afgemeld
      deelnemerOverride: aliceAfgemeld, // snapshot: ook al afgemeld op het moment van undo
    })
    expect(toegestaan).toBe(true) // HUIDIG GEDRAG
  })

  it('snapshot was actief=true, closure nu actief=false → snapshot prevaleert, id matcht → toegestaan', () => {
    // Exacte race-condition tijdlijn:
    //   T=0  storting → snapshot = aliceActief (actief: true)
    //   T=3  afmelden → closure-deelnemer = aliceAfgemeld (actief: false)
    //   T=8  undo → override = aliceActief (snapshot), closure = aliceAfgemeld
    const transacties = [maakStorting('tx-1', 'alice', 25)]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', 'alice', 25),
      transacties,
      deelnemer: aliceAfgemeld,   // closure: al afgemeld
      deelnemerOverride: aliceActief, // snapshot: was actief bij storting
    })
    expect(toegestaan).toBe(true)
  })
})

// ── UA-03: Afgemelde snapshot + saldo te laag → geblokkeerd (saldo wint) ──────

describe('handleUndo — UA-03: afgemelde snapshot + saldo te laag → geblokkeerd', () => {
  it('afgemeld, storting €25, betaling €10 → saldo €15 < €25 → geblokkeerd', () => {
    const transacties = [
      maakStorting('tx-1', 'alice', 25),
      maakBetaling('tx-2', 'alice', 10),
    ]
    const { toegestaan, reden } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', 'alice', 25),
      transacties,
      deelnemer: aliceAfgemeld,
      deelnemerOverride: aliceAfgemeld,
    })
    expect(toegestaan).toBe(false)
    expect(reden).toMatch(/betalingen gedaan/)
  })

  it('afgemeld, betaling eigen, saldo 0 → TOEGESTAAN (geen saldo-check bij betaling)', () => {
    const transacties = [
      maakStorting('tx-1', 'alice', 25),
      maakBetaling('tx-2', 'alice', 25),
    ]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakBetaling('tx-2', 'alice', 25),
      transacties,
      deelnemer: aliceAfgemeld,
      deelnemerOverride: aliceAfgemeld,
    })
    expect(toegestaan).toBe(true)
  })
})

// ── UA-04: Undo zonder snapshot, deelnemer inmiddels afgemeld ─────────────────

describe('handleUndo — UA-04: geen snapshot, closure is afgemelde deelnemer', () => {
  it('geen override, closure=afgemeld, transactie van alice → eigenaarschap op id → toegestaan', () => {
    // Geen deelnemerOverride (bijv. undo geactiveerd via een andere route dan handleTransactie).
    // De closure-deelnemer is afgemeld maar heeft nog hetzelfde id.
    // Eigenaarschapscheck is puur op id — toegestaan.
    const transacties = [maakStorting('tx-1', 'alice', 25)]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', 'alice', 25),
      transacties,
      deelnemer: aliceAfgemeld,
      deelnemerOverride: undefined,
    })
    expect(toegestaan).toBe(true)
  })
})

// ── UA-05: Snapshot actief=true vs closure actief=false → snapshot wint ───────

describe('handleUndo — UA-05: override prevaleert boven closure (eigenaarschap op id)', () => {
  it('override.id matcht → toegestaan, ongeacht closure.actief', () => {
    const transacties = [maakStorting('tx-1', 'alice', 25)]
    const resultaatMetOverride = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', 'alice', 25),
      transacties,
      deelnemer: aliceAfgemeld,
      deelnemerOverride: aliceActief,
    })
    const resultaatZonderOverride = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', 'alice', 25),
      transacties,
      deelnemer: aliceAfgemeld,
      deelnemerOverride: undefined,
    })
    // Beide hebben id='alice' → beide toegestaan
    expect(resultaatMetOverride.toegestaan).toBe(true)
    expect(resultaatZonderOverride.toegestaan).toBe(true)
  })
})

// ── UA-06: Twee transacties — één vóór afmelden (met snapshot), één na ────────

describe('handleUndo — UA-06: twee transacties, één vóór en één na afmelden', () => {
  it('storting vóór afmelden (snapshot actief) → undo toegestaan', () => {
    const transacties = [
      maakStorting('tx-1', 'alice', 25), // vóór afmelden
    ]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', 'alice', 25),
      transacties,
      deelnemer: aliceAfgemeld,
      deelnemerOverride: aliceActief, // snapshot van vóór afmelden
    })
    expect(toegestaan).toBe(true)
  })

  it('hypothetische storting na afmelden is onmogelijk (UI blokkeert dit)', () => {
    // Na afmelden is de Betalen/Storten-knop verdwenen én de server blokkeert de INSERT.
    // Er kan dus geen snapshot bestaan van een transactie na afmelden.
    // Dit testgeval documenteert de aanname, geen productiescenario.
    expect(true).toBe(true) // no-op documentatie-test
  })
})

// ── UA-07: actief wordt niet gecheckt — gedocumenteerde beperking ─────────────

describe('handleUndo — UA-07: actiefstatus is geen input van de beslissingslogica', () => {
  it('beslissingslogica heeft geen actief-check op de deelnemer — gedocumenteerd gat', () => {
    // Als iemand een actief-check toevoegt aan bepaalUndoToegestaan(), moet
    // UA-02 worden herschreven zodat 'toegestaan: false' verwacht wordt voor
    // afgemelde deelnemers.
    const broncode = bepaalUndoToegestaan.toString()
    expect(broncode).not.toContain('actiefDeelnemer.actief')
    expect(broncode).not.toContain('actief === false')
    expect(broncode).not.toContain('actief !== true')
  })
})
