import { useState, useEffect, useRef } from 'react'
import { formatBedrag, parseBedrag } from '../utils/formatBedrag'
import { logFout } from '../utils/logFout'
import { valideerTransactieBedrag } from '../utils/valideer'
import { useFocusTrap } from '../hooks/useFocusTrap'

/**
 * ModalTransactie — formulier voor storting of betaling.
 *
 * Issue 10 fix (2026-04-12): formatBedrag werd op drie plekken aangeroepen
 * zonder valuta-parameter. formatBedrag gebruikt dan de default 'EUR', waardoor
 * de weergave incorrect is zodra multicurrency wordt geactiveerd.
 * Fix: valuta-prop toegevoegd en doorgegeven aan alle formatBedrag-aanroepen.
 */
function ModalTransactie({ type, potSaldo, valuta = 'EUR', ikBenActief = true, onBevestig, onAnnuleer }) {
  const [bedrag, setBedrag] = useState('')
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')
  const panelRef = useRef(null)

  const isStorting = type === 'storting'
  const titel = isStorting ? '💰 Storting toevoegen' : '🍺 Rondje betaald'
  const MAX = 999.99

  const bedragNum = parseBedrag(bedrag)
  const bedragGeldig = bedrag.length > 0 && !isNaN(bedragNum) && bedragNum > 0 && bedragNum <= MAX

  useEffect(() => {
    panelRef.current?.querySelector('input, button:not([disabled])')?.focus()
  }, [])

  useFocusTrap(panelRef, onAnnuleer, { selector: 'input:not([disabled]), button:not([disabled])' })

  async function handleSubmit(e) {
    e.preventDefault()
    setFout('')

    const validatieFout = valideerTransactieBedrag(bedrag, bedragNum, {
      isStorting,
      potSaldo,
      formatBedrag: (b) => formatBedrag(b, valuta),
      max: MAX,
    })
    if (validatieFout) {
      setFout(validatieFout)
      return
    }

    setLaden(true)
    try {
      await onBevestig(type, bedragNum)
    } catch (error) {
      if (error.message?.includes('SALDO_TE_LAAG')) {
        const saldo = error.message.split(':')[1]
        // Issue 10 fix: valuta meegeven zodat het juiste valutasymbool getoond wordt
        setFout(`Het potje heeft niet genoeg saldo. Maximaal beschikbaar: ${formatBedrag(saldo, valuta)}.`)
      } else if (error.message?.includes('NIET_ACTIEF')) {
        setFout('Je hebt je afgemeld en kunt geen transacties meer invoeren.')
      } else if (error.message?.includes('DEELNEMER_ONTBREEKT')) {
        setFout('Er is iets misgegaan. Ververs de pagina en probeer opnieuw.')
      } else {
        setFout(logFout(error, { component: 'ModalTransactie', actie: type }))
      }
    } finally {
      setLaden(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 500 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-transactie-titel"
    >
      <div
        ref={panelRef}
        style={{ background: 'var(--wit)', width: '100%', borderRadius: '16px 16px 0 0', padding: 24, paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}
      >
        <h2 id="modal-transactie-titel" style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{titel}</h2>

        {!ikBenActief && (
          <div style={{ background: 'var(--grijs-100)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 14, color: 'var(--grijs-600)' }}>
            Je hebt je afgemeld en kunt geen transacties meer invoeren.
          </div>
        )}

        {!isStorting && ikBenActief && (
          <p style={{ fontSize: 14, color: 'var(--grijs-600)', marginBottom: 16 }}>
            {/* Issue 10 fix: valuta meegeven */}
            Beschikbaar saldo: <strong>{formatBedrag(potSaldo, valuta)}</strong>
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="veld">
            <label className="label" htmlFor="bedrag-invoer">Bedrag ({valuta})</label>
            <input
              id="bedrag-invoer"
              className={`input ${fout ? 'fout' : ''}`}
              type="text"
              inputMode="decimal"
              placeholder="bijv. 12,50"
              value={bedrag}
              onChange={e => { setBedrag(e.target.value); setFout('') }}
              disabled={!ikBenActief}
              autoFocus
            />
            {/* Issue 10 fix: valuta meegeven aan live preview */}
            {bedragGeldig && !fout && (
              <div className="teller" style={{ color: 'var(--groen)' }}>= {formatBedrag(bedragNum, valuta)}</div>
            )}
            {fout && <div className="fout-tekst">{fout}</div>}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="knop knop-secundair" onClick={onAnnuleer} style={{ flex: 1 }}>
              Annuleren
            </button>
            <button
              type="submit"
              className={`knop ${isStorting ? 'knop-primair' : 'knop-gevaar'}`}
              style={{ flex: 1 }}
              disabled={laden || !bedrag || !ikBenActief}
            >
              {laden
                ? (isStorting ? 'Storting registreren…' : 'Betaling registreren…')
                : 'Bevestigen →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ModalTransactie
