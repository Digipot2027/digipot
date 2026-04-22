import React, { useState, useEffect, useRef, useCallback } from 'react'
import { formatBedrag, parseBedrag } from '../utils/formatBedrag'
import { logFout } from '../utils/logFout'
import { valideerTransactieBedrag } from '../utils/valideer'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { slaagFormulierOp, wisFormulier } from '../utils/formulierBuffer'
import { STANDAARD_VALUTA, MAX_BEDRAG } from '../constants'

/**
 * ModalTransactie — formulier voor storting of betaling.
 *
 * Issue 10 fix (2026-04-12): formatBedrag werd op drie plekken aangeroepen
 * zonder valuta-parameter. formatBedrag gebruikt dan de default 'EUR', waardoor
 * de weergave incorrect is zodra multicurrency wordt geactiveerd.
 * Fix: valuta-prop toegevoegd en doorgegeven aan alle formatBedrag-aanroepen.
 *
 * WCAG-3 fix (2026-04-16): aria-describedby + aria-invalid toegevoegd aan
 * het bedrag-invoerveld. Screenreaders kondigen de foutmelding nu automatisch
 * aan zodra het veld focus heeft. role="alert" op de fout-div zorgt voor
 * directe aankondiging bij verschijnen.
 *
 * A17 fix (2026-04-20): bezigRef-guard toegevoegd. De laden-state vertraagt
 * de UI maar blokkeert geen tweede klik vóór de eerste async round-trip
 * klaar is, waardoor bij een snelle dubbele klik twee identieke transacties
 * konden worden ingediend. bezigRef is synchroon en blokkeert de tweede
 * aanroep direct.
 *
 * Bottom-sheet restyling (2026-04-22):
 * - Drag handle bovenaan het sheet
 * - Slide-up animatie met iOS-curve (cubic-bezier 0.32 0.72 0 1)
 * - Swipe-down op handle sluit de modal
 * - Klik buiten het sheet (op overlay) sluit de modal
 * - Bevestigen-knop gestapeld boven Annuleren (beide full-width)
 * - Label: 'Betaald bedrag' / 'Bedrag'; placeholder: '0,00'
 * - Bevestigen: grijs+disabled bij leeg/ongeldig, rood bij geldig bedrag
 * - Beschikbaar saldo direct onder de titel (alleen bij betaling)
 */
