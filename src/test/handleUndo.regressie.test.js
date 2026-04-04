/**
 * handleUndo — regressietests voor het ongedaan maken van transacties
 *
 * De handleUndo-functie staat in usePotjeActies.js en bevat business logic
 * met security-impact. Deze tests dekken alle codepaden als pure
 * logica-extractie — geen Supabase-mock, geen component mount nodig.
 *
 * Gedekte regressierisico's:
 *   UD-1  Undo van eigen transactie → toegestaan
 *   UD-2  Undo van andermans transactie → geblokkeerd
 *   UD-3  Undo van storting terwijl potsaldo < bedrag → geblokkeerd
 *   UD-4  Undo van storting terwijl potsaldo >= bedrag → toegestaan
 *   UD-5  Undo van betaling → altijd toegestaan (geen saldo-check)
 *   UD-6  Undo van onbekende transactie (id bestaat niet) → geblokkeerd
 *   UD-7  Undo terwijl deelnemer null is → geblokkeerd
 *   UD-8  Grensgeval saldo exact gelijk aan stortingsbedrag
 *   UD-9  Stale-closure bug: deelnemerOverride prevaleert boven closure-deelnemer
 *
 * Teststrategie:
 *   De beslissingslogica uit handleUndo wordt geëxtraheerd als pure functie.
 *   Als de component verandert, moet deze functie ook worden bijgewerkt.
 *
 * Signatuur (usePotjeActies.js — handleUndo):
 *   handleUndo(transactie, deelnemerOverride?)
 *
 *   - transactie:         het volledige transactie-object (uit Supabase INSERT response)
 *   - deelnemerOverride:  optioneel — snapshot van `deelnemer` op het moment van de
 *                         transactie, doorgegeven vanuit handleTransactie om de
 *                         stale-closure bug te omzeilen waarbij de useCallback-closure
 *                         nog de oude (null) deelnemer vasthoudt.
 *
 * Beslissingslogica:
 *   1. actiefDeelnemer = deelnemerOverride ?? deelnemer (closure)
 *   2. if (!transactie || transactie.deelnemer_id !== actiefDeelnemer?.id) → blokkeer
 *   3. if (transactie.type === 'storting' && potsaldo < bedrag) → blokkeer
 *   4. anders → verwijder toegestaan
 */

import { describe, it, expect } from 'vitest'
import { berekenSaldi } from '../utils/berekenSaldi'

// ─── Extractie van de undo-beslissingslogica uit usePotjeActies ──────────────
// Retourneert: { toegestaan: boolean, reden: string | null }
//
// Parameters spiegelen de productie-implementatie:
//   transactie         — het volledige transactie-object
//   deelnemer          — de deelnemer uit de useCallback-closure (kan stale/null zijn)
//   deelnemerOverride  — snapshot meegegeven vanuit handleTransactie (optioneel)
//   transacties        — huidig transactie-array (voor saldo-check)

function bepaalUndoToegestaan({ transactie, transacties, deelnemer, deelnemerOverride }) {
  const actiefDeelnemer = deelnemerOverride ?? deelnemer

  // Check 1: transactie moet bestaan én van de actieve deelnemer zijn
  if (!transactie || transactie.deelnemer_id !== actiefDeelnemer?.id) {
    return {
      toegestaan: false,
      reden: 'Je kunt alleen je eigen transacties ongedaan maken.',
    }
  }

  // Check 2: storting terugdraaien alleen als potsaldo het toelaat
  if (transactie.type === 'storting') {
    const deelnemersVoorSaldo = [{ id: actiefDeelnemer.id, naam: actiefDeelnemer.naam, aangemaakt_op: new Date(2026, 0, 1).toISOString(), actief: true, afgemeld_op: null }]
    const huidigSaldo = berekenSaldi(deelnemersVoorSaldo, transacties).potSaldo
    if (huidigSaldo < Number(transactie.bedrag)) {
      return {
        toegestaan: false,
        reden: 'Ongedaan maken niet mogelijk: er zijn al betalingen gedaan uit dit bedrag.',
      }
    }
  }

  return { toegestaan: true, reden: null }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const deelnemerA = { id: 'deelnemer-a', naam: 'Alice' }
const deelnemerB = { id: 'deelnemer-b', naam: 'Bob' }

function maakStorting(id, deelnemer_id, bedrag) {
  return { id, type: 'storting', deelnemer_id, bedrag, potje_id: 'potje-1', aangemaakt_op: new Date().toISOString() }
}

function maakBetaling(id, deelnemer_id, bedrag) {
  return { id, type: 'betaling', deelnemer_id, bedrag, potje_id: 'potje-1', aangemaakt_op: new Date().toISOString() }
}

// ─── UD-1: Undo van eigen transactie → toegestaan ────────────────────────────

describe('handleUndo — UD-1: undo van eigen transactie is toegestaan', () => {
  it('eigen storting zonder betalingen → toegestaan', () => {
    const transacties = [maakStorting('tx-1', deelnemerA.id, 20)]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', deelnemerA.id, 20),
      transacties,
      deelnemer: deelnemerA,
    })
    expect(toegestaan).toBe(true)
  })

  it('eigen betaling → altijd toegestaan (geen saldo-check)', () => {
    const transacties = [
      maakStorting('tx-1', deelnemerA.id, 50),
      maakBetaling('tx-2', deelnemerA.id, 30),
    ]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakBetaling('tx-2', deelnemerA.id, 30),
      transacties,
      deelnemer: deelnemerA,
    })
    expect(toegestaan).toBe(true)
  })
})

