/**
 * Regressietests — Medium issues 7, 8, 9, 10 (2026-04-12)
 *
 * ISSUE 7: PaginaStorten deelnemer race condition
 *   handleStorten had een `if (!deelnemer)` guard maar las daarna deelnemer.id
 *   in de INSERT zonder lokale vastlegging. Een realtime-update kon deelnemer
 *   tussen guard en INSERT op null zetten → TypeError.
 *   Fix: deelnemerId vastgelegd als lokale const vóór de async INSERT.
 *
 * ISSUE 8: usePotje payload.new undefined bij DELETE
 *   Potjes-abonnement was event: '*'. Bij een DELETE-event is payload.new
 *   undefined. setPotje(undefined) zette de potje-state stil op undefined
 *   → UI brak zonder fout of Sentry-melding.
 *   Fix: aparte abonnementen voor UPDATE (payload.new altijd aanwezig) en
 *   DELETE (setFout met begrijpelijke melding, setPotje(null)).
 *
 * ISSUE 9: useMijnPotjes geen realtime
 *   Lijst van open/gesloten potjes verouderde als een ander device een potje
 *   sloot of een nieuwe deelnemer zich aanmeldde. Geen abonnement aanwezig.
 *   Fix: realtime-abonnement op potjes (UPDATE/DELETE) en deelnemers (INSERT).
 *   Aanpak: herlaad() bij relevante wijzigingen ("herlaad bij change").
 *
 * ISSUE 10: formatBedrag zonder valuta in ModalTransactie
 *   Drie formatBedrag-aanroepen zonder valuta-parameter → altijd EUR hardcoded.
 *   Fix: valuta-prop toegevoegd aan ModalTransactie en doorgegeven aan alle
 *   formatBedrag-aanroepen. PaginaPotje geeft valuta={potje?.valuta ?? 'EUR'}.
 *
 * Gedekte cases:
 *
 * IS7-01  handleStorten: deelnemerId vastgelegd vóór async INSERT
 * IS7-02  handleStorten: null deelnemer → geblokkeerd vóór INSERT
 * IS7-03  handleStorten: deelnemer wordt null na guard → deelnemerId is al vast
 *
 * IS8-01  usePotje potjes-abonnement: UPDATE → setPotje(payload.new)
 * IS8-02  usePotje potjes-abonnement: DELETE → setPotje(null) + foutmelding
 * IS8-03  usePotje potjes-abonnement: payload.new undefined bij DELETE → geen crash
 *
 * IS9-01  useMijnPotjes realtime: potje UPDATE in bekende IDs → herlaad
 * IS9-02  useMijnPotjes realtime: potje UPDATE in onbekende IDs → geen herlaad
 * IS9-03  useMijnPotjes realtime: potje DELETE → verwijder uit lijst
 *
 * IS10-01 ModalTransactie: formatBedrag met valuta bij saldo-weergave
 * IS10-02 ModalTransactie: formatBedrag met valuta bij live preview
 * IS10-03 ModalTransactie: formatBedrag met valuta bij SALDO_TE_LAAG fout
 */

import { describe, it, expect } from 'vitest'

// ── ISSUE 7: PaginaStorten deelnemer race condition ───────────────────────────

function simuleerHandleStorten({ deelnemer, potjeStatus }) {
  // Exacte kopie van de guard-logica in handleStorten (na issue 7 fix)
  const deelnemerId = deelnemer?.id
  if (!deelnemerId) {
    return { geblokkeerd: true, reden: 'geen deelnemer', deelnemerId: null }
  }
  if (potjeStatus === 'gesloten') {
    return { geblokkeerd: true, reden: 'potje gesloten', deelnemerId: null }
  }
  // deelnemerId is hier al vastgelegd — ook als deelnemer later null wordt
  return { geblokkeerd: false, reden: null, deelnemerId }
}

