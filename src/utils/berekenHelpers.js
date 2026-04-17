/**
 * berekenHelpers.js — interne hulpfuncties voor bereken-modules
 *
 * Niet bedoeld voor directe import buiten src/utils/bereken*.js.
 * Geëxtraheerd uit berekenSaldi.js bij splitsing (2026-04-17).
 */

/**
 * Rond af op 2 decimalen en voorkomt -0.
 */
export function rond(waarde) {
  const afgerond = Math.round(waarde * 100) / 100
  return afgerond === 0 ? 0 : afgerond
}

/**
 * Verzamel gestort en betaald per deelnemer uit transacties.
 */
export function verzamelPerDeelnemer(deelnemers, transacties) {
  const gestort = {}
  const betaald = {}
  deelnemers.forEach(d => {
    gestort[d.id] = 0
    betaald[d.id] = 0
  })
  transacties
    .filter(t => t.type === 'storting')
    .forEach(t => {
      if (gestort[t.deelnemer_id] !== undefined)
        gestort[t.deelnemer_id] += Number(t.bedrag)
    })
  transacties
    .filter(t => t.type === 'betaling')
    .forEach(t => {
      if (betaald[t.deelnemer_id] !== undefined)
        betaald[t.deelnemer_id] += Number(t.bedrag)
    })
  return { gestort, betaald }
}

/**
 * Bepaalt of een deelnemer actief was op een gegeven tijdstip.
 *
 * Regels bij gelijke tijdstippen:
 *   - Aanmelden op zelfde moment als sluiting → deelnemer telt MEE (actief)
 *   - Afmelden op zelfde moment als sluiting → deelnemer telt NIET mee (afgemeld)
 */
export function wasActiefOp(deelnemer, tijdstipMs) {
  const aangemeldMs = new Date(deelnemer.aangemaakt_op).getTime()
  if (aangemeldMs > tijdstipMs) return false
  if (!deelnemer.afgemeld_op) return true
  return new Date(deelnemer.afgemeld_op).getTime() > tijdstipMs
}
