import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, RotateCcw } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { usePotje } from '../hooks/usePotje'
import { logFout } from '../utils/logFout'
import { metTimeout } from '../utils/requestTimeout'
import { formatBedrag, parseBedrag } from '../utils/formatBedrag'
import { slaagFormulierOp, laadFormulier, wisFormulier } from '../utils/formulierBuffer'
import { beperkDecimalen, valideerBedragRealtime } from '../utils/valideer'
import { STANDAARD_VALUTA, MAX_BEDRAG } from '../constants'

const SNELBEDRAGEN = [5, 10, 20, 50]

/**
 * Lucide-migratie (2026-04-24): ← → ChevronLeft, 🔄 → RotateCcw.
 * Storten-knop gebruikt ArrowUp consistent met overzichtscherm.
 */
function leesEnWisBuffer(potjeId) {
  if (!potjeId) return { bedrag: '', actief: false }
  const herstel = laadFormulier(`digipot:storten:${potjeId}`)
  if (herstel?.bedrag) {
    return { bedrag: String(herstel.bedrag).replace('.', ','), actief: true }
  }
  return { bedrag: '', actief: false }
}

function PaginaStorten() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { potje, deelnemer, laden, fout } = usePotje(id)

  const [bufferInit] = useState(() => leesEnWisBuffer(id))

  const [gekozenBedrag, setGekozenBedrag] = useState(null)
  const [vrijeInvoer, setVrijeInvoer] = useState(bufferInit.bedrag)
  const [vrijeInvoerActief, setVrijeInvoerActief] = useState(bufferInit.actief)
  const [invoerFout, setInvoerFout] = useState('')
  const [bezig, setBezig] = useState(false)
  const [geslaagd, setGeslaagd] = useState(false)
  const [bufferHersteld, setBufferHersteld] = useState(bufferInit.actief)
  const vrijeInvoerRef = useRef(null)

  const bezigRef = useRef(false)

  useEffect(() => { document.title = 'Storten — Digipot' }, [])

  const MAX = MAX_BEDRAG
  const valuta = potje?.valuta ?? STANDAARD_VALUTA

  useEffect(() => {
    if (vrijeInvoerActief) {
      setTimeout(() => vrijeInvoerRef.current?.focus(), 50)
    }
  }, [vrijeInvoerActief])

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
    setBufferHersteld(false)
  }

  function handleVrijeInvoerToggle() {
    setVrijeInvoerActief(true)
    setGekozenBedrag(null)
    setInvoerFout('')
  }

  function handleVrijeInvoerWijziging(e) {
    const nieuw = beperkDecimalen(e.target.value)
    setVrijeInvoer(nieuw)
    setGekozenBedrag(null)
    setBufferHersteld(false)

    const realtimeFout = valideerBedragRealtime(nieuw, MAX)
    setInvoerFout(realtimeFout ?? '')
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

    if (bezigRef.current) return
    bezigRef.current = true

    const deelnemerId = deelnemer?.id
    if (!deelnemerId) {
      bezigRef.current = false
      setInvoerFout('Je bent geen deelnemer van dit potje.')
      return
    }

    if (deelnemer?.actief === false) {
      bezigRef.current = false
      setInvoerFout('Je hebt je afgemeld en kunt niet meer storten.')
      return
    }

    if (potje?.status === 'gesloten') {
      bezigRef.current = false
      setInvoerFout('Dit potje is gesloten.')
      return
    }

    setBezig(true)
    try {
      const idempotencyKey = crypto.randomUUID()
      const { error } = await metTimeout(supabase
        .from('transacties')
        .insert({ potje_id: id, deelnemer_id: deelnemerId, type: 'storting', bedrag: effectiefBedrag, idempotency_key: idempotencyKey }))
      if (error) throw error

      wisFormulier(`digipot:storten:${id}`)

      setGeslaagd(true)
      setTimeout(() => {
        bezigRef.current = false
        navigate(`/potje/${id}`)
      }, 1200)
    } catch (e) {
      bezigRef.current = false
      const foutmelding = logFout(e, { component: 'PaginaStorten', actie: 'storten' })
      if (e.message?.includes('REQUEST_TIMEOUT') || e.message?.includes('fetch') || e.message?.includes('NetworkError')) {
        slaagFormulierOp(`digipot:storten:${id}`, { bedrag: effectiefBedrag })
      }
      setInvoerFout(foutmelding)
      setBezig(false)
    }
  }

  if (laden) return (
    <div className="pagina">
      <div className="kaart">
        <div className="skeleton skeleton-titel" />
        <div className="skeleton skeleton-subtitel" />
      </div>
      <div className="kaart">
        <div className="snelkeuze-grid">
          {SNELBEDRAGEN.map(b => (
            <div key={b} className="skeleton skeleton-knop" />
          ))}
        </div>
        <div className="skeleton skeleton-knop" />
      </div>
    </div>
  )

  if (fout) return (
    <div className="pagina">
      <div className="kaart">
        <p className="tekst-rood">{fout}</p>
        <button className="knop knop-secundair mt-4" onClick={() => navigate(`/potje/${id}`)}>
          <ChevronLeft size={16} aria-hidden="true" strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          Terug
        </button>
      </div>
    </div>
  )

  return (
    <div className="pagina">

      <div className="kaart">
        <div className="kaart-header">
          <button
            onClick={() => navigate(`/potje/${id}`)}
            className="knop-icoon"
            style={{ fontSize: '1.25rem', padding: '4px 0', minHeight: '44px', minWidth: '44px' }}
            aria-label="Terug naar overzicht"
          >
            <ChevronLeft size={22} aria-hidden="true" strokeWidth={2} />
          </button>
          <h1 className="titel mb-0">Storten</h1>
        </div>
        <p className="subtitel subtitel-ingesprongen">
          {potje?.naam}
        </p>
      </div>

      {bufferHersteld && (
        <div className="kaart herstel-melding" role="status">
          <p className="herstel-melding__tekst">
            <RotateCcw size={14} aria-hidden="true" strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
            Je vorige bedrag is hersteld. Controleer het en probeer opnieuw te storten.
          </p>
        </div>
      )}

      <div className="kaart">
        <p className="label mb-3">Kies een bedrag</p>

        <div
          role="group"
          aria-label="Standaardbedragen"
          className="snelkeuze-grid"
        >
          {SNELBEDRAGEN.map(bedrag => {
            const actief = gekozenBedrag === bedrag
            return (
              <button
                key={bedrag}
                type="button"
                onClick={() => handleSnelkeuze(bedrag)}
                aria-pressed={actief}
                className={`snelkeuze-knop${actief ? ' snelkeuze-knop--actief' : ''}`}
              >
                {formatBedrag(bedrag, valuta)}
              </button>
            )
          })}
        </div>

        {!vrijeInvoerActief ? (
          <button
            type="button"
            className="knop knop-secundair text-sm"
            onClick={handleVrijeInvoerToggle}
          >
            Ander bedrag
          </button>
        ) : (
          <div className="veld mb-0">
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
              aria-describedby={invoerFout && vrijeInvoerActief ? 'vrij-bedrag-fout' : undefined}
              aria-invalid={invoerFout && vrijeInvoerActief ? 'true' : undefined}
            />
          </div>
        )}

        {invoerFout && (
          <div
            id={vrijeInvoerActief ? 'vrij-bedrag-fout' : undefined}
            className="fout-tekst mt-2"
            role="alert"
          >
            {invoerFout}
          </div>
        )}
      </div>

      <div className="kaart">
        <div className="modal-knoppen--gestapeld">
          <button
            type="button"
            className={`knop ${geslaagd ? 'knop-primair' : bedragGeldig ? 'knop-primair' : 'knop-bevestig-inactief'}`}
            onClick={handleStorten}
            disabled={bezig || geslaagd}
          >
            {geslaagd
              ? `✓ ${formatBedrag(effectiefBedrag, valuta)} gestort`
              : bezig
                ? 'Bezig...'
                : bedragGeldig
                  ? `${formatBedrag(effectiefBedrag, valuta)} storten →`
                  : 'Storten →'}
          </button>
          <button type="button" className="knop knop-sheet-annuleer" onClick={() => navigate(`/potje/${id}`)}>
            Annuleren
          </button>
        </div>
      </div>

    </div>
  )
}

export default PaginaStorten
