import { useState, useEffect, useRef } from 'react'
import { logFout } from '../utils/logFout'
import { valideerDeelnemerNaam } from '../utils/valideer'
import { useFocusTrap } from '../hooks/useFocusTrap'

function ModalDeelnemen({ potjeNaam, deelnemers, onDeelnemen, onAnnuleer, profielNaam = '' }) {
  const [naam, setNaam] = useState(profielNaam)
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')
  const panelRef = useRef(null)

  const MAX_NAAM = 30
  const MAX_DEELNEMERS = 20
  const heeftProfielNaam = profielNaam.length > 0

  useEffect(() => {
    if (heeftProfielNaam) {
      panelRef.current?.querySelector('button:not([disabled])')?.focus()
    } else {
      panelRef.current?.querySelector('input')?.focus()
    }
  }, [heeftProfielNaam])

  // WCAG 2.1.1 / 2.4.3: Escape + Tab-trap via gedeelde hook
  // onAnnuleer kan undefined zijn als de modal niet sluitbaar is — gebruik no-op als fallback
  useFocusTrap(panelRef, onAnnuleer ?? (() => {}))

  async function handleSubmit(e) {
    e.preventDefault()
    setFout('')

    const validatieFout = valideerDeelnemerNaam(naam, deelnemers, {
      maxNaam: MAX_NAAM,
      maxDeelnemers: MAX_DEELNEMERS,
    })
    if (validatieFout) {
      setFout(validatieFout)
      return
    }

    setLaden(true)
    try {
      await onDeelnemen(naam.trim())
    } catch (error) {
      setFout(logFout(error, { component: 'ModalDeelnemen', actie: 'deelnemen' }))
    } finally {
      setLaden(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-deelnemen-titel"
    >
      <div ref={panelRef} className="modal-panel">
        <h2 id="modal-deelnemen-titel" className="modal-titel">
          🍺 Meedoen aan {potjeNaam}
        </h2>

        <ul className="flex flex-col gap-1 mb-4 text-sm tekst-grijs-6">
          <li>💰 Stort geld in het potje</li>
          <li>🍺 Registreer wat de groep uitgeeft</li>
          <li>📊 Eerlijke verdeling bij afsluiten</li>
        </ul>

        <form onSubmit={handleSubmit}>
          <div className="veld">
            <label className="label" htmlFor="naam-deelnemen">Jouw naam</label>
            <input
              id="naam-deelnemen"
              className={`input ${fout ? 'fout' : ''}`}
              type="text"
              placeholder="bijv. Jan"
              value={naam}
              onChange={e => { setNaam(e.target.value); setFout('') }}
              maxLength={MAX_NAAM}
              autoComplete="nickname"
              aria-describedby={fout ? 'naam-deelnemen-fout' : undefined}
              aria-invalid={fout ? 'true' : undefined}
            />
            <div className="teller">{naam.length}/{MAX_NAAM}</div>
            {heeftProfielNaam && !fout && (
              <div style={{ fontSize: 12, color: 'var(--grijs-600)', marginTop: 4 }}>
                Uit je profiel. Je kunt de naam aanpassen.
              </div>
            )}
            {/* WCAG 1.3.1 / 4.1.3: id koppelt foutmelding aan invoerveld via aria-describedby */}
            {fout && <div id="naam-deelnemen-fout" className="fout-tekst" role="alert">{fout}</div>}
          </div>

          <div className="modal-knoppen">
            {onAnnuleer && (
              <button
                type="button"
                className="knop knop-secundair flex-1"
                onClick={onAnnuleer}
              >
                Annuleren
              </button>
            )}
            <button
              type="submit"
              className={`knop knop-primair${onAnnuleer ? ' flex-1' : ''}`}
              disabled={laden || !naam.trim()}
            >
              {laden ? 'Bezig…' : 'Meedoen →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ModalDeelnemen
