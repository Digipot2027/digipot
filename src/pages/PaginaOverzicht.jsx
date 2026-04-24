import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SlidersHorizontal, ArrowUp, CreditCard, LogOut, Lock } from 'lucide-react'
import { berekenSaldi, heeftGestort, berekenAchtergelatenBedrag } from '../utils/berekenSaldi'
import { formatBedrag } from '../utils/formatBedrag'
import { STANDAARD_VALUTA } from '../constants'
import DeelnemerRij from '../components/DeelnemerRij.jsx'
import DeelnemerDetailSheet from '../components/DeelnemerDetailSheet.jsx'
import DeelKnop from '../components/DeelKnop.jsx'
import ModalAfmelden from '../components/ModalAfmelden.jsx'

/**
 * TECH-3 fix (2026-04-16): ikBenGestort gebruikt nu heeftGestort() uit
 * berekenSaldi.js i.p.v. een inline check.
 *
 * UX-1 fix (2026-04-16): helptekst "Iedereen kan het potje afsluiten"
 * toegevoegd onder de Pot afsluiten-knop.
 *
 * Lucide-migratie (2026-04-24): alle emoji's vervangen door Lucide-icons.
 * Instellingen-SVG vervangen door SlidersHorizontal. Actieknoppen gebruiken
 * ArrowUp (storten), CreditCard (betaling), LogOut (afmelden), Lock (sluiten).
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
  const ikBenGestort = heeftGestort(saldi.deelnemersSaldi, ikzelf?.id)
  const achtergelatenBedrag = ikBenActief
    ? berekenAchtergelatenBedrag(saldi.deelnemersSaldi, ikzelf?.id, saldi.potSaldo, saldi.potTotaal)
    : null

  return (
    <>
      <div className="pagina">

        {/* Header */}
        <div className="kaart">
          <div className="overzicht-header">
            <div className="overzicht-header__links">
              <h1 className="titel">🍺 {potje?.naam}</h1>
              <p className="subtitel mb-0">{formatBedrag(saldi.potSaldo, valuta)} in de pot</p>
            </div>
            <div className="overzicht-header__rechts">
              <div className="saldo-rechts">
                {actieveDeelnemers.length > 1 && (
                  <div className="saldo-display__gem">
                    {formatBedrag(gemiddeldePerPersoon, valuta)} gem. p.p.
                  </div>
                )}
              </div>
              <button
                onClick={() => navigate('/instellingen')}
                className="knop-icoon knop-icoon-instellingen"
                aria-label="Instellingen openen"
              >
                <SlidersHorizontal size={20} aria-hidden="true" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {!ikBenActief && (
            <div className="mt-3">
              <span className="badge badge-afgemeld">Afgemeld</span>
            </div>
          )}
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
                  <th scope="col">Gestort</th>
                  <th scope="col">Uitgegeven</th>
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
            <button className="knop knop-primair knop-in-grid" onClick={onStorten} disabled={!ikBenActief}>
              <ArrowUp size={16} aria-hidden="true" strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
              Storten
            </button>
            <button className="knop knop-secundair knop-in-grid" onClick={onBetalen} disabled={!ikBenActief || saldi.potSaldo === 0}>
              <CreditCard size={16} aria-hidden="true" strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
              Betaling
            </button>
          </div>

          {ikBenActief && saldi.potSaldo === 0 && (
            <p className="text-xs tekst-grijs-5 text-center helptekst-rechts">
              Geen saldo beschikbaar. Voeg eerst een storting toe.
            </p>
          )}

          {!ikBenActief && (
            <p className="text-sm tekst-grijs-6 text-center helptekst-center">
              Je hebt je afgemeld en kunt geen transacties meer invoeren.
            </p>
          )}

          <div className="actie-sectie">
            <h2 className="sectie-label mb-0">Beheer</h2>

            <div className="grid-2">
              <button
                className={`knop ${ikBenActief ? 'knop-afmelden' : 'knop-aanmelden'} knop-beheer`}
                onClick={() => ikBenActief && setAfmeldenModaal(true)}
                disabled={afmeldenLaden || (ikBenActief && !ikBenGestort)}
                title={ikBenActief && !ikBenGestort ? 'Eerst storten om je te kunnen afmelden' : undefined}
              >
                <LogOut size={16} aria-hidden="true" strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                {afmeldenLaden ? 'Bezig...' : ikBenActief ? 'Afmelden' : 'Afgemeld'}
              </button>
              <button
                className="knop knop-gevaar knop-beheer"
                style={{ opacity: heeftTransacties ? 0.7 : 0.35 }}
                onClick={onSluiten}
                disabled={!heeftTransacties}
              >
                <Lock size={16} aria-hidden="true" strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                Pot sluiten
              </button>
            </div>

            {ikBenActief && !ikBenGestort && (
              <p className="text-xs tekst-grijs-5 text-left helptekst-links">
                Eerst storten om je te kunnen afmelden.
              </p>
            )}
            {heeftTransacties && (
              <p className="text-xs tekst-grijs-5 text-right helptekst-rechts">
                Iedereen kan het potje afsluiten.
              </p>
            )}
            {!heeftTransacties && (
              <p className="text-xs tekst-grijs-5 text-right helptekst-rechts">
                Afsluiten kan pas als er transacties zijn.
              </p>
            )}

            <div className="deelknop-scheiding">
              <DeelKnop
                potjeNaam={potje?.naam}
                variant="tekstlink"
                className="deelknop-tekstlink"
              />
            </div>
          </div>

        </div>

      </div>

      {gekozenDeelnemer && (
        <DeelnemerDetailSheet
          deelnemer={gekozenDeelnemer}
          transacties={transacties}
          onSluiten={() => setGekozenDeelnemer(null)}
          valuta={valuta}
        />
      )}

      {afmeldenModaal && (
        <ModalAfmelden
          deelnemerNaam={ikzelf?.naam}
          isLaatsteActieve={ikBenActief && actieveDeelnemers.length === 1 && actieveDeelnemers[0]?.id === ikzelf?.id}
          achtergelatenBedrag={achtergelatenBedrag}
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
