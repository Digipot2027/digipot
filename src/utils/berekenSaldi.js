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
      aandeel: g, // tijdens lopend potje: aandeel = ingelegd (voor weergave)
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
 * Berekent de eindafrekening bij het sluiten van een potje.
 *
 * Rekenmodel:
 *
 *   Afgemelde deelnemers:
 *     Netto bijdrage = volledige inleg (vast)
 *     Verrekening    = betaald − ingelegd
 *
 *   Actieve deelnemers:
 *     Netto bijdrage = ingelegd × (resterend voor actieven ÷ totaal ingelegd actieven)
 *     Verrekening    = betaald − netto bijdrage
 *
 *     Resterend voor actieven = totaal betaald aan horeca − bijdrage afgemelde deelnemers
 *
 *   Cap: verrekening nooit lager dan −ingelegd
 *     (je betaalt nooit meer bij dan je hebt ingelegd)
 *
 *   Tekorten boven de cap verdwijnen — worden NIET doorgeschoven.
 *   Het resterende virtuele saldo verdwijnt bij sluiting.
 */
export function berekenEindafrekening(deelnemers, transacties) {
  if (!deelnemers || deelnemers.length === 0) {
    return { potTotaal: 0, potUitgaven: 0, potSaldo: 0, deelnemersSaldi: [] }
  }

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
    deelnemers.filter(d => d.actief !== false).map(d => d.id)
  )

  // Stap 1: bijdrage afgemelde deelnemers = volledige inleg (vast)
  const totaalBijdrageAfgemelden = deelnemers
    .filter(d => !actieveIds.has(d.id))
    .reduce((sum, d) => sum + rond(gestort[d.id]), 0)

  // Stap 2: factor voor actieve deelnemers
  //   resterend = wat overblijft na aftrek bijdrage afgemelden
  //   factor    = resterend ÷ totaal ingelegd door actieven
  const totaalIngelegdActieven = deelnemers
    .filter(d => actieveIds.has(d.id))
    .reduce((sum, d) => sum + rond(gestort[d.id]), 0)

  const resterendVoorActieven = rond(potUitgaven - totaalBijdrageAfgemelden)

  const factor = totaalIngelegdActieven > 0
    ? resterendVoorActieven / totaalIngelegdActieven
    : 0

  // Stap 3: verrekening per deelnemer
  const deelnemersSaldi = deelnemers.map(d => {
    const g = rond(gestort[d.id])
    const b = rond(betaald[d.id])
    const isActief = actieveIds.has(d.id)

    // Netto bijdrage: actief = ingelegd × factor, afgemeld = volledige inleg
    const nettoBijdrage = isActief ? rond(g * factor) : g

    // Verrekening = betaald − netto bijdrage, cap: nooit lager dan −ingelegd
    const verrekening = rond(Math.max(b - nettoBijdrage, -g))

    return {
      ...d,
      gestort: g,
      betaald: b,
      aandeel: nettoBijdrage, // netto bijdrage (voor weergave op eindafrekening)
      verrekening,
    }
  })

  return {
    potTotaal,
    potUitgaven,
    potSaldo,
    deelnemersSaldi,
  }
}
