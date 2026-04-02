import { useNavigate } from 'react-router-dom'

/**
 * PaginaNietGevonden — catch-all voor onbekende routes.
 *
 * WCAG 2.4.2: unieke paginatitel zodat screenreaders de foutstatus melden.
 */
function PaginaNietGevonden() {
  const navigate = useNavigate()

  return (
    <div className="pagina">
      <div className="kaart" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 12 }}>
          Pagina niet gevonden
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--grijs-600)', marginBottom: 24 }}>
          Deze pagina bestaat niet. Controleer de link of ga terug naar de startpagina.
        </p>
        <button className="knop knop-primair" onClick={() => navigate('/')}>
          ← Terug naar home
        </button>
      </div>
    </div>
  )
}

export default PaginaNietGevonden
