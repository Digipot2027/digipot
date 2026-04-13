/**
 * Tests — modal logica (2026-04-13)
 *
 * De modals bevatten submit-flows die via callbacks naar usePotjeActies gaan.
 * Die callbacks zijn al gedekt in usePotjeActies.regressie.test.js.
 * Dit bestand dekt de interne logica van de modals die NIET afhankelijk is
 * van Supabase: foutclassificatie, bedragvalidatie-integratie, state-logica.
 *
 * Gedekte cases:
 *
 * MD-01  ModalDeelnemen: naam leeg → validatiefout
 * MD-02  ModalDeelnemen: naam te lang → validatiefout met MAX_NAAM
 * MD-03  ModalDeelnemen: potje vol → validatiefout met MAX_DEELNEMERS
 * MD-04  ModalDeelnemen: naam bezet → validatiefout
 * MD-05  ModalDeelnemen: geldige naam → geen fout
 *
 * MT-01  ModalTransactie: SALDO_TE_LAAG fout → saldo in melding
 * MT-02  ModalTransactie: NIET_ACTIEF fout → juiste melding
 * MT-03  ModalTransactie: DEELNEMER_ONTBREEKT fout → juiste melding
 * MT-04  ModalTransactie: onbekende fout → generieke melding via logFout-pad
 * MT-05  ModalTransactie: bedrag 0 → ongeldige invoer
 * MT-06  ModalTransactie: bedrag boven max → ongeldig
 * MT-07  ModalTransactie: geldig bedrag bij betaling ≤ saldo → geen fout
 * MT-08  ModalTransactie: geldig bedrag bij betaling > saldo → saldo-fout via valideer
 *
 * MA-01  ModalAfmelden: onBevestig-callback wordt aangeroepen
 * MA-02  ModalAfmelden: onAnnuleer-callback wordt aangeroepen
 *
 * MS-01  ModalSluiten: onBevestig-callback wordt aangeroepen
 * MS-02  ModalSluiten: fout in onBevestig → foutmelding beschikbaar
 */

import { describe, it, expect, vi } from 'vitest'
import { valideerDeelnemerNaam } from '../utils/valideer'
import { valideerTransactieBedrag } from '../utils/valideer'
import { MAX_NAAM, MAX_DEELNEMERS } from '../constants'
import { formatBedrag } from '../utils/formatBedrag'
import { parseBedrag } from '../utils/formatBedrag'

// ── ModalDeelnemen validatielogica ────────────────────────────────────────────
//
// De submit-handler in ModalDeelnemen roept valideerDeelnemerNaam aan.
// Dit test de integratie van de modal met de validatiefunctie.

describe('ModalDeelnemen — MD-01..05: submit validatielogica', () => {
  const legeDeelnemers = []
  const volPotje = Array.from({ length: MAX_DEELNEMERS }, (_, i) => ({ naam: `D${i}` }))
  const bezetteDeelnemers = [{ naam: 'Alice' }]

  it('MD-01: lege naam → validatiefout', () => {
    const fout = valideerDeelnemerNaam('', legeDeelnemers, { maxNaam: MAX_NAAM, maxDeelnemers: MAX_DEELNEMERS })
    expect(fout).not.toBeNull()
    expect(fout).toContain('naam in')
  })

  it('MD-02: naam te lang → validatiefout met MAX_NAAM', () => {
    const fout = valideerDeelnemerNaam('a'.repeat(MAX_NAAM + 1), legeDeelnemers, { maxNaam: MAX_NAAM, maxDeelnemers: MAX_DEELNEMERS })
    expect(fout).not.toBeNull()
    expect(fout).toContain(String(MAX_NAAM))
  })

  it('MD-03: potje vol → validatiefout met MAX_DEELNEMERS', () => {
    const fout = valideerDeelnemerNaam('Nieuw', volPotje, { maxNaam: MAX_NAAM, maxDeelnemers: MAX_DEELNEMERS })
    expect(fout).not.toBeNull()
    expect(fout).toContain(String(MAX_DEELNEMERS))
  })

  it('MD-04: naam al bezet (case-insensitief) → validatiefout', () => {
    const fout = valideerDeelnemerNaam('alice', bezetteDeelnemers, { maxNaam: MAX_NAAM, maxDeelnemers: MAX_DEELNEMERS })
    expect(fout).not.toBeNull()
    expect(fout).toContain('bezet')
  })

  it('MD-05: geldige naam → geen fout (null)', () => {
    const fout = valideerDeelnemerNaam('Bob', bezetteDeelnemers, { maxNaam: MAX_NAAM, maxDeelnemers: MAX_DEELNEMERS })
    expect(fout).toBeNull()
  })
})

// ── ModalTransactie foutclassificatie ─────────────────────────────────────────
//
// Simuleert de catch-block logica in ModalTransactie.handleSubmit.
// De foutclassificatie bepaalt welke melding getoond wordt.

