/**
 * smoke/runner.mjs — Gedeelde runner voor T5-T10
 *
 * Gebruik: importeer runScenario en roep het aan met een scenario-object.
 * Het scenario-object heeft dezelfde structuur als T3/T4.
 */

export function maakHeaders(key) {
  return {
    'Content-Type':  'application/json',
    'apikey':        key,
    'Authorization': `Bearer ${key}`,
    'Prefer':        'return=representation',
  }
}

// ── Retry-helper ──────────────────────────────────────────────────────────────
// Bij tijdelijke netwerkfouten (fetch failed, 5xx) wordt de call
// maximaal MAX_POGINGEN keer opnieuw geprobeerd met exponentiële backoff.
// Supabase-logicafouten (4xx) worden direct gegooid zonder retry.

const MAX_POGINGEN = 4
const BASIS_WACHT_MS = 2000

async function metRetry(omschrijving, fn) {
  let poging = 0
  while (true) {
    try {
      return await fn()
    } catch (err) {
      poging++
      const isNetwerkFout = err.message.includes('fetch failed') ||
                            err.message.includes('NetworkError') ||
                            err.message.includes('ECONNRESET') ||
                            err.message.includes('ETIMEDOUT') ||
                            /\(5\d\d\)/.test(err.message) // 5xx
      const isLogicaFout  = /\(4\d\d\)/.test(err.message) // 4xx — niet opnieuw proberen

      if (isLogicaFout || !isNetwerkFout || poging >= MAX_POGINGEN) throw err

      const wachtMs = BASIS_WACHT_MS * Math.pow(2, poging - 1) // 2s, 4s, 8s
      console.log(`  ⚠️  ${omschrijving} mislukt (poging ${poging}/${MAX_POGINGEN}), retry over ${wachtMs / 1000}s...`)
      await new Promise(r => setTimeout(r, wachtMs))
    }
  }
}

