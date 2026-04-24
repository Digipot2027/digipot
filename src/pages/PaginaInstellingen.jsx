import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, CircleDot, Lock, User } from 'lucide-react'
import { PROFIEL_NAAM_KEY } from '../constants'
import { getItem } from '../utils/storage'

/**
 * Lucide-migratie (2026-04-24): emoji's vervangen door Lucide-icons.
 *   🟢 → CircleDot, 🔒 → Lock, 👤 → User, ← → ChevronLeft.
 */
function PaginaInstellingen() {
  const navigate = useNavigate()
  const profielNaam = getItem(PROFIEL_NAAM_KEY)

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
            <ChevronLeft size={22} aria-hidden="true" strokeWidth={2} />
          </button>
          <h1 className="titel" style={{ marginBottom: 0 }}>Instellingen</h1>
        </div>
      </div>

      {/* Navigatie-items */}
      <div className="kaart p-0 overflow-hidden">

        <button onClick={() => navigate('/instellingen/open')} className="nav-rij">
          <div className="nav-rij__links">
            <CircleDot size={20} aria-hidden="true" strokeWidth={2} style={{ color: 'var(--groen)', flexShrink: 0 }} />
            <div>
              <div className="nav-rij__titel">Open potjes</div>
              <div className="nav-rij__sub">Potjes waar je actief aan deelneemt</div>
            </div>
          </div>
          <span className="nav-rij__pijl">›</span>
        </button>

        <div className="nav-rij__scheiding" />

        <button onClick={() => navigate('/instellingen/gesloten')} className="nav-rij">
          <div className="nav-rij__links">
            <Lock size={20} aria-hidden="true" strokeWidth={2} style={{ color: 'var(--grijs-500)', flexShrink: 0 }} />
            <div>
              <div className="nav-rij__titel">Gesloten potjes</div>
              <div className="nav-rij__sub">Afgeronde potjes en eindafrekelingen</div>
            </div>
          </div>
          <span className="nav-rij__pijl">›</span>
        </button>

        <div className="nav-rij__scheiding" />

        <button onClick={() => navigate('/instellingen/profiel')} className="nav-rij">
          <div className="nav-rij__links">
            <User size={20} aria-hidden="true" strokeWidth={2} style={{ color: 'var(--grijs-500)', flexShrink: 0 }} />
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
