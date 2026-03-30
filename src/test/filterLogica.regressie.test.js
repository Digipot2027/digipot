/**
 * Filterlogica potjeslijsten — regressietests
 *
 * PaginaOpenPotjes en PaginaGeslotenPotjes bevatten filterlogica die
 * bepaalt welke potjes zichtbaar zijn. Die logica staat als inline code
 * in een useEffect en kan niet direct worden getest via component-mounts
 * zonder Supabase-mocks.
 *
 * Teststrategie: de kritische logica is geëxtraheerd als pure functies
 * en wordt hier getest. Als de component-implementatie verandert moeten
 * deze functies worden bijgewerkt.
 *
 * Gedekte regressierisico's:
 *   FL-1  filters-array opbouw: geen device_id én geen profielnaam → lege lijst
 *   FL-2  alleen device_id aanwezig → één filter
 *   FL-3  alleen profielnaam aanwezig → één filter
 *   FL-4  beide aanwezig → twee filters met OR
 *   FL-5  deduplicatie van potje-IDs via Set
 *   FL-6  mijnDeelnemer matching in GeslotenPotjes (device_id heeft prioriteit)
 *   FL-7  mijnVerrekening is null als deelnemer niet gevonden wordt
 *   LF-2  logFout geeft null terug bij SALDO_TE_LAAG (contract check)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Sentry zodat logFout testbaar is
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

import { logFout } from '../utils/logFout'

// ─── Extractie filterlogica uit PaginaOpenPotjes / PaginaGeslotenPotjes ───────
// Identiek aan de inline logica in beide pagina's

function bouwFilters({ deviceId, profielNaam }) {
  const filters = []
  if (deviceId) filters.push(`device_id.eq.${deviceId}`)
  if (profielNaam) filters.push(`naam.ilike.${profielNaam}`)
  return filters
}

function uniekeIds(deelnemers) {
  return [...new Set(deelnemers.map(d => d.potje_id))]
}

// Extractie matching-logica uit PaginaGeslotenPotjes
function vindMijnDeelnemer({ allDeelnemers, deviceId, profielNaam }) {
  return (allDeelnemers || []).find(d =>
    d.device_id === deviceId ||
    (profielNaam && d.naam.toLowerCase() === profielNaam.toLowerCase())
  )
}

// ─── FL-1 t/m FL-4: filters-array opbouw ─────────────────────────────────────

describe('Filterlogica — FL-1: geen device_id én geen profielnaam', () => {
  it('geeft een lege filters-array terug', () => {
    const filters = bouwFilters({ deviceId: null, profielNaam: null })
    expect(filters).toHaveLength(0)
  })

  it('lege filters-array → geen API-aanroep doen (filters.length === 0)', () => {
    const filters = bouwFilters({ deviceId: null, profielNaam: null })
    expect(filters.length === 0).toBe(true)
  })
})

describe('Filterlogica — FL-2: alleen device_id aanwezig', () => {
  it('geeft één filter terug voor device_id', () => {
    const filters = bouwFilters({ deviceId: 'uuid-123', profielNaam: null })
    expect(filters).toHaveLength(1)
    expect(filters[0]).toBe('device_id.eq.uuid-123')
  })

  it('bevat geen naam-filter als profielNaam null is', () => {
    const filters = bouwFilters({ deviceId: 'uuid-123', profielNaam: null })
    expect(filters.some(f => f.includes('ilike'))).toBe(false)
  })
})

describe('Filterlogica — FL-3: alleen profielnaam aanwezig', () => {
  it('geeft één filter terug voor naam', () => {
    const filters = bouwFilters({ deviceId: null, profielNaam: 'Jan' })
    expect(filters).toHaveLength(1)
    expect(filters[0]).toBe('naam.ilike.Jan')
  })

  it('bevat geen device_id-filter als deviceId null is', () => {
    const filters = bouwFilters({ deviceId: null, profielNaam: 'Jan' })
    expect(filters.some(f => f.includes('device_id'))).toBe(false)
  })
})

describe('Filterlogica — FL-4: beide aanwezig', () => {
  it('geeft twee filters terug', () => {
    const filters = bouwFilters({ deviceId: 'uuid-123', profielNaam: 'Jan' })
    expect(filters).toHaveLength(2)
  })

  it('eerste filter is device_id', () => {
    const filters = bouwFilters({ deviceId: 'uuid-123', profielNaam: 'Jan' })
    expect(filters[0]).toBe('device_id.eq.uuid-123')
  })

  it('tweede filter is naam.ilike', () => {
    const filters = bouwFilters({ deviceId: 'uuid-123', profielNaam: 'Jan' })
    expect(filters[1]).toBe('naam.ilike.Jan')
  })

  it('join(",") geeft geldig OR-argument voor Supabase', () => {
    const filters = bouwFilters({ deviceId: 'uuid-123', profielNaam: 'Jan' })
    expect(filters.join(',')).toBe('device_id.eq.uuid-123,naam.ilike.Jan')
  })
})

// ─── FL-5: deduplicatie potje-IDs ─────────────────────────────────────────────

describe('Filterlogica — FL-5: deduplicatie potje-IDs', () => {
  it('geeft unieke potje-IDs bij meerdere deelnemers in hetzelfde potje', () => {
    const deelnemers = [
      { potje_id: 'potje-1' },
      { potje_id: 'potje-1' }, // zelfde potje, twee deelnemers
      { potje_id: 'potje-2' },
    ]
    expect(uniekeIds(deelnemers)).toEqual(['potje-1', 'potje-2'])
  })

  it('geeft lege array bij lege deelnemerslijst', () => {
    expect(uniekeIds([])).toEqual([])
  })

  it('behoudt volgorde van eerste verschijning', () => {
    const deelnemers = [
      { potje_id: 'c' },
      { potje_id: 'a' },
      { potje_id: 'b' },
      { potje_id: 'a' },
    ]
    expect(uniekeIds(deelnemers)).toEqual(['c', 'a', 'b'])
  })

  it('alle unieke IDs bij geen duplicaten', () => {
    const deelnemers = [
      { potje_id: 'potje-1' },
      { potje_id: 'potje-2' },
      { potje_id: 'potje-3' },
    ]
    expect(uniekeIds(deelnemers)).toHaveLength(3)
  })
})

// ─── FL-6: mijnDeelnemer matching in GeslotenPotjes ──────────────────────────

describe('Filterlogica — FL-6: mijnDeelnemer matching', () => {
  const deelnemers = [
    { id: 'd1', device_id: 'uuid-mijn', naam: 'Alice' },
    { id: 'd2', device_id: 'uuid-ander', naam: 'Bob' },
    { id: 'd3', device_id: 'uuid-derde', naam: 'Jan' },
  ]

  it('vindt deelnemer op device_id', () => {
    const gevonden = vindMijnDeelnemer({ allDeelnemers: deelnemers, deviceId: 'uuid-mijn', profielNaam: null })
    expect(gevonden?.id).toBe('d1')
  })

  it('vindt deelnemer op naam (case-insensitief)', () => {
    const gevonden = vindMijnDeelnemer({ allDeelnemers: deelnemers, deviceId: 'uuid-onbekend', profielNaam: 'jan' })
    expect(gevonden?.id).toBe('d3')
  })

  it('device_id heeft prioriteit boven naam bij conflict', () => {
    // device_id matcht d1 (Alice), naam matcht d3 (Jan)
    // find() pakt de eerste match → device_id wint
    const gevonden = vindMijnDeelnemer({ allDeelnemers: deelnemers, deviceId: 'uuid-mijn', profielNaam: 'jan' })
    expect(gevonden?.id).toBe('d1')
  })

  it('geeft undefined als device_id onbekend is en geen profielnaam', () => {
    const gevonden = vindMijnDeelnemer({ allDeelnemers: deelnemers, deviceId: 'uuid-onbekend', profielNaam: null })
    expect(gevonden).toBeUndefined()
  })

  it('geeft undefined als device_id én naam niet matchen', () => {
    const gevonden = vindMijnDeelnemer({ allDeelnemers: deelnemers, deviceId: 'uuid-onbekend', profielNaam: 'Henk' })
    expect(gevonden).toBeUndefined()
  })

  it('werkt met lege deelnemerslijst', () => {
    const gevonden = vindMijnDeelnemer({ allDeelnemers: [], deviceId: 'uuid-mijn', profielNaam: 'Jan' })
    expect(gevonden).toBeUndefined()
  })

  it('werkt met null allDeelnemers (Supabase kan null teruggeven)', () => {
    // Broncode: (allDeelnemers || []).find(...) — null wordt opgevangen
    const gevonden = vindMijnDeelnemer({ allDeelnemers: null, deviceId: 'uuid-mijn', profielNaam: 'Jan' })
    expect(gevonden).toBeUndefined()
  })
})

// ─── FL-7: mijnVerrekening is null als deelnemer niet gevonden wordt ──────────

describe('Filterlogica — FL-7: mijnVerrekening null-afhandeling', () => {
  // Extractie van de mijnVerrekening-berekening uit GeslotenPotjes
  function berekenMijnVerrekening({ mijnDeelnemer, deelnemersSaldi }) {
    return mijnDeelnemer
      ? deelnemersSaldi.find(s => s.id === mijnDeelnemer.id)?.verrekening ?? null
      : null
  }

  it('geeft null als mijnDeelnemer undefined is', () => {
    const result = berekenMijnVerrekening({
      mijnDeelnemer: undefined,
      deelnemersSaldi: [{ id: 'd1', verrekening: 10 }],
    })
    expect(result).toBeNull()
  })

  it('geeft null als mijnDeelnemer null is', () => {
    const result = berekenMijnVerrekening({
      mijnDeelnemer: null,
      deelnemersSaldi: [{ id: 'd1', verrekening: 10 }],
    })
    expect(result).toBeNull()
  })

  it('geeft de verrekening terug als deelnemer gevonden wordt', () => {
    const result = berekenMijnVerrekening({
      mijnDeelnemer: { id: 'd1' },
      deelnemersSaldi: [{ id: 'd1', verrekening: 15.50 }],
    })
    expect(result).toBe(15.50)
  })

  it('geeft negatieve verrekening correct terug', () => {
    const result = berekenMijnVerrekening({
      mijnDeelnemer: { id: 'd2' },
      deelnemersSaldi: [
        { id: 'd1', verrekening: 10 },
        { id: 'd2', verrekening: -7.25 },
      ],
    })
    expect(result).toBe(-7.25)
  })

  it('geeft null als deelnemer niet in deelnemersSaldi staat (??-operator)', () => {
    // deelnemersSaldi.find() geeft undefined → ?? null → null
    const result = berekenMijnVerrekening({
      mijnDeelnemer: { id: 'onbekend' },
      deelnemersSaldi: [{ id: 'd1', verrekening: 10 }],
    })
    expect(result).toBeNull()
  })

  it('geeft 0 terug als verrekening exact nul is (niet null)', () => {
    const result = berekenMijnVerrekening({
      mijnDeelnemer: { id: 'd1' },
      deelnemersSaldi: [{ id: 'd1', verrekening: 0 }],
    })
    expect(result).toBe(0)
  })
})

// ─── LF-2: logFout contract — null bij SALDO_TE_LAAG ─────────────────────────

describe('logFout — LF-2: returnwaarde bij SALDO_TE_LAAG', () => {
  it('geeft null terug bij SALDO_TE_LAAG (callers vertrouwen op dit contract)', () => {
    // ModalTransactie en PaginaStorten handelen null speciaal af
    const bericht = logFout(new Error('SALDO_TE_LAAG:25.00'), { component: 'Test', actie: 'betaling' })
    expect(bericht).toBeNull()
  })

  it('geeft null terug bij SALDO_TE_LAAG zonder bedrag-suffix', () => {
    const bericht = logFout(new Error('SALDO_TE_LAAG'), { component: 'Test', actie: 'betaling' })
    expect(bericht).toBeNull()
  })

  it('geeft een string terug bij alle andere fouten (niet null)', () => {
    const bericht = logFout(new Error('fetch mislukt'), { component: 'Test', actie: 'laden' })
    expect(typeof bericht).toBe('string')
    expect(bericht).not.toBeNull()
  })
})
