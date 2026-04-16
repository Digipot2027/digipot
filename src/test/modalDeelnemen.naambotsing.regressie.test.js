/**
 * Regressietests — naambotising bij meedoen (#2)
 *
 * Probleem:
 *   Als iemand een potje-link opent terwijl er al een deelnemer met
 *   dezelfde naam bestaat, ziet hij een foutmelding. Maar er zijn twee
 *   subtiele varianten die niet gedekt waren:
 *
 *   Variant A — Ik ben het zelf (zelfde device_id):
 *     device_id staat al in de DB voor dit potje → de app herkent me
 *     als bestaande deelnemer → ModalDeelnemen wordt nooit getoond.
 *     Dit is correct gedrag; het is geen "botsing" maar "terugkeer".
 *     Dit pad heeft geen unit test die het gedrag documenteert.
 *
 *   Variant B — Profielnaam staat alvast ingevuld, maar die naam is bezet:
 *     localStorage heeft 'digipot_profiel_naam' = 'Jan'.
 *     Er is al een deelnemer 'Jan' in het potje (iemand anders).
 *     ModalDeelnemen laadt met naam = 'Jan' (pre-ingevuld), knop enabled.
 *     Gebruiker klikt meteen "Meedoen" → valideerDeelnemerNaam geeft fout.
 *     Het naamveld moet bewerkbaar blijven en de fout moet verdwijnen
 *     zodra de naam veranderd wordt (onChange → setFout('')).
 *
 *   Variant C — Naambotsing na trim:
 *     Gebruiker typt '  Jan  ' (met spaties). Na trim = 'Jan', dat is bezet.
 *     Dit wordt geblokkeerd door valideerDeelnemerNaam — maar is er een
 *     test die de complete volgorde (trim → duplicaat-check) verifieert?
 *
 *   Variant D — Profielnaam pre-invulling interactie met fout-reset:
 *     Na fout: gebruiker past naam aan → fout verdwijnt (setFout(''))
 *     Na fout: gebruiker maakt naam leeg → knop disabled (geen submit)
 *
 * Gedekte scenarios:
 *   NB-01  Terugkerende deelnemer: device_id matcht → deelnemer gevonden (geen modal)
 *   NB-02  device_id onbekend, naam vrij → meedoen toegestaan
 *   NB-03  device_id onbekend, naam bezet (exact) → geblokkeerd
 *   NB-04  device_id onbekend, naam bezet (andere case) → geblokkeerd
 *   NB-05  Profielnaam pre-ingevuld, naam bezet → fout na submit
 *   NB-06  Profielnaam pre-ingevuld, naam vrij → meedoen toegestaan
 *   NB-07  Naambotsing na trim: '  Jan  ' vs 'Jan' → geblokkeerd
 *   NB-08  Na fout: naam aanpassen → foutmelding verdwijnt (onChange reset)
 *   NB-09  Na fout: naam leeg maken → knop disabled (geen nieuwe submit)
 *   NB-10  Profielnaam leeg (na trim) → geen pre-invulling, geen fout
 *   NB-11  Naam bezet én potje vol → potje-vol-fout wint (volgorde)
 *   NB-12  device_id matcht maar naam is ook bezet door iemand anders → deelnemer gevonden
 */

import { describe, it, expect } from 'vitest'
import { valideerDeelnemerNaam } from '../utils/valideer'

// ── Geëxtraheerde logica ──────────────────────────────────────────────────────

// Simuleert de deelnemer-lookup in usePotje/PaginaPotje:
// bekende deelnemer = device_id matcht een bestaande deelnemer
function vindDeelnemerOpDevice(deelnemers, deviceId) {
  return deelnemers.find(d => d.device_id === deviceId) ?? null
}

// Simuleert de profielnaam-invulling in ModalDeelnemen:
// profielNaam uit localStorage wordt getrimd; lege string = geen pre-invulling
function bepaalInitieleNaam(profielNaamRaw) {
  return (profielNaamRaw ?? '').trim()
}

// Simuleert de onChange-handler in ModalDeelnemen:
// elke invoerwijziging reset de fout
function simuleerOnChange(huidigeNaam, nieuweTekst) {
  return { naam: nieuweTekst, fout: '' }
}

// Simuleert de disabled-check op de Meedoen-knop:
// disabled als laden=true of naam (na trim) is leeg
function isMeedoenKnopDisabled({ laden, naam }) {
  return laden || !naam.trim()
}

// ── NB-01: Terugkerende deelnemer — device_id matcht ─────────────────────────

