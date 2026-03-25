import { useState } from 'react'
import { deelLink } from '../utils/deelLink'

/**
 * DeelKnop — één klik/tap om de huidige pagina te delen.
 *
 * - Mobiel: native share sheet (iOS/Android)
 * - Desktop: kopieert URL naar klembord + visuele feedback
 * - Werkt als primaire of secundaire knop via `variant` prop
 */
function DeelKnop({ potjeNaam, variant = 'secundair', style = {} }) {
  const [status, setStatus] = useState('idle') // 'idle' | 'gekopieerd' | 'fout'

  async function handleDelen() {
    await deelLink(
      potjeNaam,
      (type) => {
        if (type === 'kopie') {
          setStatus('gekopieerd')
          setTimeout(() => setStatus('idle'), 2500)
        }
        // Bij native share: geen toast, OS geeft feedback
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
    : '🔗 Deel potje'

  return (
    <button
      className={`knop knop-${variant}`}
      style={{ ...style }}
      onClick={handleDelen}
      aria-live="polite"
      aria-label={
        status === 'gekopieerd'
          ? 'Link gekopieerd naar klembord'
          : 'Deel dit potje met anderen'
      }
    >
      {label}
    </button>
  )
}

export default DeelKnop
