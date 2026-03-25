import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { berekenSaldi } from '../utils/berekenSaldi'
import { formatBedrag } from '../utils/formatBedrag'
import DeelnemerDetailSheet from '../components/DeelnemerDetailSheet.jsx'
import DeelKnop from '../components/DeelKnop.jsx'

function PaginaOverzicht({ potje, deelnemers, transacties, deelnemer: ikzelf, onStorten, onBetalen, onSluiten, onAfmelden, afmeldenLaden }) {
  const navigate = useNavigate()
  const [gekozenDeelnemer, setGekozenDeelnemer] = useState(null)

  const saldi = berekenSaldi(deelnemers, transacties)
  const actieveDeelnemers = deelnemers.filter(d => d.actief !== false)
  const ikBenActief = ikzelf?.actief !== false
  const heeftTransacties = transacties.length > 0
  const mijnSaldi = saldi.deelnemersSaldi.find(s => s.id === ikzelf?.id)
  const ikBenGestort = (mijnSaldi?.gestort ?? 0) > 0

  return (
    <>
      <div className="pagina">

        {/* Header */}
        <div className="kaart">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <h1 className="titel">🍺 {potje?.naam}</h1>
              <p className="subtitel" style={{ marginBottom: 0 }}>Welkom, {ikzelf?.naam}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: saldi.potSaldo > 0 ? 'var(--groen)' : 'var(--grijs-600)' }}>
                  {formatBedrag(saldi.potSaldo)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--grijs-400)' }}>saldo</div>
              </div>
              <button
                onClick={() => navigate('/instellingen')}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--grijs-500)', padding: '2px 0 0 0', lineHeight: 1 }}
                aria-label="Instellingen openen"
              >
                ⚙️
              </button>
            </div>
          </div>

          {/* Afgemeld badge */}
          {!ikBenActief && (
            <div style={{ marginTop: 12 }}>
              <span className="badge badge-afgemeld">Afgemeld</span>
            </div>
          )}

          {/* Deel potje */}
          <DeelKnop
            potjeNaam={potje?.naam}
            variant="secundair"
            style={{ marginTop: 10, fontSize: 14, padding: '8px 14px', width: 'auto' }}
          />
        </div>

        {/* Deelnemers — klikbaar */}
        <div className="kaart">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
            Deelnemers ({actieveDeelnemers.length}/{deelnemers.length})
          </h2>
          <p style={{ fontSize: 12, color: 'var(--grijs-400)', marginBottom: 12 }}>
            Tik op een naam voor details
          </p>

          {/* Kolomhoofden */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, padding: '4px 0 8px', borderBottom: '1px solid var(--grijs-200)', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--grijs-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Naam</span>
            <span style={{ fontSize: 11, color: 'var(--grijs-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Ingelegd</span>
            <span style={{ fontSize: 11, color: 'var(--grijs-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Betaald</span>
          </div>

          {deelnemers.map(d => {
            const s = saldi.deelnemersSaldi.find(x => x.id === d.id)
            const isAfgemeld = d.actief === false
            return (
              <button
                key={d.id}
                onClick={() => setGekozenDeelnemer(d)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 8,
                  padding: '10px 6px',
                  width: '100%',
                  background: isAfgemeld ? 'var(--grijs-50)' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--grijs-100)',
                  borderRadius: isAfgemeld ? 6 : 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  opacity: isAfgemeld ? 0.6 : 1,
                }}
              >
                <span style={{ fontWeight: d.id === ikzelf?.id ? 600 : 400, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, textDecoration: isAfgemeld ? 'line-through' : 'none', color: 'var(--grijs-900)' }}>
                  {d.naam}{d.id === ikzelf?.id ? ' (jij)' : ''}
                  {isAfgemeld && <span className="badge badge-afgemeld" style={{ fontSize: 10 }}>Afgemeld</span>}
                  <span style={{ fontSize: 12, color: 'var(--grijs-400)', fontWeight: 400, textDecoration: 'none' }}>›</span>
                </span>
                <span style={{ fontSize: 14, color: 'var(--grijs-600)', textAlign: 'right' }}>
                  {formatBedrag(s?.gestort || 0)}
                </span>
                <span style={{ fontSize: 14, color: (s?.betaald || 0) > 0 ? 'var(--rood)' : 'var(--grijs-400)', textAlign: 'right' }}>
                  {formatBedrag(s?.betaald || 0)}
                </span>
              </button>
            )
          })}
        </div>

        {/* Actieknoppen — 2×2 grid */}
        <div className="kaart" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Rij 1: Storten + Betalen */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              className="knop knop-primair"
              onClick={onStorten}
              disabled={!ikBenActief}
            >
              💰 Storten
            </button>
            <button
              className="knop knop-secundair"
              onClick={onBetalen}
              disabled={!ikBenActief || saldi.potSaldo === 0}
            >
              🍺 Betaald
            </button>
          </div>

          {/* Saldo hint */}
          {ikBenActief && saldi.potSaldo === 0 && (
            <p style={{ fontSize: '0.75rem', color: 'var(--grijs-400)', textAlign: 'center', marginTop: -4 }}>
              Geen saldo beschikbaar. Voeg eerst een storting toe.
            </p>
          )}

          {!ikBenActief && (
            <p style={{ fontSize: '0.875rem', color: 'var(--grijs-400)', textAlign: 'center', padding: '4px 0' }}>
              Je hebt je afgemeld en kunt geen transacties meer invoeren.
            </p>
          )}

          {/* Rij 2: Afmelden + Potje sluiten */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, borderTop: '1px solid var(--grijs-200)', paddingTop: 10 }}>
            <button
              className={`knop ${ikBenActief ? 'knop-afmelden' : 'knop-aanmelden'}`}
              onClick={onAfmelden}
              disabled={afmeldenLaden || (ikBenActief && !ikBenGestort)}
              title={ikBenActief && !ikBenGestort ? 'Je kunt je pas afmelden als je hebt gestort' : undefined}
            >
              {afmeldenLaden ? 'Bezig...' : ikBenActief ? '👋 Afmelden' : '✅ Aangemeld'}
            </button>
            <button
              className="knop knop-gevaar"
              style={{ opacity: heeftTransacties ? 0.7 : 0.35 }}
              onClick={onSluiten}
              disabled={!heeftTransacties}
              title={!heeftTransacties ? 'Er zijn nog geen transacties' : undefined}
            >
              🔒 Pot sluiten
            </button>
          </div>

        </div>

      </div>

      {/* Deelnemer detail sheet */}
      {gekozenDeelnemer && (
        <DeelnemerDetailSheet
          deelnemer={gekozenDeelnemer}
          transacties={transacties}
          onSluiten={() => setGekozenDeelnemer(null)}
        />
      )}
    </>
  )
}

export default PaginaOverzicht
