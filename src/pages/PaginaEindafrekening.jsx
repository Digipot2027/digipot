import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { berekenEindafrekening, berekenVereffening } from '../utils/berekenSaldi'
import { formatBedrag } from '../utils/formatBedrag'

/**
 * Opent de Tikkie-app via deep link.
 * Fallback naar tikkie.me als de app niet geïnstalleerd is.
 *
 * SEC-FIX (2026-04-04): window.open krijgt 'noopener,noreferrer' als derde
 * argument. Zonder dit konden kwaadaardige pagina's via window.opener
 * de originele tab overnemen (tab-napping). noopener verbreekt de
 * opener-referentie; noreferrer voorkomt dat het Referer-header wordt
 * meegestuurd.
 */
function openTikkie() {
  const start = Date.now()
  window.location.href = 'tikkie://'
  setTimeout(() => {
    if (Date.now() - start < 2000) {
      window.open('https://tikkie.me', '_blank', 'noopener,noreferrer')
    }
  }, 1500)
}

function PaginaEindafrekening({ potje, deelnemers, transacties }) {
  const navigate    = useNavigate()
  const valuta      = potje.valuta ?? 'EUR'
  const saldi       = berekenEindafrekening(deelnemers, transacties, potje.gesloten_op)
  const vereffening = berekenVereffening(saldi.deelnemersSaldi)

  // Datum en tijd van sluiting
  const sluitMoment = new Date(potje.gesloten_op)
  const sluitDatum = sluitMoment.toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const sluitTijd = sluitMoment.toLocaleTimeString('nl-NL', {
    hour: '2-digit', minute: '2-digit',
  })

  // Naam van de sluiter opzoeken via gesloten_door (UUID → deelnemer.naam)
  const sluiterNaam = potje.gesloten_door
    ? (deelnemers.find(d => d.id === potje.gesloten_door)?.naam ?? null)
    : null

  const sluitRegel = sluiterNaam
    ? `Gesloten op ${sluitDatum} door ${sluiterNaam} om ${sluitTijd}.`
    : `Automatisch gesloten op ${sluitDatum} om ${sluitTijd}.`

  const [opengeklapt, setOpengeklapt] = useState(null)

  function toggleDetail(id) {
    setOpengeklapt(prev => prev === id ? null : id)
  }

  function transactiesVoor(deelnemerId) {
    return transacties
      .filter(t => t.deelnemer_id === deelnemerId)
      .sort((a, b) => new Date(a.aangemaakt_op) - new Date(b.aangemaakt_op))
  }

  function tijdLabel(iso) {
    return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
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

        <p className="subtitel">{sluitRegel}</p>

        <p style={{ fontSize: 12, color: 'var(--grijs-500)', marginTop: -8, marginBottom: 12 }}>
          Dit potje wordt na 7 dagen volledig verwijderd.
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--grijs-200)' }}>
          <span style={{ color: 'var(--grijs-600)' }}>Totaal in de pot gestort</span>
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
          const isAfgemeld   = d.actief === false
          const isOpen       = opengeklapt === d.id
          const dtransacties = transactiesVoor(d.id)
          const isLaatste    = index === saldi.deelnemersSaldi.length - 1

          return (
            <div
              key={d.id}
              style={{
                borderBottom: isLaatste ? 'none' : '1px solid var(--grijs-100)',
                opacity: isAfgemeld ? 0.75 : 1,
                padding: '12px 0',
              }}
            >
              <button
                onClick={() => toggleDetail(d.id)}
                aria-expanded={isOpen}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  width: '100%', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left', gap: 8, padding: 0,
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <strong style={{
                      fontSize: '0.9375rem',
                      textDecoration: isAfgemeld ? 'line-through' : 'none',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {d.naam}
                    </strong>
                    {isAfgemeld && (
                      <span className="badge badge-afgemeld" style={{ fontSize: 10, flexShrink: 0 }}>Afgemeld</span>
                    )}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--grijs-600)' }}>
                    Betaald: {formatBedrag(d.betaald, valuta)}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--grijs-500)' }}>
                    In de pot: {formatBedrag(d.gestort, valuta)}
                  </span>
                </span>

                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontWeight: 700, color: d.verrekening >= 0 ? 'var(--groen)' : 'var(--rood)', fontSize: '1rem' }}>
                    {d.verrekening >= 0
                      ? `+${formatBedrag(d.verrekening, valuta)}`
                      : `-${formatBedrag(Math.abs(d.verrekening), valuta)}`}
                  </span>
                  <span style={{
                    fontSize: 11, color: 'var(--grijs-500)',
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    details
                    <span style={{
                      fontSize: 12, color: 'var(--grijs-400)', lineHeight: 1,
                      display: 'inline-block', transition: 'transform 0.15s',
                      transform: isOpen ? 'rotate(90deg)' : 'none',
                    }}>›</span>
                  </span>
                </span>
              </button>

              <div style={{ fontSize: 12, color: d.verrekening >= 0 ? 'var(--groen)' : 'var(--rood)', marginTop: 6 }}>
                {d.verrekening >= 0 ? '✅ Ontvangt geld terug' : '⚠️ Moet bijbetalen'}
              </div>

              {isOpen && (
                <div style={{
                  background: 'var(--grijs-50)', borderRadius: 8,
                  padding: '12px 14px', marginTop: 10, fontSize: 13,
                }}>
                  {dtransacties.length === 0 ? (
                    <p style={{ color: 'var(--grijs-500)', margin: 0 }}>Geen transacties.</p>
                  ) : (
                    <>
                      {dtransacties.filter(t => t.type === 'storting').length > 0 && (
                        <>
                          <p style={{ fontWeight: 600, color: 'var(--grijs-600)', marginBottom: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            In de pot gestort
                          </p>
                          {dtransacties.filter(t => t.type === 'storting').map(t => (
                            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: 'var(--grijs-700)' }}>
                              <span>{tijdLabel(t.aangemaakt_op)}</span>
                              <span style={{ fontWeight: 500 }}>{formatBedrag(t.bedrag, valuta)}</span>
                            </div>
                          ))}
                        </>
                      )}
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
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Vereffening ── */}
      {vereffening.length > 0 && (
        <div className="kaart">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Vereffening</h2>
          <p style={{ fontSize: 13, color: 'var(--grijs-600)', marginBottom: 16 }}>
            {vereffening.length === 1
              ? 'Eén overboeking om alles te vereffenen'
              : `${vereffening.length} overboekingen om alles te vereffenen`}
          </p>
          {vereffening.map((v, i) => (
            <div key={i} style={{ borderBottom: i < vereffening.length - 1 ? '1px solid var(--grijs-100)' : 'none', padding: '12px 0' }}>
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
              <button
                className="knop knop-secundair"
                style={{ fontSize: '0.875rem', minHeight: 40 }}
                onClick={openTikkie}
                aria-label={`Stuur een Tikkie van ${formatBedrag(v.bedrag, valuta)} aan ${v.van}`}
              >
                💸 {v.aan}: stuur Tikkie naar {v.van}
              </button>
            </div>
          ))}
        </div>
      )}

      {vereffening.length === 0 && saldi.deelnemersSaldi.length > 0 && (
        <div className="kaart" style={{ textAlign: 'center', padding: '20px 24px' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>Alles vereffend</p>
          <p style={{ fontSize: 13, color: 'var(--grijs-600)' }}>Er hoeft niemand meer bij te betalen.</p>
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
