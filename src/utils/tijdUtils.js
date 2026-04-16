/**
 * Tijdformattering-utilities voor Digipot.
 *
 * BUG-2 fix (2026-04-16): tijdLabel en volledigTijdLabel waren gedupliceerd
 * als lokale functies in PaginaEindafrekening.jsx en DeelnemerDetailSheet.jsx.
 * Beide functies zijn hier gecentraliseerd zodat wijzigingen in formattering
 * automatisch propageren naar alle schermen die ze gebruiken.
 *
 * @module tijdUtils
 */

/**
 * Formatteert een ISO-timestamp naar "uu:mm".
 * Gebruikt voor transactierijen op de eindafrekening.
 *
 * @param {string} iso - ISO 8601 timestamp
 * @returns {string} Tijdstring in "uu:mm" formaat
 */
export function tijdLabel(iso) {
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Formatteert een ISO-timestamp naar "uu:mm" voor transacties van vandaag,
 * of naar "d mnd uu:mm" voor transacties van eerdere dagen.
 * Gebruikt in de DeelnemerDetailSheet.
 *
 * @param {string} iso - ISO 8601 timestamp
 * @returns {string} Tijdstring, met datum als de transactie niet van vandaag is
 */
export function volledigTijdLabel(iso) {
  const d = new Date(iso)
  const nu = new Date()
  const ouderDanVandaag = d.toDateString() !== nu.toDateString()
  if (ouderDanVandaag) {
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) +
      ' ' + d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}
