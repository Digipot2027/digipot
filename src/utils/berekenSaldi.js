/**
 * berekenSaldi.js — lopende saldi per deelnemer (actief potje)
 *
 * Geëxporteerde functies:
 *   berekenSaldi   — saldi tijdens een lopend potje
 *   heeftGestort   — controleert of een deelnemer heeft gestort
 *
 * Zie ook:
 *   berekenEindafrekening.js — eindafrekening bij sluiting
 *   berekenVereffening.js    — minimale vereffening na sluiting
 *   berekenHelpers.js        — gedeelde hulpfuncties (intern)
 */

import { rond, verzamelPerDeelnemer } from './berekenHelpers'

/**
 * Berekent de lopende saldi per deelnemer (tijdens een actief potje).
 *
 * Terminologie:
 *   gestort     = totaal ingelegd door een deelnemer in het potje (virtueel)
 *   betaald     = wat een deelnemer werkelijk aan de horeca heeft voorgeschoten
 *   verrekening = betaald − gestort (+ = ontvangt terug, − = moet bijbetalen)
 *
 * Regels:
 *   - Verrekening = werkelijk betaald − ingelegd
 *   - Verrekening nooit lager dan −gestort (je betaalt nooit meer bij dan je hebt ingelegd)
 *   - Het resterende virtuele saldo verdwijnt bij sluiting
 */
export function berekenSaldi(deelnemers, transacties) {
  if (!deelnemers || deelnemers.length === 0) {
    return { potTotaal: 0, potUitgaven: 0, potSaldo: 0, deelnemersSaldi: [] }
  }

  const potTotaal = transacties
    .filter(t => t.type === 'storting')
    .reduce((sum, t) => sum + Number(t.bedrag), 0)

  const potUitgaven = transacties
    .filter(t => t.type === 'betaling')
    .reduce((sum, t) => sum + Number(t.bedrag), 0)

  const potSaldo = potTotaal - potUitgaven

  const { gestort, betaald } = verzamelPerDeelnemer(deelnemers, transacties)

  const deelnemersSaldi = deelnemers.map(d => {
    const g = rond(gestort[d.id])
    const b = rond(betaald[d.id])
    const verrekening = rond(Math.max(b - g, -g))
    return {
      ...d,
      gestort: g,
      betaald: b,
      aandeel: g,
      verrekening,
    }
  })

  return {
    potTotaal: rond(potTotaal),
    potUitgaven: rond(potUitgaven),
    potSaldo: rond(potSaldo),
    deelnemersSaldi,
  }
}

/**
 * Bepaalt of een deelnemer heeft gestort op basis van saldi.
 *
 * TECH-3 fix (2026-04-16): de check `(mijnSaldi?.gestort ?? 0) > 0` was
 * gedupliceerd in PaginaOverzicht en usePotjeActies. Eén gedeelde functie
 * voorkomt dat een drempelwijziging op meerdere plekken moet worden doorgevoerd.
 *
 * @param {Array} deelnemersSaldi - Resultaat van berekenSaldi().deelnemersSaldi
 * @param {string} deelnemerId - ID van de te checken deelnemer
 * @returns {boolean}
 */
export function heeftGestort(deelnemersSaldi, deelnemerId) {
  const saldi = deelnemersSaldi.find(s => s.id === deelnemerId)
  return (saldi?.gestort ?? 0) > 0
}
