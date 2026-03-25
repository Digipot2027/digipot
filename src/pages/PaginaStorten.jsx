import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { logFout } from '../utils/logFout'
import { berekenSaldi } from '../utils/berekenSaldi'
import { formatBedrag, parseBedrag } from '../utils/formatBedrag'

function PaginaStorten() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [potje, setPotje] = useState(null)
  const [deelnemers, setDeelnemers] = useState([])
  const [transacties, setTransacties] = useState([])
  const [deelnemer, setDeelnemer] = useState(null)
  const [laden, setLaden] = useState(true)
  const [fout, setFout] = useState('')
  const [bedrag, setBedrag] = useState('')
  const [invoerFout, setInvoerFout] = useState('')
  const [bezig, setBezig] = useState(false)

  const MAX = 999.99

  const deviceId = (() => {
    let did = localStorage.getItem('digipot_device_id')
    if (!did) { did = crypto.randomUUID(); localStorage.setItem('digipot_device_id', did) }
    return did
  })()

  const laadData = useCallback(async () => {
    try {
      const [{ data: p, error: pe }, { data: d, error: de }, { data: t, error: te }] =
        await Promise.all([
          supabase.from('potjes').select('*').eq('id', id).single(),
          supabase.from('deelnemers').select('*').eq('potje_id', id).order('aangemaakt_op'),
          supabase.from('transacties').select('*').eq('potje_id', id).order('aangemaakt_op'),
        ])
      if (pe) throw pe
      if (de) throw de
      if (te) throw te
      setPotje(p)
      setDeelnemers(d)
      setTransacties(t)
      const bekend = d.find(x => x.device_id === deviceId)
      if (bekend) setDeelnemer(bekend)
    } catch (e) {
      setFout(logFout(e, { component: 'PaginaStorten', actie: 'laadData' }))
    } finally {
      setLaden(false)
    }
  }, [id, deviceId])

  useEffect(() => { laadData() }, [laadData])

  const bedragNum = parseBedrag(bedrag)
  const bedragGeldig = bedrag.length > 0 && !isNaN(bedragNum) && bedragNum > 0 && bedragNum <= MAX

  async function handleStorten(e) {
    e.preventDefault()
    setInvoerFout('')

    if (!bedragGeldig) {
      setInvoerFout(bedragNum > MAX
        ? 'Het maximale bedrag per storting is €999,99.'
        : 'Voer een bedrag in van minimaal €0,01.')
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
      await supabase.from('transacties')
        .insert({ potje_id: id, deelnemer_id: deelnemer.id, type: 'storting', bedrag: bedragNum })
        .select().single()
      navigate(`/potje/${id}`, { state: { toast: { bericht: `Storting van ${formatBedrag(bedragNum)} geregistreerd.`, type: 'ok' } } })
    } catch (e) {
      setInvoerFout(logFout(e, { component: 'PaginaStorten', actie: 'storten' }))
    } finally {
      setBezig(false)
    }
  }

  if (laden) return (
    <div className="pagina">
      <div className="kaart">
        <div className="skeleton" style={{ height: 28, width: '60%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 16, width: '40%' }} />
      </div>
      <div className="kaart">
        <div className="skeleton" style={{ height: 48, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 48 }} />
      </div>
    </div>
  )

  if (fout) return (
    <div className="pagina">
      <div className="kaart">
        <p style={{ color: 'var(--rood)' }}>{fout}</p>
        <button className="knop knop-secundair" style={{ marginTop: 16 }} onClick={() => navigate(`/potje/${id}`)}>
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
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: '4px 0', color: 'var(--grijs-600)', lineHeight: 1 }}
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

      {/* Jouw storting tot nu toe */}
      {reedGestort > 0 && (
        <div className="kaart" style={{ background: 'var(--groen-licht)', border: '1px solid #bbf7d0' }}>
          <p style={{ fontSize: 13, color: 'var(--groen)', fontWeight: 500 }}>
            Je hebt tot nu toe <strong>{formatBedrag(reedGestort)}</strong> ingelegd.
          </p>
        </div>
      )}

      {/* Formulier */}
      <div className="kaart">
        <form onSubmit={handleStorten}>
          <div className="veld">
            <label className="label" htmlFor="bedrag-invoer">Bedrag (€)</label>
            <input
              id="bedrag-invoer"
              className={`input ${invoerFout ? 'fout' : ''}`}
              type="text"
              inputMode="decimal"
              placeholder="bijv. 20,00"
              value={bedrag}
              onChange={e => { setBedrag(e.target.value); setInvoerFout('') }}
              autoFocus
              autoComplete="off"
            />
            {bedragGeldig && !invoerFout && (
              <div className="teller" style={{ color: 'var(--groen)' }}>= {formatBedrag(bedragNum)}</div>
            )}
            {invoerFout && <div className="fout-tekst">{invoerFout}</div>}
          </div>

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
              type="submit"
              className="knop knop-primair"
              style={{ flex: 1 }}
              disabled={bezig || !bedragGeldig}
            >
              {bezig ? 'Bezig...' : 'Storten →'}
            </button>
          </div>
        </form>
      </div>

      {/* Pot saldo info */}
      <div className="kaart" style={{ background: 'var(--grijs-50)', border: '1px solid var(--grijs-200)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
          <span style={{ color: 'var(--grijs-600)' }}>Huidig potsaldo</span>
          <strong style={{ color: saldi.potSaldo > 0 ? 'var(--groen)' : 'var(--grijs-600)' }}>
            {formatBedrag(saldi.potSaldo)}
          </strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 8 }}>
          <span style={{ color: 'var(--grijs-600)' }}>Totaal ingelegd</span>
          <strong>{formatBedrag(saldi.potTotaal)}</strong>
        </div>
      </div>

    </div>
  )
}

export default PaginaStorten