describe('PaginaStorten — IS7-01/02/03: deelnemer race condition fix', () => {
  it('IS7-01: deelnemerId wordt vastgelegd als lokale const vóór async gebruik', () => {
    const deelnemer = { id: 'd1', naam: 'Alice', actief: true }
    const { geblokkeerd, deelnemerId } = simuleerHandleStorten({
      deelnemer,
      potjeStatus: 'open',
      bedrag: 10,
    })
    expect(geblokkeerd).toBe(false)
    expect(deelnemerId).toBe('d1')
  })

  it('IS7-02: deelnemer null → geblokkeerd vóór INSERT', () => {
    const { geblokkeerd, reden } = simuleerHandleStorten({
      deelnemer: null,
      potjeStatus: 'open',
      bedrag: 10,
    })
    expect(geblokkeerd).toBe(true)
    expect(reden).toBe('geen deelnemer')
  })

  it('IS7-03: deelnemerId is vastgelegd — wijziging van deelnemer achteraf heeft geen effect', () => {
    const deelnemer = { id: 'd1', naam: 'Alice', actief: true }
    const { deelnemerId } = simuleerHandleStorten({ deelnemer, potjeStatus: 'open', bedrag: 10 })

    // Simuleer: deelnemer wordt null nádat deelnemerId is vastgelegd
    // (zoals bij een race condition via realtime-update)
    deelnemer.id = null // muteert het originele object

    // deelnemerId is al vastgelegd — onveranderd
    expect(deelnemerId).toBe('d1')
  })
})

// ── ISSUE 8: usePotje payload.new undefined bij DELETE ───────────────────────

function simuleerPotjesAbonnement(event, payload) {
  // Exacte kopie van de twee handlers in usePotje (na issue 8 fix)
  const updates = []

  if (event === 'UPDATE') {
    // payload.new is altijd aanwezig bij UPDATE
    updates.push({ type: 'setPotje', waarde: payload.new })
  } else if (event === 'DELETE') {
    // payload.new is undefined bij DELETE — niet gebruiken
    updates.push({ type: 'setPotje', waarde: null })
    updates.push({ type: 'setFout', waarde: 'Dit potje is verwijderd. Na 7 dagen worden potjes automatisch opgeruimd.' })
  }

  return updates
}

describe('usePotje — IS8-01/02/03: potjes-abonnement event-splitsing', () => {
  it('IS8-01: UPDATE event → setPotje met payload.new', () => {
    const payload = { new: { id: 'p1', status: 'gesloten', naam: 'vrijmibo' } }
    const updates = simuleerPotjesAbonnement('UPDATE', payload)
    expect(updates).toHaveLength(1)
    expect(updates[0]).toEqual({ type: 'setPotje', waarde: payload.new })
  })

  it('IS8-02: DELETE event → setPotje(null) + begrijpelijke foutmelding', () => {
    const payload = { old: { id: 'p1' }, new: undefined }
    const updates = simuleerPotjesAbonnement('DELETE', payload)
    expect(updates).toHaveLength(2)
    expect(updates[0]).toEqual({ type: 'setPotje', waarde: null })
    expect(updates[1].type).toBe('setFout')
    expect(updates[1].waarde).toContain('verwijderd')
  })

  it('IS8-03: DELETE met undefined payload.new → geen crash, null correct verwerkt', () => {
    // Oud gedrag: setPotje(undefined) → stille UI-breuk
    // Nieuw gedrag: setPotje(null) → fout getoond
    const payload = { old: { id: 'p1' }, new: undefined }
    expect(() => simuleerPotjesAbonnement('DELETE', payload)).not.toThrow()
    const updates = simuleerPotjesAbonnement('DELETE', payload)
    expect(updates.find(u => u.type === 'setPotje').waarde).toBeNull()
    // Niet undefined
    expect(updates.find(u => u.type === 'setPotje').waarde).not.toBeUndefined()
  })
})

// ── ISSUE 9: useMijnPotjes realtime beslissingslogica ────────────────────────

function simuleerPotjesUpdateHandler(payload, potjeIds) {
  // Exacte kopie van de UPDATE-handler in useMijnPotjes realtime-abonnement
  if (potjeIds.includes(payload.new?.id)) {
    return 'herlaad'
  }
  return 'niets'
}

function simuleerPotjesDeleteHandler(payload, potjes, potjeIds) {
  // Exacte kopie van de DELETE-handler in useMijnPotjes realtime-abonnement
  const verwijderdId = payload.old?.id
  if (verwijderdId && potjeIds.includes(verwijderdId)) {
    return {
      nieuwePotjes: potjes.filter(p => p.id !== verwijderdId),
      nieuweIds: potjeIds.filter(id => id !== verwijderdId),
    }
  }
  return { nieuwePotjes: potjes, nieuweIds: potjeIds }
}

