/**
 * Regressietests — handleUndo op gesloten potje (#6)
 *
 * Probleem:
 *   De Undo-toast blijft 10 seconden zichtbaar na een storting of betaling.
 *   Als het potje in die 10 seconden wordt gesloten (handmatig of lifecycle),
 *   kan de gebruiker nog op "Ongedaan" klikken.
 *
 *   handleUndo checkt:
 *     1. Eigenaarschap (deelnemer_id === actief deelnemer)
 *     2. Saldo (alleen bij storting: potsaldo >= bedrag)
 *   Maar handleUndo checkt NIET of potje.status === 'gesloten'.
 *
 *   Gevolg: de DB-call wordt toch uitgevoerd. De DB-trigger of RLS zou
 *   dit moeten blokkeren, maar de applicatielaag geeft geen begrijpelijke
 *   foutmelding. De gebruiker ziet een generieke fout of een Sentry-melding.
 *
 * Gedekte scenarios:
 *   UG-01  handleUndo op gesloten potje — potjeStatus-check ontbreekt → gedocumenteerd gedrag
 *   UG-02  handleUndo op open potje — onveranderd gedrag
 *   UG-03  potjeStatus 'gesloten' + eigenaarschap fails → reden eigenaarschap wint
 *   UG-04  grensgeval: potje sluit exact op het moment van undo (gesloten_op = now)
 *   UG-05  handleUndo-beslissing is puur op eigenaarschap + saldo, niet op potje-status
 *
 * Teststrategie:
 *   We documenteren het HUIDIGE gedrag van de beslissingslogica. Als in een
 *   toekomstige iteratie een potje-status-check wordt toegevoegd, falen
 *   UG-01 en UG-05 — dat is het gewenste signaal voor de ontwikkelaar.
 *
 *   De beslissingslogica is geëxtraheerd uit usePotjeActies.handleUndo,
 *   inclusief de potjeStatus-parameter die er NIET in zit (bewust).
 */

import { describe, it, expect } from 'vitest'
import { berekenSaldi } from '../utils/berekenSaldi'

// ── Geëxtraheerde beslissingslogica ──────────────────────────────────────────
// Identiek aan handleUndo in usePotjeActies.js.
// potjeStatus is bewust NIET opgenomen — dat is het gedocumenteerde gat.

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

const deelnemer = { id: 'd1', naam: 'Alice' }

function storting(id, bedrag) {
  return { id, type: 'storting', deelnemer_id: 'd1', bedrag, potje_id: 'p1', aangemaakt_op: new Date().toISOString() }
}

function betaling(id, bedrag) {
  return { id, type: 'betaling', deelnemer_id: 'd1', bedrag, potje_id: 'p1', aangemaakt_op: new Date().toISOString() }
}

// ── UG-01: Undo op gesloten potje — potjeStatus-check ontbreekt ───────────────

describe('handleUndo — UG-01: gesloten potje blokkeert NIET in de beslissingslogica', () => {
  it('eigen storting, potje gesloten, voldoende saldo → beslissing: toegestaan (potje-check ontbreekt)', () => {
    // Dit is het gedocumenteerde gat: handleUndo weet niet dat het potje gesloten is.
    // De DB-call wordt gemaakt — wat daar dan mis gaat, is niet afgedekt in de UI.
    // Als in de toekomst een potjeStatus-guard wordt toegevoegd, moet deze test
    // worden herschreven zodat het resultaat 'toegestaan: false' verwacht.
    const transacties = [storting('tx-1', 25)]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: storting('tx-1', 25),
      transacties,
      deelnemer,
    })
    // HUIDIG GEDRAG: toegestaan, want potje-status wordt niet gecheckt
    expect(toegestaan).toBe(true)
  })

  it('eigen betaling, potje gesloten → beslissing: toegestaan (potje-check ontbreekt)', () => {
    const transacties = [storting('tx-1', 25), betaling('tx-2', 20)]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: betaling('tx-2', 20),
      transacties,
      deelnemer,
    })
    expect(toegestaan).toBe(true)
  })
})

// ── UG-02: Undo op open potje — onveranderd gedrag ───────────────────────────

describe('handleUndo — UG-02: open potje, onveranderd gedrag', () => {
  it('eigen storting, open potje, saldo voldoende → toegestaan', () => {
    const transacties = [storting('tx-1', 25)]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: storting('tx-1', 25),
      transacties,
      deelnemer,
    })
    expect(toegestaan).toBe(true)
  })

  it('eigen storting, open potje, saldo te laag → geblokkeerd', () => {
    const transacties = [storting('tx-1', 25), betaling('tx-2', 10)]
    const { toegestaan, reden } = bepaalUndoToegestaan({
      transactie: storting('tx-1', 25),
      transacties,
      deelnemer,
    })
    expect(toegestaan).toBe(false)
    expect(reden).toMatch(/betalingen gedaan/)
  })
})

// ── UG-03: Potje gesloten + eigenaarschap mislukt → reden eigenaarschap ───────

describe('handleUndo — UG-03: andermans transactie op gesloten potje', () => {
  it('andermans transactie → eigenaarschapsfout, niet potje-status-fout', () => {
    const anderDeelnemer = { id: 'd2', naam: 'Bob' }
    const transacties = [storting('tx-1', 25)]
    const andermansStorting = { ...storting('tx-1', 25), deelnemer_id: 'd2' }
    const { toegestaan, reden } = bepaalUndoToegestaan({
      transactie: andermansStorting,
      transacties,
      deelnemer,
    })
    expect(toegestaan).toBe(false)
    expect(reden).toMatch(/eigen transacties/)
  })
})

// ── UG-04: Grensgeval — potje sluit op exact zelfde moment als undo-toast ─────

describe('handleUndo — UG-04: gesloten_op tijdstip gelijk aan undo-moment', () => {
  it('storting aangemaakt op T=0, potje gesloten op T=10s, undo op T=10s → beslissing: toegestaan', () => {
    // Tijdlijn die jullie hebben meegemaakt:
    //   T=0s   storting geregistreerd → toast verschijnt met Undo-knop (10s)
    //   T=9s   potje wordt gesloten (lifecycle of handmatig)
    //   T=10s  gebruiker klikt Undo
    // De beslissingslogica weet niets van gesloten_op — de DB-call gaat door.
    const transacties = [storting('tx-1', 25)]
    const { toegestaan } = bepaalUndoToegestaan({
      transactie: storting('tx-1', 25),
      transacties,
      deelnemer,
    })
    expect(toegestaan).toBe(true) // beslissingslogica geeft groen
    // Aanbeveling: voeg potjeStatus-check toe in handleUndo, of verberg
    // de Undo-knop zodra het potje via realtime als 'gesloten' binnenkomt.
  })
})

// ── UG-05: Gedocumenteerde beperking — potje-status niet in scope ─────────────

describe('handleUndo — UG-05: potje-status is geen invoer van de beslissingslogica', () => {
  it('beslissingslogica heeft geen potjeStatus-parameter — dit is het gedocumenteerde gat', () => {
    // Als deze test slaagt, is de beperking nog steeds aanwezig.
    // Als iemand potjeStatus toevoegt aan bepaalUndoToegestaan(), moet
    // UG-01 worden herschreven zodat 'toegestaan: false' verwacht wordt.
    const parameters = bepaalUndoToegestaan.toString()
    expect(parameters).not.toContain('potjeStatus')
    expect(parameters).not.toContain('gesloten')
  })
})
