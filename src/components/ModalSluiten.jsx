import { useState } from 'react'
import { vertaalFout } from '../utils/vertaalFout'

function ModalSluiten({ potjeNaam, onBevestig, onAnnuleer }) {
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')

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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 500 }}>
      <div style={{ background: 'var(--wit)', width: '100%', borderRadius: '16px 16px 0 0', padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>🔒 Potje sluiten</h2>
        <p style={{ fontSize: 14, color: 'var(--grijs-600)', marginBottom: 20 }}>
          Weet je zeker dat je <strong>{potjeNaam}</strong> wilt sluiten?
          Dit kan niet ongedaan worden gemaakt. Iedereen ziet direct de eindafrekening.
        </p>

        {fout && <div className="fout-tekst" style={{ marginBottom: 12 }}>{fout}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="knop knop-secundair" onClick={onAnnuleer} style={{ flex: 1 }}>
            Annuleren
          </button>
          <button
            className="knop knop-gevaar"
            style={{ flex: 1 }}
            onClick={handleSluiten}
            disabled={laden}
          >
            {laden ? 'Bezig...' : 'Ja, sluiten'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalSluiten
