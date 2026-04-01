/**
 * smoke/t2.mjs — Digipot smoke test T2 (v3)
 *
 * Laat-aankomers: 8 personen, 2 uur
 * Nadia komt op T+45, Kwak op T+75 — ongelijke inleg testen
 *
 * Uitvoeren:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SMOKE_DEVICE_ID=... node smoke/t2.mjs | tee smoke/t2-output.log
 *
 * Saldo-simulatie (cumulatief):
 *   T+5:   +50 (ronde 1)        → saldo €106
 *   T+40:  +48 (ronde 2)        → saldo  €98
 *   T+50:  +8  (Nadia)          → saldo €106
 *   T+55:  −98 (Beer)           → saldo   €8
 *   T+70:  +50 (ronde 3)        → saldo  €58
 *   T+80:  +4  (Kwak)           → saldo  €62
 *   T+90:  −56 (Tesser)         → saldo   €6
 *   T+100: +48 (ronde 4)        → saldo  €54
 *   T+108: +8  (Nadia)          → saldo  €62
 *   T+110: −58 (Poiesz)         → saldo   €4
 *   T+115: +4  (Kwak)           → saldo   €8
 *   T+118: −6  (Cynthia)        → saldo   €2
 *
 * Totaal gestort: €220 | Betaald: €218 = 99.1% ✓
 */

const SUPABASE_URL    = process.env.SUPABASE_URL
const SUPABASE_KEY    = process.env.SUPABASE_ANON_KEY
const SMOKE_DEVICE_ID = process.env.SMOKE_DEVICE_ID

if (!SUPABASE_URL || !SUPABASE_KEY || !SMOKE_DEVICE_ID) {
  console.error('Ontbrekende env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SMOKE_DEVICE_ID')
  process.exit(1)
}

const HEADERS = {
  'Content-Type':  'application/json',
  'apikey':        SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Prefer':        'return=representation',
}

// ── Retry-helper ──────────────────────────────────────────────────────────────
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
                            /\(5\d\d\)/.test(err.message)
      const isLogicaFout  = /\(4\d\d\)/.test(err.message)
      if (isLogicaFout || !isNetwerkFout || poging >= MAX_POGINGEN) throw err
      const wachtMs = BASIS_WACHT_MS * Math.pow(2, poging - 1)
      console.log(`  ⚠️  ${omschrijving} mislukt (poging ${poging}/${MAX_POGINGEN}), retry over ${wachtMs / 1000}s...`)
      await new Promise(r => setTimeout(r, wachtMs))
    }
  }
}

async function sbInsert(tabel, body) {
  return metRetry(`INSERT ${tabel}`, async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabel}`, {
      method: 'POST', headers: HEADERS, body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`INSERT ${tabel} (${res.status}): ${await res.text()}`)
    return res.json()
  })
}

async function sbPatch(tabel, filter, body) {
  return metRetry(`PATCH ${tabel}`, async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabel}?${filter}`, {
      method: 'PATCH', headers: HEADERS, body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`PATCH ${tabel} (${res.status}): ${await res.text()}`)
    return res.json()
  })
}

