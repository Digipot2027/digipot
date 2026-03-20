import { describe, it, expect } from 'vitest'
import { vertaalFout } from '../utils/vertaalFout'

describe('vertaalFout', () => {
  it('geeft fallback terug bij null', () => {
    expect(vertaalFout(null)).toBe('Er is iets misgegaan. Probeer het opnieuw.')
  })

  it('geeft fallback terug bij undefined', () => {
    expect(vertaalFout(undefined)).toBe('Er is iets misgegaan. Probeer het opnieuw.')
  })

  it('geeft null terug bij SALDO_TE_LAAG', () => {
    expect(vertaalFout(new Error('SALDO_TE_LAAG:10.00'))).toBeNull()
  })

  it('vertaalt duplicate naam fout', () => {
    const fout = new Error('duplicate key value violates unique constraint "deelnemers_potje_id_naam"')
    expect(vertaalFout(fout)).toBe('Deze naam is al bezet in dit potje. Kies een andere naam.')
  })

  it('vertaalt duplicate device fout', () => {
    const fout = new Error('duplicate key value violates unique constraint "deelnemers_potje_id_device"')
    expect(vertaalFout(fout)).toBe('Je lijkt al mee te doen. Kies je naam om verder te gaan.')
  })

  it('vertaalt gesloten potje fout', () => {
    const fout = new Error('potjes gesloten status error')
    expect(vertaalFout(fout)).toBe('Dit potje is al gesloten en kan niet meer worden gewijzigd.')
  })

  it('vertaalt bedrag check_violation', () => {
    const fout = new Error('check_violation on bedrag constraint')
    expect(vertaalFout(fout)).toBe('Voer een bedrag in tussen €0,01 en €999,99.')
  })

  it('vertaalt naam check_violation', () => {
    const fout = new Error('check_violation on naam constraint')
    expect(vertaalFout(fout)).toBe('De naam is te lang. Maximaal 30 tekens toegestaan.')
  })

  it('vertaalt JWT/auth fout', () => {
    const fout = new Error('JWT expired')
    expect(vertaalFout(fout)).toBe('Sessie verlopen. Ververs de pagina.')
  })

  it('vertaalt netwerk fout', () => {
    const fout = new Error('fetch failed: network error')
    expect(vertaalFout(fout)).toBe('Verbinding verbroken. Wijzigingen worden niet opgeslagen. Controleer je internet.')
  })

  it('geeft fallback bij onbekende fout', () => {
    const fout = new Error('iets totaal onbekend')
    expect(vertaalFout(fout)).toBe('Er is iets misgegaan. Probeer het opnieuw.')
  })

  it('werkt ook met een string als fout', () => {
    expect(vertaalFout({ message: 'JWT token invalid' })).toBe('Sessie verlopen. Ververs de pagina.')
  })
})
