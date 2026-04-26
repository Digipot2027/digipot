import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { logFout } from '../utils/logFout'
import { logMelding } from '../utils/logMelding'
import { metTimeout } from '../utils/requestTimeout'
import { valideerPotjeNaam } from '../utils/valideer'
import { MAX_NAAM, STANDAARD_VALUTA } from '../constants'

/**
 * Lucide-migratie (2026-04-24): instellingen-SVG vervangen door SlidersHorizontal.
 */
function PaginaNieuwPotje() {
  const navigate = useNavigate()
  const [naam, setNaam] = useState('')
  const [valuta] = useState(STANDAARD_VALUTA)
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')

  useEffect(() => { document.title = 'Nieuw potje — Digipot' }, [])

  async function handleAanmaken(e) {
    e.preventDefault()
    setFout('')

    const validatieFout = valideerPotjeNaam(naam, { maxNaam: MAX_NAAM })
    if (validatieFout) {
      setFout(validatieFout)
      return
    }

    setLaden(true)
    try {
      const nieuweId = crypto.randomUUID()

      const { error } = await metTimeout(supabase
        .from('potjes')
        .insert({ id: nieuweId, naam: naam.trim(), valuta }))

      if (error) throw error

      logMelding('succes_potje_aangemaakt', { component: 'PaginaNieuwPotje' })
      navigate(`/potje/${nieuweId}`)
    } catch (error) {
      setFout(logFout(error, { component: 'PaginaNieuwPotje', actie: 'aanmaken' }))
    } finally {
      setLaden(false)
    }
  }

  return (
    <div className="pagina">
      <div className="kaart">
        <div className="pagina-header">
          <h1 className="titel" style={{ marginBottom: 0 }}>🍺 Digipot</h1>
          <button
            onClick={() => navigate('/instellingen')}
            className="knop-icoon"
            aria-label="Instellingen openen"
          >
            <SlidersHorizontal size={22} aria-hidden="true" strokeWidth={1.5} />
          </button>
        </div>
        <p className="subtitel">Start een nieuw groepspotje en deel de link met je vrienden.</p>

        <form onSubmit={handleAanmaken}>
          <div className="veld">
            <label className="label" htmlFor="naam">Naam van het potje</label>
            <input
              id="naam"
              className={`input ${fout ? 'fout' : ''}`}
              type="text"
              placeholder="bijv. vrijmibo"
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
