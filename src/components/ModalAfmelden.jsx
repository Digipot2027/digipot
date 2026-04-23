import React, { useState, useEffect, useRef, useCallback } from 'react'
import { logFout } from '../utils/logFout'
import { useFocusTrap } from '../hooks/useFocusTrap'

/**
 * ModalAfmelden — bevestigingsdialoog vóór definitief afmelden.
 *
 * Afmelden is onomkeerbaar (geen heractivatie). Deze modal geeft de gebruiker
 * een expliciete waarschuwing en vraagt om bewuste bevestiging.
 *
 * Gedrag:
 * - Escape of "Annuleren" sluit de modal zonder actie
 * - "Ja, meld me af" roept onBevestig() aan
 * - Tab-trap binnen het panel (WCAG 2.1.1)
 * - Klik buiten sheet of swipe-down sluit de modal
 *
 * BUG-3 fix (2026-04-16): catch-blok toegevoegd aan handleBevestig.
 * Zonder catch verdween een exception uit onBevestig() stil — geen fout
 * getoond aan de gebruiker, geen Sentry-logging. De fout wordt nu getoond
 * in de modal zelf via lokale fout-state. De outer handler (usePotjeActies
 * handleAfmelden) vangt DB-fouten al op via toonToast; deze catch dekt
 * onverwachte bugs in de aanroepketen die de outer handler niet bereiken.
 *
 * Zombie-preventie (2026-04-18): prop isLaatsteActieve toont een extra
 * waarschuwing aan de gebruiker die als laatste actieve deelnemer op het
 * punt staat zich af te melden. Na afmelding sluit de DB-trigger
 * sluit_potje_bij_laatste_afmelding het potje automatisch, waarna de
 * eindafrekening verschijnt. Zonder deze waarschuwing zou de sluiting
 * een verrassing zijn.
 *
 * Achtergelaten bedrag (2026-04-21): prop achtergelatenBedrag toont een
 * oranje waarschuwingsbanner wanneer de deelnemer een betekenisvol aandeel
 * in het resterende potsaldo achterlaat. De berekening en drempel (€2) zitten
 * in berekenAchtergelatenBedrag() — de modal toont alleen wat wordt
 * meegegeven. null of 0 = geen melding.
 *
 * Bottom-sheet restyling (2026-04-22):
 * - Drag handle + slide-up animatie (zelfde patroon als andere modals)
 * - Klik buiten sheet of swipe-down sluit modal
 * - Titel 'Afmelden?' zonder emoji
 * - Genummerde lijst met gevolgen
 * - Oranje banner voor achtergelaten bedrag (apart van de lijst)
 * - Knoppen gestapeld: 'Ja, meld me af' (rood) boven 'Annuleren' (wit)
 */
function ModalAfmelden({ isLaatsteActieve = false, achtergelatenBedrag = null, onBevestig, onAnnuleer }) {
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')
  const panelRef = useRef(null)
  const swipeStartY = useRef(null)

  // Focus eerste knop bij openen
  useEffect(() => {
    panelRef.current?.querySelector('button:not([disabled])')?.focus()
  }, [])

  // WCAG 2.1.1 / 2.4.3: Escape + Tab-trap via gedeelde hook
  useFocusTrap(panelRef, onAnnuleer, { selector: 'button:not([disabled])' })

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

  async function handleBevestig() {
    setFout('')
    setLaden(true)
    try {
      await onBevestig()
    } catch (error) {
      // BUG-3 fix aangevuld (2026-04-23): logFout() toegevoegd zodat onverwachte
      // fouten in de aanroepketen ook naar Sentry gaan.
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
        {/* Drag handle — touch target voor swipe-to-dismiss */}
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

        {/* Genummerde lijst met gevolgen */}
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

        {/* Oranje banner voor achtergelaten bedrag */}
        {toonAchtergelatenBedrag && (
          <div className="modal-afmelden-banner" role="note">
            <span className="modal-afmelden-banner__icoon" aria-hidden="true">⚠️</span>
            <span>
              Je laat <strong>~{achtergelatenBedrag.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })}</strong> achter in de pot voor de andere deelnemers.
            </span>
          </div>
        )}

        {/* BUG-3 fix: fout zichtbaar in de modal */}
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