export async function sbInsert(url, key, tabel, body) {
  return metRetry(`INSERT ${tabel}`, async () => {
    const res = await fetch(`${url}/rest/v1/${tabel}`, {
      method: 'POST', headers: maakHeaders(key), body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`INSERT ${tabel} (${res.status}): ${await res.text()}`)
    return res.json()
  })
}

export async function sbPatch(url, key, tabel, filter, body) {
  return metRetry(`PATCH ${tabel}`, async () => {
    const res = await fetch(`${url}/rest/v1/${tabel}?${filter}`, {
      method: 'PATCH', headers: maakHeaders(key), body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`PATCH ${tabel} (${res.status}): ${await res.text()}`)
    return res.json()
  })
}

export async function sbSelect(url, key, tabel, filter) {
  return metRetry(`SELECT ${tabel}`, async () => {
    const res = await fetch(`${url}/rest/v1/${tabel}?${filter}`, {
      headers: { ...maakHeaders(key), 'Prefer': 'return=representation' },
    })
    if (!res.ok) throw new Error(`SELECT ${tabel} (${res.status}): ${await res.text()}`)
    return res.json()
  })
}

export function wachtTot(startMs, minuut) {
  const wacht = (startMs + minuut * 60_000) - Date.now()
  if (wacht <= 0) return Promise.resolve()
  const mm = Math.floor(wacht / 60_000)
  const ss = Math.floor((wacht % 60_000) / 1000)
  console.log(`  Wacht ${mm}m ${ss}s tot T+${minuut}min...`)
  return new Promise(r => setTimeout(r, wacht))
}

export function berekenSaldi(deelnemers, transacties, sluitTijdstip) {
  const sluitMs = new Date(sluitTijdstip).getTime()
  const gestort = {}, betaald = {}
  deelnemers.forEach(d => { gestort[d.id] = 0; betaald[d.id] = 0 })
  transacties.filter(t => t.type === 'storting')
    .forEach(t => { if (gestort[t.deelnemer_id] !== undefined) gestort[t.deelnemer_id] += Number(t.bedrag) })
  transacties.filter(t => t.type === 'betaling')
    .forEach(t => { if (betaald[t.deelnemer_id] !== undefined) betaald[t.deelnemer_id] += Number(t.bedrag) })
  const totG = Object.values(gestort).reduce((s, v) => s + v, 0)
  const totB = Object.values(betaald).reduce((s, v) => s + v, 0)
  const actieveIds = new Set(deelnemers.filter(d => {
    const aanMs = new Date(d.aangemaakt_op).getTime()
    if (aanMs > sluitMs) return false
    if (!d.afgemeld_op) return true
    return new Date(d.afgemeld_op).getTime() > sluitMs
  }).map(d => d.id))
  const bijdAfg = deelnemers.filter(d => !actieveIds.has(d.id)).reduce((s, d) => s + gestort[d.id], 0)
  const ingAct  = deelnemers.filter(d =>  actieveIds.has(d.id)).reduce((s, d) => s + gestort[d.id], 0)
  const factor  = ingAct > 0 ? (totB - bijdAfg) / ingAct : 0
  return {
    totaalGestort: totG, totaalBetaald: totB,
    uitgifte: totG > 0 ? totB / totG * 100 : 0,
    deelnemers: deelnemers.map(d => {
      const g = Math.round(gestort[d.id] * 100) / 100
      const b = Math.round(betaald[d.id] * 100) / 100
      const actief = actieveIds.has(d.id)
      const netto = actief ? Math.round(g * factor * 100) / 100 : g
      const ver = Math.round(Math.max(b - netto, -g) * 100) / 100
      return { naam: d.naam, gestort: g, betaald: b, netto, verrekening: ver, actief }
    }),
  }
}

export async function runScenario(scenario, label) {
  const SUPABASE_URL    = process.env.SUPABASE_URL
  const SUPABASE_KEY    = process.env.SUPABASE_ANON_KEY
  const SMOKE_DEVICE_ID = process.env.SMOKE_DEVICE_ID

  if (!SUPABASE_URL || !SUPABASE_KEY || !SMOKE_DEVICE_ID) {
    console.error('Ontbrekende env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SMOKE_DEVICE_ID')
    process.exit(1)
  }

  const ins = (t, b)    => sbInsert(SUPABASE_URL, SUPABASE_KEY, t, b)
  const pat = (t, f, b) => sbPatch(SUPABASE_URL, SUPABASE_KEY, t, f, b)
  const sel = (t, f)    => sbSelect(SUPABASE_URL, SUPABASE_KEY, t, f)

  console.log(`\nDigipot Smoke Test ${label}`)
  console.log('='.repeat(52))
  console.log(`Scenario : ${scenario.naam}`)
  console.log(`Duur     : ${scenario.duurMinuten} minuten`)
  console.log('='.repeat(52))

  console.log('\nPotje aanmaken...')
  const [potje] = await ins('potjes', {
    naam: scenario.naam, status: 'open', valuta: scenario.valuta ?? 'EUR',
  })
  console.log(`OK  : ${potje.id}`)
  console.log(`URL : https://digipot.pages.dev/potje/${potje.id}`)

  console.log('\nDeelnemers aanmaken (aankomst T+0)...')
  const dm = {}
  for (const d of scenario.deelnemers.filter(d => d.aankomstMinuut === 0)) {
    const [rec] = await ins('deelnemers', {
      potje_id: potje.id, naam: d.naam,
      device_id: d.isBeek ? SMOKE_DEVICE_ID : crypto.randomUUID(),
    })
    dm[d.naam] = rec
    console.log(`  ${d.naam}${d.isBeek ? ' <- jij' : ''}`)
  }

  console.log('\nEvents uitvoeren...')
  const startMs = Date.now()
  const events = [...scenario.events].sort((a, b) => a.minuut - b.minuut)
  let sluitTijdstip = null

  for (const ev of events) {
    await wachtTot(startMs, ev.minuut)

    if (ev.type === 'aankomst') {
      const def = scenario.deelnemers.find(d => d.naam === ev.naam)
      const [rec] = await ins('deelnemers', {
        potje_id: potje.id, naam: ev.naam,
        device_id: def?.isBeek ? SMOKE_DEVICE_ID : crypto.randomUUID(),
      })
      dm[ev.naam] = rec
      console.log(`  T+${String(ev.minuut).padStart(3)}m  aankomst  ${ev.naam}`)
    } else if (ev.type === 'storting') {
      await ins('transacties', {
        potje_id: potje.id, deelnemer_id: dm[ev.naam].id,
        type: 'storting', bedrag: ev.bedrag,
      })
      console.log(`  T+${String(ev.minuut).padStart(3)}m  storting  ${ev.naam.padEnd(12)}  EUR ${ev.bedrag}`)
    } else if (ev.type === 'betaling') {
      await ins('transacties', {
        potje_id: potje.id, deelnemer_id: dm[ev.naam].id,
        type: 'betaling', bedrag: ev.bedrag,
      })
      console.log(`  T+${String(ev.minuut).padStart(3)}m  betaling  ${ev.naam.padEnd(12)}  EUR ${ev.bedrag}`)
    } else if (ev.type === 'afmelden') {
      await pat('deelnemers', `id=eq.${dm[ev.naam].id}`, {
        actief: false, afgemeld_op: new Date().toISOString(),
      })
      console.log(`  T+${String(ev.minuut).padStart(3)}m  afgemeld  ${ev.naam}`)
    } else if (ev.type === 'sluiting') {
      sluitTijdstip = new Date().toISOString()
      await pat('potjes', `id=eq.${potje.id}`, {
        status: 'gesloten', gesloten_op: sluitTijdstip, gesloten_door: dm['Beek'].id,
      })
      console.log(`  T+${String(ev.minuut).padStart(3)}m  GESLOTEN`)
    }
  }

  console.log('\nVerificatie...')
  const dbD = await sel('deelnemers',  `potje_id=eq.${potje.id}`)
  const dbT = await sel('transacties', `potje_id=eq.${potje.id}`)
  const res = berekenSaldi(dbD, dbT, sluitTijdstip)

  console.log(`\nTotaal gestort : EUR ${res.totaalGestort.toFixed(2)}`)
  console.log(`Totaal betaald : EUR ${res.totaalBetaald.toFixed(2)}`)
  console.log(`Uitgifte       : ${res.uitgifte.toFixed(1)}% (min 98%)`)
  console.log('')

  for (const s of res.deelnemers) {
    console.log(
      `  ${s.actief ? 'actief  ' : 'afgemeld'} ${s.naam.padEnd(12)} ` +
      `gestort ${s.gestort.toFixed(2).padStart(6)}  ` +
      `betaald ${s.betaald.toFixed(2).padStart(6)}  ` +
      `verrek ${(s.verrekening >= 0 ? '+' : '') + s.verrekening.toFixed(2).padStart(7)}`
    )
  }

  const ok = res.uitgifte >= 98.0
  console.log('\n' + '='.repeat(52))
  console.log(ok ? `${label} GESLAAGD` : `${label} MISLUKT — uitgifte onder 98%`)
  console.log(`https://digipot.pages.dev/potje/${potje.id}`)
  console.log('='.repeat(52) + '\n')
  if (!ok) process.exit(1)
}
