/**
 * berekenEindafrekening.js — eindafrekening bij sluiten van een potje
 *
 * Geëxtraheerd uit berekenSaldi.js bij splitsing (2026-04-17).
 */

import { rond, verzamelPerDeelnemer, wasActiefOp } from './berekenHelpers'

/**
 * Berekent de eindafrekening bij het sluiten van een potje.
 *
 * @param {Array} deelnemers
 * @param {Array} transacties
 * @param {string|null} sluitTijdstip  ISO-timestamp van sluiting (potje.gesloten_op).
 *                                     Als null: huidige tijd (voor preview).
 */
export function berekenEindafrekening(deelnemers, transacties, sluitTijdstip = null) {
  if (!deelnemers || deelnemers.length === 0) {
    return { potTotaal: 0, potUitgaven: 0, potSaldo: 0, deelnemersSaldi: [] }
  }

  const sluitMs = sluitTijdstip
    ? new Date(sluitTijdstip).getTime()
    : Date.now()

  const potTotaal = rond(
    transacties
      .filter(t => t.type === 'storting')
      .reduce((sum, t) => sum + Number(t.bedrag), 0)
  )
  const potUitgaven = rond(
    transacties
      .filter(t => t.type === 'betaling')
      .reduce((sum, t) => sum + Number(t.bedrag), 0)
  )
  const potSaldo = rond(potTotaal - potUitgaven)

  const { gestort, betaald } = verzamelPerDeelnemer(deelnemers, transacties)

  const actieveIds = new Set(
    deelnemers.filter(d => wasActiefOp(d, sluitMs)).map(d => d.id)
  )

  const totaalBijdrageAfgemelden = deelnemers
    .filter(d => !actieveIds.has(d.id))
    .reduce((sum, d) => sum + rond(gestort[d.id]), 0)

  const totaalIngelegdActieven = deelnemers
    .filter(d => actieveIds.has(d.id))
    .reduce((sum, d) => sum + rond(gestort[d.id]), 0)

  const resterendVoorActieven = rond(potUitgaven - totaalBijdrageAfgemelden)

  const factor = totaalIngelegdActieven > 0
    ? resterendVoorActieven / totaalIngelegdActieven
    : 0

  const deelnemersSaldi = deelnemers.map(d => {
    const g = rond(gestort[d.id])
    const b = rond(betaald[d.id])
    const isActief = actieveIds.has(d.id)
    const nettoBijdrage = isActief ? rond(g * factor) : g
    const verrekening = rond(Math.max(b - nettoBijdrage, -g))
    return { ...d, gestort: g, betaald: b, aandeel: nettoBijdrage, verrekening }
  })

  return { potTotaal, potUitgaven, potSaldo, deelnemersSaldi }
}