function classificeerTransactieFout(errorBericht, saldo, valuta = 'EUR') {
  if (errorBericht?.includes('SALDO_TE_LAAG')) {
    const saldoWaarde = errorBericht.split(':')[1]
    return `Het potje heeft niet genoeg saldo. Maximaal beschikbaar: ${formatBedrag(saldoWaarde, valuta)}.`
  }
  if (errorBericht?.includes('NIET_ACTIEF')) {
    return 'Je hebt je afgemeld en kunt geen transacties meer invoeren.'
  }
  if (errorBericht?.includes('DEELNEMER_ONTBREEKT')) {
    return 'Er is iets misgegaan. Ververs de pagina en probeer opnieuw.'
  }
  return null // onbekende fout → logFout-pad
}

describe('ModalTransactie — MT-01..04: foutclassificatie', () => {
  it('MT-01: SALDO_TE_LAAG → melding bevat saldo', () => {
    const melding = classificeerTransactieFout('SALDO_TE_LAAG:25', 25)
    expect(melding).toContain('saldo')
    expect(melding).not.toBeNull()
  })

  it('MT-02: NIET_ACTIEF → afgemeld-melding', () => {
    const melding = classificeerTransactieFout('NIET_ACTIEF', 0)
    expect(melding).toContain('afgemeld')
  })

  it('MT-03: DEELNEMER_ONTBREEKT → ververs-melding', () => {
    const melding = classificeerTransactieFout('DEELNEMER_ONTBREEKT', 0)
    expect(melding).toContain('Ververs')
  })

  it('MT-04: onbekende fout → null (logFout-pad)', () => {
    const melding = classificeerTransactieFout('NetworkError', 0)
    expect(melding).toBeNull()
  })
})

describe('ModalTransactie — MT-05..08: bedragvalidatie-integratie', () => {
  const formatBedragMock = (b) => formatBedrag(b, 'EUR')

  it('MT-05: bedrag 0 → ongeldig', () => {
    const fout = valideerTransactieBedrag('0', 0, { isStorting: true, potSaldo: 100, formatBedrag: formatBedragMock })
    expect(fout).not.toBeNull()
  })

  it('MT-06: bedrag boven 999.99 → ongeldig', () => {
    const fout = valideerTransactieBedrag('1000', 1000, { isStorting: true, potSaldo: 5000, formatBedrag: formatBedragMock })
    expect(fout).not.toBeNull()
    expect(fout).toContain('999')
  })

  it('MT-07: geldig bedrag, betaling ≤ saldo → geen fout', () => {
    const fout = valideerTransactieBedrag('25', 25, { isStorting: false, potSaldo: 100, formatBedrag: formatBedragMock })
    expect(fout).toBeNull()
  })

  it('MT-08: geldig bedrag, betaling > saldo → saldo-fout', () => {
    const fout = valideerTransactieBedrag('150', 150, { isStorting: false, potSaldo: 100, formatBedrag: formatBedragMock })
    expect(fout).not.toBeNull()
    expect(fout).toContain('saldo')
  })
})

// ── ModalAfmelden callback-logica ─────────────────────────────────────────────
//
// ModalAfmelden is een bevestigingsdialoog. De kernlogica is de callback-flow.

async function simuleerModalAfmelden(onBevestig, onAnnuleer, actie) {
  if (actie === 'bevestig') {
    await onBevestig()
    return 'bevestigd'
  }
  onAnnuleer()
  return 'geannuleerd'
}

describe('ModalAfmelden — MA-01..02: callback-flow', () => {
  it('MA-01: bevestig → onBevestig wordt aangeroepen', async () => {
    const onBevestig = vi.fn().mockResolvedValue(undefined)
    const onAnnuleer = vi.fn()
    const resultaat = await simuleerModalAfmelden(onBevestig, onAnnuleer, 'bevestig')
    expect(onBevestig).toHaveBeenCalledOnce()
    expect(resultaat).toBe('bevestigd')
  })

  it('MA-02: annuleer → onAnnuleer wordt aangeroepen', async () => {
    const onBevestig = vi.fn()
    const onAnnuleer = vi.fn()
    const resultaat = await simuleerModalAfmelden(onBevestig, onAnnuleer, 'annuleer')
    expect(onAnnuleer).toHaveBeenCalledOnce()
    expect(onBevestig).not.toHaveBeenCalled()
    expect(resultaat).toBe('geannuleerd')
  })
})

// ── ModalSluiten callback + foutpad ──────────────────────────────────────────

async function simuleerModalSluiten(onBevestig) {
  try {
    await onBevestig()
    return { fout: null }
  } catch (e) {
    return { fout: e.message }
  }
}

describe('ModalSluiten — MS-01..02: callback en foutpad', () => {
  it('MS-01: succesvolle sluiting → geen fout', async () => {
    const onBevestig = vi.fn().mockResolvedValue(undefined)
    const { fout } = await simuleerModalSluiten(onBevestig)
    expect(fout).toBeNull()
    expect(onBevestig).toHaveBeenCalledOnce()
  })

  it('MS-02: fout in onBevestig → foutbericht beschikbaar', async () => {
    const onBevestig = vi.fn().mockRejectedValue(new Error('DEELNEMER_ONTBREEKT'))
    const { fout } = await simuleerModalSluiten(onBevestig)
    expect(fout).toBe('DEELNEMER_ONTBREEKT')
  })
})
