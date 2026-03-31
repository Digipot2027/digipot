import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { berekenEindafrekening } from '../utils/berekenSaldi'
import { formatBedrag } from '../utils/formatBedrag'

/**
 * Berekent de minimale vereffening tussen crediteuren en debiteuren.
 * Algoritme: grootste debiteur koppelen aan grootste crediteur (greedy).
 * Resultaat: maximaal n-1 transacties voor n deelnemers.
 *
 * @param {Array} deelnemersSaldi - output van berekenEindafrekening
 * @returns {Array} [{van, aan, bedrag}]
 */
function berekenVereffening(deelnemersSaldi) {
  // Alleen deelnemers met een relevant saldo
  const crediteuren = deelnemersSaldi
    .filter(d => d.verrekening > 0.005)
    .map(d => ({ naam: d.naam, bedrag: d.verrekening }))
    .sort((a, b) => b.bedrag - a.bedrag)

  const debiteuren = deelnemersSaldi
    .filter(d => d.verrekening < -0.005)
    .map(d => ({ naam: d.naam, bedrag: Math.abs(d.verrekening) }))
    .sort((a, b) => b.bedrag - a.bedrag)

  const transacties = []

  // Werk met kopieën zodat de originele saldi ongewijzigd blijven
  const cred = crediteuren.map(c => ({ ...c }))
  const deb  = debiteuren.map(d => ({ ...d }))

  let ci = 0, di = 0
  while (ci < cred.length && di < deb.length) {
    const bedrag = Math.round(Math.min(cred[ci].bedrag, deb[di].bedrag) * 100) / 100
    if (bedrag >= 0.01) {
      transacties.push({ van: deb[di].naam, aan: cred[ci].naam, bedrag })
    }
    cred[ci].bedrag = Math.round((cred[ci].bedrag - bedrag) * 100) / 100
    deb[di].bedrag  = Math.round((deb[di].bedrag  - bedrag) * 100) / 100
    if (cred[ci].bedrag < 0.01) ci++
    if (deb[di].bedrag  < 0.01) di++
  }

  return transacties
}

/**
 * Opent de Tikkie-app. Als Tikkie niet geïnstalleerd is, valt terug
 * op tikkie.me in de browser zodat de gebruiker alsnog een verzoek
 * kan aanmaken.
 */
function openTikkie(bedrag, omschrijving) {
  // Tikkie app deep link — werkt als de app geïnstalleerd is
  // Tikkie heeft geen publieke API voor pre-filled deep links;
  // we openen de app en tonen de omschrijving als tekst via share-sheet.
  const tikkieUrl = `tikkie://`
  const fallbackUrl = `https://tikkie.me`

  // Probeer de app te openen; na 1,5s naar fallback als app niet reageert
  const start = Date.now()
  window.location.href = tikkieUrl

  setTimeout(() => {
    // Als de pagina nog zichtbaar is (app niet geopend), open fallback
    if (Date.now() - start < 2000) {
      window.open(fallbackUrl, '_blank')
    }
  }, 1500)
}

