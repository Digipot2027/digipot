import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { logFout } from '../utils/logFout'

function PaginaNieuwPotje() {
  const navigate = useNavigate()
  const [naam, setNaam] = useState('')
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')

  const MAX_NAAM = 30 // K1: overeenkomstig DB-constraint potjes.naam

  async function handleAanmaken(e) {
    e.preventDefault()
    setFout('')

    const naamTrimmed = naam.trim()
    if (!naamTrimmed) {
      setFout('Geef het potje een naam.')
      return
    }
    if (naamTrimmed.length > MAX_NAAM) {
      setFout(`De naam van het potje mag maximaal ${MAX_NAAM} tekens zijn.`)
      return
    }

    setLaden(true)
    try {
      const { data, error } = await supabase
        .from('potjes')
        .insert({ naam: naamTrimmed })
        .select()
        .single()

      if (error) throw error
      navigate(`/potje/${data.id}`)
    } catch (error) {
      setFout(logFout(error, { component: 'PaginaNieuwPotje', actie: 'aanmaken' }))
    } finally {
      setLaden(false)
    }
  }

  return (
    <div className="pagina">
      <div className="kaart">
        <h1 className="titel">🍺 Digipot</h1>
        <p className="subtitel">Start een nieuw groepspotje en deel de link met je vrienden.</p>

        <form onSubmit={handleAanmaken}>
          <div className="veld">
            <label className="label" htmlFor="naam">Naam van het potje</label>
            <input
              id="naam"
              className={`input ${fout ? 'fout' : ''}`}
              type="text"
              placeholder="bijv. Vakantie Spanje 2026"
              value={naam}
              onChange={e => { setNaam(e.target.value); setFout('') }}
              maxLength={MAX_NAAM}
              autoFocus
              autoComplete="off"
            />
            <div className="teller">{naam.length}/{MAX_NAAM}</div>
            {fout && <div className="fout-tekst">{fout}</div>}
          </div>

          <button
            type="submit"
            className="knop knop-primair"
            disabled={laden || !naam.trim()}
          >
            {laden ? 'Bezig...' : 'Potje aanmaken →'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default PaginaNieuwPotje
