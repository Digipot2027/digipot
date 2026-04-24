import React, { useState, useEffect, useRef, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { logFout } from '../utils/logFout'
import { useFocusTrap } from '../hooks/useFocusTrap'

/**
 * ModalSluiten — bevestigingsmodal voor het afsluiten van een potje.
 *
 * Lucide-migratie (2026-04-24): ⚠️ emoji vervangen door AlertTriangle icon.
 *
 * K4 fix (2026-04-16), Bottom-sheet restyling (2026-04-22).
 */
function ModalSluiten({ aantalActiefDeelnemers = 0, onBevestig, onAnnuleer }) {
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

  async function handleSluiten() {
    setLaden(true)
    try {
      await onBevestig()
    } catch (error) {
      setFout(logFout(error, { component: 'ModalSluiten', actie: 'sluiten' }))
      setLaden(false)
    }
  }

  const deelnemersTekst = aantalActiefDeelnemers === 1
    ? '1 deelnemer'
    : `${aantalActiefDeelnemers} deelnemers`

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-sluiten-titel"
      onClick={handleOverlayClick}
    >
      <div ref={panelRef} className="modal-panel modal-panel--sheet">
        <div
          className="modal-handle"
          aria-hidden="true"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />

        {/* Waarschuwingsicoon */}
        <div className="modal-sluiten-icoon" aria-hidden="true">
          <AlertTriangle size={24} strokeWidth={2} />
        </div>

        <h2 id="modal-sluiten-titel" className="modal-titel modal-titel--center">
          Pot sluiten?
        </h2>

        <p className="modal-sluiten-subtekst">
          Dit is <strong>onomkeerbaar</strong>. Iedereen ziet direct wie geld terugkrijgt en wie moet bijbetalen.
        </p>

        <div className="modal-sluiten-banner" role="note">
          De pot wordt direct gesloten voor {deelnemersTekst}. Daarna is de eindafrekening definitief.
        </div>

        {fout && <div className="fout-tekst mb-3" role="alert">{fout}</div>}

        <div className="modal-knoppen--gestapeld">
          <button
            className="knop knop-gevaar"
            onClick={handleSluiten}
            disabled={laden}
          >
            {laden ? 'Bezig…' : 'Ja, sluit de pot'}
          </button>
          <button
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

export default ModalSluiten
