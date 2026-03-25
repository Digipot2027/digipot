import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const PROFIEL_NAAM_KEY = 'digipot_profiel_naam'
const MAX_NAAM = 30

function PaginaProfiel() {
  const navigate = useNavigate()
  const opgeslagenNaam = localStorage.getItem(PROFIEL_NAAM_KEY) || ''

  const [naam, setNaam] = useState(opgeslagenNaam)
  const [opgeslagen, setOpgeslagen] = useState(false)
  const [fout, setFout] = useState('')

  function handleOpslaan(e) {
    e.preventDefault()
    setFout('')

    const naamTrimmed = naam.trim()

    if (naamTrimmed.length > MAX_NAAM) {
      setFout(`Je naam mag maximaal ${MAX_NAAM} tekens zijn.`)
      return
    }

    if (naamTrimmed) {
      localStorage.setItem(PROFIEL_NAAM_KEY, naamTrimmed)
    } else {
      localStorage.removeItem(PROFIEL_NAAM_KEY)
    }

    setNaam(naamTrimmed)
    setOpgeslagen(true)
    setTimeout(() => setOpgeslagen(false), 2500)
  }

  function handleVerwijderen() {
    localStorage.removeItem(PROFIEL_NAAM_KEY)
    setNaam('')
    setOpgeslagen(false)
  }

  const heeftWijziging = naam.trim() !== opgeslagenNaam

  return (
    <div className="pagina">

      {/* Header */}
      <div className="kaart">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <button
            onClick={() => navigate('/instellingen')}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--grijs-600)', padding: '4px 0', lineHeight: 1 }}
            aria-label="Terug naar instellingen"
          >
            ←
          </button>
          <h1 className="titel" style={{ marginBottom: 0 }}>👤 Profiel</h1>
        </div>
        <p className="subtitel" style={{ marginBottom: 0, paddingLeft: 36 }}>
          Je naam wordt automatisch ingevuld als je meedoet aan een nieuw potje.
        </p>
      </div>

      {/* Naam formulier */}
      <div className="kaart">
        <form onSubmit={handleOpslaan}>
          <div className="veld">
            <label className="label" htmlFor="profiel-naam">Jouw naam</label>
            <input
              id="profiel-naam"
              className={`input ${fout ? 'fout' : ''}`}
              type="text"
              placeholder="bijv. Jan"
              value={naam}
              onChange={e => { setNaam(e.target.value); setFout(''); setOpgeslagen(false) }}
              maxLength={MAX_NAAM}
              autoComplete="nickname"
              autoFocus
            />
            <div className="teller">{naam.length}/{MAX_NAAM}</div>
            {fout && <div className="fout-tekst">{fout}</div>}
          </div>

          <button
            type="submit"
            className="knop knop-primair"
            disabled={!heeftWijziging && !opgeslagen}
          >
            {opgeslagen ? '✅ Opgeslagen!' : 'Opslaan →'}
          </button>
        </form>
      </div>

      {/* Naam verwijderen — alleen tonen als er een naam is opgeslagen */}
      {opgeslagenNaam && (
        <div className="kaart" style={{ background: 'var(--grijs-50)', border: '1px solid var(--grijs-200)' }}>
          <p style={{ fontSize: 13, color: 'var(--grijs-600)', marginBottom: 12 }}>
            Je naam wordt lokaal opgeslagen op dit apparaat. Er worden geen persoonlijke gegevens verstuurd.
          </p>
          <button
            type="button"
            className="knop knop-secundair"
            style={{ fontSize: 14 }}
            onClick={handleVerwijderen}
          >
            🗑 Naam verwijderen
          </button>
        </div>
      )}

      {/* Uitleg als er nog geen naam is */}
      {!opgeslagenNaam && (
        <div className="kaart" style={{ background: 'var(--grijs-50)', border: '1px solid var(--grijs-200)' }}>
          <p style={{ fontSize: 13, color: 'var(--grijs-600)' }}>
            Je naam wordt lokaal opgeslagen op dit apparaat. Er worden geen persoonlijke gegevens verstuurd.
          </p>
        </div>
      )}

    </div>
  )
}

export default PaginaProfiel
