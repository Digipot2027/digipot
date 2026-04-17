import { useState, useEffect, useRef } from 'react'
import { logFout } from '../utils/logFout'
import { useFocusTrap } from '../hooks/useFocusTrap'

function ModalSluiten({ potjeNaam, onBevestig, onAnnuleer }) {
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')
  const panelRef = useRef(null)

  // K4: focus eerste knop bij openen
  useEffect(() => {
    panelRef.current?.querySelector('button:not([disabled])')?.focus()
  }, [])

  // WCAG 2.1.1 / 2.4.3: Escape + Tab-trap via gedeelde hook
  useFocusTrap(panelRef, onAnnuleer, { selector: 'button:not([disabled])' })

  async function handleSluiten() {
    setLaden(true)
    try {
      await onBevestig()
    } catch (error) {
      setFout(logFout(error, { component: 'ModalSluiten', actie: 'sluiten' }))
      setLaden(false)
    }
  }

  return (
    // K4: role + aria-modal + aria-labelledby
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-sluiten-titel"
    >
      <div ref={panelRef} className="modal-panel">
        <h2 id="modal-sluiten-titel" className="modal-titel">🔒 Potje sluiten</h2>
        <p className="modal-tekst">
          Weet je zeker dat je <strong>{potjeNaam}</strong> wilt sluiten?
          Dit kan niet ongedaan worden gemaakt. Iedereen ziet direct de eindafrekening.
        </p>

        {fout && <div className="fout-tekst mb-3">{fout}</div>}

        <div className="modal-knoppen">
          <button className="knop knop-secundair flex-1" onClick={onAnnuleer}>
            Annuleren
          </button>
          {/* V4: pijl op primaire actieknop */}
          <button
            className="knop knop-gevaar flex-1"
            onClick={handleSluiten}
            disabled={laden}
          >
            {laden ? 'Bezig...' : 'Ja, sluiten →'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalSluiten
