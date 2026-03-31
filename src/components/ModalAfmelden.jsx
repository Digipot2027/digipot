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
 */
function ModalAfmelden({ deelnemerNaam, onBevestig, onAnnuleer }) {
  const [laden, setLaden] = useState(false)
  const panelRef = useRef(null)

  // Focus eerste knop bij openen
  useEffect(() => {
    panelRef.current?.querySelector('button:not([disabled])')?.focus()
  }, [])

  // WCAG 2.1.1 / 2.4.3: Escape + Tab-trap via gedeelde hook
  useFocusTrap(panelRef, onAnnuleer, { selector: 'button:not([disabled])' })

  async function handleBevestig() {
    setLaden(true)
    try {
      await onBevestig()
    } finally {
      setLaden(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 500 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-afmelden-titel"
    >
      <div
        ref={panelRef}
        style={{ background: 'var(--wit)', width: '100%', borderRadius: '16px 16px 0 0', padding: 24, paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}
      >
        <h2 id="modal-afmelden-titel" style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
          👋 Afmelden
        </h2>

        <p style={{ fontSize: 14, color: 'var(--grijs-600)', marginBottom: 12 }}>
          Weet je zeker dat je <strong>{deelnemerNaam}</strong> wilt afmelden?
        </p>

        {/* Gevolgen expliciet benoemen */}
        <div style={{ background: 'var(--oranje-licht)', border: '1px solid #fed7aa', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: 'var(--oranje)', fontWeight: 600, marginBottom: 4 }}>
            Let op — dit kan niet ongedaan worden gemaakt:
          </p>
          <ul style={{ listStyle: 'none', fontSize: 13, color: 'var(--oranje)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li>• Je telt niet meer mee bij nieuwe betalingen</li>
            <li>• Je kunt je daarna niet opnieuw aanmelden</li>
            <li>• Je inleg blijft zichtbaar in de eindafrekening</li>
          </ul>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="knop knop-secundair"
            style={{ flex: 1 }}
            onClick={onAnnuleer}
          >
            Annuleren
          </button>
          <button
            type="button"
            className="knop knop-afmelden"
            style={{ flex: 1 }}
            onClick={handleBevestig}
            disabled={laden}
          >
            {laden ? 'Bezig...' : 'Ja, afmelden →'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalAfmelden
