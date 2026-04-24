import { useState } from 'react'
import { UserPlus, Link, CheckCircle, AlertTriangle } from 'lucide-react'
import { deelLink } from '../utils/deelLink'

/**
 * DeelKnop — één klik/tap om de huidige pagina te delen.
 *
 * - Mobiel (iOS/Android): native share sheet met Signal, WhatsApp etc.
 * - Desktop (macOS, Windows): kopieert URL direct naar klembord + visuele feedback
 *
 * Knoptekst: "Vrienden uitnodigen" (mobiel) / "Link kopiëren" (desktop).
 *
 * Lucide-migratie (2026-04-24): emoji's vervangen door Lucide-icons.
 * Icons zijn aria-hidden — knoptekst is de toegankelijke label.
 */
function DeelKnop({ potjeNaam, variant = 'secundair', className = '' }) {
  const [status, setStatus] = useState('idle') // 'idle' | 'gekopieerd' | 'fout'

  const isMobiel = navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)

  async function handleDelen() {
    await deelLink(
      potjeNaam,
      (type) => {
        if (type === 'kopie') {
          setStatus('gekopieerd')
          setTimeout(() => setStatus('idle'), 2500)
        }
      },
      () => {
        setStatus('fout')
        setTimeout(() => setStatus('idle'), 3000)
      }
    )
  }

  const label = status === 'gekopieerd'
    ? 'Link gekopieerd!'
    : status === 'fout'
    ? 'Kopiëren mislukt'
    : isMobiel ? 'Vrienden uitnodigen' : 'Link kopiëren'

  const Icon = status === 'gekopieerd'
    ? CheckCircle
    : status === 'fout'
    ? AlertTriangle
    : isMobiel ? UserPlus : Link

  return (
    <button
      className={variant === 'tekstlink'
        ? `deelknop-tekstlink${className ? ' ' + className : ''}`
        : variant === 'uitnodigen'
        ? `knop-uitnodigen${className ? ' ' + className : ''}`
        : `knop knop-${variant}${className ? ' ' + className : ''}`
      }
      onClick={handleDelen}
      aria-live="polite"
      aria-label={
        status === 'gekopieerd'
          ? 'Link gekopieerd naar klembord'
          : isMobiel
          ? 'Nodig vrienden uit voor dit potje'
          : 'Kopieer de link naar dit potje'
      }
    >
      <Icon size={16} aria-hidden="true" strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
      {label}
    </button>
  )
}

export default DeelKnop
