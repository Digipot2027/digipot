/**
 * Hulpfunctie: rond af op 2 decimalen en voorkomt -0.
 */
function rond(waarde) {
  const afgerond = Math.round(waarde * 100) / 100
  return afgerond === 0 ? 0 : afgerond
}

/**
 * Hulpfunctie: verzamel gestort en betaald per deelnemer uit transacties.
 */
function verzamelPerDeelnemer(deelnemers, transacties) {
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

/**
 * Bepaalt of een deelnemer actief was op een gegeven tijdstip.
 *
 * Regels bij gelijke tijdstippen:
 *   - Aanmelden op zelfde moment als sluiting → deelnemer telt MEE (actief)
 *   - Afmelden op zelfde moment als sluiting → deelnemer telt NIET mee (afgemeld)
 */
function wasActiefOp(deelnemer, tijdstipMs) {
  const aangemeldMs = new Date(deelnemer.aangemaakt_op).getTime()
  if (aangemeldMs > tijdstipMs) return false
  if (!deelnemer.afgemeld_op) return true
  return new Date(deelnemer.afgemeld_op).getTime() > tijdstipMs
}

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

/**
 * Berekent de minimale vereffening tussen crediteuren en debiteuren.
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
