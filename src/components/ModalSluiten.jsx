import { useState, useEffect, useRef } from 'react'
import { vertaalFout } from '../utils/vertaalFout'

function ModalSluiten({ potjeNaam, onBevestig, onAnnuleer }) {
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')
  const panelRef = useRef(null)

  // K4: focus eerste knop bij openen
  useEffect(() => {
    panelRef.current?.querySelector('button:not([disabled])')?.focus()
  }, [])

  // K4: Escape sluit modal, Tab-trap binnen panel
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { onAnnuleer(); return }
      if (e.key !== 'Tab') return
      const els = [...(panelRef.current?.querySelectorAll(
        'button:not([disabled])'
      ) ?? [])]
      if (els.length < 2) return
      const first = els[0], last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onAnnuleer])

  async function handleSluiten() {
    setLaden(true)
    try {
      await onBevestig()
    } catch (error) {
      setFout(vertaalFout(error))
      setLaden(false)
    }
  }

  return (
    // K4: role + aria-modal + aria-labelledby
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 500 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-sluiten-titel"
    >
      <div
        ref={panelRef}
        style={{ background: 'var(--wit)', width: '100%', borderRadius: '16px 16px 0 0', padding: 24, paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}
      >
        <h2 id="modal-sluiten-titel" style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>🔒 Potje sluiten</h2>
        <p style={{ fontSize: 14, color: 'var(--grijs-600)', marginBottom: 20 }}>
          Weet je zeker dat je <strong>{potjeNaam}</strong> wilt sluiten?
          Dit kan niet ongedaan worden gemaakt. Iedereen ziet direct de eindafrekening.
        </p>

        {fout && <div className="fout-tekst" style={{ marginBottom: 12 }}>{fout}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="knop knop-secundair" onClick={onAnnuleer} style={{ flex: 1 }}>
            Annuleren
          </button>
          {/* V4: pijl op primaire actieknop */}
          <button
            className="knop knop-gevaar"
            style={{ flex: 1 }}
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
