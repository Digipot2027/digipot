import { berekenEindafrekening } from '../utils/berekenSaldi'
import { formatBedrag } from '../utils/formatBedrag'

function PaginaEindafrekening({ potje, deelnemers, transacties }) {
  const saldi = berekenEindafrekening(deelnemers, transacties)
  const gesloten = new Date(potje.gesloten_op)
  const sluitDatum = gesloten.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="pagina">
      <div className="kaart">
        <h1 className="titel">🔒 {potje.naam}</h1>
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
                <span>Gestort: {formatBedrag(d.gestort)}</span>
                <span>Aandeel: {formatBedrag(d.aandeel)}</span>
              </div>
              <div style={{ fontSize: 12, color: d.verrekening >= 0 ? 'var(--groen)' : 'var(--rood)', marginTop: 4 }}>
                {d.verrekening >= 0 ? '✅ Ontvangt geld terug' : '⚠️ Moet bijbetalen'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default PaginaEindafrekening