// ─── UD-2: Undo van andermans transactie → geblokkeerd ───────────────────────

describe('handleUndo — UD-2: undo van andermans transactie is geblokkeerd', () => {
  it('transactie van deelnemer B, ingelogd als A → geblokkeerd', () => {
    const transacties = [maakStorting('tx-1', deelnemerB.id, 20)]
    const { toegestaan, reden } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', deelnemerB.id, 20),
      transacties,
      deelnemer: deelnemerA,
    })
    expect(toegestaan).toBe(false)
    expect(reden).toMatch(/eigen transacties/)
  })

  it('betaling van deelnemer B, ingelogd als A → geblokkeerd', () => {
    const transacties = [
      maakStorting('tx-1', deelnemerA.id, 50),
      maakBetaling('tx-2', deelnemerB.id, 30),
    ]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakBetaling('tx-2', deelnemerB.id, 30),
      transacties,
      deelnemer: deelnemerA,
    })
    expect(toegestaan).toBe(false)
  })
})

// ─── UD-3: Undo van storting terwijl saldo te laag → geblokkeerd ─────────────

describe('handleUndo — UD-3: undo storting geblokkeerd bij te laag saldo', () => {
  it('storting €20, daarna betaling €10 → saldo €10 < storting €20 → geblokkeerd', () => {
    const transacties = [
      maakStorting('tx-1', deelnemerA.id, 20),
      maakBetaling('tx-2', deelnemerA.id, 10),
    ]
    const { toegestaan, reden } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', deelnemerA.id, 20),
      transacties,
      deelnemer: deelnemerA,
    })
    expect(toegestaan).toBe(false)
    expect(reden).toMatch(/betalingen gedaan/)
  })

  it('storting €20, betaling €20 → saldo €0 < storting €20 → geblokkeerd', () => {
    const transacties = [
      maakStorting('tx-1', deelnemerA.id, 20),
      maakBetaling('tx-2', deelnemerA.id, 20),
    ]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', deelnemerA.id, 20),
      transacties,
      deelnemer: deelnemerA,
    })
    expect(toegestaan).toBe(false)
  })

  it('storting €50, betaling €30 → saldo €20 < storting €50 → geblokkeerd', () => {
    const transacties = [
      maakStorting('tx-1', deelnemerA.id, 50),
      maakBetaling('tx-2', deelnemerA.id, 30),
    ]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', deelnemerA.id, 50),
      transacties,
      deelnemer: deelnemerA,
    })
    expect(toegestaan).toBe(false)
  })
})

// ─── UD-4: Undo van storting terwijl saldo voldoende → toegestaan ────────────

describe('handleUndo — UD-4: undo storting toegestaan bij voldoende saldo', () => {
  it('storting €20, geen betalingen → saldo €20 >= €20 → toegestaan', () => {
    const transacties = [maakStorting('tx-1', deelnemerA.id, 20)]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', deelnemerA.id, 20),
      transacties,
      deelnemer: deelnemerA,
    })
    expect(toegestaan).toBe(true)
  })

  it('twee stortingen €20 + €30, geen betalingen → tweede storting undo toegestaan', () => {
    const transacties = [
      maakStorting('tx-1', deelnemerA.id, 20),
      maakStorting('tx-2', deelnemerA.id, 30),
    ]
    // Saldo = 50, storting tx-2 = 30, saldo >= bedrag → toegestaan
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-2', deelnemerA.id, 30),
      transacties,
      deelnemer: deelnemerA,
    })
    expect(toegestaan).toBe(true)
  })

  it('storting €50, betaling €10 → saldo €40 >= storting €50? Nee → geblokkeerd', () => {
    // Grensgeval: saldo (40) < storting (50) → nog steeds geblokkeerd
    const transacties = [
      maakStorting('tx-1', deelnemerA.id, 50),
      maakBetaling('tx-2', deelnemerA.id, 10),
    ]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', deelnemerA.id, 50),
      transacties,
      deelnemer: deelnemerA,
    })
    expect(toegestaan).toBe(false)
  })
})

// ─── UD-5: Undo van betaling → altijd toegestaan ─────────────────────────────