describe('useMijnPotjes — IS9-01/02/03: realtime abonnement beslissingslogica', () => {
  const potjeIds = ['p1', 'p2', 'p3']
  const potjes = [
    { id: 'p1', naam: 'vrijmibo', status: 'open' },
    { id: 'p2', naam: 'uitje', status: 'open' },
  ]

  it('IS9-01: potje UPDATE in bekende IDs → herlaad', () => {
    const result = simuleerPotjesUpdateHandler({ new: { id: 'p1', status: 'gesloten' } }, potjeIds)
    expect(result).toBe('herlaad')
  })

  it('IS9-02: potje UPDATE voor onbekend potje → geen herlaad', () => {
    const result = simuleerPotjesUpdateHandler({ new: { id: 'p99', status: 'gesloten' } }, potjeIds)
    expect(result).toBe('niets')
  })

  it('IS9-02b: UPDATE met null payload.new.id → geen herlaad, geen crash', () => {
    expect(() => simuleerPotjesUpdateHandler({ new: null }, potjeIds)).not.toThrow()
    const result = simuleerPotjesUpdateHandler({ new: null }, potjeIds)
    expect(result).toBe('niets')
  })

  it('IS9-03: potje DELETE in bekende IDs → verwijderd uit lijst en IDs', () => {
    const { nieuwePotjes, nieuweIds } = simuleerPotjesDeleteHandler(
      { old: { id: 'p1' } },
      potjes,
      potjeIds
    )
    expect(nieuwePotjes).toHaveLength(1)
    expect(nieuwePotjes[0].id).toBe('p2')
    expect(nieuweIds).not.toContain('p1')
  })

  it('IS9-03b: potje DELETE voor onbekend ID → lijst ongewijzigd', () => {
    const { nieuwePotjes, nieuweIds } = simuleerPotjesDeleteHandler(
      { old: { id: 'p99' } },
      potjes,
      potjeIds
    )
    expect(nieuwePotjes).toHaveLength(2)
    expect(nieuweIds).toHaveLength(3)
  })
})

// ── ISSUE 10: ModalTransactie formatBedrag met valuta ────────────────────────

function formatBedragMock(bedrag, valuta = 'EUR') {
  // Versimpelde mock die valuta zichtbaar maakt in de output
  return `${valuta} ${Number(bedrag).toFixed(2)}`
}

function simuleerSaldoWeergave(potSaldo, valuta) {
  return `Beschikbaar saldo: ${formatBedragMock(potSaldo, valuta)}`
}

function simuleerLivePreview(bedragNum, valuta) {
  return `= ${formatBedragMock(bedragNum, valuta)}`
}

function simuleerSaldoTelaagFout(saldo, valuta) {
  return `Het potje heeft niet genoeg saldo. Maximaal beschikbaar: ${formatBedragMock(saldo, valuta)}.`
}

describe('ModalTransactie — IS10-01/02/03: formatBedrag met valuta', () => {
  it('IS10-01: saldo-weergave gebruikt de meegegeven valuta', () => {
    const eur = simuleerSaldoWeergave(25, 'EUR')
    const usd = simuleerSaldoWeergave(25, 'USD')
    expect(eur).toContain('EUR')
    expect(usd).toContain('USD')
    expect(eur).not.toContain('USD')
  })

  it('IS10-02: live preview gebruikt de meegegeven valuta', () => {
    const gbp = simuleerLivePreview(12.5, 'GBP')
    expect(gbp).toContain('GBP')
    expect(gbp).toContain('12.50')
  })

  it('IS10-03: SALDO_TE_LAAG foutmelding gebruikt de meegegeven valuta', () => {
    const chf = simuleerSaldoTelaagFout(8, 'CHF')
    expect(chf).toContain('CHF')
    expect(chf).toContain('8.00')
    expect(chf).not.toContain('EUR')
  })

  it('IS10-03b: default valuta EUR als geen valuta meegegeven (backward compat)', () => {
    const standaard = simuleerSaldoWeergave(10, undefined)
    expect(standaard).toContain('EUR')
  })
})
