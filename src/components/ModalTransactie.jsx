import { useState } from 'react'
import { formatBedrag, parseBedrag } from '../utils/formatBedrag'
import { vertaalFout } from '../utils/vertaalFout'

function ModalTransactie({ type, potSaldo, ikBenActief = true, onBevestig, onAnnuleer }) {
  const [bedrag, setBedrag] = useState('')
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState('')

  const isStorting = type === 'storting'
  const titel = isStorting ? '💰 Storting toevoegen' : '🍺 Rondje betaald'
  const MAX = 999.99

  async function handleSubmit(e) {
    e.preventDefault()
    setFout('')

    const bedragNum = parseBedrag(bedrag)
    if (!bedrag || isNaN(bedragNum) || bedragNum <= 0) {
      setFout('Voer een bedrag in van minimaal €0,01.')
      return
    }
    if (bedragNum > MAX) {
      setFout(`Het maximale bedrag per transactie is €999,99.`)
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
        setFout(vertaalFout(error))
      }
    } finally {
      setLaden(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 500 }}>
      <div style={{ background: 'var(--wit)', width: '100%', borderRadius: '16px 16px 0 0', padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{titel}</h2>

        {!ikBenActief && (
          <div style={{ background: 'var(--grijs-100, #f3f4f6)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 14, color: 'var(--grijs-600)' }}>
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
            <label className="label" htmlFor="bedrag">Bedrag (€)</label>
            <input
              id="bedrag"
              className={`input ${fout ? 'fout' : ''}`}
              type="text"
              inputMode="decimal"
              placeholder="bijv. 12,50"
              value={bedrag}
              onChange={e => { setBedrag(e.target.value); setFout('') }}
              autoFocus
              disabled={!ikBenActief}
            />
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
              {laden ? 'Bezig...' : 'Bevestigen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ModalTransactie
