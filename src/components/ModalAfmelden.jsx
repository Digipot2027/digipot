import { useState, useEffect, useRef } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'

/**
 * ModalAfmelden — bevestigingsdialoog vóór definitief afmelden.
 *
 * Afmelden is onomkeerbaar (geen heractivatie). Deze modal geeft de gebruiker
 * een expliciete waarschuwing en vraagt om bewuste bevestiging.
 *
 * Gedrag:
 * - Escape of "Annuleren" sluit de modal zonder actie
 * - "Ja, afmelden" roept onBevestig() aan
 * - Tab-trap binnen het panel (WCAG 2.1.1)
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
 * extra bullet wanneer de deelnemer een betekenisvol aandeel in het
 * resterende potsaldo achterlaat. De berekening en drempel (€2) zitten
 * in berekenAchtergelatenBedrag() — de modal toont alleen wat wordt
 * meegegeven. null of 0 = geen melding.
 */
function ModalAfmelden({ deelnemerNaam, isLaatsteActieve = false, achtergelatenBedrag = null, onBevestig, onAnnuleer }) {
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')
  const panelRef = useRef(null)

  // Focus eerste knop bij openen
  useEffect(() => {
    panelRef.current?.querySelector('button:not([disabled])')?.focus()
  }, [])

  // WCAG 2.1.1 / 2.4.3: Escape + Tab-trap via gedeelde hook
  useFocusTrap(panelRef, onAnnuleer, { selector: 'button:not([disabled])' })

  async function handleBevestig() {
    setFout('')
    setLaden(true)
    try {
      await onBevestig()
    } catch {
      // Onverwachte fout in de aanroepketen — toon in de modal zodat de
      // gebruiker feedback krijgt en de modal niet stil blijft hangen.
      setFout('Er is iets misgegaan. Probeer het opnieuw.')
    } finally {
      setLaden(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-afmelden-titel"
    >
      <div ref={panelRef} className="modal-panel">
        <h2 id="modal-afmelden-titel" className="modal-titel">
          👋 Afmelden
        </h2>

        <p className="modal-tekst--mb3">
          Weet je zeker dat je <strong>{deelnemerNaam}</strong> wilt afmelden?
        </p>

        {/* Gevolgen expliciet benoemen */}
        <div className="waarschuwing-blok">
          <p className="waarschuwing-blok__titel">
            Let op — dit kan niet ongedaan worden gemaakt:
          </p>
          <ul className="waarschuwing-blok__lijst">
            <li>• Je telt niet meer mee bij nieuwe betalingen</li>
            <li>• Je kunt je daarna niet opnieuw aanmelden</li>
            <li>• Je inleg blijft zichtbaar in de eindafrekening</li>
            {achtergelatenBedrag !== null && achtergelatenBedrag > 0 && (
              <li>• Je laat <strong>~{achtergelatenBedrag.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })}</strong> achter in het potje — dit geld ben je kwijt</li>
            )}
            {isLaatsteActieve && (
              <li><strong>• Het potje wordt direct afgesloten</strong> — jij bent de laatste actieve deelnemer. Iedereen ziet meteen de eindafrekening.</li>
            )}
          </ul>
        </div>

        {/* BUG-3 fix: fout zichtbaar in de modal */}
        {fout && (
          <div id="modal-afmelden-fout" className="fout-tekst mb-3" role="alert">
            {fout}
          </div>
        )}

        <div className="modal-knoppen">
          <button
            type="button"
            className="knop knop-secundair flex-1"
            onClick={onAnnuleer}
          >
            Annuleren
          </button>
          <button
            type="button"
            className="knop knop-afmelden flex-1"
            onClick={handleBevestig}
            disabled={laden}
            aria-describedby={fout ? 'modal-afmelden-fout' : undefined}
          >
            {laden ? 'Bezig...' : 'Ja, afmelden →'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalAfmelden
