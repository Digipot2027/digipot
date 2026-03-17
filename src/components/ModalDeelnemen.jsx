import { useState } from 'react'
import { vertaalFout } from '../utils/vertaalFout'

function ModalDeelnemen({ potjeNaam, deelnemers, onDeelnemen }) {
  const [naam, setNaam] = useState('')
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')

  const MAX_NAAM = 30
  const MAX_DEELNEMERS = 20

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
      setFout(vertaalFout(error))
    } finally {
      setLaden(false)
    }
  }

  return (
    <div className="pagina">
      <div className="kaart">
        <h1 className="titel">🍺 {potjeNaam}</h1>
        <p className="subtitel">Vul je naam in om deel te nemen aan dit potje.</p>

        <form onSubmit={handleSubmit}>
          <div className="veld">
            <label className="label" htmlFor="naam">Jouw naam</label>
            <input
              id="naam"
              className={`input ${fout ? 'fout' : ''}`}
              type="text"
              placeholder="bijv. Jan"
              value={naam}
              onChange={e => { setNaam(e.target.value); setFout('') }}
              maxLength={MAX_NAAM}
              autoFocus
            />
            <div className="teller">{naam.length}/{MAX_NAAM}</div>
            {fout && <div className="fout-tekst">{fout}</div>}
          </div>

          <button
            type="submit"
            className="knop knop-primair"
            disabled={laden || !naam.trim()}
          >
            {laden ? 'Bezig...' : 'Meedoen →'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ModalDeelnemen
