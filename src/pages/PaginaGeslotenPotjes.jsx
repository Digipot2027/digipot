import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useMijnPotjes } from '../hooks/useMijnPotjes'
import { formatBedrag } from '../utils/formatBedrag'

/**
 * Lucide-migratie (2026-04-24): ← vervangen door ChevronLeft.
 */
function PaginaGeslotenPotjes() {
  const navigate = useNavigate()
  const { potjes, laden, fout, herlaad } = useMijnPotjes('gesloten')

  useEffect(() => { document.title = 'Gesloten potjes — Digipot' }, [])

  const foutRef = useCallback(node => {
    if (node && fout) node.focus()
  }, [fout])

  function datumLabel(iso) {
    return new Date(iso).toLocaleDateString('nl-NL', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }

  if (laden) return (
    <div className="pagina">
      <div className="kaart">
        <div className="skeleton skeleton-titel" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="kaart">
          <div className="skeleton skeleton-kaart" />
          <div className="skeleton skeleton-kaart-sub" />
        </div>
      ))}
    </div>
  )

  return (
    <div className="pagina">

      {/* Header */}
      <div className="kaart">
        <div className="kaart-header" style={{ marginBottom: 0 }}>
          <button
            onClick={() => navigate(-1)}
            className="knop-icoon"
            style={{ fontSize: '1.25rem', padding: '4px 0' }}
            aria-label="Terug"
          >
            <ChevronLeft size={22} aria-hidden="true" strokeWidth={2} />
          </button>
          <h1 className="titel" style={{ marginBottom: 0 }}>Gesloten potjes</h1>
        </div>
      </div>

      {fout && (
        <div ref={foutRef} role="alert" tabIndex={-1} className="kaart fout-kaart">
          <p className="text-sm tekst-rood mb-3">{fout}</p>
          <button className="knop knop-secundair mt-2" onClick={herlaad}>
            Opnieuw proberen
          </button>
        </div>
      )}

      {!fout && potjes.length === 0 && (
        <div className="kaart lege-staat">
          <div className="lege-staat__emoji">🔒</div>
          <p className="text-base font-semibold mb-2">Geen gesloten potjes</p>
          <p className="text-sm tekst-grijs-6 mb-5">
            Je hebt nog geen afgeronde potjes op dit apparaat.
          </p>
          <button className="knop knop-primair" onClick={() => navigate('/')}>
            Nieuw potje starten
          </button>
        </div>
      )}

      {potjes.length > 0 && (
        <ul
          role="list"
          className="kaart p-0 overflow-hidden"
          style={{ listStyle: 'none' }}
          aria-label="Gesloten potjes"
        >
          {potjes.map((potje, index) => (
            <li
              key={potje.id}
              className={index < potjes.length - 1 ? 'potje-rij__scheiding' : ''}
            >
              <button
                onClick={() => navigate(`/potje/${potje.id}`)}
                className="potje-rij"
              >
                <div className="potje-rij__info">
                  <div className="potje-rij__naam">{potje.naam}</div>
                  <div className="potje-rij__sub">
                    Gesloten op {datumLabel(potje.gesloten_op)}
                  </div>
                </div>
                <div className="potje-rij__rechts">
                  {potje.mijnVerrekening !== null && (
                    <div className="potje-rij__saldo">
                      <div className={`potje-rij__saldo-bedrag ${potje.mijnVerrekening >= 0 ? 'potje-rij__saldo-bedrag--positief' : 'potje-rij__saldo-bedrag--rood'}`}>
                        {potje.mijnVerrekening >= 0
                          ? `+${formatBedrag(potje.mijnVerrekening, potje.valuta)}`
                          : `-${formatBedrag(Math.abs(potje.mijnVerrekening), potje.valuta)}`}
                      </div>
                      <div className="potje-rij__saldo-label">
                        {potje.mijnVerrekening >= 0 ? 'te ontvangen' : 'bij te betalen'}
                      </div>
                    </div>
                  )}
                  <span className="nav-rij__pijl">›</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

    </div>
  )
}

export default PaginaGeslotenPotjes