function ModalTransactie({ type, potSaldo, valuta = STANDAARD_VALUTA, potjeId = null, ikBenActief = true, onBevestig, onAnnuleer }) {
  const [bedrag, setBedrag] = useState('')
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')
  const panelRef = useRef(null)
  const handleRef = useRef(null)
  // A17: guard tegen dubbele submit vóór de eerste async round-trip voltooid is
  const bezigRef = useRef(false)
  // Swipe-state voor drag-to-dismiss
  const swipeStartY = useRef(null)

  const isStorting = type === 'storting'
  const titel = isStorting ? 'Storting toevoegen' : 'Betaling registreren'
  const labelBedrag = isStorting ? 'Bedrag' : 'Betaald bedrag'
  const MAX = MAX_BEDRAG

  const bedragNum = parseBedrag(bedrag)
  const bedragGeldig = bedrag.length > 0 && !isNaN(bedragNum) && bedragNum > 0 && bedragNum <= MAX

  useEffect(() => {
    panelRef.current?.querySelector('input, button:not([disabled])')?.focus()
  }, [])

  useFocusTrap(panelRef, onAnnuleer, { selector: 'input:not([disabled]), button:not([disabled])' })

  // Klik buiten sheet (op overlay) sluit de modal
  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) onAnnuleer()
  }, [onAnnuleer])

  // Swipe-down op de drag handle sluit de modal
  function handleTouchStart(e) {
    swipeStartY.current = e.touches[0].clientY
  }
  function handleTouchEnd(e) {
    if (swipeStartY.current === null) return
    const delta = e.changedTouches[0].clientY - swipeStartY.current
    swipeStartY.current = null
    if (delta > 60) onAnnuleer()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFout('')

    const validatieFout = valideerTransactieBedrag(bedrag, bedragNum, {
      isStorting,
      potSaldo,
      formatBedrag: (b) => formatBedrag(b, valuta),
      max: MAX,
    })
    if (validatieFout) {
      setFout(validatieFout)
      return
    }

    // A17: blokkeer dubbele submit
    if (bezigRef.current) return
    bezigRef.current = true
    setLaden(true)

    try {
      await onBevestig(type, bedragNum)
      // B5: submit geslaagd — verwijder eventuele buffer
      if (potjeId) wisFormulier(`digipot:betaling:${potjeId}`)
    } catch (error) {
      if (error.message?.includes('SALDO_TE_LAAG')) {
        const saldo = error.message.split(':')[1]
        setFout(`Het potje heeft niet genoeg saldo. Maximaal beschikbaar: ${formatBedrag(saldo, valuta)}.`)
      } else if (error.message?.includes('NIET_ACTIEF')) {
        setFout('Je hebt je afgemeld en kunt geen transacties meer invoeren.')
      } else if (error.message?.includes('DEELNEMER_ONTBREEKT')) {
        setFout('Er is iets misgegaan. Ververs de pagina en probeer opnieuw.')
      } else {
        // B5: bij timeout of netwerkfout het bedrag bewaren voor herstel
        if (potjeId && (
          error.message?.includes('REQUEST_TIMEOUT') ||
          error.message?.includes('fetch') ||
          error.message?.includes('NetworkError')
        )) {
          slaagFormulierOp(`digipot:betaling:${potjeId}`, { bedrag: bedragNum, type })
        }
        setFout(logFout(error, { component: 'ModalTransactie', actie: type }))
      }
    } finally {
      bezigRef.current = false
      setLaden(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-transactie-titel"
      onClick={handleOverlayClick}
    >
      <div
        ref={panelRef}
        className="modal-panel modal-panel--sheet"
      >
        {/* Drag handle — touch target voor swipe-to-dismiss */}
        <div
          ref={handleRef}
          className="modal-handle"
          aria-hidden="true"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />

        <h2 id="modal-transactie-titel" className="modal-titel">{titel}</h2>

        {!isStorting && ikBenActief && (
          <p className="modal-saldo-hint">
            Beschikbaar saldo: <strong>{formatBedrag(potSaldo, valuta)}</strong>
          </p>
        )}

        {!ikBenActief && (
          <div className="modal-info-blok">
            Je hebt je afgemeld en kunt geen transacties meer invoeren.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="veld">
            <label className="label" htmlFor="bedrag-invoer">{labelBedrag}</label>
            <input
              id="bedrag-invoer"
              className={`input ${fout ? 'fout' : ''}`}
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={bedrag}
              onChange={e => { setBedrag(e.target.value); setFout('') }}
              disabled={!ikBenActief}
              autoFocus
              aria-describedby={fout ? 'bedrag-invoer-fout' : undefined}
              aria-invalid={fout ? 'true' : undefined}
            />
            {bedragGeldig && !fout && (
              <div className="teller tekst-groen">= {formatBedrag(bedragNum, valuta)}</div>
            )}
            {/* WCAG 1.3.1 / 4.1.3: id koppelt foutmelding aan invoerveld via aria-describedby */}
            {fout && <div id="bedrag-invoer-fout" className="fout-tekst" role="alert">{fout}</div>}
          </div>

          <div className="modal-knoppen--gestapeld">
            <button
              type="submit"
              className={`knop ${bedragGeldig && !laden ? 'knop-gevaar' : 'knop-bevestig-inactief'}`}
              disabled={laden || !bedragGeldig || !ikBenActief}
            >
              {laden
                ? (isStorting ? 'Storting registreren…' : 'Betaling registreren…')
                : 'Bevestigen'}
            </button>
            <button
              type="button"
              className="knop knop-sheet-annuleer"
              onClick={onAnnuleer}
            >
              Annuleren
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ModalTransactie
