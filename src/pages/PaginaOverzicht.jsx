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
  const gemiddeldePerPersoon = actieveDeelnemers.length > 0
    ? saldi.potSaldo / actieveDeelnemers.length
    : 0
  const ikBenActief = ikzelf?.actief !== false
  const heeftTransacties = transacties.length > 0
  // TECH-3 fix: heeftGestort() uit berekenSaldi.js i.p.v. inline check
  const ikBenGestort = heeftGestort(saldi.deelnemersSaldi, ikzelf?.id)

  return (
    <>
      <div className="pagina">

        {/* Header */}
        <div className="kaart">
          <div className="overzicht-header">
            <div className="overzicht-header__links">
              <h1 className="titel">🍺 {potje?.naam}</h1>
              <p className="subtitel mb-0">Welkom, {ikzelf?.naam}</p>
            </div>
            <div className="overzicht-header__rechts">
              <div style={{ textAlign: 'right' }}>
                <div className={`saldo-display${saldi.potSaldo > 0 ? ' saldo-display--positief' : ' saldo-display--nul'}`}>
                  {formatBedrag(saldi.potSaldo, valuta)}
                </div>
                <div className="sectie-label">nog te besteden</div>
                {actieveDeelnemers.length > 1 && (
                  <div className="saldo-display__gem">
                    {formatBedrag(gemiddeldePerPersoon, valuta)} gem. p.p.
                  </div>
                )}
              </div>
              <button
                onClick={() => navigate('/instellingen')}
                className="knop-icoon"
                style={{ fontSize: 22, padding: '2px 0 0 0' }}
                aria-label="Instellingen openen"
              >
                ⚙️
              </button>
            </div>
          </div>

          {!ikBenActief && (
            <div className="mt-3">
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
          <h2 className="text-base font-semibold mb-1">
            Deelnemers ({actieveDeelnemers.length}/{deelnemers.length})
          </h2>
          <p className="text-xs tekst-grijs-5 mb-3">
            Tik op een naam voor details
          </p>

          <div className="deelnemers-tabel-wrapper">
            <table
              className="deelnemers-tabel"
              aria-label="Deelnemersoverzicht"
            >
              <colgroup>
                <col style={{ width: 'auto' }} />
                <col style={{ width: 72 }} />
                <col style={{ width: 72 }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Naam</th>
                  <th scope="col">In de pot</th>
                  <th scope="col">Betaald</th>
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
        <div className="kaart actie-kaart">

          <div className="grid-2">
            <button className="knop knop-primair" style={{ minWidth: 0 }} onClick={onStorten} disabled={!ikBenActief}>
              💰 In pot storten
            </button>
            <button className="knop knop-secundair" style={{ minWidth: 0 }} onClick={onBetalen} disabled={!ikBenActief || saldi.potSaldo === 0}>
              🍺 Betaling registreren
            </button>
          </div>

          {ikBenActief && saldi.potSaldo === 0 && (
            <p className="text-xs tekst-grijs-5 text-center" style={{ marginTop: -4 }}>
              Geen saldo beschikbaar. Voeg eerst een storting toe.
            </p>
          )}

          {!ikBenActief && (
            <p className="text-sm tekst-grijs-6 text-center" style={{ padding: '4px 0' }}>
              Je hebt je afgemeld en kunt geen transacties meer invoeren.
            </p>
          )}

          <div className="actie-sectie">
            <h2 className="sectie-label mb-0">Beheer</h2>

            <div className="grid-2">
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
              <p className="text-xs tekst-grijs-5 text-left" style={{ marginTop: -4 }}>
                Eerst storten om je te kunnen afmelden.
              </p>
            )}
            {/* UX-1 fix (2026-04-16): uitleg dat iedereen het potje kan afsluiten */}
            {heeftTransacties && (
              <p className="text-xs tekst-grijs-5 text-right" style={{ marginTop: -4 }}>
                Iedereen kan het potje afsluiten.
              </p>
            )}
            {!heeftTransacties && (
              <p className="text-xs tekst-grijs-5 text-right" style={{ marginTop: -4 }}>
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
          isLaatsteActieve={ikBenActief && actieveDeelnemers.length === 1 && actieveDeelnemers[0]?.id === ikzelf?.id}
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
