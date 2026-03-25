import { useState, useEffect, useRef } from 'react'
import { logFout } from '../utils/logFout'

function ModalDeelnemen({ potjeNaam, deelnemers, onDeelnemen }) {
  const [naam, setNaam] = useState('')
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')
  const panelRef = useRef(null)

  const MAX_NAAM = 30
  const MAX_DEELNEMERS = 20

  // K4: focus eerste invoerveld bij openen
  useEffect(() => {
    panelRef.current?.querySelector('input')?.focus()
  }, [])

  // K4: Escape sluit niet (bij deelnemen is er geen annuleer), Tab-trap binnen panel
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Tab') return
      const els = [...(panelRef.current?.querySelectorAll(
        'input, button:not([disabled])'
      ) ?? [])]
      if (els.length < 2) return
      const first = els[0], last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setFout('')

    const naamTrimmed = naam.trim()
    if (!naamTrimmed) {
      setFout('Vul je naam in om deel te nemen.')
      return
    }
    if (naamTrimmed.length > MAX_NAAM) {
      setFout(`Je naam mag maximaal ${MAX_NAAM} tekens zijn.`)
      return
    }
    if (deelnemers.length >= MAX_DEELNEMERS) {
      setFout(`Dit potje heeft het maximum van ${MAX_DEELNEMERS} deelnemers bereikt.`)
      return
    }

    const bestaatAl = deelnemers.some(
      d => d.naam.toLowerCase() === naamTrimmed.toLowerCase()
    )
    if (bestaatAl) {
      setFout('Deze naam is al bezet in dit potje. Kies een andere naam.')
      return
    }

    setLaden(true)
    try {
      await onDeelnemen(naamTrimmed)
    } catch (error) {
      setFout(logFout(error, { component: 'ModalDeelnemen', actie: 'deelnemen' }))
    } finally {
      setLaden(false)
    }
  }

  // G4: bottom-sheet overlay, consistent met ModalTransactie en ModalSluiten
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

        {/* G1: onboarding context voor nieuwe gebruikers */}
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
            {fout && <div className="fout-tekst">{fout}</div>}
          </div>

          <button
            type="submit"
            className="knop knop-primair"
            disabled={laden || !naam.trim()}
          >
            {laden ? 'Bezig…' : 'Meedoen →'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ModalDeelnemen
