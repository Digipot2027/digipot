import React, { useState, useEffect, useRef, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { logFout } from '../utils/logFout'
import { useFocusTrap } from '../hooks/useFocusTrap'

/**
 * ModalAfmelden — bevestigingsdialoog vóór definitief afmelden.
 *
 * Lucide-migratie (2026-04-24): ⚠️ emoji vervangen door AlertTriangle icon.
 *
 * [Overige historische opmerkingen ongewijzigd]
 * BUG-3 fix (2026-04-16), Zombie-preventie (2026-04-18),
 * Achtergelaten bedrag (2026-04-21), Bottom-sheet restyling (2026-04-22).
 */
function ModalAfmelden({ isLaatsteActieve = false, achtergelatenBedrag = null, onBevestig, onAnnuleer }) {
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')
  const panelRef = useRef(null)
  const swipeStartY = useRef(null)

  useEffect(() => {
    panelRef.current?.querySelector('button:not([disabled])')?.focus()
  }, [])

  useFocusTrap(panelRef, onAnnuleer, { selector: 'button:not([disabled])' })

  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) onAnnuleer()
  }, [onAnnuleer])

  function handleTouchStart(e) {
    swipeStartY.current = e.touches[0].clientY
  }
  function handleTouchEnd(e) {
    if (swipeStartY.current === null) return
    const delta = e.changedTouches[0].clientY - swipeStartY.current
    swipeStartY.current = null
    if (delta > 60) onAnnuleer()
  }

  async function handleBevestig() {
    setFout('')
    setLaden(true)
    try {
      await onBevestig()
    } catch (error) {
      setFout(logFout(error, { component: 'ModalAfmelden', actie: 'afmelden' }))
    } finally {
      setLaden(false)
    }
  }

  const toonAchtergelatenBedrag = achtergelatenBedrag !== null && achtergelatenBedrag > 0

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-afmelden-titel"
      onClick={handleOverlayClick}
    >
      <div ref={panelRef} className="modal-panel modal-panel--sheet">
        <div
          className="modal-handle"
          aria-hidden="true"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />

        <h2 id="modal-afmelden-titel" className="modal-titel">
          Afmelden?
        </h2>

        <p className="modal-afmelden-subtekst">
          Dit is onomkeerbaar. Na het afmelden:
        </p>

        <ol className="modal-afmelden-lijst">
          <li>
            <span className="modal-afmelden-lijst__nummer">1</span>
            Je telt niet meer mee in nieuwe betalingen.
          </li>
          <li>
            <span className="modal-afmelden-lijst__nummer">2</span>
            Je kunt niet opnieuw deelnemen aan deze pot.
          </li>
          <li>
            <span className="modal-afmelden-lijst__nummer">3</span>
            Je storting blijft zichtbaar in de eindafrekening.
          </li>
          {isLaatsteActieve && (
            <li>
              <span className="modal-afmelden-lijst__nummer">4</span>
              <strong>Het potje wordt direct afgesloten</strong> — jij bent de laatste actieve deelnemer.
            </li>
          )}
        </ol>

        {toonAchtergelatenBedrag && (
          <div className="modal-afmelden-banner" role="note">
            <AlertTriangle size={16} aria-hidden="true" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Je laat <strong>~{achtergelatenBedrag.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })}</strong> achter in de pot voor de andere deelnemers.
            </span>
          </div>
        )}

        {fout && (
          <div id="modal-afmelden-fout" className="fout-tekst mb-3" role="alert">
            {fout}
          </div>
        )}

        <div className="modal-knoppen--gestapeld">
          <button
            type="button"
            className="knop knop-gevaar"
            onClick={handleBevestig}
            disabled={laden}
            aria-describedby={fout ? 'modal-afmelden-fout' : undefined}
          >
            {laden ? 'Bezig…' : 'Ja, meld me af'}
          </button>
          <button
            type="button"
            className="knop knop-sheet-annuleer"
            onClick={onAnnuleer}
          >
            Annuleren
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalAfmelden
