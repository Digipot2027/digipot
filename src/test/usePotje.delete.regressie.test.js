/**
 * Regressietests — usePotje transactie DELETE-reducer (SEC-L2)
 *
 * Teststrategie: logica-extractie patroon.
 *
 * SEC-L2: usePotje luistert nu ook op DELETE-events van transacties via
 * Supabase Realtime. Hierdoor worden undo's van andere clients direct
 * zichtbaar zonder refresh.
 *
 * De reducer-logica is:
 *   payload.old?.id → verwijder transactie met dat id uit de lijst
 *
 * Let op: bij RLS geeft Supabase bij DELETE events alleen payload.old.id
 * terug (het primaire sleutelfield) — niet het volledige record. De
 * reducer filtert puur op id.
 *
 * Gedekte scenario's:
 *   TD-01  bestaande transactie wordt verwijderd uit de lijst
 *   TD-02  lijst van één element → wordt leeg na delete
 *   TD-03  onbekend id → lijst blijft ongewijzigd (geen crash)
 *   TD-04  payload.old is undefined → lijst blijft ongewijzigd (geen crash)
 *   TD-05  payload.old.id is null → lijst blijft ongewijzigd
 *   TD-06  meerdere transacties → alleen de juiste wordt verwijderd
 *   TD-07  dubbele id in lijst → beide worden verwijderd (defensief)
 */

import { describe, it, expect } from 'vitest'

// ── Geëxtraheerde reducer uit usePotje ───────────────────────────────────────

function reduceTransactiesDelete(prev, payload) {
  const verwijderdId = payload?.old?.id
  if (!verwijderdId) return prev
  return prev.filter(t => t.id !== verwijderdId)
}

// ── Testdata ──────────────────────────────────────────────────────────────────

const tx1 = { id: 'tx-1', deelnemer_id: 'd1', type: 'storting', bedrag: '25.00' }
const tx2 = { id: 'tx-2', deelnemer_id: 'd1', type: 'betaling', bedrag: '30.00' }
const tx3 = { id: 'tx-3', deelnemer_id: 'd2', type: 'storting', bedrag: '20.00' }

// ── TD-01 t/m TD-07 ───────────────────────────────────────────────────────────

describe('usePotje — transactie DELETE-reducer (TD-01 t/m TD-07)', () => {

  it('TD-01: bestaande transactie wordt verwijderd uit de lijst', () => {
    const prev = [tx1, tx2, tx3]
    const payload = { old: { id: 'tx-2' } } // alleen id bij RLS
    const result = reduceTransactiesDelete(prev, payload)
    expect(result).toHaveLength(2)
    expect(result.find(t => t.id === 'tx-2')).toBeUndefined()
    expect(result.find(t => t.id === 'tx-1')).toBeDefined()
    expect(result.find(t => t.id === 'tx-3')).toBeDefined()
  })

  it('TD-02: lijst van één element → leeg na delete', () => {
    const prev = [tx1]
    const payload = { old: { id: 'tx-1' } }
    const result = reduceTransactiesDelete(prev, payload)
    expect(result).toHaveLength(0)
  })

  it('TD-03: onbekend id → lijst blijft ongewijzigd', () => {
    const prev = [tx1, tx2]
    const payload = { old: { id: 'tx-onbekend' } }
    const result = reduceTransactiesDelete(prev, payload)
    expect(result).toHaveLength(2)
    expect(result).toEqual(prev)
  })

  it('TD-04: payload.old is undefined (Supabase fout) → lijst blijft ongewijzigd', () => {
    const prev = [tx1, tx2]
    const payload = {} // old ontbreekt
    const result = reduceTransactiesDelete(prev, payload)
    expect(result).toEqual(prev)
  })

  it('TD-05: payload.old.id is null → lijst blijft ongewijzigd', () => {
    const prev = [tx1]
    const payload = { old: { id: null } }
    const result = reduceTransactiesDelete(prev, payload)
    expect(result).toEqual(prev)
  })

  it('TD-04b: payload zelf is undefined → geen crash, lijst ongewijzigd', () => {
    const prev = [tx1]
    const result = reduceTransactiesDelete(prev, undefined)
    expect(result).toEqual(prev)
  })

  it('TD-06: meerdere transacties → alleen de juiste wordt verwijderd', () => {
    const prev = [tx1, tx2, tx3]
    const payload = { old: { id: 'tx-3' } }
    const result = reduceTransactiesDelete(prev, payload)
    expect(result).toHaveLength(2)
    expect(result.map(t => t.id)).toEqual(['tx-1', 'tx-2'])
  })

  it('TD-07: dubbele id in lijst → beide worden verwijderd (filter is correct gedrag)', () => {
    // Defensief: dit zou normaal niet mogen voorkomen, maar de reducer
    // gedraagt zich correct (filter verwijdert alle matches)
    const dubbel = [tx1, { ...tx1, type: 'betaling' }]
    const payload = { old: { id: 'tx-1' } }
    const result = reduceTransactiesDelete(dubbel, payload)
    expect(result).toHaveLength(0)
  })

})

describe('usePotje — DELETE sync met INSERT: round-trip invariant', () => {

  it('TD-08: INSERT gevolgd door DELETE → uiteindelijk dezelfde lijst als beginstand', () => {
    function reduceInsert(prev, nieuw) {
      return [...prev, nieuw]
    }

    const beginstand = [tx1, tx2]
    const naTussentijdseInsert = reduceInsert(beginstand, tx3)
    expect(naTussentijdseInsert).toHaveLength(3)

    const naDelete = reduceTransactiesDelete(naTussentijdseInsert, { old: { id: 'tx-3' } })
    expect(naDelete).toHaveLength(2)
    expect(naDelete.map(t => t.id)).toEqual(['tx-1', 'tx-2'])
  })

})
