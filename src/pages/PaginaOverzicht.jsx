import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { berekenSaldi } from '../utils/berekenSaldi'
import { formatBedrag } from '../utils/formatBedrag'

// Formatteert timestamp naar "uu:mm" of "12 jan uu:mm" als ouder dan vandaag
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

// ─── Deelnemer detail bottom-sheet ───────────────────────────────────────────

function PaginaDeelnemerDetail({ deelnemer, transacties, onSluiten }) {
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

// ─── Overzichtscherm ──────────────────────────────────────────────────────────

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

          {/* Status + afmelden */}
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {!ikBenActief && <span className="badge badge-afgemeld">Afgemeld</span>}
            <button
              className={`knop ${ikBenActief ? 'knop-afmelden' : 'knop-aanmelden'}`}
              style={{ width: 'auto', fontSize: 13, padding: '11px 16px' }}
              onClick={onAfmelden}
              disabled={afmeldenLaden || (ikBenActief && !ikBenGestort)}
              title={ikBenActief && !ikBenGestort ? 'Je kunt je pas afmelden als je hebt gestort' : undefined}
            >
              {afmeldenLaden ? 'Bezig...' : ikBenActief ? '👋 Afmelden' : '✅ Aangemeld'}
            </button>
            {ikBenActief && !ikBenGestort && (
              <span style={{ fontSize: 12, color: 'var(--grijs-400)' }}>Stort eerst om te kunnen afmelden</span>
            )}
          </div>

          {/* Link kopiëren */}
          <button
            className="knop knop-secundair"
            style={{ marginTop: 10, fontSize: 14, padding: '8px 14px', width: 'auto' }}
            onClick={() => navigator.clipboard.writeText(window.location.href)}
          >
            🔗 Link kopiëren
          </button>
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

        {/* Actieknoppen */}
        <div className="kaart" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ikBenActief ? (
            <>
              <button className="knop knop-primair" onClick={onStorten}>💰 Storten</button>
              <button
                className="knop knop-secundair"
                onClick={onBetalen}
                disabled={saldi.potSaldo === 0}
              >
                🍺 Rondje betaald
              </button>
              {saldi.potSaldo === 0 && (
                <p style={{ fontSize: 12, color: 'var(--grijs-400)', textAlign: 'center', marginTop: -4 }}>
                  Geen saldo beschikbaar. Voeg eerst een storting toe.
                </p>
              )}
            </>
          ) : (
            <p style={{ fontSize: 14, color: 'var(--grijs-400)', textAlign: 'center', padding: '8px 0' }}>
              Je hebt je afgemeld en kunt geen transacties meer invoeren.
            </p>
          )}
          {heeftTransacties && (
            <>
              <div style={{ borderTop: '1px solid var(--grijs-200)', marginTop: 2 }} />
              <button className="knop knop-gevaar" style={{ opacity: 0.7 }} onClick={onSluiten}>
                🔒 Potje sluiten
              </button>
            </>
          )}
        </div>

      </div>

      {/* Deelnemer detail sheet */}
      {gekozenDeelnemer && (
        <PaginaDeelnemerDetail
          deelnemer={gekozenDeelnemer}
          transacties={transacties}
          onSluiten={() => setGekozenDeelnemer(null)}
        />
      )}
    </>
  )
}

export default PaginaOverzicht
