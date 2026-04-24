import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SlidersHorizontal, Lock, Send, PartyPopper } from 'lucide-react'
import { berekenEindafrekening } from '../utils/berekenEindafrekening'
import { berekenVereffening } from '../utils/berekenVereffening'
import { formatBedrag } from '../utils/formatBedrag'
import { tijdLabel } from '../utils/tijdUtils'
import { STANDAARD_VALUTA } from '../constants'

/**
 * BUG-2 fix (2026-04-16): tijdLabel geïmporteerd uit tijdUtils.js.
 * SEC-FIX (2026-04-04): window.open krijgt 'noopener,noreferrer'.
 * Hoog-5 fix (2026-04-12): Page Visibility API i.p.v. timing-conditie.
 * Lucide-migratie (2026-04-24): emoji's vervangen door Lucide-icons.
 *   🔒 → Lock, 💸 → Send, 🎉 → PartyPopper, ⚙️ → SlidersHorizontal.
 */
function openTikkie() {
  window.location.href = 'tikkie://'

  let fallbackTimer = null

  function cleanup() {
    clearTimeout(fallbackTimer)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      cleanup()
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  fallbackTimer = setTimeout(() => {
    cleanup()
    window.open('https://tikkie.me', '_blank', 'noopener,noreferrer')
  }, 1500)
}

function PaginaEindafrekening({ potje, deelnemers, transacties }) {
  const navigate    = useNavigate()
  const valuta      = potje.valuta ?? STANDAARD_VALUTA
  const saldi       = berekenEindafrekening(deelnemers, transacties, potje.gesloten_op)
  const vereffening = berekenVereffening(saldi.deelnemersSaldi)

  const sluitMoment = new Date(potje.gesloten_op)
  const sluitDatum = sluitMoment.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
  const sluitTijd  = sluitMoment.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })

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

  return (
    <div className="pagina">

      {/* ── Header ── */}
      <div className="kaart">
        <div className="eindafrekening-header">
          <h1 className="titel mb-0">
            <Lock size={20} aria-hidden="true" strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
            {potje.naam}
          </h1>
          <button
            onClick={() => navigate('/instellingen')}
            className="knop-icoon"
            aria-label="Instellingen openen"
          >
            <SlidersHorizontal size={20} aria-hidden="true" strokeWidth={1.5} />
          </button>
        </div>

        <p className="subtitel">{sluitRegel}</p>

        <p className="text-xs tekst-grijs-5" style={{ marginTop: -8, marginBottom: 12 }}>
          Dit potje wordt na 7 dagen volledig verwijderd.
        </p>

        <div className="eindafrekening-saldo-rij eindafrekening-saldo-rij--border">
          <span className="tekst-grijs-6">Totaal in de pot gestort</span>
          <strong>{formatBedrag(saldi.potTotaal, valuta)}</strong>
        </div>
        <div className="eindafrekening-saldo-rij">
          <span className="tekst-grijs-6">Totaal uitgegeven</span>
          <strong>{formatBedrag(saldi.potUitgaven, valuta)}</strong>
        </div>
      </div>

      {/* ── Eindafrekening per deelnemer ── */}
      <div className="kaart">
        <h2 className="text-base font-semibold mb-4">
          Eindafrekening per deelnemer
        </h2>

        {saldi.deelnemersSaldi.map((d, index) => {
          const isAfgemeld   = d.actief === false
          const isOpen       = opengeklapt === d.id
          const dtransacties = transactiesVoor(d.id)
          const isLaatste    = index === saldi.deelnemersSaldi.length - 1
          const detailId     = `detail-inhoud-${d.id}`

          return (
            <div
              key={d.id}
              className={`ea-deelnemer${isAfgemeld ? ' ea-deelnemer--afgemeld' : ''}${!isLaatste ? ' ea-deelnemer--border' : ''}`}
            >
              <button
                onClick={() => toggleDetail(d.id)}
                aria-expanded={isOpen}
                aria-controls={detailId}
                className="ea-deelnemer__knop"
              >
                <span className="ea-deelnemer__links">
                  <span className="ea-deelnemer__naam-rij">
                    <strong className={`ea-deelnemer__naam${isAfgemeld ? ' ea-deelnemer__naam--afgemeld' : ''}`}>
                      {d.naam}
                    </strong>
                    {isAfgemeld && (
                      <span className="badge badge-afgemeld" style={{ fontSize: 10, flexShrink: 0 }}>Afgemeld</span>
                    )}
                  </span>
                  <span className="ea-deelnemer__sub-betaald">
                    Betaald: {formatBedrag(d.betaald, valuta)}
                  </span>
                  <span className="ea-deelnemer__sub-gestort">
                    In de pot: {formatBedrag(d.gestort, valuta)}
                  </span>
                </span>

                <span className="ea-deelnemer__rechts">
                  <span className={`ea-deelnemer__bedrag${d.verrekening >= 0 ? ' ea-deelnemer__bedrag--positief' : ' ea-deelnemer__bedrag--negatief'}`}>
                    {d.verrekening >= 0
                      ? `+${formatBedrag(d.verrekening, valuta)}`
                      : `-${formatBedrag(Math.abs(d.verrekening), valuta)}`}
                  </span>
                  <span className="ea-deelnemer__details-label">
                    details
                    <span className={`ea-deelnemer__pijl${isOpen ? ' ea-deelnemer__pijl--open' : ''}`}>›</span>
                  </span>
                </span>
              </button>

              <div className={`ea-deelnemer__status${d.verrekening >= 0 ? ' ea-deelnemer__status--positief' : ' ea-deelnemer__status--negatief'}`}>
                {d.verrekening >= 0 ? '✓ Ontvangt geld terug' : '! Moet bijbetalen'}
              </div>

              <div id={detailId}>
                {isOpen && (
                  <div className="ea-detail-blok">
                    {dtransacties.length === 0 ? (
                      <p className="tekst-grijs-5" style={{ margin: 0 }}>Geen transacties.</p>
                    ) : (
                      <>
                        {dtransacties.filter(t => t.type === 'storting').length > 0 && (
                          <>
                            <p className="ea-detail-sectie-titel">In de pot gestort</p>
                            {dtransacties.filter(t => t.type === 'storting').map(t => (
                              <div key={t.id} className="ea-detail-transactie-rij">
                                <span>{tijdLabel(t.aangemaakt_op)}</span>
                                <span className="ea-detail-transactie-rij__bedrag">{formatBedrag(t.bedrag, valuta)}</span>
                              </div>
                            ))}
                          </>
                        )}
                        {dtransacties.filter(t => t.type === 'betaling').length > 0 && (
                          <>
                            <p className="ea-detail-sectie-titel ea-detail-sectie-titel--mt">Betalingen aan horeca</p>
                            {dtransacties.filter(t => t.type === 'betaling').map(t => (
                              <div key={t.id} className="ea-detail-transactie-rij">
                                <span>{tijdLabel(t.aangemaakt_op)}</span>
                                <span className="ea-detail-transactie-rij__bedrag ea-detail-transactie-rij__bedrag--groen">{formatBedrag(t.bedrag, valuta)}</span>
                              </div>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Vereffening ── */}
      {vereffening.length > 0 && (
        <div className="kaart">
          <h2 className="text-base font-semibold mb-1">Vereffening</h2>
          <p className="text-sm tekst-grijs-6 mb-4">
            {vereffening.length === 1
              ? 'Eén overboeking om alles te vereffenen'
              : `${vereffening.length} overboekingen om alles te vereffenen`}
          </p>
          {vereffening.map((v, i) => (
            <div key={i} className={`vereffening-rij${i < vereffening.length - 1 ? ' vereffening-rij--border' : ''}`}>
              <div className="vereffening-rij__header">
                <span className="vereffening-rij__namen">
                  <strong>{v.van}</strong>
                  <span className="vereffening-rij__pijl">→</span>
                  <strong>{v.aan}</strong>
                </span>
                <span className="vereffening-rij__bedrag">
                  {formatBedrag(v.bedrag, valuta)}
                </span>
              </div>
              <button
                className="knop knop-secundair vereffening-rij__tikkie"
                onClick={openTikkie}
                aria-label={`Stuur Tikkie naar ${v.van} voor ${formatBedrag(v.bedrag, valuta)}`}
              >
                <Send size={14} aria-hidden="true" strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                {v.aan}: stuur Tikkie naar {v.van}
              </button>
            </div>
          ))}
        </div>
      )}

      {vereffening.length === 0 && saldi.deelnemersSaldi.length > 0 && (
        <div className="kaart alles-vereffend">
          <div className="alles-vereffend__emoji" aria-hidden="true">
            <PartyPopper size={32} strokeWidth={1.5} />
          </div>
          <p className="font-semibold mb-1">Alles vereffend</p>
          <p className="alles-vereffend__sub">Er hoeft niemand meer bij te betalen.</p>
        </div>
      )}

      {/* ── Knoppen ── */}
      <div className="kaart actie-kaart">
        <button className="knop knop-primair" onClick={() => navigate('/')}>
          Nieuw potje starten
        </button>
        <button className="knop knop-secundair" onClick={() => navigate('/instellingen')}>
          Naar instellingen
        </button>
      </div>

    </div>
  )
}

export default PaginaEindafrekening
