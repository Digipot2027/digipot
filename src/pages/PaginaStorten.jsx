import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { usePotje } from '../hooks/usePotje'
import { logFout } from '../utils/logFout'
import { berekenSaldi } from '../utils/berekenSaldi'
import { formatBedrag, parseBedrag } from '../utils/formatBedrag'

// Standaardbedragen — primaire keuzemethode
const SNELBEDRAGEN = [5, 10, 20, 50]

function PaginaStorten() {
  const { id } = useParams()
  const navigate = useNavigate()

  // Data via usePotje — eigen formulierlogica blijft in deze component
  const { potje, deelnemers, transacties, deelnemer, laden, fout } = usePotje(id)

  // Bedragselectie
  const [gekozenBedrag, setGekozenBedrag] = useState(null)
  const [vrijeInvoer, setVrijeInvoer] = useState('')
  const [vrijeInvoerActief, setVrijeInvoerActief] = useState(false)
  const [invoerFout, setInvoerFout] = useState('')
  const [bezig, setBezig] = useState(false)
  const vrijeInvoerRef = useRef(null)

  // WCAG 2.4.2: unieke paginatitel
  useEffect(() => { document.title = 'Storten — Digipot' }, [])

  const MAX = 999.99
  const valuta = potje?.valuta ?? 'EUR'

  // Focus vrij invoerveld zodra het zichtbaar wordt
  useEffect(() => {
    if (vrijeInvoerActief) {
      setTimeout(() => vrijeInvoerRef.current?.focus(), 50)
    }
  }, [vrijeInvoerActief])

  // Bepaal het te storten bedrag: snelkeuze heeft prioriteit, anders vrije invoer
  const vrijeInvoerNum = parseBedrag(vrijeInvoer)
  const effectiefBedrag = gekozenBedrag !== null
    ? gekozenBedrag
    : (vrijeInvoerActief && vrijeInvoer.trim() ? vrijeInvoerNum : null)

  const bedragGeldig = effectiefBedrag !== null
    && !isNaN(effectiefBedrag)
    && effectiefBedrag > 0
    && effectiefBedrag <= MAX

  function handleSnelkeuze(bedrag) {
    setGekozenBedrag(bedrag)
    setVrijeInvoer('')
    setVrijeInvoerActief(false)
    setInvoerFout('')
  }

  function handleVrijeInvoerToggle() {
    setVrijeInvoerActief(true)
    setGekozenBedrag(null)
    setInvoerFout('')
  }

  function handleVrijeInvoerWijziging(e) {
    setVrijeInvoer(e.target.value)
    setGekozenBedrag(null)
    setInvoerFout('')
  }

  async function handleStorten() {
    setInvoerFout('')

    if (!bedragGeldig) {
      if (effectiefBedrag !== null && effectiefBedrag > MAX) {
        setInvoerFout('Het maximale bedrag per storting is €999,99.')
      } else {
        setInvoerFout('Kies een bedrag of voer een bedrag in.')
      }
      return
    }

    if (!deelnemer) {
      setInvoerFout('Je bent geen deelnemer van dit potje.')
      return
    }

    if (potje?.status === 'gesloten') {
      setInvoerFout('Dit potje is gesloten.')
      return
    }

    setBezig(true)
    try {
      // SEC-H1 (2026-04-04): destructureer altijd de error uit de Supabase-response.
      // Zonder deze check werd een RLS-fout, netwerk-fout of constraint-schending
      // stil genegeerd: navigate() werd toch aangeroepen en de gebruiker zag een
      // valse succesmelding terwijl de storting nooit in de database was opgeslagen.
      // .select()/.single() zijn verwijderd: de returnwaarde is niet nodig voor
      // navigatie, en .single() gooide zelf een fout bij 0 rijen (wat het probleem
      // maskeerde in plaats van zichtbaar te maken).
      const { error } = await supabase
        .from('transacties')
        .insert({ potje_id: id, deelnemer_id: deelnemer.id, type: 'storting', bedrag: effectiefBedrag })
      if (error) throw error

      navigate(`/potje/${id}`, {
        state: {
          toast: {
            bericht: `Storting van ${formatBedrag(effectiefBedrag, valuta)} geregistreerd.`,
            type: 'ok',
          },
        },
      })
    } catch (e) {
      setInvoerFout(logFout(e, { component: 'PaginaStorten', actie: 'storten' }))
    } finally {
      setBezig(false)
    }
  }

  // ── Skeleton loader ───────────────────────────────────────────────────────────
  if (laden) return (
    <div className="pagina">
      <div className="kaart">
        <div className="skeleton" style={{ height: 28, width: '60%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 16, width: '40%' }} />
      </div>
      <div className="kaart">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          {SNELBEDRAGEN.map(b => (
            <div key={b} className="skeleton" style={{ height: 64 }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 48 }} />
      </div>
    </div>
  )

  if (fout) return (
    <div className="pagina">
      <div className="kaart">
        <p style={{ color: 'var(--rood)' }}>{fout}</p>
        <button
          className="knop knop-secundair"
          style={{ marginTop: 16 }}
          onClick={() => navigate(`/potje/${id}`)}
        >
          ← Terug
        </button>
      </div>
    </div>
  )

  const saldi = berekenSaldi(deelnemers, transacties)
  const mijnSaldi = saldi.deelnemersSaldi.find(s => s.id === deelnemer?.id)
  const reedGestort = mijnSaldi?.gestort ?? 0

  return (
    <div className="pagina">

      {/* Header */}
      <div className="kaart">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <button
            onClick={() => navigate(`/potje/${id}`)}
            style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', padding: '4px 0', color: 'var(--grijs-600)', lineHeight: 1 }}
            aria-label="Terug naar overzicht"
          >
            ←
          </button>
          <h1 className="titel" style={{ marginBottom: 0 }}>💰 Storten</h1>
        </div>
        <p className="subtitel" style={{ marginBottom: 0, paddingLeft: 36 }}>
          {potje?.naam} · {deelnemer?.naam}
        </p>
      </div>

      {/* Al gestort */}
      {reedGestort > 0 && (
        <div className="kaart" style={{ background: 'var(--groen-licht)', border: '1px solid #bbf7d0' }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--groen)', fontWeight: 500 }}>
            Je hebt tot nu toe <strong>{formatBedrag(reedGestort, valuta)}</strong> ingelegd.
          </p>
        </div>
      )}

      {/* Bedragkeuze */}
      <div className="kaart">
        <p className="label" style={{ marginBottom: 12 }}>Kies een bedrag</p>

        {/* Snelknoppen — primaire methode */}
        <div
          role="group"
          aria-label="Standaardbedragen"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}
        >
          {SNELBEDRAGEN.map(bedrag => {
            const actief = gekozenBedrag === bedrag
            return (
              <button
                key={bedrag}
                type="button"
                onClick={() => handleSnelkeuze(bedrag)}
                aria-pressed={actief}
                style={{
                  padding: '16px 12px',
                  borderRadius: 10,
                  border: actief ? '2px solid var(--groen)' : '1.5px solid var(--grijs-200)',
                  background: actief ? 'var(--groen-licht)' : 'var(--grijs-50)',
                  color: actief ? 'var(--groen)' : 'var(--grijs-900)',
                  fontWeight: actief ? 700 : 500,
                  fontSize: '1.125rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textAlign: 'center',
                  minHeight: 64,
                }}
              >
                {formatBedrag(bedrag, valuta)}
              </button>
            )
          })}
        </div>

        {/* Vrij bedrag — aanvulling */}
        {!vrijeInvoerActief ? (
          <button
            type="button"
            className="knop knop-secundair"
            style={{ fontSize: '0.875rem' }}
            onClick={handleVrijeInvoerToggle}
          >
            ✏️ Ander bedrag invoeren
          </button>
        ) : (
          <div className="veld" style={{ marginBottom: 0 }}>
            <label className="label" htmlFor="vrij-bedrag">
              Ander bedrag ({valuta})
            </label>
            <input
              id="vrij-bedrag"
              ref={vrijeInvoerRef}
              className={`input ${invoerFout && vrijeInvoerActief ? 'fout' : ''}`}
              type="text"
              inputMode="decimal"
              placeholder="bijv. 35,00"
              value={vrijeInvoer}
              onChange={handleVrijeInvoerWijziging}
              autoComplete="off"
            />
            {vrijeInvoerActief && vrijeInvoerNum > 0 && !invoerFout && (
              <div className="teller" style={{ color: 'var(--groen)' }}>
                = {formatBedrag(vrijeInvoerNum, valuta)}
              </div>
            )}
          </div>
        )}

        {invoerFout && (
          <div className="fout-tekst" style={{ marginTop: 8 }}>{invoerFout}</div>
        )}
      </div>

      {/* Samenvatting + bevestigen */}
      <div className="kaart">
        {bedragGeldig && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 14px',
            background: 'var(--groen-licht)',
            borderRadius: 8,
            marginBottom: 14,
            border: '1px solid #bbf7d0',
          }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--groen)', fontWeight: 500 }}>
              Jouw storting
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--groen)' }}>
              {formatBedrag(effectiefBedrag, valuta)}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="knop knop-secundair"
            style={{ flex: 1 }}
            onClick={() => navigate(`/potje/${id}`)}
          >
            Annuleren
          </button>
          <button
            type="button"
            className="knop knop-primair"
            style={{ flex: 1 }}
            onClick={handleStorten}
            disabled={bezig || !bedragGeldig}
          >
            {bezig ? 'Bezig...' : 'Storten →'}
          </button>
        </div>
      </div>

      {/* Pot info */}
      <div className="kaart" style={{ background: 'var(--grijs-50)', border: '1px solid var(--grijs-200)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
          <span style={{ color: 'var(--grijs-600)' }}>Huidig potsaldo</span>
          <strong style={{ color: saldi.potSaldo > 0 ? 'var(--groen)' : 'var(--grijs-600)' }}>
            {formatBedrag(saldi.potSaldo, valuta)}
          </strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginTop: 8 }}>
          <span style={{ color: 'var(--grijs-600)' }}>Totaal ingelegd</span>
          <strong>{formatBedrag(saldi.potTotaal, valuta)}</strong>
        </div>
      </div>

    </div>
  )
}

export default PaginaStorten
