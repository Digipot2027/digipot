import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { logFout } from '../utils/logFout'
import { metTimeout } from '../utils/requestTimeout'
import { valideerPotjeNaam } from '../utils/valideer'
import { MAX_NAAM, STANDAARD_VALUTA } from '../constants'

function PaginaNieuwPotje() {
  const navigate = useNavigate()
  const [naam, setNaam] = useState('')
  const [valuta] = useState(STANDAARD_VALUTA)
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')

  // WCAG 2.4.2: unieke paginatitel per scherm
  useEffect(() => { document.title = 'Nieuw potje — Digipot' }, [])

  async function handleAanmaken(e) {
    e.preventDefault()
    setFout('')

    // Validatie via geëxtraheerde pure functie — unit-testbaar zonder React
    const validatieFout = valideerPotjeNaam(naam, { maxNaam: MAX_NAAM })
    if (validatieFout) {
      setFout(validatieFout)
      return
    }

    setLaden(true)
    try {
      // Hoog-4 fix (2026-04-12): potje-ID client-side genereren zodat we na de
      // INSERT niet afhankelijk zijn van .select().single() voor de navigatie.
      //
      // Oud gedrag: .insert(...).select().single() — als de RLS-policy de SELECT
      // na de INSERT blokkeerde, gooide .single() PGRST116. Die fout werd (na de
      // PGRST116-fix) vertaald als "Dit potje bestaat niet of is verwijderd" —
      // terwijl het potje net succesvol was aangemaakt.
      //
      // Nieuw gedrag: UUID client-side aanmaken via crypto.randomUUID() en als
      // `id` meesturen in de INSERT. Na een succesvolle INSERT navigeren we direct
      // naar /potje/:id zonder terug te hoeven lezen uit de DB.
      // crypto.randomUUID() is beschikbaar in alle moderne browsers en in Node.js ≥ 14.
      const nieuweId = crypto.randomUUID()

      const { error } = await metTimeout(supabase
        .from('potjes')
        .insert({ id: nieuweId, naam: naam.trim(), valuta }))

      if (error) throw error
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
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <line x1="2" y1="5" x2="20" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="8" cy="5" r="2.5" fill="white" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="2" y1="11" x2="20" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="14" cy="11" r="2.5" fill="white" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="2" y1="17" x2="20" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="9" cy="17" r="2.5" fill="white" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
        </div>
        <p className="subtitel">Start een nieuw groepspotje en deel de link met je vrienden.</p>

        <form onSubmit={handleAanmaken}>

          {/* Potjenaam */}
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
