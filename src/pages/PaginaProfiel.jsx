import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, User, Trash2 } from 'lucide-react'
import { PROFIEL_NAAM_KEY, TEKSTGROOTTE_KEY, MAX_NAAM } from '../constants'
import { getItem, setItem, removeItem } from '../utils/storage'

const TEKSTGROOTTES = [
  { waarde: 'normaal', label: 'Normaal' },
  { waarde: 'groot', label: 'Groot' },
  { waarde: 'extra-groot', label: 'Extra groot' },
]

/**
 * BUG-5 fix (2026-04-16): lege naam na trim leidt niet meer tot stille verwijdering.
 * Lucide-migratie (2026-04-24): 👤 → User, 🗑 → Trash2, ← → ChevronLeft.
 */
function PaginaProfiel() {
  const navigate = useNavigate()
  const opgeslagenNaam = getItem(PROFIEL_NAAM_KEY) || ''
  const opgeslagenTekstgrootte = getItem(TEKSTGROOTTE_KEY) || 'normaal'

  const [naam, setNaam] = useState(opgeslagenNaam)
  const [tekstgrootte, setTekstgrootte] = useState(opgeslagenTekstgrootte)
  const [opgeslagen, setOpgeslagen] = useState(false)
  const [fout, setFout] = useState('')
  const [opgeslagenNaamState, setOpgeslagenNaamState] = useState(opgeslagenNaam)

  useEffect(() => { document.title = 'Profiel — Digipot' }, [])

  const radioRefs = useRef([])

  function handleTekstgrootte(waarde, index) {
    setTekstgrootte(waarde)
    setItem(TEKSTGROOTTE_KEY, waarde)
    document.documentElement.setAttribute('data-tekstgrootte', waarde)
    radioRefs.current[index]?.focus()
  }

  function handleOpslaan(e) {
    e.preventDefault()
    setFout('')

    const naamTrimmed = naam.trim()

    if (naamTrimmed.length > MAX_NAAM) {
      setFout(`Je naam mag maximaal ${MAX_NAAM} tekens zijn.`)
      return
    }

    if (!naamTrimmed) {
      setFout('Vul een naam in of gebruik "Naam verwijderen" om je naam te wissen.')
      return
    }

    setItem(PROFIEL_NAAM_KEY, naamTrimmed)
    setOpgeslagenNaamState(naamTrimmed)
    setNaam(naamTrimmed)
    setOpgeslagen(true)
    setTimeout(() => setOpgeslagen(false), 2500)
  }

  function handleVerwijderen() {
    removeItem(PROFIEL_NAAM_KEY)
    setOpgeslagenNaamState('')
    setNaam('')
    setOpgeslagen(false)
    setFout('')
  }

  const heeftWijziging = naam.trim() !== opgeslagenNaamState

  return (
    <div className="pagina">

      {/* Header */}
      <div className="kaart">
        <div className="kaart-header">
          <button
            onClick={() => navigate(-1)}
            className="knop-icoon"
            style={{ fontSize: '1.25rem', padding: '4px 0' }}
            aria-label="Terug"
          >
            <ChevronLeft size={22} aria-hidden="true" strokeWidth={2} />
          </button>
          <h1 className="titel" style={{ marginBottom: 0 }}>
            <User size={20} aria-hidden="true" strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
            Profiel
          </h1>
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
              aria-describedby={fout ? 'profiel-naam-fout' : undefined}
              aria-invalid={fout ? 'true' : undefined}
            />
            <div className="teller">{naam.length}/{MAX_NAAM}</div>
            {fout && <div id="profiel-naam-fout" className="fout-tekst" role="alert">{fout}</div>}
          </div>

          <button
            type="submit"
            className="knop knop-primair"
            disabled={!heeftWijziging && !opgeslagen}
          >
            {opgeslagen ? '✓ Opgeslagen!' : 'Opslaan →'}
          </button>
        </form>
      </div>

      {/* Tekstgrootte */}
      <div className="kaart">
        <h2 className="text-base font-semibold mb-1">Tekstgrootte</h2>
        <p className="text-sm tekst-grijs-6 mb-4">
          De instelling wordt direct toegepast en onthouden.
        </p>

        <div
          role="radiogroup"
          aria-label="Tekstgrootte kiezen"
          className="flex gap-2"
        >
          {TEKSTGROOTTES.map(({ waarde, label }, index) => {
            const actief = tekstgrootte === waarde
            const letterKlasse = waarde === 'normaal'
              ? 'tekstgrootte-knop__letter--normaal'
              : waarde === 'groot'
              ? 'tekstgrootte-knop__letter--groot'
              : 'tekstgrootte-knop__letter--extra'
            return (
              <button
                key={waarde}
                ref={el => { radioRefs.current[index] = el }}
                role="radio"
                aria-checked={actief}
                tabIndex={actief ? 0 : -1}
                onKeyDown={e => {
                  const richtingen = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']
                  if (!richtingen.includes(e.key)) return
                  e.preventDefault()
                  const stap = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1
                  const volgende = (index + stap + TEKSTGROOTTES.length) % TEKSTGROOTTES.length
                  handleTekstgrootte(TEKSTGROOTTES[volgende].waarde, volgende)
                }}
                onClick={() => handleTekstgrootte(waarde, index)}
                className={`tekstgrootte-knop${actief ? ' tekstgrootte-knop--actief' : ''}`}
              >
                <div className={letterKlasse}>A</div>
                <div>{label}</div>
              </button>
            )
          })}
        </div>

      </div>

      {/* Naam verwijderen */}
      {opgeslagenNaamState && (
        <div className="kaart info-kaart">
          <p className="text-sm tekst-grijs-6 mb-3">
            Je naam wordt lokaal opgeslagen op dit apparaat. Er worden geen persoonlijke gegevens verstuurd.
          </p>
          <button
            type="button"
            className="knop knop-secundair"
            onClick={handleVerwijderen}
          >
            <Trash2 size={14} aria-hidden="true" strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
            Naam verwijderen
          </button>
        </div>
      )}

      {!opgeslagenNaamState && (
        <div className="kaart info-kaart">
          <p className="text-sm tekst-grijs-6">
            Je naam wordt lokaal opgeslagen op dit apparaat. Er worden geen persoonlijke gegevens verstuurd.
          </p>
        </div>
      )}

    </div>
  )
}

export default PaginaProfiel
