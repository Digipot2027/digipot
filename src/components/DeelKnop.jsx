import { useState } from 'react'
import { deelLink } from '../utils/deelLink'

/**
 * DeelKnop — één klik/tap om de huidige pagina te delen.
 *
 * - Mobiel (iOS/Android): native share sheet met Signal, WhatsApp etc.
 * - Desktop (macOS, Windows): kopieert URL direct naar klembord + visuele feedback
 *
 * De knoptekst past zich aan het platform aan zodat de verwachting klopt.
 */
function DeelKnop({ potjeNaam, variant = 'secundair', style = {} }) {
  const [status, setStatus] = useState('idle') // 'idle' | 'gekopieerd' | 'fout'

  // Op mobiel verschijnt native share sheet, op desktop kopiëren we direct
  const isMobiel = navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)

  async function handleDelen() {
    await deelLink(
      potjeNaam,
      (type) => {
        if (type === 'kopie') {
          setStatus('gekopieerd')
          setTimeout(() => setStatus('idle'), 2500)
        }
        // Bij native share: geen statuswijziging, OS geeft eigen feedback
      },
      () => {
        setStatus('fout')
        setTimeout(() => setStatus('idle'), 3000)
      }
    )
  }

  const label = status === 'gekopieerd'
    ? '✅ Link gekopieerd!'
    : status === 'fout'
    ? '⚠️ Kopiëren mislukt'
    : isMobiel ? '🔗 Deel potje' : '🔗 Link kopiëren'

  return (
    <button
      className={`knop knop-${variant}`}
      style={{ ...style }}
      onClick={handleDelen}
      aria-live="polite"
      aria-label={
        status === 'gekopieerd'
          ? 'Link gekopieerd naar klembord'
          : isMobiel
          ? 'Deel dit potje met anderen'
          : 'Kopieer de link naar dit potje'
      }
    >
      {label}
    </button>
  )
}

export default DeelKnop
