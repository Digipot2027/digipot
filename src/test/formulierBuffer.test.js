/**
 * formulierBuffer.test.js — unit tests voor formulierBuffer
 *
 * Dekt:
 *   - slaagFormulierOp: schrijft naar sessionStorage
 *   - laadFormulier: leest en verwijdert buffer
 *   - laadFormulier: retourneert null als sleutel ontbreekt
 *   - wisFormulier: verwijdert zonder te lezen
 *   - Eenmalige lezing: tweede aanroep retourneert null
 *   - Foutbestendigheid: SessionStorage-fouten worden stil afgehandeld
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { slaagFormulierOp, laadFormulier, wisFormulier } from '../utils/formulierBuffer'

describe('formulierBuffer', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  describe('slaagFormulierOp', () => {
    it('schrijft data als JSON naar sessionStorage', () => {
      slaagFormulierOp('digipot:storten:abc', { bedrag: 15 })
      const opgeslagen = sessionStorage.getItem('digipot:storten:abc')
      expect(JSON.parse(opgeslagen)).toEqual({ bedrag: 15 })
    })

    it('overschrijft bestaande data bij zelfde sleutel', () => {
      slaagFormulierOp('digipot:storten:abc', { bedrag: 10 })
      slaagFormulierOp('digipot:storten:abc', { bedrag: 20 })
      const opgeslagen = sessionStorage.getItem('digipot:storten:abc')
      expect(JSON.parse(opgeslagen)).toEqual({ bedrag: 20 })
    })

    it('slaat niets op bij een sessionStorage-fout — stil doorgaan', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
      expect(() => slaagFormulierOp('digipot:storten:abc', { bedrag: 5 })).not.toThrow()
      setItemSpy.mockRestore()
    })
  })

  describe('laadFormulier', () => {
    it('retourneert de opgeslagen data', () => {
      slaagFormulierOp('digipot:storten:abc', { bedrag: 25 })
      const resultaat = laadFormulier('digipot:storten:abc')
      expect(resultaat).toEqual({ bedrag: 25 })
    })

    it('verwijdert de buffer na lezen — tweede aanroep retourneert null', () => {
      slaagFormulierOp('digipot:storten:abc', { bedrag: 30 })
      laadFormulier('digipot:storten:abc')
      const resultaat = laadFormulier('digipot:storten:abc')
      expect(resultaat).toBeNull()
    })

    it('retourneert null als sleutel niet bestaat', () => {
      const resultaat = laadFormulier('digipot:storten:niet-bestaand')
      expect(resultaat).toBeNull()
    })

    it('retourneert null bij ongeldige JSON in sessionStorage', () => {
      sessionStorage.setItem('digipot:storten:kapot', 'geen-json{{{')
      const resultaat = laadFormulier('digipot:storten:kapot')
      expect(resultaat).toBeNull()
    })

    it('retourneert null bij een sessionStorage-fout — stil doorgaan', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })
      expect(() => laadFormulier('digipot:storten:abc')).not.toThrow()
      const resultaat = laadFormulier('digipot:storten:abc')
      expect(resultaat).toBeNull()
      getItemSpy.mockRestore()
    })
  })

  describe('wisFormulier', () => {
    it('verwijdert de sleutel uit sessionStorage', () => {
      slaagFormulierOp('digipot:betaling:abc', { bedrag: 10, type: 'betaling' })
      wisFormulier('digipot:betaling:abc')
      expect(sessionStorage.getItem('digipot:betaling:abc')).toBeNull()
    })

    it('doet niets als de sleutel niet bestaat', () => {
      expect(() => wisFormulier('digipot:betaling:niet-bestaand')).not.toThrow()
    })

    it('stilt sessionStorage-fouten', () => {
      const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })
      expect(() => wisFormulier('digipot:storten:abc')).not.toThrow()
      removeItemSpy.mockRestore()
    })
  })

  describe('isolatie tussen sleutels', () => {
    it('twee sleutels storen elkaar niet', () => {
      slaagFormulierOp('digipot:storten:potje1', { bedrag: 5 })
      slaagFormulierOp('digipot:storten:potje2', { bedrag: 99 })
      expect(laadFormulier('digipot:storten:potje1')).toEqual({ bedrag: 5 })
      expect(laadFormulier('digipot:storten:potje2')).toEqual({ bedrag: 99 })
    })
  })
})
