import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { berekenSaldi, heeftGestort } from '../utils/berekenSaldi'
import { formatBedrag } from '../utils/formatBedrag'
import { STANDAARD_VALUTA } from '../constants'
import DeelnemerRij from '../components/DeelnemerRij.jsx'
import DeelnemerDetailSheet from '../components/DeelnemerDetailSheet.jsx'
import DeelKnop from '../components/DeelKnop.jsx'
import ModalAfmelden from '../components/ModalAfmelden.jsx'

/**
 * TECH-3 fix (2026-04-16): ikBenGestort gebruikt nu heeftGestort() uit
 * berekenSaldi.js i.p.v. een inline check. Eén bron van waarheid voor
 * de afmeld-drempel.
 *
 * UX-1 fix (2026-04-16): helptekst "Iedereen kan het potje afsluiten"
 * toegevoegd onder de Pot afsluiten-knop.
 */
function PaginaOverzicht({ potje, deelnemers, transacties, deelnemer: ikzelf, onStorten, onBetalen, onSluiten, onAfmelden, afmeldenLaden }) {
  const navigate = useNavigate()
  const [gekozenDeelnemer, setGekozenDeelnemer] = useState(null)
  const [afmeldenModaal, setAfmeldenModaal] = useState(false)

  const valuta = potje?.valuta ?? STANDAARD_VALUTA
  const saldi = berekenSaldi(deelnemers, transacties)
  const actieveDeelnemers = deelnemers.filter(d => d.actief !== false)
  const ikBenActief = ikzelf?.actief !== false
  const heeftTransacties = transacties.length > 0
  // TECH-3 fix: heeftGestort() uit berekenSaldi.js i.p.v. inline check
  const ikBenGestort = heeftGestort(saldi.deelnemersSaldi, ikzelf?.id)

  return (
    <>
      <div className="pagina">

        {/* Header */}
        <div className="kaart">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="titel">🍺 {potje?.naam}</h1>
              <p className="subtitel" style={{ marginBottom: 0 }}>Welkom, {ikzelf?.naam}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: saldi.potSaldo > 0 ? 'var(--groen)' : 'var(--grijs-600)' }}>
                  {formatBedrag(saldi.potSaldo, valuta)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--grijs-500)' }}>nog te besteden</div>
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

          {!ikBenActief && (
            <div style={{ marginTop: 12 }}>
              <span className="badge badge-afgemeld">Afgemeld</span>
            </div>
          )}

          <DeelKnop
            potjeNaam={potje?.naam}
            variant="secundair"
            className="deelknop-in-kaart"
          />
        </div>

        {/* Deelnemers */}
        <div className="kaart">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
            Deelnemers ({actieveDeelnemers.length}/{deelnemers.length})
          </h2>
          <p style={{ fontSize: 12, color: 'var(--grijs-500)', marginBottom: 12 }}>
            Tik op een naam voor details
          </p>

          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table
              style={{ width: '100%', minWidth: 260, borderCollapse: 'collapse', tableLayout: 'fixed' }}
              aria-label="Deelnemersoverzicht"
            >
              <colgroup>
                <col style={{ width: 'auto' }} />
                <col style={{ width: 72 }} />
                <col style={{ width: 72 }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--grijs-200)' }}>
                  <th scope="col" style={{ fontSize: 11, color: 'var(--grijs-600)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', padding: '4px 6px 8px' }}>Naam</th>
                  <th scope="col" style={{ fontSize: 11, color: 'var(--grijs-600)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', padding: '4px 6px 8px' }}>In de pot</th>
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
        </div>

        {/* Actieknoppen */}
        <div className="kaart" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button className="knop knop-primair" style={{ minWidth: 0 }} onClick={onStorten} disabled={!ikBenActief}>
              💰 In pot storten
            </button>
            <button className="knop knop-secundair" style={{ minWidth: 0 }} onClick={onBetalen} disabled={!ikBenActief || saldi.potSaldo === 0}>
              🍺 Betaling registreren
            </button>
          </div>

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

          <div style={{ borderTop: '1px solid var(--grijs-200)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--grijs-400)', marginBottom: 0 }}>
              Beheer
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                className={`knop ${ikBenActief ? 'knop-afmelden' : 'knop-aanmelden'}`}
                style={{ minWidth: 0, fontSize: '0.85rem' }}
                onClick={() => ikBenActief && setAfmeldenModaal(true)}
                disabled={afmeldenLaden || (ikBenActief && !ikBenGestort)}
              >
                {afmeldenLaden ? 'Bezig...' : ikBenActief ? '👋 Jezelf afmelden' : '✅ Afgemeld'}
              </button>
              <button
                className="knop knop-gevaar"
                style={{ opacity: heeftTransacties ? 0.7 : 0.35, minWidth: 0, fontSize: '0.85rem' }}
                onClick={onSluiten}
                disabled={!heeftTransacties}
              >
                🔒 Pot afsluiten
              </button>
            </div>

            {ikBenActief && !ikBenGestort && (
              <p style={{ fontSize: '0.75rem', color: 'var(--grijs-500)', textAlign: 'left', marginTop: -4 }}>
                Eerst storten om je te kunnen afmelden.
              </p>
            )}
            {/* UX-1 fix (2026-04-16): uitleg dat iedereen het potje kan afsluiten */}
            {heeftTransacties && (
              <p style={{ fontSize: '0.75rem', color: 'var(--grijs-500)', textAlign: 'right', marginTop: -4 }}>
                Iedereen kan het potje afsluiten.
              </p>
            )}
            {!heeftTransacties && (
              <p style={{ fontSize: '0.75rem', color: 'var(--grijs-500)', textAlign: 'right', marginTop: -4 }}>
                Afsluiten kan pas als er transacties zijn.
              </p>
            )}
          </div>

        </div>

      </div>

      {/* Deelnemer detail sheet */}
      {gekozenDeelnemer && (
        <DeelnemerDetailSheet
          deelnemer={gekozenDeelnemer}
          transacties={transacties}
          onSluiten={() => setGekozenDeelnemer(null)}
          valuta={valuta}
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
