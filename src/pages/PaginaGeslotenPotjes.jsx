import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMijnPotjes } from '../hooks/useMijnPotjes'
import { formatBedrag } from '../utils/formatBedrag'

function PaginaGeslotenPotjes() {
  const navigate = useNavigate()
  const { potjes, laden, fout } = useMijnPotjes('gesloten')

  // WCAG 2.4.2: unieke paginatitel
  useEffect(() => { document.title = 'Gesloten potjes — Digipot' }, [])

  function datumLabel(iso) {
    return new Date(iso).toLocaleDateString('nl-NL', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }

  if (laden) return (
    <div className="pagina">
      <div className="kaart">
        <div className="skeleton" style={{ height: 28, width: '50%', marginBottom: 12 }} />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="kaart">
          <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 14, width: '40%' }} />
        </div>
      ))}
    </div>
  )

  return (
    <div className="pagina">

      {/* Header */}
      <div className="kaart">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--grijs-600)', padding: '4px 0', lineHeight: 1 }}
            aria-label="Terug"
          >
            ←
          </button>
          <h1 className="titel" style={{ marginBottom: 0 }}>🔒 Gesloten potjes</h1>
        </div>
      </div>

      {fout && (
        <div className="kaart">
          <p style={{ color: 'var(--rood)', fontSize: '0.875rem' }}>{fout}</p>
        </div>
      )}

      {/* Lege staat */}
      {!fout && potjes.length === 0 && (
        <div className="kaart" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>
            Geen gesloten potjes
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--grijs-600)', marginBottom: 20 }}>
            Je hebt nog geen afgeronde potjes op dit apparaat.
          </p>
          <button className="knop knop-primair" onClick={() => navigate('/')}>
            Nieuw potje starten
          </button>
        </div>
      )}

      {/* Lijst */}
      {potjes.length > 0 && (
        <div className="kaart" style={{ padding: 0, overflow: 'hidden' }}>
          {potjes.map((potje, index) => (
            <button
              key={potje.id}
              onClick={() => navigate(`/potje/${potje.id}`)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                width: '100%',
                background: 'transparent',
                border: 'none',
                borderBottom: index < potjes.length - 1 ? '1px solid var(--grijs-100)' : 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--grijs-900)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {potje.naam}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--grijs-600)' }}>
                  Gesloten op {datumLabel(potje.gesloten_op)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 12 }}>
                {potje.mijnVerrekening !== null && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: potje.mijnVerrekening >= 0 ? 'var(--groen)' : 'var(--rood)',
                    }}>
                      {potje.mijnVerrekening >= 0
                        ? `+${formatBedrag(potje.mijnVerrekening)}`
                        : `-${formatBedrag(Math.abs(potje.mijnVerrekening))}`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--grijs-500)' }}>
                      {potje.mijnVerrekening >= 0 ? 'ontvangen' : 'bijbetaald'}
                    </div>
                  </div>
                )}
                <span style={{ fontSize: '1.25rem', color: 'var(--grijs-400)', lineHeight: 1 }}>›</span>
              </div>
            </button>
          ))}
        </div>
      )}

    </div>
  )
}

export default PaginaGeslotenPotjes
