import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * PaginaNietGevonden — catch-all voor onbekende routes.
 *
 * WCAG 2.4.2: unieke paginatitel zodat screenreaders de foutstatus melden.
 */
function PaginaNietGevonden() {
  const navigate = useNavigate()

  // WCAG-1 / 2.4.2: paginatitel instellen — ontbrak eerder als enige pagina.
  useEffect(() => { document.title = 'Pagina niet gevonden — Digipot' }, [])

  return (
    <div className="pagina">
      <div className="kaart lege-staat">
        <div className="lege-staat__emoji">🔍</div>
        <h1 className="text-xl font-bold mb-3">
          Pagina niet gevonden
        </h1>
        <p className="text-sm tekst-grijs-6 mb-6">
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
