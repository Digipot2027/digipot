import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const PROFIEL_NAAM_KEY = 'digipot_profiel_naam'
const TEKSTGROOTTE_KEY = 'digipot_tekstgrootte'
const MAX_NAAM = 30

const TEKSTGROOTTES = [
  { waarde: 'normaal', label: 'Normaal', voorbeeld: '16px' },
  { waarde: 'groot', label: 'Groot', voorbeeld: '19px' },
  { waarde: 'extra-groot', label: 'Extra groot', voorbeeld: '22px' },
]

function PaginaProfiel() {
  const navigate = useNavigate()
  const opgeslagenNaam = localStorage.getItem(PROFIEL_NAAM_KEY) || ''
  const opgeslagenTekstgrootte = localStorage.getItem(TEKSTGROOTTE_KEY) || 'normaal'

  const [naam, setNaam] = useState(opgeslagenNaam)
  const [tekstgrootte, setTekstgrootte] = useState(opgeslagenTekstgrootte)
  const [opgeslagen, setOpgeslagen] = useState(false)
  const [fout, setFout] = useState('')
  // useRef zodat opgeslagenNaam synchroon bijgewerkt wordt na opslaan,
  // zonder een re-render te triggeren. Voorkomt dat heeftWijziging de
  // knop incorrect enabled/disabled toont na opslaan.
  const opgeslagenNaamRef = useRef(opgeslagenNaam)

  function handleTekstgrootte(waarde) {
    setTekstgrootte(waarde)
    localStorage.setItem(TEKSTGROOTTE_KEY, waarde)
    document.documentElement.setAttribute('data-tekstgrootte', waarde)
  }

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

    opgeslagenNaamRef.current = naamTrimmed // synchroon bijwerken
    setNaam(naamTrimmed)
    setOpgeslagen(true)
    setTimeout(() => setOpgeslagen(false), 2500)
  }

  function handleVerwijderen() {
    localStorage.removeItem(PROFIEL_NAAM_KEY)
    opgeslagenNaamRef.current = '' // synchroon bijwerken
    setNaam('')
    setOpgeslagen(false)
  }

  const heeftWijziging = naam.trim() !== opgeslagenNaamRef.current

  return (
    <div className="pagina">

      {/* Header */}
      <div className="kaart">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--grijs-600)', padding: '4px 0', lineHeight: 1 }}
            aria-label="Terug"
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

      {/* Tekstgrootte */}
      <div className="kaart">
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>Tekstgrootte</h2>
        <p style={{ fontSize: '0.8125rem', color: 'var(--grijs-400)', marginBottom: 16 }}>
          De instelling wordt direct toegepast en onthouden.
        </p>
        <div
          role="radiogroup"
          aria-label="Tekstgrootte kiezen"
          style={{ display: 'flex', gap: 10 }}
        >
          {TEKSTGROOTTES.map(({ waarde, label }) => {
            const actief = tekstgrootte === waarde
            return (
              <button
                key={waarde}
                role="radio"
                aria-checked={actief}
                onClick={() => handleTekstgrootte(waarde)}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  borderRadius: 8,
                  border: actief ? '2px solid var(--blauw)' : '1.5px solid var(--grijs-200)',
                  background: actief ? '#eff6ff' : 'var(--grijs-50)',
                  color: actief ? 'var(--blauw)' : 'var(--grijs-900)',
                  fontWeight: actief ? 700 : 400,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  textAlign: 'center',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: waarde === 'normaal' ? '1rem' : waarde === 'groot' ? '1.25rem' : '1.5rem', marginBottom: 4 }}>A</div>
                <div>{label}</div>
              </button>
            )
          })}
        </div>

        {/* Live voorbeeld */}
        <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--grijs-50)', borderRadius: 8, border: '1px solid var(--grijs-200)' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--grijs-600)', marginBottom: 4 }}>Voorbeeld:</p>
          <p style={{ fontSize: '1rem' }}>Vakantie Spanje 2026</p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--grijs-400)' }}>Potje · 3 deelnemers · €45,00</p>
        </div>
      </div>

      {/* Naam verwijderen */}
      {opgeslagenNaam && (
        <div className="kaart" style={{ background: 'var(--grijs-50)', border: '1px solid var(--grijs-200)' }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--grijs-600)', marginBottom: 12 }}>
            Je naam wordt lokaal opgeslagen op dit apparaat. Er worden geen persoonlijke gegevens verstuurd.
          </p>
          <button
            type="button"
            className="knop knop-secundair"
            onClick={handleVerwijderen}
          >
            🗑 Naam verwijderen
          </button>
        </div>
      )}

      {!opgeslagenNaam && (
        <div className="kaart" style={{ background: 'var(--grijs-50)', border: '1px solid var(--grijs-200)' }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--grijs-600)' }}>
            Je naam wordt lokaal opgeslagen op dit apparaat. Er worden geen persoonlijke gegevens verstuurd.
          </p>
        </div>
      )}

    </div>
  )
}

export default PaginaProfiel
