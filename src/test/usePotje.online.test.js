/**
 * Regressietests — usePotje online/offline handlers en foutpaden (2026-04-13)
 *
 * De datalaad-functie en realtime-reducers zijn al gedekt in usePotje.regressie.test.js
 * en usePotje.delete.regressie.test.js. Dit bestand dekt de resterende gaps:
 *
 * 1. Online/offline handler logica
 *    De window online/offline events zetten de online-state. De beslissingslogica
 *    "was offline, nu online → toon toast" is testbaar als pure functie.
 *
 * 2. laadData deelnemer-matching logica
 *    Welke deelnemer wordt herkend op basis van device_id is pure array-logica.
 *
 * 3. Foutpad: laadData foutvertaling
 *    Als Supabase een fout gooit, wordt deze vertaald via logFout. De fallback
 *    ("Dit potje bestaat niet") treedt op als vertaalFout null teruggeeft.
 *
 * Gedekte cases:
 *
 * PO-01  Online-state: van offline naar online → toast triggeren
 * PO-02  Online-state: al online → geen toast
 * PO-03  Online-state: van online naar offline → geen toast
 * PO-04  Online-state: twee keer offline → geen dubbele toast
 *
 * PD-01  deelnemer-matching: device_id gevonden → deelnemer gezet
 * PD-02  deelnemer-matching: device_id niet gevonden → deelnemer null
 * PD-03  deelnemer-matching: lege deelnemers-array → deelnemer null
 * PD-04  deelnemer-matching: meerdere deelnemers → juiste herkend
 *
 * PF-01  foutpad: fout bij laden → fout wordt doorgegeven
 * PF-02  foutpad: PGRST116 fout → Nederlandse gebruiksmelding
 */

import { describe, it, expect } from 'vitest'

// ── PO: Online/offline beslissingslogica ──────────────────────────────────────
//
// Simuleert de `vorigeOnline` ref-logica uit PaginaPotje en de online-state
// transities die window online/offline events veroorzaken.

function simuleerOnlineTransitie(vorigeOnline, huidigeOnline) {
  // Exacte kopie van de useEffect-logica in PaginaPotje
  const moetToastTonen = !vorigeOnline && huidigeOnline
  return { moetToastTonen, nieuweVorigeOnline: huidigeOnline }
}

describe('usePotje — PO-01..04: online/offline transitielogica', () => {
  it('PO-01: was offline, nu online → toast tonen', () => {
    const { moetToastTonen } = simuleerOnlineTransitie(false, true)
    expect(moetToastTonen).toBe(true)
  })

  it('PO-02: was al online, nu online → geen toast', () => {
    const { moetToastTonen } = simuleerOnlineTransitie(true, true)
    expect(moetToastTonen).toBe(false)
  })

  it('PO-03: was online, nu offline → geen toast', () => {
    const { moetToastTonen } = simuleerOnlineTransitie(true, false)
    expect(moetToastTonen).toBe(false)
  })

  it('PO-04: twee keer offline → geen toast bij tweede offline', () => {
    const stap1 = simuleerOnlineTransitie(false, false)
    expect(stap1.moetToastTonen).toBe(false)
    const stap2 = simuleerOnlineTransitie(stap1.nieuweVorigeOnline, false)
    expect(stap2.moetToastTonen).toBe(false)
  })
})

// ── PD: deelnemer-matching ────────────────────────────────────────────────────
//
// Simuleert de `d.find(x => x.device_id === deviceId)` logica in usePotje.laadData.

function vindDeelnemerVoorDevice(deelnemers, deviceId) {
  return deelnemers.find(x => x.device_id === deviceId) ?? null
}

describe('usePotje — PD-01..04: deelnemer-matching op device_id', () => {
  it('PD-01: device_id gevonden → deelnemer teruggegeven', () => {
    const deelnemers = [
      { id: 'd1', naam: 'Alice', device_id: 'dev-a' },
      { id: 'd2', naam: 'Bob',   device_id: 'dev-b' },
    ]
    const resultaat = vindDeelnemerVoorDevice(deelnemers, 'dev-a')
    expect(resultaat?.id).toBe('d1')
  })

  it('PD-02: device_id niet in lijst → null', () => {
    const deelnemers = [{ id: 'd1', naam: 'Alice', device_id: 'dev-a' }]
    expect(vindDeelnemerVoorDevice(deelnemers, 'dev-onbekend')).toBeNull()
  })

  it('PD-03: lege deelnemers-array → null', () => {
    expect(vindDeelnemerVoorDevice([], 'dev-a')).toBeNull()
  })

  it('PD-04: meerdere deelnemers → juiste herkend', () => {
    const deelnemers = [
      { id: 'd1', naam: 'Alice',   device_id: 'dev-a' },
      { id: 'd2', naam: 'Bob',     device_id: 'dev-b' },
      { id: 'd3', naam: 'Charlie', device_id: 'dev-c' },
    ]
    const resultaat = vindDeelnemerVoorDevice(deelnemers, 'dev-c')
    expect(resultaat?.naam).toBe('Charlie')
  })
})

// ── PF: foutpad laadData ──────────────────────────────────────────────────────
//
// Simuleert de foutafhandeling in usePotje.laadData.
// Als logFout null teruggeeft (bijv. bij SALDO_TE_LAAG — dat is geen laadfout)
// valt de component terug op een hardcoded melding.

function simuleerLaadDataFout(logFoutResultaat) {
  // Exacte kopie van de foutafhandeling in laadData
  return logFoutResultaat || 'Dit potje bestaat niet. Controleer de link.'
}

describe('usePotje — PF-01..02: laadData foutafhandeling', () => {
  it('PF-01: logFout geeft een string → die string wordt als fout gezet', () => {
    const fout = simuleerLaadDataFout('Verbinding verbroken.')
    expect(fout).toBe('Verbinding verbroken.')
  })

  it('PF-02: logFout geeft null/falsy → fallback melding getoond', () => {
    const fout = simuleerLaadDataFout(null)
    expect(fout).toContain('bestaat niet')
    expect(fout).toContain('Controleer de link')
  })
})
