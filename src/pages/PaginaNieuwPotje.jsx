import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { logFout } from '../utils/logFout'
import { valideerPotjeNaam } from '../utils/valideer'
import { MAX_NAAM, STANDAARD_VALUTA } from '../constants'

// MULTICURRENCY: valutakeuze tijdelijk verborgen.
// STANDAARD_VALUTA ('EUR') wordt altijd meegestuurd via hidden state.
// Heractiveringsinstructie: verwijder de comment hieronder en herstel het
// <div className="veld"> blok voor valutaselectie (zie git history of TO).

function PaginaNieuwPotje() {
  const navigate = useNavigate()
  const [naam, setNaam] = useState('')
  const [valuta] = useState(STANDAARD_VALUTA)   // vast EUR zolang multicurrency verborgen is
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

      const { error } = await supabase
        .from('potjes')
        .insert({ id: nieuweId, naam: naam.trim(), valuta })

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <h1 className="titel" style={{ marginBottom: 0 }}>🍺 Digipot</h1>
          <button
            onClick={() => navigate('/instellingen')}
            style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--grijs-500)', padding: '2px 0 0 0', lineHeight: 1 }}
            aria-label="Instellingen openen"
          >
            ⚙️
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
              placeholder="bijv. vrijmibo bij Arie"
              value={naam}
              onChange={e => { setNaam(e.target.value); setFout('') }}
              maxLength={MAX_NAAM}
              autoFocus
              autoComplete="off"
            />
            <div className="teller">{naam.length}/{MAX_NAAM}</div>
            {fout && <div className="fout-tekst">{fout}</div>}
          </div>

          {/*
            MULTICURRENCY — tijdelijk verborgen (zie opmerking bovenaan dit bestand).
            Valuta staat vast op EUR via state; geen zichtbaar veld nodig.

            Herstelblok (plak terug als multicurrency geactiveerd wordt):
            ────────────────────────────────────────────────────────────────
            import { MAX_NAAM, STANDAARD_VALUTA, VALUTA_OPTIES } from '../constants'
            const [valuta, setValuta] = useState(STANDAARD_VALUTA)

            <div className="veld">
              <label className="label" htmlFor="valuta">Valuta</label>
              <select
                id="valuta"
                className="select"
                value={valuta}
                onChange={e => setValuta(e.target.value)}
              >
                {VALUTA_OPTIES.map(opt => (
                  <option key={opt.waarde} value={opt.waarde}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="teller">Niet aanpasbaar na aanmaken</div>
            </div>
            ────────────────────────────────────────────────────────────────
          */}

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