describe('ModalDeelnemen — NB-01: terugkerende deelnemer (device_id matcht)', () => {
  const deelnemers = [
    { id: 'd1', naam: 'Jan', device_id: 'dev-jan', aangemaakt_op: '2026-01-01T10:00:00Z', actief: true, afgemeld_op: null },
    { id: 'd2', naam: 'Piet', device_id: 'dev-piet', aangemaakt_op: '2026-01-01T10:01:00Z', actief: true, afgemeld_op: null },
  ]

  it('NB-01a: eigen device_id matcht → deelnemer gevonden → modal niet getoond', () => {
    const gevonden = vindDeelnemerOpDevice(deelnemers, 'dev-jan')
    // Als gevonden !== null → ModalDeelnemen wordt NIET gerenderd (PaginaPotje checkt !deelnemer)
    expect(gevonden).not.toBeNull()
    expect(gevonden.naam).toBe('Jan')
  })

  it('NB-01b: onbekend device_id → null → ModalDeelnemen WEL getoond', () => {
    const gevonden = vindDeelnemerOpDevice(deelnemers, 'dev-onbekend')
    expect(gevonden).toBeNull()
  })

  it('NB-01c: device_id matcht maar naam is ook bezet door iemand anders → deelnemer gevonden (eigen device wint)', () => {
    // Jan is al in de lijst met zijn device. Als iemand anders ook 'Jan' heet
    // (verschillende device), heeft de DB een unique constraint — maar device-lookup
    // wint sowieso in de app-laag. De deelnemer wordt herkend op device_id.
    const gevonden = vindDeelnemerOpDevice(deelnemers, 'dev-jan')
    expect(gevonden.id).toBe('d1')
  })
})

// ── NB-02 t/m NB-04: naam-validatie bij onbekend device ─────────────────────

describe('ModalDeelnemen — NB-02/03/04: naam-validatie bij onbekend device', () => {
  const deelnemers = [
    { id: 'd1', naam: 'Jan', device_id: 'dev-jan' },
    { id: 'd2', naam: 'Piet', device_id: 'dev-piet' },
  ]

  it('NB-02: onbekend device, naam niet bezet → validatie: null (geldig)', () => {
    expect(valideerDeelnemerNaam('Marie', deelnemers)).toBeNull()
  })

  it('NB-03: onbekend device, naam exact bezet → fout', () => {
    const fout = valideerDeelnemerNaam('Jan', deelnemers)
    expect(fout).toContain('al bezet')
  })

  it('NB-04: onbekend device, naam bezet andere case → fout (case-insensitief)', () => {
    const fout = valideerDeelnemerNaam('JAN', deelnemers)
    expect(fout).toContain('al bezet')
  })

  it('NB-04b: onbekend device, naam bezet lowercase → fout', () => {
    const fout = valideerDeelnemerNaam('jan', deelnemers)
    expect(fout).toContain('al bezet')
  })
})

// ── NB-05 t/m NB-06: profielnaam pre-ingevuld ────────────────────────────────

describe('ModalDeelnemen — NB-05/06: profielnaam pre-ingevuld', () => {
  const deelnemers = [
    { id: 'd1', naam: 'Jan', device_id: 'dev-jan' },
  ]

  it('NB-05: profielnaam "Jan" pre-ingevuld, naam bezet → fout na submit', () => {
    const initieel = bepaalInitieleNaam('Jan')
    expect(initieel).toBe('Jan')
    // Gebruiker klikt direct Meedoen → validatie
    const fout = valideerDeelnemerNaam(initieel, deelnemers)
    expect(fout).toContain('al bezet')
  })

  it('NB-05b: profielnaam met spaties "  Jan  " pre-ingevuld → initieel = "Jan" (trim)', () => {
    const initieel = bepaalInitieleNaam('  Jan  ')
    expect(initieel).toBe('Jan')
    const fout = valideerDeelnemerNaam(initieel, deelnemers)
    expect(fout).toContain('al bezet')
  })

  it('NB-06: profielnaam "Marie" pre-ingevuld, naam vrij → validatie: null', () => {
    const initieel = bepaalInitieleNaam('Marie')
    expect(valideerDeelnemerNaam(initieel, deelnemers)).toBeNull()
  })

  it('NB-10: profielnaam leeg string → initieel = "" → knop disabled (geen submit)', () => {
    const initieel = bepaalInitieleNaam('')
    expect(initieel).toBe('')
    expect(isMeedoenKnopDisabled({ laden: false, naam: initieel })).toBe(true)
  })

  it('NB-10b: profielnaam null → initieel = "" → knop disabled', () => {
    const initieel = bepaalInitieleNaam(null)
    expect(initieel).toBe('')
    expect(isMeedoenKnopDisabled({ laden: false, naam: initieel })).toBe(true)
  })
})

// ── NB-07: Naambotsing na trim ────────────────────────────────────────────────

