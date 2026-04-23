import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { usePotje } from '../hooks/usePotje'
import { logFout } from '../utils/logFout'
import { metTimeout } from '../utils/requestTimeout'
import { berekenSaldi } from '../utils/berekenSaldi'
import { formatBedrag, parseBedrag } from '../utils/formatBedrag'
import { slaagFormulierOp, laadFormulier, wisFormulier } from '../utils/formulierBuffer'
import { beperkDecimalen } from '../utils/valideer'
import { STANDAARD_VALUTA, MAX_BEDRAG } from '../constants'

// Standaardbedragen — primaire keuzemethode
const SNELBEDRAGEN = [5, 10, 20, 50]

/**
 * leesEnWisBuffer — lees de sessionStorage-buffer voor een potje-ID.
 *
 * B5: aangeroepen op module-niveau (buiten de component) zodat de waarde
 * beschikbaar is vóór de eerste render. laadFormulier() wist de buffer
 * direct na lezen — het aanbod is eenmalig per paginalaad.
 *
 * Wordt één keer per module-evaluatie aangeroepen; bij SPA-navigatie
 * terug naar dit scherm evalueert React Router de module opnieuw.
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

  const { potje, deelnemers, transacties, deelnemer, laden, fout } = usePotje(id)

  // B5: buffer één keer uitlezen via useState lazy initializer.
  // De initializer wordt alleen bij mount aangeroepen, niet bij re-renders.
  // leesEnWisBuffer() wist de buffer direct — eenmalig aanbod.
  const [bufferInit] = useState(() => leesEnWisBuffer(id))

  const [gekozenBedrag, setGekozenBedrag] = useState(null)
  const [vrijeInvoer, setVrijeInvoer] = useState(bufferInit.bedrag)
  const [vrijeInvoerActief, setVrijeInvoerActief] = useState(bufferInit.actief)
  const [invoerFout, setInvoerFout] = useState('')
  const [bezig, setBezig] = useState(false)
  const [bufferHersteld, setBufferHersteld] = useState(bufferInit.actief)
  const vrijeInvoerRef = useRef(null)

  // Dubbele-submit-guard (fix dubbelstorten 2026-04-13)
  const bezigRef = useRef(false)

  // WCAG 2.4.2: unieke paginatitel
  useEffect(() => { document.title = 'Storten — Digipot' }, [])

  const MAX = MAX_BEDRAG
  // SEC-4 fix (2026-04-16): STANDAARD_VALUTA uit constants.js i.p.v. hardcoded 'EUR'
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
    setVrijeInvoer(beperkDecimalen(e.target.value))
    setGekozenBedrag(null)
    setInvoerFout('')
    setBufferHersteld(false)
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

      // B5: submit geslaagd — verwijder eventuele buffer
      wisFormulier(`digipot:storten:${id}`)

      navigate(`/potje/${id}`, {
        state: {
          toast: {
            bericht: `Storting van ${formatBedrag(effectiefBedrag, valuta)} geregistreerd.`,
            type: 'ok',
          },
        },
      })
    } catch (e) {
      bezigRef.current = false
      const foutmelding = logFout(e, { component: 'PaginaStorten', actie: 'storten' })
      // B5: bij timeout of netwerkfout het bedrag bewaren zodat de gebruiker
      // het niet opnieuw hoeft in te voeren na verversen of terugnavigeren
      if (e.message?.includes('REQUEST_TIMEOUT') || e.message?.includes('fetch') || e.message?.includes('NetworkError')) {
        slaagFormulierOp(`digipot:storten:${id}`, { bedrag: effectiefBedrag })
      }
      setInvoerFout(foutmelding)
    } finally {
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
          {'\u2190'} Terug
        </button>
      </div>
    </div>
  )

  const mijnSaldi = berekenSaldi(deelnemers, transacties).deelnemersSaldi.find(s => s.id === deelnemer?.id)
  const reedGestort = mijnSaldi?.gestort ?? 0

  return (
    <div className="pagina">

      <div className="kaart">
        <div className="kaart-header">
          <button
            onClick={() => navigate(`/potje/${id}`)}
            className="knop-icoon"
            style={{ fontSize: '1.25rem', padding: '4px 0' }}
            aria-label="Terug naar overzicht"
          >
            {'\u2190'}
          </button>
          <h1 className="titel mb-0">{'\ud83d\udcb0'} Storten</h1>
        </div>
        <p className="subtitel subtitel-ingesprongen">
          {potje?.naam} {'\u00b7'} {deelnemer?.naam}
        </p>
      </div>

      {/* B5: melding dat het bedrag is hersteld na een eerdere mislukte poging */}
      {bufferHersteld && (
        <div className="kaart herstel-melding" role="status">
          <p className="herstel-melding__tekst">
            🔄 Je vorige bedrag is hersteld. Controleer het en probeer opnieuw te storten.
          </p>
        </div>
      )}

      {reedGestort > 0 && (
        <div className="kaart storten-al-gestort">
          <p className="storten-al-gestort__tekst">
            Je hebt tot nu toe <strong>{formatBedrag(reedGestort, valuta)}</strong> ingelegd.
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
            {'\u270f\ufe0f'} Ander bedrag invoeren
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
        {bedragGeldig && (
          <div className="storten-preview">
            <span className="storten-preview__label">Jouw storting</span>
            <span className="storten-preview__bedrag">
              {formatBedrag(effectiefBedrag, valuta)}
            </span>
          </div>
        )}

        <div className="modal-knoppen">
          <button type="button" className="knop knop-secundair flex-1" onClick={() => navigate(`/potje/${id}`)}>
            Annuleren
          </button>
          <button
            type="button"
            className="knop knop-primair flex-1"
            onClick={handleStorten}
            disabled={bezig || !bedragGeldig}
          >
            {bezig ? 'Bezig...' : bedragGeldig ? `${formatBedrag(effectiefBedrag, valuta)} storten →` : 'Storten →'}
          </button>
        </div>
      </div>



    </div>
  )
}

export default PaginaStorten
