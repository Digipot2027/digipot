/**
 * valideerBedragRealtime.test.js
 *
 * Unit tests voor valideerBedragRealtime() — realtime MAX-validatie
 * die tijdens typen wordt aangeroepen vanuit onChange-handlers.
 *
 * Gedrag:
 * - Lege of onvolledige invoer → null (geen fout tijdens typen)
 * - Bedrag ≤ MAX → null
 * - Bedrag > MAX → foutmelding
 * - Accepteert komma én punt als decimaalteken
 */

import { describe, it, expect } from 'vitest'
import { valideerBedragRealtime } from '../utils/valideer'

const MAX = 999.99

describe('valideerBedragRealtime', () => {
  describe('lege of onvolledige invoer → null', () => {
    it('lege string geeft null', () => {
      expect(valideerBedragRealtime('')).toBeNull()
    })

    it('alleen spaties geeft null', () => {
      expect(valideerBedragRealtime('   ')).toBeNull()
    })

    it('null geeft null', () => {
      expect(valideerBedragRealtime(null)).toBeNull()
    })

    it('undefined geeft null', () => {
      expect(valideerBedragRealtime(undefined)).toBeNull()
    })

    it('enkel komma geeft null (gebruiker start decimaalgedeelte)', () => {
      expect(valideerBedragRealtime(',')).toBeNull()
    })

    it('enkel punt geeft null (gebruiker start decimaalgedeelte)', () => {
      expect(valideerBedragRealtime('.')).toBeNull()
    })
  })

  describe('letters en ongeldige tekens → foutmelding', () => {
    it('puur letters geeft foutmelding', () => {
      expect(valideerBedragRealtime('abc')).toMatch(/cijfers/)
    })

    it('één letter geeft foutmelding', () => {
      expect(valideerBedragRealtime('a')).toMatch(/cijfers/)
    })

    it('mix van letters en cijfers geeft foutmelding', () => {
      expect(valideerBedragRealtime('12a')).toMatch(/cijfers/)
    })

    it('spatie gevolgd door cijfer geeft foutmelding', () => {
      // na trim() is " 1" -> "1" → dat is geldig. Maar " 1 " met interne spatie: trim geeft "1 1" → NaN
      expect(valideerBedragRealtime('1 1')).toMatch(/cijfers/)
    })
  })

  describe('geldige bedragen ≤ MAX → null', () => {
    it('1 geeft null', () => {
      expect(valideerBedragRealtime('1')).toBeNull()
    })

    it('999,99 (komma) geeft null', () => {
      expect(valideerBedragRealtime('999,99')).toBeNull()
    })

    it('999.99 (punt) geeft null', () => {
      expect(valideerBedragRealtime('999.99')).toBeNull()
    })

    it('0,01 geeft null', () => {
      expect(valideerBedragRealtime('0,01')).toBeNull()
    })

    it('50 geeft null', () => {
      expect(valideerBedragRealtime('50')).toBeNull()
    })
  })

  describe('bedrag > MAX → foutmelding', () => {
    it('1000 geeft foutmelding', () => {
      expect(valideerBedragRealtime('1000')).toMatch(/999,99/)
    })

    it('1000,00 geeft foutmelding', () => {
      expect(valideerBedragRealtime('1000,00')).toMatch(/999,99/)
    })

    it('9999999999 geeft foutmelding', () => {
      expect(valideerBedragRealtime('9999999999')).toMatch(/999,99/)
    })

    it('1000.00 (punt) geeft foutmelding', () => {
      expect(valideerBedragRealtime('1000.00')).toMatch(/999,99/)
    })
  })

  describe('aangepaste max-waarde', () => {
    it('50 boven max=49 geeft foutmelding', () => {
      expect(valideerBedragRealtime('50', 49)).not.toBeNull()
    })

    it('49 onder max=49 geeft null', () => {
      expect(valideerBedragRealtime('49', 49)).toBeNull()
    })
  })

  describe('2 decimalen (grenswaarde afkapping)', () => {
    // beperkDecimalen() kapt het 3e decimaal af in de component vóór validatie.
    // valideerBedragRealtime ontvangt dus altijd maximaal 2 decimalen.
    // Deze tests borgen dat afgekapte waarden correct worden beoordeeld.
    it('precies 2 decimalen geeft null', () => {
      expect(valideerBedragRealtime('12,34')).toBeNull()
    })

    it('precies 2 decimalen met punt geeft null', () => {
      expect(valideerBedragRealtime('12.34')).toBeNull()
    })

    it('1 decimaal geeft null', () => {
      expect(valideerBedragRealtime('12,3')).toBeNull()
    })

    it('0 decimalen geeft null', () => {
      expect(valideerBedragRealtime('12')).toBeNull()
    })
  })
})
