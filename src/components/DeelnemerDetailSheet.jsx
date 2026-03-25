import { formatBedrag } from '../utils/formatBedrag'

// Formatteert timestamp naar "uu:mm" of "dag maand uu:mm" als ouder dan vandaag
function volledigTijdLabel(iso) {
  const d = new Date(iso)
  const nu = new Date()
  const ouderDanVandaag = d.toDateString() !== nu.toDateString()
  if (ouderDanVandaag) {
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) +
      ' ' + d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function DeelnemerDetailSheet({ deelnemer, transacties, onSluiten }) {
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
      <div style={{
        background: 'var(--wit)',
        width: '100%',
        borderRadius: '16px 16px 0 0',
        padding: 24,
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
        maxHeight: '80vh',
        overflowY: 'auto',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 id="detail-titel" style={{ fontSize: 18, fontWeight: 700 }}>{deelnemer.naam}</h2>
            {isAfgemeld && <span className="badge badge-afgemeld">Afgemeld</span>}
          </div>
          <button
            onClick={onSluiten}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--grijs-400)', padding: 4 }}
            aria-label="Sluiten"
          >
            ✕
          </button>
        </div>

        {/* Totaalkaartjes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          <div style={{ background: 'var(--groen-licht)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--groen)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Totaal ingelegd
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--groen)' }}>
              {formatBedrag(totaalGestort)}
            </div>
          </div>
          <div style={{ background: 'var(--rood-licht)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--rood)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Totaal betaald
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--rood)' }}>
              {formatBedrag(totaalBetaald)}
            </div>
          </div>
        </div>

        {/* Inleg uitgesplitst */}
        {stortingen.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--grijs-600)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Inleg
            </h3>
            {stortingen.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--grijs-100)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🟢</span>
                  <span style={{ fontSize: 13, color: 'var(--grijs-600)' }}>{volledigTijdLabel(t.aangemaakt_op)}</span>
                </div>
                <span style={{ fontWeight: 600, color: 'var(--groen)' }}>+{formatBedrag(t.bedrag)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Betalingen uitgesplitst */}
        {betalingen.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--grijs-600)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Betalingen
            </h3>
            {betalingen.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--grijs-100)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🔴</span>
                  <span style={{ fontSize: 13, color: 'var(--grijs-600)' }}>{volledigTijdLabel(t.aangemaakt_op)}</span>
                </div>
                <span style={{ fontWeight: 600, color: 'var(--rood)' }}>-{formatBedrag(t.bedrag)}</span>
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
