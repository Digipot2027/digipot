/**
 * berekenVereffening.js — minimale vereffening tussen crediteuren en debiteuren
 *
 * Geëxtraheerd uit berekenSaldi.js bij splitsing (2026-04-17).
 */

/**
 * Berekent de minimale vereffening tussen crediteuren en debiteuren.
 *
 * Algoritme: greedy — grootste crediteur koppelen aan grootste debiteur.
 * Doel: minimaal aantal transacties (maximaal n-1 voor n deelnemers).
 *
 * @param {Array<{naam: string, verrekening: number}>} deelnemersSaldi
 * @returns {Array<{van: string, aan: string, bedrag: number}>}
 */
export function berekenVereffening(deelnemersSaldi) {
  const crediteuren = deelnemersSaldi
    .filter(d => d.verrekening > 0.005)
    .map(d => ({ naam: d.naam, bedrag: d.verrekening }))
    .sort((a, b) => b.bedrag - a.bedrag)

  const debiteuren = deelnemersSaldi
    .filter(d => d.verrekening < -0.005)
    .map(d => ({ naam: d.naam, bedrag: Math.abs(d.verrekening) }))
    .sort((a, b) => b.bedrag - a.bedrag)

  const transacties = []
  const cred = crediteuren.map(c => ({ ...c }))
  const deb  = debiteuren.map(d => ({ ...d }))

  let ci = 0, di = 0
  while (ci < cred.length && di < deb.length) {
    const bedrag = Math.round(Math.min(cred[ci].bedrag, deb[di].bedrag) * 100) / 100
    if (bedrag >= 0.01) {
      transacties.push({ van: deb[di].naam, aan: cred[ci].naam, bedrag })
    }
    cred[ci].bedrag = Math.round((cred[ci].bedrag - bedrag) * 100) / 100
    deb[di].bedrag  = Math.round((deb[di].bedrag  - bedrag) * 100) / 100
    if (cred[ci].bedrag < 0.01) ci++
    if (deb[di].bedrag  < 0.01) di++
  }

  return transacties
}
