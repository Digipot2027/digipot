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

  return (
    <tr
      onClick={onClick}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick()}
      role="button"
      tabIndex={0}
      aria-label={`Details van ${deelnemer.naam}${isAfgemeld ? ', afgemeld' : ''}`}
      style={{
        background: isAfgemeld ? 'var(--grijs-50)' : 'transparent',
        borderBottom: '1px solid var(--grijs-100)',
        cursor: 'pointer',
        opacity: isAfgemeld ? 0.6 : 1,
      }}
    >
      {/* Naam-cel — overflow:hidden + ellipsis zodat lange namen de bedragkolommen
          niet wegdrukken in de table-layout:fixed tabel op smalle schermen (320px).
          Volledige naam is beschikbaar via aria-label op de <tr> en via de detail-sheet. */}
      <td style={{ padding: '10px 6px', overflow: 'hidden' }}>
        <span style={{
          fontWeight: isIkzelf ? 600 : 400,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 14,
          textDecoration: isAfgemeld ? 'line-through' : 'none',
          color: 'var(--grijs-900)',
          overflow: 'hidden',
        }}>
          <span style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}>
            {deelnemer.naam}{isIkzelf ? ' (jij)' : ''}
          </span>
          {isAfgemeld && (
            <span className="badge badge-afgemeld" style={{ fontSize: 10, flexShrink: 0 }}>Afgemeld</span>
          )}
          {/* Pijltje als visuele hint — aria-hidden want al duidelijk via role="button" */}
          <span
            style={{ fontSize: 12, color: 'var(--grijs-400)', fontWeight: 400, textDecoration: 'none', flexShrink: 0 }}
            aria-hidden="true"
          >›</span>
        </span>
      </td>

      {/* Ingelegd-cel */}
      <td style={{ fontSize: 14, color: 'var(--grijs-600)', textAlign: 'right', padding: '10px 6px', whiteSpace: 'nowrap' }}>
        {formatBedrag(saldi?.gestort || 0, valuta)}
      </td>

      {/* Betaald-cel */}
      <td style={{
        fontSize: 14,
        color: (saldi?.betaald || 0) > 0 ? 'var(--grijs-900)' : 'var(--grijs-400)',
        textAlign: 'right',
        padding: '10px 6px',
        whiteSpace: 'nowrap',
      }}>
        {formatBedrag(saldi?.betaald || 0, valuta)}
      </td>
    </tr>
  )
}

export default DeelnemerRij