describe('handleUndo — UD-5: undo van betaling altijd toegestaan (geen saldo-check)', () => {
  it('eigen betaling, saldo is 0 → toch toegestaan', () => {
    // Bij betaling is er geen saldo-check — alleen eigenaarschap telt
    const transacties = [
      maakStorting('tx-1', deelnemerA.id, 20),
      maakBetaling('tx-2', deelnemerA.id, 20),
    ]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakBetaling('tx-2', deelnemerA.id, 20),
      transacties,
      deelnemer: deelnemerA,
    })
    expect(toegestaan).toBe(true)
  })

  it('eigen betaling, groot bedrag → toegestaan', () => {
    const transacties = [
      maakStorting('tx-1', deelnemerA.id, 999),
      maakBetaling('tx-2', deelnemerA.id, 999),
    ]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakBetaling('tx-2', deelnemerA.id, 999),
      transacties,
      deelnemer: deelnemerA,
    })
    expect(toegestaan).toBe(true)
  })
})

// ─── UD-6: Undo van onbekend transactie-id → geblokkeerd ─────────────────────

describe('handleUndo — UD-6: null/undefined transactie-object is geblokkeerd', () => {
  it('transactie is null → geblokkeerd', () => {
    const { toegestaan, reden } = bepaalUndoToegestaan({
      transactie: null,
      transacties: [maakStorting('tx-1', deelnemerA.id, 20)],
      deelnemer: deelnemerA,
    })
    expect(toegestaan).toBe(false)
    expect(reden).toMatch(/eigen transacties/)
  })

  it('transactie is undefined → geblokkeerd', () => {
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: undefined,
      transacties: [],
      deelnemer: deelnemerA,
    })
    expect(toegestaan).toBe(false)
  })
})

// ─── UD-7: Undo terwijl deelnemer null is → geblokkeerd ──────────────────────

describe('handleUndo — UD-7: geen actieve deelnemer → altijd geblokkeerd', () => {
  it('deelnemer is null → geblokkeerd zonder crash', () => {
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', deelnemerA.id, 20),
      transacties: [maakStorting('tx-1', deelnemerA.id, 20)],
      deelnemer: null,
    })
    expect(toegestaan).toBe(false)
  })

  it('deelnemer is undefined → geblokkeerd zonder crash', () => {
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', deelnemerA.id, 20),
      transacties: [maakStorting('tx-1', deelnemerA.id, 20)],
      deelnemer: undefined,
    })
    expect(toegestaan).toBe(false)
  })
})

// ─── UD-8: Grensgeval — saldo exact gelijk aan stortingsbedrag ───────────────

describe('handleUndo — UD-8: grensgeval saldo exact gelijk aan stortingsbedrag', () => {
  it('saldo exact gelijk aan storting → toegestaan (>=, niet >)', () => {
    // Saldo = 20, storting = 20, geen betalingen → saldo >= bedrag → toegestaan
    const transacties = [maakStorting('tx-1', deelnemerA.id, 20)]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', deelnemerA.id, 20),
      transacties,
      deelnemer: deelnemerA,
    })
    // Saldo is 20 (alleen de storting), bedrag is 20, 20 < 20 is false → toegestaan
    expect(toegestaan).toBe(true)
  })

  it('saldo €0.01 onder stortingsbedrag → geblokkeerd', () => {
    const transacties = [
      maakStorting('tx-1', deelnemerA.id, 20),
      maakBetaling('tx-2', deelnemerA.id, 0.01),
    ]
    // Saldo = 19.99, bedrag storting = 20, 19.99 < 20 → geblokkeerd
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', deelnemerA.id, 20),
      transacties,
      deelnemer: deelnemerA,
    })
    expect(toegestaan).toBe(false)
  })
})

// ─── UD-9: Stale-closure bug — deelnemerOverride prevaleert ──────────────────
// Reproduceert de bug uit de schermafbeelding: deelnemer in closure is null
// (race condition bij laden), maar deelnemerOverride is de correcte snapshot.

describe('handleUndo — UD-9: stale-closure bug — deelnemerOverride prevaleert', () => {
  it('closure-deelnemer null, override correct → toegestaan', () => {
    // Simuleert: handleTransactie gecreëerd vóór deelnemer geladen was (null),
    // maar de snapshot (deelnemerOverride) is correct meegegeven.
    const transacties = [maakStorting('tx-1', deelnemerA.id, 20)]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', deelnemerA.id, 20),
      transacties,
      deelnemer: null,               // stale closure → null
      deelnemerOverride: deelnemerA, // snapshot → correct
    })
    expect(toegestaan).toBe(true)
  })

  it('closure-deelnemer null, override ook null → geblokkeerd', () => {
    const transacties = [maakStorting('tx-1', deelnemerA.id, 20)]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', deelnemerA.id, 20),
      transacties,
      deelnemer: null,
      deelnemerOverride: null,
    })
    expect(toegestaan).toBe(false)
  })

  it('closure-deelnemer verkeerd (oud), override correct → toegestaan', () => {
    // Simuleert een deelnemer die tussentijds ververst is in de state
    const transacties = [maakStorting('tx-1', deelnemerA.id, 20)]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: maakStorting('tx-1', deelnemerA.id, 20),
      transacties,
      deelnemer: deelnemerB,         // stale: verkeerde deelnemer in closure
      deelnemerOverride: deelnemerA, // snapshot: correct
    })
    expect(toegestaan).toBe(true)
  })
})
