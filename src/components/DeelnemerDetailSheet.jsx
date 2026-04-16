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
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 500 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-titel"
      onClick={e => { if (e.target === e.currentTarget) onSluiten() }}
    >
      <div
        ref={panelRef}
        style={{
          background: 'var(--wit)',
          width: '100%',
          borderRadius: '16px 16px 0 0',
          padding: 24,
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 id="detail-titel" style={{ fontSize: 18, fontWeight: 700 }}>{deelnemer.naam}</h2>
            {isAfgemeld && <span className="badge badge-afgemeld">Afgemeld</span>}
          </div>
          <button
            onClick={onSluiten}
            style={{
              background: 'none', border: 'none', fontSize: 18,
              cursor: 'pointer', color: 'var(--grijs-400)',
              minWidth: 44, minHeight: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginRight: -10,
            }}
            aria-label="Sluiten"
          >
            ✕
          </button>
        </div>

        {/* Totaalkaartjes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          <div style={{ background: 'var(--groen-licht)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--groen)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              In de pot gestort
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--groen)' }}>
              {formatBedrag(totaalGestort, valuta)}
            </div>
          </div>
          <div style={{ background: 'var(--rood-licht)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--rood)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Betaald aan horeca
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--rood)' }}>
              {formatBedrag(totaalBetaald, valuta)}
            </div>
          </div>
        </div>

        {/* Stortingen */}
        {stortingen.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--grijs-600)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              In de pot gestort
            </h3>
            {stortingen.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--grijs-100)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🟢</span>
                  <span style={{ fontSize: 13, color: 'var(--grijs-600)' }}>{volledigTijdLabel(t.aangemaakt_op)}</span>
                </div>
                <span style={{ fontWeight: 600, color: 'var(--groen)' }}>+{formatBedrag(t.bedrag, valuta)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Betalingen */}
        {betalingen.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--grijs-600)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Betalingen aan horeca
            </h3>
            {betalingen.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--grijs-100)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🔴</span>
                  <span style={{ fontSize: 13, color: 'var(--grijs-600)' }}>{volledigTijdLabel(t.aangemaakt_op)}</span>
                </div>
                <span style={{ fontWeight: 600, color: 'var(--rood)' }}>-{formatBedrag(t.bedrag, valuta)}</span>
              </div>
            ))}
          </div>
        )}

        {mijnTransacties.length === 0 && (
          <p style={{ fontSize: 14, color: 'var(--grijs-400)', textAlign: 'center', padding: '16px 0' }}>
            Nog geen transacties.
          </p>
        )}

        <button className="knop knop-secundair" onClick={onSluiten}>
          Sluiten
        </button>
      </div>
    </div>
  )
}

export default DeelnemerDetailSheet