function PaginaEindafrekening({ potje, deelnemers, transacties }) {
  const navigate  = useNavigate()
  const valuta    = potje.valuta ?? 'EUR'
  const saldi     = berekenEindafrekening(deelnemers, transacties, potje.gesloten_op)
  const vereffening = berekenVereffening(saldi.deelnemersSaldi)

  const gesloten  = new Date(potje.gesloten_op)
  const sluitDatum = gesloten.toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // Bijhouden welke deelnemer is uitgeklapt
  const [opengeklapt, setOpengeklapt] = useState(null)

  function toggleDetail(id) {
    setOpengeklapt(prev => prev === id ? null : id)
  }

  // Transacties per deelnemer voor het uitklappaneel
  function transactiesVoor(deelnemerId) {
    return transacties
      .filter(t => t.deelnemer_id === deelnemerId)
      .sort((a, b) => new Date(a.aangemaakt_op) - new Date(b.aangemaakt_op))
  }

  function tijdLabel(iso) {
    return new Date(iso).toLocaleTimeString('nl-NL', {
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="pagina">

      {/* ── Header ── */}
      <div className="kaart">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <h1 className="titel" style={{ marginBottom: 0 }}>🔒 {potje.naam}</h1>
          <button
            onClick={() => navigate('/instellingen')}
            style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--grijs-500)', padding: '2px 0 0 0', lineHeight: 1 }}
            aria-label="Instellingen openen"
          >
            ⚙️
          </button>
        </div>
        <p className="subtitel">
          {potje.gesloten_door === null
            ? `Automatisch gesloten op ${sluitDatum}`
            : `Gesloten op ${sluitDatum}`}
        </p>
        {potje.gesloten_door === null && (
          <p style={{ fontSize: 12, color: 'var(--grijs-500)', marginTop: 4 }}>
            Dit potje is na 24 uur automatisch gesloten en wordt na 7 dagen volledig verwijderd.
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--grijs-200)' }}>
          <span style={{ color: 'var(--grijs-600)' }}>Totaal gestort</span>
          <strong>{formatBedrag(saldi.potTotaal, valuta)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
          <span style={{ color: 'var(--grijs-600)' }}>Totaal uitgegeven</span>
          <strong>{formatBedrag(saldi.potUitgaven, valuta)}</strong>
        </div>
      </div>

      {/* ── Eindafrekening per deelnemer ── */}
      <div className="kaart">
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          Eindafrekening per deelnemer
        </h2>

        {saldi.deelnemersSaldi.map((d, index) => {
          const isAfgemeld  = d.actief === false
          const isOpen      = opengeklapt === d.id
          const dtransacties = transactiesVoor(d.id)
          const isLaatste   = index === saldi.deelnemersSaldi.length - 1

          return (
            <div
              key={d.id}
              style={{
                borderBottom: isLaatste ? 'none' : '1px solid var(--grijs-100)',
                opacity: isAfgemeld ? 0.75 : 1,
              }}
            >
              {/* Hoofdrij — klikbaar */}
              <button
                onClick={() => toggleDetail(d.id)}
                aria-expanded={isOpen}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  padding: '14px 0',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  gap: 8,
                }}
              >
                {/* Links: naam + badge */}
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <strong
                    style={{
                      fontSize: '0.9375rem',
                      textDecoration: isAfgemeld ? 'line-through' : 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d.naam}
                  </strong>
                  {isAfgemeld && (
                    <span className="badge badge-afgemeld" style={{ fontSize: 10, flexShrink: 0 }}>
                      Afgemeld
                    </span>
                  )}
                </span>

                {/* Rechts: verrekening + pijltje */}
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontWeight: 700, color: d.verrekening >= 0 ? 'var(--groen)' : 'var(--rood)' }}>
                    {d.verrekening >= 0
                      ? `+${formatBedrag(d.verrekening, valuta)}`
                      : `-${formatBedrag(Math.abs(d.verrekening), valuta)}`}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--grijs-400)', lineHeight: 1, transform: isOpen ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>
                    ›
                  </span>
                </span>
              </button>

              {/* Status label */}
              <div style={{ fontSize: 12, color: d.verrekening >= 0 ? 'var(--groen)' : 'var(--rood)', marginTop: -8, paddingBottom: 10 }}>
                {d.verrekening >= 0 ? '✅ Ontvangt geld terug' : '⚠️ Moet bijbetalen'}
              </div>

              {/* Uitklappaneel */}
              {isOpen && (
                <div style={{
                  background: 'var(--grijs-50)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginBottom: 12,
                  fontSize: 13,
                }}>
                  {dtransacties.length === 0 ? (
                    <p style={{ color: 'var(--grijs-500)', margin: 0 }}>Geen transacties.</p>
                  ) : (
                    <>
                      {/* Stortingen */}
                      {dtransacties.filter(t => t.type === 'storting').length > 0 && (
                        <>
                          <p style={{ fontWeight: 600, color: 'var(--grijs-600)', marginBottom: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Stortingen
                          </p>
                          {dtransacties.filter(t => t.type === 'storting').map(t => (
                            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: 'var(--grijs-700)' }}>
                              <span>{tijdLabel(t.aangemaakt_op)}</span>
                              <span style={{ fontWeight: 500 }}>{formatBedrag(t.bedrag, valuta)}</span>
                            </div>
                          ))}
                        </>
                      )}

                      {/* Betalingen */}
                      {dtransacties.filter(t => t.type === 'betaling').length > 0 && (
                        <>
                          <p style={{ fontWeight: 600, color: 'var(--grijs-600)', marginBottom: 6, marginTop: 10, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Betalingen aan horeca
                          </p>
                          {dtransacties.filter(t => t.type === 'betaling').map(t => (
                            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: 'var(--grijs-700)' }}>
                              <span>{tijdLabel(t.aangemaakt_op)}</span>
                              <span style={{ fontWeight: 500, color: 'var(--groen)' }}>{formatBedrag(t.bedrag, valuta)}</span>
                            </div>
                          ))}
                        </>
                      )}

                      {/* Totaalregel */}
                      <div style={{ borderTop: '1px solid var(--grijs-200)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                        <span>Ingelegd</span>
                        <span>{formatBedrag(d.gestort, valuta)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                        <span>Betaald aan horeca</span>
                        <span style={{ color: 'var(--groen)' }}>{formatBedrag(d.betaald, valuta)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Vereffening (wie betaalt aan wie) ── */}
      {vereffening.length > 0 && (
        <div className="kaart">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
            Vereffening
          </h2>
          <p style={{ fontSize: 13, color: 'var(--grijs-600)', marginBottom: 16 }}>
            {vereffening.length === 1
              ? 'Eén overboeking om alles te vereffenen'
              : `${vereffening.length} overboekingen om alles te vereffenen`}
          </p>

          {vereffening.map((v, i) => (
            <div
              key={i}
              style={{
                borderBottom: i < vereffening.length - 1 ? '1px solid var(--grijs-100)' : 'none',
                padding: '12px 0',
              }}
            >
              {/* Wie → aan wie + bedrag */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.9375rem' }}>
                  <strong>{v.van}</strong>
                  <span style={{ color: 'var(--grijs-500)', margin: '0 6px' }}>→</span>
                  <strong>{v.aan}</strong>
                </span>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>
                  {formatBedrag(v.bedrag, valuta)}
                </span>
              </div>

              {/* Tikkie-knop — zichtbaar voor de crediteur (v.aan ontvangt) */}
              <button
                className="knop knop-secundair"
                style={{ fontSize: '0.875rem', minHeight: 40 }}
                onClick={() => openTikkie(v.bedrag, `${potje.naam} — ${v.van} aan ${v.aan}`)}
                aria-label={`Stuur een Tikkie van ${formatBedrag(v.bedrag, valuta)} aan ${v.van}`}
              >
                💸 {v.aan}: stuur Tikkie naar {v.van}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Geen vereffening nodig (bijv. alles al verrekend of saldo klopt exact) */}
      {vereffening.length === 0 && saldi.deelnemersSaldi.length > 0 && (
        <div className="kaart" style={{ textAlign: 'center', padding: '20px 24px' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>Alles vereffend</p>
          <p style={{ fontSize: 13, color: 'var(--grijs-600)' }}>
            Er hoeft niemand meer bij te betalen.
          </p>
        </div>
      )}

      {/* ── Knoppen ── */}
      <div className="kaart" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="knop knop-primair" onClick={() => navigate('/')}>
          🍺 Nieuw potje starten
        </button>
        <button className="knop knop-secundair" onClick={() => navigate('/instellingen')}>
          ⚙️ Naar instellingen
        </button>
      </div>

    </div>
  )
}

export default PaginaEindafrekening
