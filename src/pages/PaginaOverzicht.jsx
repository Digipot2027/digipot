import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { berekenSaldi } from '../utils/berekenSaldi'
import { formatBedrag } from '../utils/formatBedrag'
import DeelnemerRij from '../components/DeelnemerRij.jsx'
import DeelnemerDetailSheet from '../components/DeelnemerDetailSheet.jsx'
import DeelKnop from '../components/DeelKnop.jsx'
import ModalAfmelden from '../components/ModalAfmelden.jsx'

function PaginaOverzicht({ potje, deelnemers, transacties, deelnemer: ikzelf, onStorten, onBetalen, onSluiten, onAfmelden, afmeldenLaden }) {
  const navigate = useNavigate()
  const [gekozenDeelnemer, setGekozenDeelnemer] = useState(null)
  const [afmeldenModaal, setAfmeldenModaal] = useState(false)

  const valuta = potje?.valuta ?? 'EUR'
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
                  {formatBedrag(saldi.potSaldo, valuta)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--grijs-500)' }}>saldo</div>
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

        {/* Deelnemers — klikbaar
             WCAG 1.3.1: echte <table> met <th scope="col"> zodat screenreaders
             kolomhoofden koppelen aan celwaarden.
             WCAG 1.4.3: kolomhoofden gebruiken grijs-600 (#4b5563, contrast 7.4:1 op wit). */}
        <div className="kaart">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
            Deelnemers ({actieveDeelnemers.length}/{deelnemers.length})
          </h2>
          <p style={{ fontSize: 12, color: 'var(--grijs-500)', marginBottom: 12 }}>
            Tik op een naam voor details
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-label="Deelnemersoverzicht">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--grijs-200)' }}>
                <th scope="col" style={{ fontSize: 11, color: 'var(--grijs-600)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', padding: '4px 6px 8px' }}>Naam</th>
                <th scope="col" style={{ fontSize: 11, color: 'var(--grijs-600)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', padding: '4px 6px 8px' }}>Ingelegd</th>
                <th scope="col" style={{ fontSize: 11, color: 'var(--grijs-600)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', padding: '4px 6px 8px' }}>Betaald</th>
              </tr>
            </thead>
            <tbody>
              {deelnemers.map(d => (
                <DeelnemerRij
                  key={d.id}
                  deelnemer={d}
                  saldi={saldi.deelnemersSaldi.find(x => x.id === d.id)}
                  isIkzelf={d.id === ikzelf?.id}
                  onClick={() => setGekozenDeelnemer(d)}
                  valuta={valuta}
                />
              ))}
            </tbody>
          </table>
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
            <p style={{ fontSize: '0.75rem', color: 'var(--grijs-500)', textAlign: 'center', marginTop: -4 }}>
              Geen saldo beschikbaar. Voeg eerst een storting toe.
            </p>
          )}

          {!ikBenActief && (
            <p style={{ fontSize: '0.875rem', color: 'var(--grijs-600)', textAlign: 'center', padding: '4px 0' }}>
              Je hebt je afgemeld en kunt geen transacties meer invoeren.
            </p>
          )}

          {/* Rij 2: Afmelden + Potje sluiten */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, borderTop: '1px solid var(--grijs-200)', paddingTop: 10 }}>
            <button
              className={`knop ${ikBenActief ? 'knop-afmelden' : 'knop-aanmelden'}`}
              onClick={() => ikBenActief && setAfmeldenModaal(true)}
              disabled={afmeldenLaden || (ikBenActief && !ikBenGestort)}
            >
              {afmeldenLaden ? 'Bezig...' : ikBenActief ? '👋 Afmelden' : '✅ Aangemeld'}
            </button>
            <button
              className="knop knop-gevaar"
              style={{ opacity: heeftTransacties ? 0.7 : 0.35 }}
              onClick={onSluiten}
              disabled={!heeftTransacties}
            >
              🔒 Pot sluiten
            </button>
          </div>

          {/* Helpteksten onder rij 2 — zichtbaar op mobiel */}
          {ikBenActief && !ikBenGestort && (
            <p style={{ fontSize: '0.75rem', color: 'var(--grijs-500)', textAlign: 'left', marginTop: -4 }}>
              Eerst storten om je te kunnen afmelden.
            </p>
          )}
          {!heeftTransacties && (
            <p style={{ fontSize: '0.75rem', color: 'var(--grijs-500)', textAlign: 'right', marginTop: -4 }}>
              Pot sluiten kan pas als er transacties zijn.
            </p>
          )}

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

      {/* Afmeld-bevestigingsmodal */}
      {afmeldenModaal && (
        <ModalAfmelden
          deelnemerNaam={ikzelf?.naam}
          onBevestig={async () => {
            await onAfmelden()
            setAfmeldenModaal(false)
          }}
          onAnnuleer={() => setAfmeldenModaal(false)}
        />
      )}
    </>
  )
}

export default PaginaOverzicht
