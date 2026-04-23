import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PROFIEL_NAAM_KEY } from '../constants'
import { getItem } from '../utils/storage'

function PaginaInstellingen() {
  const navigate = useNavigate()
  const profielNaam = getItem(PROFIEL_NAAM_KEY)

  // WCAG 2.4.2: unieke paginatitel
  useEffect(() => { document.title = 'Instellingen — Digipot' }, [])

  return (
    <div className="pagina">

      {/* Header */}
      <div className="kaart">
        <div className="kaart-header">
          <button
            onClick={() => navigate(-1)}
            className="knop-icoon"
            style={{ fontSize: 20, padding: '4px 0' }}
            aria-label="Terug"
          >
            ←
          </button>
          <h1 className="titel" style={{ marginBottom: 0 }}>Instellingen</h1>
        </div>
      </div>

      {/* Navigatie-items */}
      <div className="kaart p-0 overflow-hidden">

        {/* Open potjes */}
        <button onClick={() => navigate('/instellingen/open')} className="nav-rij">
          <div className="nav-rij__links">
            <span style={{ fontSize: 20 }}>🟢</span>
            <div>
              <div className="nav-rij__titel">Open potjes</div>
              <div className="nav-rij__sub">Potjes waar je actief aan deelneemt</div>
            </div>
          </div>
          <span className="nav-rij__pijl">›</span>
        </button>

        <div className="nav-rij__scheiding" />

        {/* Gesloten potjes */}
        <button onClick={() => navigate('/instellingen/gesloten')} className="nav-rij">
          <div className="nav-rij__links">
            <span style={{ fontSize: 20 }}>🔒</span>
            <div>
              <div className="nav-rij__titel">Gesloten potjes</div>
              <div className="nav-rij__sub">Afgeronde potjes en eindafrekelingen</div>
            </div>
          </div>
          <span className="nav-rij__pijl">›</span>
        </button>

        <div className="nav-rij__scheiding" />

        {/* Profiel */}
        <button onClick={() => navigate('/instellingen/profiel')} className="nav-rij">
          <div className="nav-rij__links">
            <span style={{ fontSize: 20 }}>👤</span>
            <div>
              <div className="nav-rij__titel">Profiel</div>
              <div className="nav-rij__sub">
                {profielNaam
                  ? `Ingesteld als "${profielNaam}"`
                  : 'Nog geen naam ingesteld'}
              </div>
            </div>
          </div>
          <span className="nav-rij__pijl">›</span>
        </button>

      </div>

    </div>
  )
}

export default PaginaInstellingen
