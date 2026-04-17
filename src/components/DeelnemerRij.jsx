import { formatBedrag } from '../utils/formatBedrag'

/**
 * DeelnemerRij — één rij in de deelnemerstafel op het Overzichtscherm.
 *
 * Geëxtraheerd uit PaginaOverzicht zodat de tabel-render-logica
 * geïsoleerd en afzonderlijk testbaar is.
 *
 * WCAG 1.3.1: gebruikt <tr> binnen een semantische <table> met <th scope="col">.
 * WCAG 1.4.3: kleuren via CSS-variabelen met gedocumenteerde contrastwaarden.
 * WCAG 2.1.1: Enter/Space opent detail-sheet (toetsenbordtoegang).
 *   Space-handler roept e.preventDefault() aan om paginascroll te voorkomen.
 *
 * Mobiel (punt 3): naam-cel gebruikt overflow:hidden + text-overflow:ellipsis zodat
 * lange namen niet de bedragkolommen wegdrukken in de fixed-layout tabel.
 * De volledige naam is altijd beschikbaar via aria-label op de rij én via de
 * detail-sheet die opent bij aantikken.
 *
 * @param {Object}   props
 * @param {object}   props.deelnemer    - Deelnemer-record
 * @param {object}   props.saldi        - Saldi-object voor deze deelnemer ({ gestort, betaald })
 * @param {boolean}  props.isIkzelf     - true als dit de huidig ingelogde deelnemer is
 * @param {Function} props.onClick      - Callback bij klik of Enter/Space
 * @param {string}   [props.valuta]     - ISO 4217 valutacode (default: 'EUR')
 */
function DeelnemerRij({ deelnemer, saldi, isIkzelf, onClick, valuta = 'EUR' }) {
  const isAfgemeld = deelnemer.actief === false

  // WCAG-3: Space-toets scrollt de pagina als e.preventDefault() ontbreekt.
  // Enter heeft dit probleem niet, maar we behandelen beide consistent.
  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <tr
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Details van ${deelnemer.naam}${isAfgemeld ? ', afgemeld' : ''}`}
      className={`deelnemer-rij${isAfgemeld ? ' deelnemer-rij--afgemeld' : ''}`}
    >
      {/* Naam-cel — overflow:hidden + ellipsis zodat lange namen de bedragkolommen
          niet wegdrukken in de table-layout:fixed tabel op smalle schermen (320px).
          Volledige naam is beschikbaar via aria-label op de <tr> en via de detail-sheet. */}
      <td className="deelnemer-rij__naam-cel">
        <span className={`deelnemer-rij__naam-inhoud${isIkzelf ? ' deelnemer-rij__naam-inhoud--ikzelf' : ''}`}>
          <span className={`deelnemer-rij__naam-tekst${isAfgemeld ? ' deelnemer-rij__naam-tekst--afgemeld' : ''}`}>
            {deelnemer.naam}{isIkzelf ? ' (jij)' : ''}
          </span>
          {isAfgemeld && (
            <span className="badge badge-afgemeld" style={{ fontSize: 10, flexShrink: 0 }}>Afgemeld</span>
          )}
          {/* Pijltje als visuele hint — aria-hidden want al duidelijk via role="button" */}
          <span className="deelnemer-rij__pijl" aria-hidden="true">›</span>
        </span>
      </td>

      {/* Ingelegd-cel */}
      <td className="deelnemer-rij__bedrag-cel">
        {formatBedrag(saldi?.gestort || 0, valuta)}
      </td>

      {/* Betaald-cel */}
      <td className={`deelnemer-rij__betaald-cel${(saldi?.betaald || 0) > 0 ? ' deelnemer-rij__betaald-cel--actief' : ''}`}>
        {formatBedrag(saldi?.betaald || 0, valuta)}
      </td>
    </tr>
  )
}

export default DeelnemerRij
