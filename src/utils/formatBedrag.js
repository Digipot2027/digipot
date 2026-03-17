/**
 * Formatteert een bedrag als Nederlandse valuta
 * Altijd komma als decimaalteken: €10,50
 */
export function formatBedrag(bedrag) {
  if (bedrag === null || bedrag === undefined) return '€0,00'
  return '€' + Number(bedrag).toLocaleString('nl-NL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

/**
 * Parseert een bedrag string naar number
 * Accepteert zowel komma als punt als decimaalteken
 */
export function parseBedrag(waarde) {
  if (!waarde) return 0
  return parseFloat(String(waarde).replace(',', '.'))
}
