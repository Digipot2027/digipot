import { useState, useEffect, useRef } from 'react'
import { formatBedrag, parseBedrag } from '../utils/formatBedrag'
import { logFout } from '../utils/logFout'

function ModalTransactie({ type, potSaldo, ikBenActief = true, onBevestig, onAnnuleer }) {
  const [bedrag, setBedrag] = useState('')
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')
  const panelRef = useRef(null)

  const isStorting = type === 'storting'
  const titel = isStorting ? '💰 Storting toevoegen' : '🍺 Rondje betaald'
  const MAX = 999.99

  // V3: live bedrag-preview
  const bedragNum = parseBedrag(bedrag)
  const bedragGeldig = bedrag.length > 0 && !isNaN(bedragNum) && bedragNum > 0 && bedragNum <= MAX

  // K4: Escape + focus-trap
  useEffect(() => {
    panelRef.current?.querySelector('input, button:not([disabled])')?.focus()

    function onKey(e) {
      if (e.key === 'Escape') { onAnnuleer(); return }
      if (e.key !== 'Tab') return
      const els = [...(panelRef.current?.querySelectorAll(
        'input:not([disabled]), button:not([disabled])'
      ) ?? [])]
      if (els.length < 2) return
      const first = els[0], last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onAnnuleer])

  async function handleSubmit(e) {
    e.preventDefault()
    setFout('')

    if (!bedrag || isNaN(bedragNum) || bedragNum <= 0) {
      setFout('Voer een bedrag in van minimaal €0,01.')
      return
    }
    if (bedragNum > MAX) {
      setFout('Het maximale bedrag per transactie is €999,99.')
      return
    }
    if (!isStorting && bedragNum > potSaldo) {
      setFout(`Het potje heeft niet genoeg saldo. Maximaal beschikbaar: ${formatBedrag(potSaldo)}.`)
      return
    }

    setLaden(true)
    try {
      await onBevestig(type, bedragNum)
    } catch (error) {
      if (error.message?.includes('SALDO_TE_LAAG')) {
        const saldo = error.message.split(':')[1]
        setFout(`Het potje heeft niet genoeg saldo. Maximaal beschikbaar: ${formatBedrag(saldo)}.`)
      } else if (error.message?.includes('NIET_ACTIEF')) {
        setFout('Je hebt je afgemeld en kunt geen transacties meer invoeren.')
      } else {
        setFout(logFout(error, { component: 'ModalTransactie', actie: type }))
      }
    } finally {
      setLaden(false)
    }
  }

  return (
    // K4: role + aria-modal + aria-labelledby
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
            Beschikbaar saldo: <strong>{formatBedrag(potSaldo)}</strong>
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="veld">
            <label className="label" htmlFor="bedrag-invoer">Bedrag (€)</label>
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
            {/* V3: live preview van het geparsede bedrag */}
            {bedragGeldig && !fout && (
              <div className="teller" style={{ color: 'var(--groen)' }}>= {formatBedrag(bedragNum)}</div>
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
              {/* V6: context-specifieke laadtekst; V4: pijl op primaire knop */}
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
