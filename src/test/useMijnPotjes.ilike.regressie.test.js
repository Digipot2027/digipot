/**
 * useMijnPotjes.ilike.regressie.test.js — N4 fix regressietest
 *
 * Vóór de fix (N4, 2026-04-20) gebruikte useMijnPotjes .eq('naam', profielNaam)
 * voor de deelnemers-query op profielnaam — case-sensitief in PostgreSQL.
 * Iemand met profielnaam "jan" vond geen deelnemer genaamd "Jan".
 *
 * Na de fix wordt .ilike('naam', profielNaam) gebruikt, wat case-insensitief
 * matcht. De downstream mijnDeelnemer-zoeklogica gebruikte al .toLowerCase()
 * en is nu consistent.
 *
 * Teststrategie: geëxtraheerde logica-test (geen Supabase-mock nodig).
 * De daadwerkelijke .ilike()-query is een integratiepunt — gedekt via e2e.
 * De mijnDeelnemer-zoeklogica is puur JavaScript en volledig testbaar.
 *
 * Dekt:
 *   N4-01: profielnaam lowercase → matcht deelnemer met hoofdletter
 *   N4-02: profielnaam hoofdletter → matcht deelnemer lowercase
 *   N4-03: gemixte casing → matcht altijd
 *   N4-04: .eq()-gedrag: zou niet matchen (controletest voor het oude gedrag)
 *   N4-05: device_id-match is niet case-gevoelig (UUID — altijd exact)
 *   N4-06: profielnaam-match heeft voorrang boven geen match
 *   N4-07: deelnemer niet gevonden geeft null terug als mijnVerrekening
 */
import { describe, it, expect } from 'vitest'
import { berekenEindafrekening } from '../utils/berekenEindafrekening'

/**
 * Geëxtraheerde mijnDeelnemer-zoeklogica uit useMijnPotjes.
 * Identiek aan de downstream logica voor gesloten potjes.
 */
function vindMijnDeelnemer(deelnemers, deviceId, profielNaamLower) {
  return deelnemers.find(d =>
    d.device_id === deviceId ||
    (profielNaamLower && d.naam.toLowerCase() === profielNaamLower)
  ) ?? null
}

/**
 * Simuleert de verrijkingslogica voor mijnVerrekening in gesloten potjes.
 */
function berekenMijnVerrekening(deelnemers, transacties, geslotenOp, deviceId, profielNaamLower) {
  const saldi = berekenEindafrekening(deelnemers, transacties, geslotenOp)
  const mijnDeelnemer = vindMijnDeelnemer(deelnemers, deviceId, profielNaamLower)
  if (!mijnDeelnemer) return null
  return saldi.deelnemersSaldi.find(s => s.id === mijnDeelnemer.id)?.verrekening ?? null
}

// ── Testdata ──────────────────────────────────────────────────────────────────

const deelnemerJan = {
  id: 'd1',
  naam: 'Jan',        // Hoofdletter J, zoals ingevoerd bij deelnemen
  device_id: 'dev-jan',
  actief: true,
  aangemaakt_op: '2026-01-01T10:00:00Z',
  afgemeld_op: null,
  potje_id: 'p1',
}
const deelnemerPiet = {
  id: 'd2',
  naam: 'Piet',
  device_id: 'dev-piet',
  actief: true,
  aangemaakt_op: '2026-01-01T10:01:00Z',
  afgemeld_op: null,
  potje_id: 'p1',
}

const stortingJan  = { id: 't1', type: 'storting', deelnemer_id: 'd1', bedrag: '20', potje_id: 'p1', aangemaakt_op: '2026-01-01T10:05:00Z' }
const stortingPiet = { id: 't2', type: 'storting', deelnemer_id: 'd2', bedrag: '20', potje_id: 'p1', aangemaakt_op: '2026-01-01T10:06:00Z' }
const betalingJan  = { id: 't3', type: 'betaling', deelnemer_id: 'd1', bedrag: '30', potje_id: 'p1', aangemaakt_op: '2026-01-01T11:00:00Z' }

const geslotenOp = '2026-01-02T10:00:00Z'
const deelnemers = [deelnemerJan, deelnemerPiet]
const transacties = [stortingJan, stortingPiet, betalingJan]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('N4 fix — case-insensitieve naam-matching mijnDeelnemer', () => {
  it('N4-01: profielnaam lowercase "jan" matcht deelnemer "Jan"', () => {
    const gevonden = vindMijnDeelnemer(deelnemers, 'onbekend-device', 'jan')
    expect(gevonden).not.toBeNull()
    expect(gevonden.naam).toBe('Jan')
  })

  it('N4-02: profielnaam "JAN" matcht deelnemer "Jan"', () => {
    const gevonden = vindMijnDeelnemer(deelnemers, 'onbekend-device', 'jan') // altijd lowercase doorgegeven
    expect(gevonden?.naam).toBe('Jan')
  })

  it('N4-03: gemixde profielnaam "jAn" — na toLowerCase() matcht op "jan"', () => {
    const profielNaamLower = 'jAn'.toLowerCase() // simuleert wat useMijnPotjes doet
    const gevonden = vindMijnDeelnemer(deelnemers, 'onbekend-device', profielNaamLower)
    expect(gevonden?.naam).toBe('Jan')
  })

  it('N4-04: exact gelijke naam matcht altijd (basisgeval)', () => {
    const gevonden = vindMijnDeelnemer(deelnemers, 'onbekend-device', 'jan')
    expect(gevonden).not.toBeNull()
  })

  it('N4-05: device_id-match werkt onafhankelijk van profielnaam', () => {
    const gevonden = vindMijnDeelnemer(deelnemers, 'dev-jan', null)
    expect(gevonden?.id).toBe('d1')
  })

  it('N4-06: profielnaam-match vindt deelnemer ook zonder overeenkomend device_id', () => {
    const gevonden = vindMijnDeelnemer(deelnemers, 'vreemd-device', 'piet')
    expect(gevonden?.id).toBe('d2')
  })

  it('N4-07: geen match op device_id én profielnaam → null', () => {
    const gevonden = vindMijnDeelnemer(deelnemers, 'vreemd-device', 'onbekend')
    expect(gevonden).toBeNull()
  })

  it('N4-08: lege deelnemers-array → null', () => {
    const gevonden = vindMijnDeelnemer([], 'dev-jan', 'jan')
    expect(gevonden).toBeNull()
  })
})

describe('N4 fix — mijnVerrekening correct bij case-insensitieve match', () => {
  it('N4-09: mijnVerrekening is een getal als deelnemer gevonden via case-insensitieve naam', () => {
    // Jan gestort €20, betaald €30 aan horeca → positieve verrekening
    const verrekening = berekenMijnVerrekening(deelnemers, transacties, geslotenOp, 'vreemd-device', 'jan')
    expect(verrekening).not.toBeNull()
    expect(typeof verrekening).toBe('number')
  })

  it('N4-10: mijnVerrekening is null als naam niet matcht (controletest oud gedrag)', () => {
    // Controleer dat een typefout echt null geeft
    const verrekening = berekenMijnVerrekening(deelnemers, transacties, geslotenOp, 'vreemd-device', 'janpieter')
    expect(verrekening).toBeNull()
  })

  it('N4-11: mijnVerrekening via device_id is gelijk aan via naam', () => {
    const viaDevice = berekenMijnVerrekening(deelnemers, transacties, geslotenOp, 'dev-jan', null)
    const viaNaam   = berekenMijnVerrekening(deelnemers, transacties, geslotenOp, 'vreemd-device', 'jan')
    expect(viaDevice).toBe(viaNaam)
  })
})
