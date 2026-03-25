/**
 * Deelt de huidige URL via native share (mobiel) of kopieert naar klembord (desktop).
 *
 * Native share wordt alleen gebruikt op echte mobiele apparaten (iOS/Android).
 * Op desktop (macOS, Windows, Linux) wordt altijd direct gekopieerd — de macOS
 * share sheet toont alleen apps met een Share Extension (niet Signal/WhatsApp).
 *
 * @param {string} potjeNaam - Naam van het potje, voor native share tekst
 * @param {function} onSucces - Callback na succesvol delen/kopiëren
 * @param {function} onFout - Callback bij fout
 */
export async function deelLink(potjeNaam, onSucces, onFout) {
  const url = window.location.href

  // Detecteer mobiel: alleen op touch-apparaten native share aanbieden
  // navigator.share bestaat ook op macOS Safari maar toont een beperkte sheet
  const isMobiel = navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)

  if (isMobiel) {
    try {
      await navigator.share({
        title: `Digipot — ${potjeNaam}`,
        text: `Doe mee aan het potje "${potjeNaam}"`,
        url,
      })
      onSucces?.('native') // native share heeft eigen feedback, geen toast nodig
    } catch (e) {
      // Gebruiker annuleerde share — geen fout tonen
      if (e.name !== 'AbortError') {
        // Native share mislukt → val terug op kopiëren
        await kopieerNaarKlembord(url, onSucces, onFout)
      }
    }
    return
  }

  // Desktop: altijd direct kopiëren naar klembord
  await kopieerNaarKlembord(url, onSucces, onFout)
}

async function kopieerNaarKlembord(url, onSucces, onFout) {
  try {
    await navigator.clipboard.writeText(url)
    onSucces?.('kopie')
  } catch {
    // Clipboard API niet beschikbaar (bijv. HTTP) → execCommand fallback
    try {
      const el = document.createElement('textarea')
      el.value = url
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      onSucces?.('kopie')
    } catch {
      onFout?.()
    }
  }
}
