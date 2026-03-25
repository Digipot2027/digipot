/**
 * Hulpfunctie: rond af op 2 decimalen en voorkomt -0.
 */
function rond(waarde) {
  const afgerond = Math.round(waarde * 100) / 100
  return afgerond === 0 ? 0 : afgerond
}

/**
 * Berekent saldi per deelnemer op basis van tijdgebaseerde verdeling.
 *
 * Terminologie:
 *   gestort    = inleg van een deelnemer in het potje
 *   betaald    = wat een deelnemer uit het potje heeft voorgeschoten
 *   aandeel    = berekend eerlijk deel van de totale uitgaven
 *   verrekening = betaald - aandeel (+ = ontvangt terug, - = moet bijbetalen)
 *
 * Regels:
 *   - Een deelnemer telt alleen mee bij betalingen waarvoor hij actief was
 *     (aangemeld én niet afgemeld op het moment van de betaling)
 *   - Bij gelijke tijdstippen: eerst aan-/afmelding, daarna pas betaling
 *   - Afronding op 2 decimalen met centcorrectie op de laatste deelnemer
 */
export function berekenSaldi(deelnemers, transacties) {
  if (!deelnemers || deelnemers.length === 0) {
    return { potTotaal: 0, potUitgaven: 0, potSaldo: 0, deelnemersSaldi: [] }
  }

  // Pot-totalen
  const potTotaal = transacties
    .filter(t => t.type === 'storting')
    .reduce((sum, t) => sum + Number(t.bedrag), 0)

  const potUitgaven = transacties
    .filter(t => t.type === 'betaling')
    .reduce((sum, t) => sum + Number(t.bedrag), 0)

  const potSaldo = potTotaal - potUitgaven

  // Initialiseer gestort, betaald en aandeel per deelnemer
  const gestort = {}
  const betaald = {}
  const aandelen = {}
  deelnemers.forEach(d => {
    gestort[d.id] = 0
    betaald[d.id] = 0
    aandelen[d.id] = 0
  })

  // Gestort per deelnemer
  transacties
    .filter(t => t.type === 'storting')
    .forEach(t => {
      if (gestort[t.deelnemer_id] !== undefined) {
        gestort[t.deelnemer_id] += Number(t.bedrag)
      }
    })

  // Betaald per deelnemer (wat zij hebben voorgeschoten uit de pot)
  transacties
    .filter(t => t.type === 'betaling')
    .forEach(t => {
      if (betaald[t.deelnemer_id] !== undefined) {
        betaald[t.deelnemer_id] += Number(t.bedrag)
      }
    })

  // Per betaling: verdeel aandeel over actieve deelnemers op dat moment
  // Actief = aangemeld vóór of op betaaltijdstip, en nog niet afgemeld
  // Bij gelijke tijdstippen: afmelding geldt al, aanmelding ook
  transacties
    .filter(t => t.type === 'betaling')
    .forEach(betaling => {
      const betalingTijd = new Date(betaling.aangemaakt_op).getTime()

      const actief = deelnemers.filter(d => {
        const aanmeldTijd = new Date(d.aangemaakt_op).getTime()
        if (aanmeldTijd > betalingTijd) return false

        if (d.afgemeld_op) {
          // Bij gelijk tijdstip: afmelding gaat voor, dus deelnemer telt niet mee
          return new Date(d.afgemeld_op).getTime() > betalingTijd
        }

        return d.actief !== false
      })

      if (actief.length === 0) return

      const bedrag = Number(betaling.bedrag)
      const aandeelPerPersoon = Math.floor((bedrag / actief.length) * 100) / 100
      let verdeeld = 0

      actief.forEach((d, index) => {
        if (index === actief.length - 1) {
          // Centcorrectie: laatste deelnemer vangt afrondingsverschil op
          aandelen[d.id] += rond(bedrag - verdeeld)
        } else {
          aandelen[d.id] += aandeelPerPersoon
          verdeeld += aandeelPerPersoon
        }
      })
    })

  // verrekening = betaald - aandeel
  const deelnemersSaldi = deelnemers.map(d => ({
    ...d,
    gestort: rond(gestort[d.id]),
    betaald: rond(betaald[d.id]),
    aandeel: rond(aandelen[d.id]),
    verrekening: rond(betaald[d.id] - aandelen[d.id])
  }))

  return {
    potTotaal: rond(potTotaal),
    potUitgaven: rond(potUitgaven),
    potSaldo: rond(potSaldo),
    deelnemersSaldi
  }
}

/**
 * Berekent de eindafrekening bij het sluiten van een potje.
 *
 * De cap (verrekening >= -gestort) is een technisch vangnet tegen een falende
 * V2-databasecontrole. In normale werking kan de cap niet bijten omdat
 * betaald <= gestort altijd geldt (afgedwongen door V2).
 *
 * Tekortherverdeling:
 *   Als de cap bijt bij een afgemelde deelnemer, wordt het tekort doorgeschoven
 *   naar actieve deelnemers. Ook daar wordt de cap toegepast.
 *   Wat daarna overblijft verdwijnt (gewenst gedrag).
 *
 * Iedereen afgemeld:
 *   Als er geen actieve deelnemers zijn, verdwijnen alle resterende tekorten.
 *   Dit is gewenst gedrag.
 */
export function berekenEindafrekening(deelnemers, transacties) {
  const basis = berekenSaldi(deelnemers, transacties)
  const actieveIds = new Set(
    deelnemers.filter(d => d.actief !== false).map(d => d.id)
  )

  // Stap 1: cap toepassen op alle deelnemers, tekort verzamelen
  let totaalTekort = 0

  const gecapteSaldi = basis.deelnemersSaldi.map(ds => {
    const ondergrens = -ds.gestort
    if (ds.verrekening >= ondergrens) return ds

    // Cap bijt: verrekening was lager dan -gestort
    const gecapt = rond(ondergrens)
    const tekort = rond(gecapt - ds.verrekening) // positief getal
    totaalTekort = rond(totaalTekort + tekort)
    return { ...ds, verrekening: gecapt }
  })

  // Stap 2: tekort herverdelen over actieve deelnemers
  // Als er geen tekort is of geen actieve deelnemers: klaar
  if (totaalTekort === 0 || actieveIds.size === 0) {
    return { ...basis, deelnemersSaldi: gecapteSaldi }
  }

  const actieveIndices = gecapteSaldi
    .map((ds, i) => actieveIds.has(ds.id) ? i : -1)
    .filter(i => i !== -1)

  const aantalActief = actieveIndices.length
  const aanpassingPerActief = Math.floor((totaalTekort / aantalActief) * 100) / 100
  let reedVerdeeld = 0

  const aangepasteSaldi = gecapteSaldi.map((ds, i) => {
    if (!actieveIds.has(ds.id)) return ds

    const isLaatste = i === actieveIndices[actieveIndices.length - 1]
    const aanpassing = isLaatste
      ? rond(totaalTekort - reedVerdeeld)
      : aanpassingPerActief

    if (!isLaatste) {
      reedVerdeeld = rond(reedVerdeeld + aanpassingPerActief)
    }

    const nieuweVerrekening = rond(ds.verrekening - aanpassing)

    // Stap 3: cap ook toepassen op actieve deelnemers na herverdeling
    // Wat daarna overblijft verdwijnt (gewenst gedrag per systeemregel)
    const ondergrens = -ds.gestort
    return {
      ...ds,
      verrekening: nieuweVerrekening < ondergrens ? rond(ondergrens) : nieuweVerrekening
    }
  })

  return { ...basis, deelnemersSaldi: aangepasteSaldi }
}
