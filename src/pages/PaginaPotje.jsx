import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { usePotje } from '../hooks/usePotje'
import { usePotjeActies } from '../hooks/usePotjeActies'
import { berekenSaldi } from '../utils/berekenSaldi'
import { PROFIEL_NAAM_KEY, STANDAARD_VALUTA } from '../constants'
import { getItem } from '../utils/storage'
import ModalDeelnemen from '../components/ModalDeelnemen.jsx'
import ModalTransactie from '../components/ModalTransactie.jsx'
import ModalSluiten from '../components/ModalSluiten.jsx'
import PaginaEindafrekening from './PaginaEindafrekening.jsx'
import PaginaOverzicht from './PaginaOverzicht.jsx'

// Toast-duur in ms — synchroon met de CSS-animatieduur via --toast-duur
const TOAST_DUUR_UNDO  = 10000
const TOAST_DUUR_INFO  = 5000
const TOAST_DUUR_KORT  = 3000

function PaginaPotje() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const {
    potje,
    deelnemers,
    transacties,
    deelnemer,
    setDeelnemer,
    setDeelnemers,
    setTransacties,
    laden,
    fout,
    online,
  } = usePotje(id)

  const [modaal, setModaal] = useState(null)
  const [toast, setToast] = useState(null)
  const [afmeldenLaden, setAfmeldenLaden] = useState(false)
  const toastTimerRef = useRef(null)

  // ── Toast ─────────────────────────────────────────────────────────────────────

  const toonToast = useCallback((bericht, type = 'info', actie = null) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    const duur = actie ? TOAST_DUUR_UNDO : type === 'info' ? TOAST_DUUR_INFO : TOAST_DUUR_KORT
    setToast({ bericht, type, actie, duur })
    toastTimerRef.current = setTimeout(() => setToast(null), duur)
  }, [])

  useEffect(() => {
    if (location.state?.toast) {
      const { bericht, type } = location.state.toast
      // eslint-disable-next-line react-hooks/set-state-in-effect
      toonToast(bericht, type)
      navigate(location.pathname, { replace: true, state: {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const vorigeOnline = useRef(online)
  useEffect(() => {
    if (!vorigeOnline.current && online) {
      setTimeout(() => toonToast('Verbinding hersteld.', 'ok'), 0)
    }
    vorigeOnline.current = online
  }, [online, toonToast])

  // ── Acties ────────────────────────────────────────────────────────────────────

  const { handleDeelnemen, handleTransactie, handleSluiten, handleAfmelden } =
    usePotjeActies({
      potjeId: id,
      potje,
      deelnemers,
      transacties,
      deelnemer,
      setDeelnemer,
      setDeelnemers,
      setTransacties,
      toonToast,
      setModaal,
      setAfmeldenLaden,
    })

  // ── Afgeleide waarden ─────────────────────────────────────────────────────────

  const saldi = berekenSaldi(deelnemers, transacties)
  const ikBenActief = deelnemer?.actief !== false
  const valuta = potje?.valuta ?? STANDAARD_VALUTA

  useEffect(() => {
    if (!potje) return
    if (potje.status === 'gesloten') {
      document.title = `Eindafrekening: ${potje.naam} — Digipot`
    } else if (!deelnemer) {
      document.title = `Meedoen: ${potje.naam} — Digipot`
    } else {
      document.title = `${potje.naam} — Digipot`
    }
  }, [potje, deelnemer])

  // ── Renders ───────────────────────────────────────────────────────────────────

  if (laden) return (
    <div className="pagina">
      <div className="kaart">
        <div className="skeleton skeleton-titel" />
        <div className="skeleton skeleton-subtitel" />
        <div className="skeleton skeleton-smal" />
      </div>
      <div className="kaart">
        <div className="skeleton skeleton-subtitel mb-3" />
        <div className="skeleton skeleton-rij mb-2" />
        <div className="skeleton skeleton-rij mb-2" />
        <div className="skeleton skeleton-rij" />
      </div>
    </div>
  )

  if (fout) return (
    <div className="pagina">
      <div className="kaart">
        <p className="tekst-rood">{fout}</p>
      </div>
    </div>
  )

  // Deelneemscherm
  if (!deelnemer) {
    return (
      <>
        <div className="pagina">
          <div className="kaart">
            <h1 className="titel">🍺 {potje?.naam}</h1>
            <p className="subtitel">Doe mee en splits de kosten eerlijk.</p>
          </div>
        </div>
        <ModalDeelnemen
          potjeNaam={potje?.naam}
          deelnemers={deelnemers}
          onDeelnemen={handleDeelnemen}
          profielNaam={getItem(PROFIEL_NAAM_KEY)?.trim() || ''}
        />
      </>
    )
  }

  // Eindafrekeningscherm
  if (potje?.status === 'gesloten') return (
    <PaginaEindafrekening potje={potje} deelnemers={deelnemers} transacties={transacties} />
  )

  // Overzichtscherm
  return (
    <>
      {!online && (
        <div className="verbinding-banner">
          ⚠️ Verbinding verbroken. Wijzigingen worden niet opgeslagen.
        </div>
      )}
      <div className={!online ? 'online-offset' : undefined}>
        <PaginaOverzicht
          potje={potje}
          deelnemers={deelnemers}
          transacties={transacties}
          deelnemer={deelnemer}
          onStorten={() => navigate(`/potje/${id}/storten`)}
          onBetalen={() => setModaal('betaling')}
          onSluiten={() => setModaal('sluiten')}
          onAfmelden={handleAfmelden}
          afmeldenLaden={afmeldenLaden}
        />
      </div>

      {modaal === 'betaling' && (
        <ModalTransactie
          type="betaling"
          potSaldo={saldi.potSaldo}
          valuta={valuta}
          potjeId={id}
          ikBenActief={ikBenActief}
          onBevestig={handleTransactie}
          onAnnuleer={() => setModaal(null)}
        />
      )}
      {modaal === 'sluiten' && (
        <ModalSluiten
          potjeNaam={potje?.naam}
          aantalActiefDeelnemers={deelnemers.filter(d => d.actief !== false).length}
          onBevestig={handleSluiten}
          onAnnuleer={() => setModaal(null)}
        />
      )}

      {toast && (
        <div
          className={`toast ${toast.type}${toast.actie ? ' toast--heeft-undo' : ''}`}
          style={toast.actie ? { '--toast-duur': `${toast.duur}ms` } : undefined}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="toast-inhoud">
            <span>{toast.bericht}</span>
            {toast.actie && (
              <button className="toast-knop" onClick={toast.actie.handler}>
                {toast.actie.label}
              </button>
            )}
          </div>
          <div className="toast-voortgang" aria-hidden="true" />
        </div>
      )}
    </>
  )
}

export default PaginaPotje
