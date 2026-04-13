import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PROFIEL_NAAM_KEY, TEKSTGROOTTE_KEY, MAX_NAAM } from '../constants'
import { valideerProfielNaam, heeftProfielWijziging } from '../utils/tijdUtils'

const TEKSTGROOTTES = [
  { waarde: 'normaal', label: 'Normaal' },
  { waarde: 'groot', label: 'Groot' },
  { waarde: 'extra-groot', label: 'Extra groot' },
]

function PaginaProfiel() {
  const navigate = useNavigate()
  const opgeslagenNaam = localStorage.getItem(PROFIEL_NAAM_KEY) || ''
  const opgeslagenTekstgrootte = localStorage.getItem(TEKSTGROOTTE_KEY) || 'normaal'

  const [naam, setNaam] = useState(opgeslagenNaam)
  const [tekstgrootte, setTekstgrootte] = useState(opgeslagenTekstgrootte)
  const [opgeslagen, setOpgeslagen] = useState(false)
  const [fout, setFout] = useState('')

  // WCAG 2.4.2: unieke paginatitel
  useEffect(() => { document.title = 'Profiel — Digipot' }, [])

  // Bijgehouden als state zodat heeftWijziging correct reageert na opslaan/verwijderen.
  const [opgeslagenNaamState, setOpgeslagenNaamState] = useState(opgeslagenNaam)

  // WCAG-7: refs voor roving tabindex — alleen actieve radio in tabvolgorde
  const radioRefs = useRef([])

  function handleTekstgrootte(waarde, index) {
    setTekstgrootte(waarde)
    localStorage.setItem(TEKSTGROOTTE_KEY, waarde)
    document.documentElement.setAttribute('data-tekstgrootte', waarde)
    // Focus de nieuw geselecteerde radio zodat de toetsenbordgebruiker niet
    // de focus kwijtraakt na wijziging via pijltjestoets.
    radioRefs.current[index]?.focus()
  }

  function handleOpslaan(e) {
    e.preventDefault()
    setFout('')

    const { geldig, naamTrimmed, fout: validatieFout } = valideerProfielNaam(naam, MAX_NAAM)
    if (!geldig) {
      setFout(validatieFout)
      return
    }

    if (naamTrimmed) {
      localStorage.setItem(PROFIEL_NAAM_KEY, naamTrimmed)
    } else {
      localStorage.removeItem(PROFIEL_NAAM_KEY)
    }

    setOpgeslagenNaamState(naamTrimmed)
    setNaam(naamTrimmed)
    setOpgeslagen(true)
    setTimeout(() => setOpgeslagen(false), 2500)
  }

  function handleVerwijderen() {
    localStorage.removeItem(PROFIEL_NAAM_KEY)
    setOpgeslagenNaamState('')
    setNaam('')
    setOpgeslagen(false)
  }

  const heeftWijziging = heeftProfielWijziging(naam, opgeslagenNaamState)

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
        <p style={{ fontSize: '0.8125rem', color: 'var(--grijs-600)', marginBottom: 16 }}>
          De instelling wordt direct toegepast en onthouden.
        </p>

        {/*
          WCAG-7 / 4.1.2: roving tabindex patroon voor radiogroup.
          - Alleen de geselecteerde optie heeft tabIndex={0}; de rest tabIndex={-1}.
          - Pijltjestoetsen navigeren tussen opties en verplaatsen focus + selectie.
          - Dit is het correcte ARIA-patroon voor role="radiogroup" (APG).
        */}
        <div
          role="radiogroup"
          aria-label="Tekstgrootte kiezen"
          style={{ display: 'flex', gap: 10 }}
        >
          {TEKSTGROOTTES.map(({ waarde, label }, index) => {
            const actief = tekstgrootte === waarde
            return (
              <button
                key={waarde}
                ref={el => { radioRefs.current[index] = el }}
                role="radio"
                aria-checked={actief}
                tabIndex={actief ? 0 : -1}
                onKeyDown={e => {
                  // WCAG 4.1.2: pijltjestoets-navigatie binnen radiogroup
                  const richtingen = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']
                  if (!richtingen.includes(e.key)) return
                  e.preventDefault()
                  const stap = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1
                  const volgende = (index + stap + TEKSTGROOTTES.length) % TEKSTGROOTTES.length
                  handleTekstgrootte(TEKSTGROOTTES[volgende].waarde, volgende)
                }}
                onClick={() => handleTekstgrootte(waarde, index)}
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
          <p style={{ fontSize: '0.8125rem', color: 'var(--grijs-600)' }}>Potje · 3 deelnemers · €45,00</p>
        </div>
      </div>

      {/* Naam verwijderen */}
      {opgeslagenNaamState && (
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

      {!opgeslagenNaamState && (
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
