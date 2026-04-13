import { useState, useEffect, useRef } from 'react'
import { logFout } from '../utils/logFout'
import { valideerDeelnemerNaam } from '../utils/valideer'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { MAX_NAAM, MAX_DEELNEMERS } from '../constants'

function ModalDeelnemen({ potjeNaam, deelnemers, onDeelnemen, onAnnuleer, profielNaam = '' }) {
  const [naam, setNaam] = useState(profielNaam)
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')
  const panelRef = useRef(null)

  // SEC-M1 fix (2026-04-13): gebruik constanten uit constants.js i.p.v. hardcoded waarden.
  // Bij een toekomstige wijziging in de limieten worden alle validaties automatisch bijgewerkt.
  const heeftProfielNaam = profielNaam.length > 0

  useEffect(() => {
    if (heeftProfielNaam) {
      panelRef.current?.querySelector('button:not([disabled])')?.focus()
    } else {
      panelRef.current?.querySelector('input')?.focus()
    }
  }, [heeftProfielNaam])

  // WCAG 2.1.1 / 2.4.3: Escape + Tab-trap via gedeelde hook
  // onAnnuleer kan undefined zijn als de modal niet sluitbaar is (deelnemen
  // is verplicht voor verdere interactie). In dat geval is Escape een bewuste
  // no-op: de gebruiker moet een naam invullen voordat de app verder kan.
  // WCAG-3 bewuste keuze (2026-04-13): geen Escape-sluiting als onAnnuleer
  // niet meegegeven is — dit is geen omissie maar een expliciete keuze.
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
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 500 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-deelnemen-titel"
    >
      <div
        ref={panelRef}
        style={{ background: 'var(--wit)', width: '100%', borderRadius: '16px 16px 0 0', padding: 24, paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}
      >
        <h2 id="modal-deelnemen-titel" style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
          🍺 Meedoen aan {potjeNaam}
        </h2>

        <ul style={{ listStyle: 'none', marginBottom: 16, fontSize: 13, color: 'var(--grijs-600)', display: 'flex', flexDirection: 'column', gap: 4 }}>
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
            />
            <div className="teller">{naam.length}/{MAX_NAAM}</div>
            {heeftProfielNaam && !fout && (
              <div style={{ fontSize: 12, color: 'var(--grijs-600)', marginTop: 4 }}>
                Uit je profiel. Je kunt de naam aanpassen.
              </div>
            )}
            {fout && <div className="fout-tekst">{fout}</div>}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {onAnnuleer && (
              <button
                type="button"
                className="knop knop-secundair"
                style={{ flex: 1 }}
                onClick={onAnnuleer}
              >
                Annuleren
              </button>
            )}
            <button
              type="submit"
              className="knop knop-primair"
              style={{ flex: onAnnuleer ? 1 : undefined }}
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
