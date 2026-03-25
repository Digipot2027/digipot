import { useNavigate } from 'react-router-dom'

const PROFIEL_NAAM_KEY = 'digipot_profiel_naam'

function PaginaInstellingen() {
  const navigate = useNavigate()
  const profielNaam = localStorage.getItem(PROFIEL_NAAM_KEY)

  return (
    <div className="pagina">

      {/* Header */}
      <div className="kaart">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--grijs-600)', padding: '4px 0', lineHeight: 1 }}
            aria-label="Terug"
          >
            ←
          </button>
          <h1 className="titel" style={{ marginBottom: 0 }}>⚙️ Instellingen</h1>
        </div>
      </div>

      {/* Navigatie-items */}
      <div className="kaart" style={{ padding: 0, overflow: 'hidden' }}>

        {/* Open potjes */}
        <button
          onClick={() => navigate('/instellingen/open')}
          style={rij()}
        >
          <div style={rijLinks()}>
            <span style={{ fontSize: 20 }}>🟢</span>
            <div>
              <div style={rijTitel()}>Open potjes</div>
              <div style={rijSub()}>Potjes waar je actief aan deelneemt</div>
            </div>
          </div>
          <span style={pijl()}>›</span>
        </button>

        <div style={scheiding()} />

        {/* Gesloten potjes */}
        <button
          onClick={() => navigate('/instellingen/gesloten')}
          style={rij()}
        >
          <div style={rijLinks()}>
            <span style={{ fontSize: 20 }}>🔒</span>
            <div>
              <div style={rijTitel()}>Gesloten potjes</div>
              <div style={rijSub()}>Afgeronde potjes en eindafrekelingen</div>
            </div>
          </div>
          <span style={pijl()}>›</span>
        </button>

        <div style={scheiding()} />

        {/* Profiel */}
        <button
          onClick={() => navigate('/instellingen/profiel')}
          style={rij()}
        >
          <div style={rijLinks()}>
            <span style={{ fontSize: 20 }}>👤</span>
            <div>
              <div style={rijTitel()}>Profiel</div>
              <div style={rijSub()}>
                {profielNaam
                  ? `Ingesteld als "${profielNaam}"`
                  : 'Nog geen naam ingesteld'}
              </div>
            </div>
          </div>
          <span style={pijl()}>›</span>
        </button>

      </div>

    </div>
  )
}

// Stijlhulpfuncties — voorkomen herhaling van inline styles
function rij() {
  return {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    width: '100%',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  }
}
function rijLinks() {
  return { display: 'flex', alignItems: 'center', gap: 14 }
}
function rijTitel() {
  return { fontSize: 15, fontWeight: 600, color: 'var(--grijs-900)', marginBottom: 2 }
}
function rijSub() {
  return { fontSize: 13, color: 'var(--grijs-400)' }
}
function pijl() {
  return { fontSize: 20, color: 'var(--grijs-400)', lineHeight: 1 }
}
function scheiding() {
  return { height: 1, background: 'var(--grijs-100)', margin: '0 20px' }
}

export default PaginaInstellingen
