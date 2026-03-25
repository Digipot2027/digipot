/**
 * Deelt de huidige URL via native share (mobiel) of kopieert naar klembord (desktop).
 *
 * @param {string} potjeNaam - Naam van het potje, voor native share tekst
 * @param {function} onSucces - Callback na succesvol delen/kopiëren
 * @param {function} onFout - Callback bij fout
 */
export async function deelLink(potjeNaam, onSucces, onFout) {
  const url = window.location.href

  // Native share — beschikbaar op mobiel (iOS Safari, Android Chrome)
  if (navigator.share) {
    try {
      await navigator.share({
        title: `Digipot — ${potjeNaam}`,
        text: `Doe mee aan het potje "${potjeNaam}"`,
        url,
      })
      onSucces?.('native') // native share heeft eigen feedback, geen toast nodig
    } catch (e) {
      // Gebruiker annuleerde share — geen fout
      if (e.name !== 'AbortError') {
        // Native share mislukt → val terug op kopiëren
        await kopieerNaarKlembord(url, onSucces, onFout)
      }
    }
    return
  }

  // Fallback: kopieer naar klembord
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