async function sbSelect(tabel, filter) {
  return metRetry(`SELECT ${tabel}`, async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabel}?${filter}`, {
      headers: { ...HEADERS, 'Prefer': 'return=representation' },
    })
    if (!res.ok) throw new Error(`SELECT ${tabel} (${res.status}): ${await res.text()}`)
    return res.json()
  })
}

// ── Tijdsbeheer ───────────────────────────────────────────────────────────────

function wachtTot(startMs, minuut) {
  const wacht = (startMs + minuut * 60_000) - Date.now()
  if (wacht <= 0) return Promise.resolve()
  const mm = Math.floor(wacht / 60_000)
  const ss = Math.floor((wacht % 60_000) / 1000)
  console.log(`  Wacht ${mm}m ${ss}s tot T+${minuut}min...`)
  return new Promise(r => setTimeout(r, wacht))
}

// ── Verificatie ───────────────────────────────────────────────────────────────

function berekenSaldi(deelnemers, transacties) {
  const gestort = {}, betaald = {}
  deelnemers.forEach(d => { gestort[d.id] = 0; betaald[d.id] = 0 })
  transacties.filter(t => t.type === 'storting')
    .forEach(t => { if (gestort[t.deelnemer_id] !== undefined) gestort[t.deelnemer_id] += Number(t.bedrag) })
  transacties.filter(t => t.type === 'betaling')
    .forEach(t => { if (betaald[t.deelnemer_id] !== undefined) betaald[t.deelnemer_id] += Number(t.bedrag) })
  const totG = Object.values(gestort).reduce((s, v) => s + v, 0)
  const totB = Object.values(betaald).reduce((s, v) => s + v, 0)
  const fac  = totG > 0 ? totB / totG : 0
  return {
    totaalGestort: totG, totaalBetaald: totB,
    uitgifte: totG > 0 ? totB / totG * 100 : 0,
    deelnemers: deelnemers.map(d => {
      const g   = Math.round(gestort[d.id] * 100) / 100
      const b   = Math.round(betaald[d.id] * 100) / 100
      const net = Math.round(g * fac * 100) / 100
      const ver = Math.round(Math.max(b - net, -g) * 100) / 100
      return { naam: d.naam, gestort: g, betaald: b, netto: net, verrekening: ver }
    }),
  }
}

// ── Scenario ──────────────────────────────────────────────────────────────────

const SCENARIO = {
  naam: '[SMOKE-T2] Zaterdagborrel', valuta: 'EUR', duurMinuten: 120,
  deelnemers: [
    { naam: 'Beek',    isBeek: true,  aankomstMinuut: 0  },
    { naam: 'Beer',    isBeek: false, aankomstMinuut: 0  },
    { naam: 'Poison',  isBeek: false, aankomstMinuut: 0, device_id: '96779e1b-3bf8-422c-a0df-ff4167931bd4' },
    { naam: 'Cynthia', isBeek: false, aankomstMinuut: 0  },
    { naam: 'Dijl',    isBeek: false, aankomstMinuut: 0  },
    { naam: 'Tesser',  isBeek: false, aankomstMinuut: 0  },
    { naam: 'Nadia',   isBeek: false, aankomstMinuut: 45 },
    { naam: 'Kwak',    isBeek: false, aankomstMinuut: 75 },
  ],
  events: [
    { minuut:   5, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut:   5, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut:   5, type: 'storting', naam: 'Poison',  bedrag:  6 },
    { minuut:   5, type: 'storting', naam: 'Cynthia', bedrag:  9 },
    { minuut:   5, type: 'storting', naam: 'Dijl',    bedrag:  8 },
    { minuut:   5, type: 'storting', naam: 'Tesser',  bedrag: 10 },
    { minuut:  40, type: 'storting', naam: 'Beek',    bedrag:  7 },
    { minuut:  40, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut:  40, type: 'storting', naam: 'Poison',  bedrag:  6 },
    { minuut:  40, type: 'storting', naam: 'Cynthia', bedrag:  8 },
    { minuut:  40, type: 'storting', naam: 'Dijl',    bedrag:  8 },
    { minuut:  40, type: 'storting', naam: 'Tesser',  bedrag: 10 },
    { minuut:  45, type: 'aankomst', naam: 'Nadia' },
    { minuut:  50, type: 'storting', naam: 'Nadia',   bedrag:  8 },
    { minuut:  55, type: 'betaling', naam: 'Beer',    bedrag: 98 },
    { minuut:  70, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut:  70, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut:  70, type: 'storting', naam: 'Poison',  bedrag:  6 },
    { minuut:  70, type: 'storting', naam: 'Cynthia', bedrag:  9 },
    { minuut:  70, type: 'storting', naam: 'Dijl',    bedrag:  8 },
    { minuut:  70, type: 'storting', naam: 'Tesser',  bedrag: 10 },
    { minuut:  75, type: 'aankomst', naam: 'Kwak' },
    { minuut:  80, type: 'storting', naam: 'Kwak',    bedrag:  4 },
    { minuut:  90, type: 'betaling', naam: 'Tesser',  bedrag: 56 },
    { minuut: 100, type: 'storting', naam: 'Beek',    bedrag:  7 },
    { minuut: 100, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut: 100, type: 'storting', naam: 'Poison',  bedrag:  6 },
    { minuut: 100, type: 'storting', naam: 'Cynthia', bedrag:  8 },
    { minuut: 100, type: 'storting', naam: 'Dijl',    bedrag:  8 },
    { minuut: 100, type: 'storting', naam: 'Tesser',  bedrag: 10 },
    { minuut: 108, type: 'storting', naam: 'Nadia',   bedrag:  8 },
    { minuut: 110, type: 'betaling', naam: 'Poison',  bedrag: 58 },
    { minuut: 115, type: 'storting', naam: 'Kwak',    bedrag:  4 },
    { minuut: 118, type: 'betaling', naam: 'Cynthia', bedrag:  6 },
    { minuut: 120, type: 'sluiting' },
  ],
  verwacht: {
    potTotaal: 220, potUitgaven: 218,
    saldi: {
      Beek: -29.73, Beer: 62.33, Poison: +34.22, Cynthia: -27.69,
      Dijl: -31.71, Tesser: 16.36, Nadia: -15.85, Kwak: -7.93,
    },
  },
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nDigipot Smoke Test T2 (v3) — Laat-aankomers')
  console.log('='.repeat(52))
  console.log(`Scenario : ${SCENARIO.naam}`)
  console.log(`Personen : 8 (Nadia T+45, Kwak T+75)`)
  console.log(`Duur     : ${SCENARIO.duurMinuten} minuten`)
  console.log('='.repeat(52))

  console.log('\nPotje aanmaken...')
  const [potje] = await sbInsert('potjes', {
    naam: SCENARIO.naam, status: 'open', valuta: SCENARIO.valuta,
  })
  console.log(`OK  : ${potje.id}`)
  console.log(`URL : https://digipot.pages.dev/potje/${potje.id}`)
  console.log(`      Open deze URL om live mee te kijken als Beek`)

  console.log('\nDeelnemers aanmaken (vroege aankomers)...')
  const dm = {}
  for (const d of SCENARIO.deelnemers.filter(d => d.aankomstMinuut === 0)) {
    const [rec] = await sbInsert('deelnemers', {
      potje_id: potje.id, naam: d.naam,
      device_id: d.isBeek ? SMOKE_DEVICE_ID : (d.device_id ?? crypto.randomUUID()),
    })
    dm[d.naam] = rec
    console.log(`  ${d.naam}${d.isBeek ? ' <- jij' : d.device_id ? ' <- Poison' : ''}`)
  }

  console.log('\nEvents uitvoeren...')
  const startMs = Date.now()
  const events  = [...SCENARIO.events].sort((a, b) => a.minuut - b.minuut)

  for (const ev of events) {
    await wachtTot(startMs, ev.minuut)

    if (ev.type === 'aankomst') {
      const def = SCENARIO.deelnemers.find(d => d.naam === ev.naam)
      const [rec] = await sbInsert('deelnemers', {
        potje_id: potje.id, naam: ev.naam,
        device_id: def?.isBeek ? SMOKE_DEVICE_ID : crypto.randomUUID(),
      })
      dm[ev.naam] = rec
      console.log(`  T+${String(ev.minuut).padStart(3)}m  aankomst  ${ev.naam}`)
    } else if (ev.type === 'storting') {
      await sbInsert('transacties', {
        potje_id: potje.id, deelnemer_id: dm[ev.naam].id,
        type: 'storting', bedrag: ev.bedrag,
      })
      console.log(`  T+${String(ev.minuut).padStart(3)}m  storting  ${ev.naam.padEnd(8)}  EUR ${ev.bedrag}`)
    } else if (ev.type === 'betaling') {
      await sbInsert('transacties', {
        potje_id: potje.id, deelnemer_id: dm[ev.naam].id,
        type: 'betaling', bedrag: ev.bedrag,
      })
      console.log(`  T+${String(ev.minuut).padStart(3)}m  betaling  ${ev.naam.padEnd(8)}  EUR ${ev.bedrag}`)
    } else if (ev.type === 'sluiting') {
      await sbPatch('potjes', `id=eq.${potje.id}`, {
        status: 'gesloten', gesloten_op: new Date().toISOString(), gesloten_door: dm['Beek'].id,
      })
      console.log(`  T+${String(ev.minuut).padStart(3)}m  GESLOTEN`)
    }
  }

  console.log('\nVerificatie...')
  const dbD = await sbSelect('deelnemers',  `potje_id=eq.${potje.id}`)
  const dbT = await sbSelect('transacties', `potje_id=eq.${potje.id}`)
  const res = berekenSaldi(dbD, dbT)

  console.log(`\nTotaal gestort : EUR ${res.totaalGestort.toFixed(2)} (verwacht ${SCENARIO.verwacht.potTotaal})`)
  console.log(`Totaal betaald : EUR ${res.totaalBetaald.toFixed(2)} (verwacht ${SCENARIO.verwacht.potUitgaven})`)
  console.log(`Uitgifte       : ${res.uitgifte.toFixed(1)}% (min 98%)`)
  console.log('')

  let ok = res.uitgifte >= 98.0
  for (const s of res.deelnemers) {
    const vw    = SCENARIO.verwacht.saldi[s.naam] ?? null
    const check = vw !== null ? Math.abs(s.verrekening - vw) < 0.06 : true
    if (!check) ok = false
    const vwStr = vw !== null ? `verwacht ${vw >= 0 ? '+' : ''}${vw.toFixed(2)}` : ''
    console.log(
      `  ${check ? 'OK  ' : 'FOUT'} ${s.naam.padEnd(8)} ` +
      `gestort ${s.gestort.toFixed(2).padStart(6)}  ` +
      `betaald ${s.betaald.toFixed(2).padStart(6)}  ` +
      `verrek ${(s.verrekening >= 0 ? '+' : '') + s.verrekening.toFixed(2).padStart(7)}  ${vwStr}`
    )
  }

  console.log('\n' + '='.repeat(52))
  console.log(ok ? 'T2 GESLAAGD' : 'T2 MISLUKT')
  console.log(`https://digipot.pages.dev/potje/${potje.id}`)
  console.log('='.repeat(52) + '\n')
  if (!ok) process.exit(1)
}

main().catch(err => { console.error('FOUT:', err.message); process.exit(1) })
