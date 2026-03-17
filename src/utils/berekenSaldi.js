/**
 * Berekent saldi per deelnemer op basis van tijdgebaseerde verdeling.
 * Een deelnemer betaalt alleen mee aan uitgaven NA zijn instapmoment.
 */
export function berekenSaldi(deelnemers, transacties) {
  if (!deelnemers || deelnemers.length === 0) {
    return { potTotaal: 0, potUitgaven: 0, potSaldo: 0, deelnemersSaldi: [] }
  }

  // Bereken pot totalen
  const potTotaal = transacties
    .filter(t => t.type === 'storting')
    .reduce((sum, t) => sum + Number(t.bedrag), 0)

  const potUitgaven = transacties
    .filter(t => t.type === 'betaling')
    .reduce((sum, t) => sum + Number(t.bedrag), 0)

  const potSaldo = potTotaal - potUitgaven

  // Initialiseer aandeel per deelnemer op 0
  const aandelen = {}
  deelnemers.forEach(d => { aandelen[d.id] = 0 })

  // Per betaling: verdeel over actieve deelnemers op dat moment
  const betalingen = transacties.filter(t => t.type === 'betaling')

  betalingen.forEach(betaling => {
    const betalingTijd = new Date(betaling.aangemaakt_op).getTime()

    // Actieve deelnemers = ingestapt vóór of op het moment van de betaling
    const actief = deelnemers.filter(d =>
      new Date(d.aangemaakt_op).getTime() <= betalingTijd
    )

    if (actief.length === 0) return

    const bedrag = Number(betaling.bedrag)
    const aandeel = Math.floor((bedrag / actief.length) * 100) / 100
    let totaalVerdeeld = 0

    actief.forEach((d, index) => {
      if (index === actief.length - 1) {
        // Laatste deelnemer krijgt het cent-restant
        aandelen[d.id] += Math.round((bedrag - totaalVerdeeld) * 100) / 100
      } else {
        aandelen[d.id] += aandeel
        totaalVerdeeld += aandeel
      }
    })
  })

  // Bereken gestort per deelnemer
  const gestort = {}
  deelnemers.forEach(d => { gestort[d.id] = 0 })
  transacties
    .filter(t => t.type === 'storting')
    .forEach(t => {
      if (gestort[t.deelnemer_id] !== undefined) {
        gestort[t.deelnemer_id] += Number(t.bedrag)
      }
    })

  // Stel eindresultaat samen
  const deelnemersSaldi = deelnemers.map(d => ({
    ...d,
    gestort: Math.round(gestort[d.id] * 100) / 100,
    aandeel: Math.round(aandelen[d.id] * 100) / 100,
    verrekening: Math.round((gestort[d.id] - aandelen[d.id]) * 100) / 100
  }))

  return {
    potTotaal: Math.round(potTotaal * 100) / 100,
    potUitgaven: Math.round(potUitgaven * 100) / 100,
    potSaldo: Math.round(potSaldo * 100) / 100,
    deelnemersSaldi
  }
}
