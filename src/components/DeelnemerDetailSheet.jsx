import { useRef, useEffect } from 'react'
import { formatBedrag } from '../utils/formatBedrag'
import { volledigTijdLabel } from '../utils/tijdUtils'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { STANDAARD_VALUTA } from '../constants'

/**
 * BUG-1 fix (2026-04-16): valuta-prop toegevoegd.
 * BUG-2 fix (2026-04-16): volledigTijdLabel geïmporteerd uit tijdUtils.js
 *   i.p.v. lokaal gedefinieerd. Eén bron van waarheid voor tijdformattering.
 */
function DeelnemerDetailSheet({ deelnemer, transacties, onSluiten, valuta = STANDAARD_VALUTA }) {
  const panelRef = useRef(null)

  useFocusTrap(panelRef, onSluiten)

  useEffect(() => {
    panelRef.current?.querySelector('button')?.focus()
  }, [])

  const mijnTransacties = transacties
    .filter(t => t.deelnemer_id === deelnemer.id)
    .sort((a, b) => new Date(a.aangemaakt_op) - new Date(b.aangemaakt_op))

  const stortingen = mijnTransacties.filter(t => t.type === 'storting')
  const betalingen = mijnTransacties.filter(t => t.type === 'betaling')
  const totaalGestort = stortingen.reduce((s, t) => s + Number(t.bedrag), 0)
  const totaalBetaald = betalingen.reduce((s, t) => s + Number(t.bedrag), 0)
  const isAfgemeld = deelnemer.actief === false

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-titel"
      onClick={e => { if (e.target === e.currentTarget) onSluiten() }}
    >
      <div ref={panelRef} className="detail-panel">

        {/* Header */}
        <div className="detail-header">
          <div className="detail-header__links">
            <h2 id="detail-titel" className="detail-header__titel">{deelnemer.naam}</h2>
            {isAfgemeld && <span className="badge badge-afgemeld">Afgemeld</span>}
          </div>
          <button
            onClick={onSluiten}
            className="detail-sluit-knop"
            aria-label="Sluiten"
          >
            ✕
          </button>
        </div>

        {/* Totaalkaartjes */}
        <div className="detail-totalen">
          <div className="detail-totaal-kaart detail-totaal-kaart--groen">
            <div className="detail-totaal-kaart__label detail-totaal-kaart__label--groen">
              In de pot gestort
            </div>
            <div className="detail-totaal-kaart__bedrag detail-totaal-kaart__bedrag--groen">
              {formatBedrag(totaalGestort, valuta)}
            </div>
          </div>
          <div className="detail-totaal-kaart detail-totaal-kaart--rood">
            <div className="detail-totaal-kaart__label detail-totaal-kaart__label--rood">
              Betaald aan horeca
            </div>
            <div className="detail-totaal-kaart__bedrag detail-totaal-kaart__bedrag--rood">
              {formatBedrag(totaalBetaald, valuta)}
            </div>
          </div>
        </div>

        {/* Stortingen */}
        {stortingen.length > 0 && (
          <div className="detail-sectie">
            <h3 className="detail-sectie__titel">In de pot gestort</h3>
            {stortingen.map(t => (
              <div key={t.id} className="detail-transactie-rij">
                <div className="detail-transactie-rij__links">
                  <span>🟢</span>
                  <span className="detail-transactie-rij__tijd">{volledigTijdLabel(t.aangemaakt_op)}</span>
                </div>
                <span className="detail-transactie-rij__bedrag detail-transactie-rij__bedrag--groen">
                  +{formatBedrag(t.bedrag, valuta)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Betalingen */}
        {betalingen.length > 0 && (
          <div className="detail-sectie">
            <h3 className="detail-sectie__titel">Betalingen aan horeca</h3>
            {betalingen.map(t => (
              <div key={t.id} className="detail-transactie-rij">
                <div className="detail-transactie-rij__links">
                  <span>🔴</span>
                  <span className="detail-transactie-rij__tijd">{volledigTijdLabel(t.aangemaakt_op)}</span>
                </div>
                <span className="detail-transactie-rij__bedrag detail-transactie-rij__bedrag--rood">
                  -{formatBedrag(t.bedrag, valuta)}
                </span>
              </div>
            ))}
          </div>
        )}

        {mijnTransacties.length === 0 && (
          <p className="detail-leeg">Nog geen transacties.</p>
        )}

        <button className="knop knop-secundair" onClick={onSluiten}>
          Sluiten
        </button>
      </div>
    </div>
  )
}

export default DeelnemerDetailSheet
