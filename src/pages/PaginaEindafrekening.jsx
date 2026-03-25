import { useNavigate } from 'react-router-dom'
import { berekenEindafrekening } from '../utils/berekenSaldi'
import { formatBedrag } from '../utils/formatBedrag'

function PaginaEindafrekening({ potje, deelnemers, transacties }) {
  const navigate = useNavigate()
  const saldi = berekenEindafrekening(deelnemers, transacties)
  const gesloten = new Date(potje.gesloten_op)
  const sluitDatum = gesloten.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="pagina">
      <div className="kaart">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <h1 className="titel" style={{ marginBottom: 0 }}>🔒 {potje.naam}</h1>
          <button
            onClick={() => navigate('/instellingen')}
            style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--grijs-500)', padding: '2px 0 0 0', lineHeight: 1 }}
            aria-label="Instellingen openen"
          >
            ⚙️
          </button>
        </div>
        <p className="subtitel">Gesloten op {sluitDatum}</p>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--grijs-200)' }}>
          <span style={{ color: 'var(--grijs-600)' }}>Totaal gestort</span>
          <strong>{formatBedrag(saldi.potTotaal)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
          <span style={{ color: 'var(--grijs-600)' }}>Totaal uitgegeven</span>
          <strong>{formatBedrag(saldi.potUitgaven)}</strong>
        </div>
      </div>

      <div className="kaart">
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Eindafrekening per deelnemer</h2>
        {saldi.deelnemersSaldi.map(d => {
          const isAfgemeld = d.actief === false
          return (
            <div key={d.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--grijs-100)', opacity: isAfgemeld ? 0.75 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <strong style={{ textDecoration: isAfgemeld ? 'line-through' : 'none' }}>{d.naam}</strong>
                  {isAfgemeld && <span className="badge badge-afgemeld" style={{ fontSize: 10 }}>Afgemeld</span>}
                </span>
                <span style={{
                  fontWeight: 700,
                  color: d.verrekening >= 0 ? 'var(--groen)' : 'var(--rood)'
                }}>
                  {d.verrekening >= 0 ? `+${formatBedrag(d.verrekening)}` : `-${formatBedrag(Math.abs(d.verrekening))}`}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--grijs-600)' }}>
                <span>Betaald: {formatBedrag(d.betaald)}</span>
                <span>Aandeel: {formatBedrag(d.aandeel)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--grijs-500)', marginTop: 2 }}>
                Ingelegd: {formatBedrag(d.gestort)}
              </div>
              <div style={{ fontSize: 12, color: d.verrekening >= 0 ? 'var(--groen)' : 'var(--rood)', marginTop: 4 }}>
                {d.verrekening >= 0 ? '✅ Ontvangt geld terug' : '⚠️ Moet bijbetalen'}
              </div>
            </div>
          )
        })}
      </div>
      <div className="kaart" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          className="knop knop-primair"
          onClick={() => navigate('/')}
        >
          🍺 Nieuw potje starten
        </button>
        <button
          className="knop knop-secundair"
          onClick={() => navigate('/instellingen')}
        >
          ⚙️ Naar instellingen
        </button>
      </div>

    </div>
  )
}

export default PaginaEindafrekening