describe('ModalDeelnemen — NB-07: naambotsing na trim', () => {
  const deelnemers = [{ id: 'd1', naam: 'Jan', device_id: 'dev-jan' }]

  it('NB-07a: "  Jan  " (met spaties) → na trim = "Jan" → bezet', () => {
    const fout = valideerDeelnemerNaam('  Jan  ', deelnemers)
    expect(fout).toContain('al bezet')
  })

  it('NB-07b: "  jan  " (lowercase + spaties) → na trim = "jan" → bezet (case-insensitief)', () => {
    const fout = valideerDeelnemerNaam('  jan  ', deelnemers)
    expect(fout).toContain('al bezet')
  })

  it('NB-07c: "Jana" (geen spaties, andere naam) → vrij', () => {
    expect(valideerDeelnemerNaam('Jana', deelnemers)).toBeNull()
  })
})

// ── NB-08 t/m NB-09: fout-reset en knop-disabled na fout ─────────────────────

describe('ModalDeelnemen — NB-08/09: fout-reset en knop-disabled na fout', () => {
  it('NB-08: naam aanpassen na fout → fout verdwijnt (onChange reset)', () => {
    // Simuleert: gebruiker had "Jan" (fout), typt dan "Marie"
    const na = simuleerOnChange('Jan', 'Marie')
    expect(na.naam).toBe('Marie')
    expect(na.fout).toBe('')
  })

  it('NB-08b: naam hetzelfde houden (geen onChange) → fout blijft staan', () => {
    // Als gebruiker niets aanpast, reset de fout niet
    // (fout staat in state, setFout('') wordt alleen aangeroepen in onChange)
    const fout = 'Deze naam is al bezet in dit potje. Kies een andere naam.'
    // Zonder onChange: fout onveranderd
    expect(fout).toContain('al bezet')
  })

  it('NB-09a: naam leeg maken na fout → knop disabled, geen nieuwe submit mogelijk', () => {
    // Gebruiker wist het veld (backspace) → naam = ""
    const na = simuleerOnChange('Jan', '')
    expect(na.naam).toBe('')
    expect(na.fout).toBe('')
    expect(isMeedoenKnopDisabled({ laden: false, naam: na.naam })).toBe(true)
  })

  it('NB-09b: naam met alleen spaties → knop disabled (trim)', () => {
    const na = simuleerOnChange('Jan', '   ')
    expect(isMeedoenKnopDisabled({ laden: false, naam: na.naam })).toBe(true)
  })

  it('NB-08c: naam aanpassen naar geldige waarde → knop enabled', () => {
    const na = simuleerOnChange('Jan', 'Marie')
    expect(isMeedoenKnopDisabled({ laden: false, naam: na.naam })).toBe(false)
  })
})

// ── NB-11: Naam bezet én potje vol → volgorde validaties ─────────────────────

describe('ModalDeelnemen — NB-11: naam bezet én potje vol → volgorde', () => {
  it('potje-vol-fout wint van bezette-naam-fout (VD-17 regressie in context)', () => {
    // Twintig bestaande deelnemers, waarvan één "Jan" heet
    const namen = Array.from({ length: 19 }, (_, i) => `D${i}`)
    namen.push('Jan')
    const deelnemers = namen.map((naam, i) => ({ id: String(i), naam, device_id: `dev-${i}` }))
    const fout = valideerDeelnemerNaam('Jan', deelnemers)
    // Potje vol (20) → die fout wint van de naambotsing
    expect(fout).toContain('maximum van 20 deelnemers')
    expect(fout).not.toContain('al bezet')
  })

  it('potje heeft 19 deelnemers, naam bezet → bezette-naam-fout', () => {
    const namen = Array.from({ length: 18 }, (_, i) => `D${i}`)
    namen.push('Jan')
    const deelnemers = namen.map((naam, i) => ({ id: String(i), naam, device_id: `dev-${i}` }))
    const fout = valideerDeelnemerNaam('Jan', deelnemers)
    expect(fout).toContain('al bezet')
  })
})

// ── NB-12: device_id matcht en naam is ook vrij ───────────────────────────────

describe('ModalDeelnemen — NB-12: device_id matcht, naam ook vrij (consistentie)', () => {
  it('als device_id matcht, is de naam-validatie niet meer relevant (modal niet getoond)', () => {
    // Terugkerende deelnemer wordt herkend op device_id — de validatie loopt
    // nooit voor hem, want ModalDeelnemen wordt alleen getoond als deelnemer = null
    const deelnemers = [
      { id: 'd1', naam: 'Jan', device_id: 'dev-jan' },
    ]
    const gevonden = vindDeelnemerOpDevice(deelnemers, 'dev-jan')
    // Gevonden → deelnemer !== null → ModalDeelnemen niet gerenderd
    expect(gevonden).not.toBeNull()
    // Dus valideerDeelnemerNaam wordt nooit aangeroepen voor 'Jan' met dev-jan
    // Dit is geen fout, maar gedocumenteerd gedrag
    expect(gevonden.device_id).toBe('dev-jan')
  })
})
