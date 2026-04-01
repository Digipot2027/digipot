/**
 * smoke/t1.mjs — Digipot smoke test T1 (v2)
 *
 * Fix t.o.v. v1: alle events (stortingen + betalingen + sluiting) zitten
 * in één gesorteerde event queue. Ze worden op volgorde van tijdstip
 * uitgevoerd — niet in aparte loops die elkaar blokkeren.
 *
 * Uitvoeren:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SMOKE_DEVICE_ID=... node smoke/t1.mjs
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

const SCENARIO = {
  naam:        '[SMOKE-T1] Vrijdagmibo',
  valuta:      'EUR',
  duurMinuten: 60,

  deelnemers: [
    { naam: 'Beek',    isBeek: true  },
    { naam: 'Beer',    isBeek: false },
    { naam: 'Poison',  isBeek: false, device_id: '96779e1b-3bf8-422c-a0df-ff4167931bd4' },
    { naam: 'Tesser',  isBeek: false },
    { naam: 'Chantal', isBeek: false },
  ],

  // Alle events op volgorde van tijdstip
  events: [
    { minuut:  5, type: 'storting', naam: 'Beek',    bedrag: 5  },
    { minuut:  5, type: 'storting', naam: 'Beer',    bedrag: 6  },
    { minuut:  5, type: 'storting', naam: 'Poison',  bedrag: 4  },
    { minuut:  5, type: 'storting', naam: 'Tesser',  bedrag: 7  },
    { minuut:  5, type: 'storting', naam: 'Chantal', bedrag: 4  },
    { minuut: 15, type: 'betaling', naam: 'Beer',    bedrag: 26 },
    { minuut: 25, type: 'storting', naam: 'Beek',    bedrag: 5  },
    { minuut: 25, type: 'storting', naam: 'Beer',    bedrag: 6  },
    { minuut: 25, type: 'storting', naam: 'Poison',  bedrag: 4  },
    { minuut: 25, type: 'storting', naam: 'Tesser',  bedrag: 7  },
    { minuut: 25, type: 'storting', naam: 'Chantal', bedrag: 5  },
    { minuut: 35, type: 'betaling', naam: 'Tesser',  bedrag: 27 },
    { minuut: 45, type: 'storting', naam: 'Beek',    bedrag: 5  },
    { minuut: 45, type: 'storting', naam: 'Beer',    bedrag: 6  },
    { minuut: 45, type: 'storting', naam: 'Poison',  bedrag: 4  },
    { minuut: 45, type: 'storting', naam: 'Tesser',  bedrag: 6  },
    { minuut: 45, type: 'storting', naam: 'Chantal', bedrag: 4  },
    { minuut: 55, type: 'betaling', naam: 'Beek',    bedrag: 24 },
    { minuut: 60, type: 'sluiting' },
  ],

  verwacht: {
    potTotaal:   78,
    potUitgaven: 77,
    // Gestort=78, betaald=77 (Beer26+Tesser27+Beek24), uitgifte=98.7%, factor=77/78=0.9872
    // Beek:    gestort15, betaald24, netto14.81, verrek+9.19
    // Beer:    gestort18, betaald26, netto17.77, verrek+8.23
    // Poiesz:  gestort12, betaald 0, netto11.85, verrek-11.85
    // Tesser:  gestort20, betaald27, netto19.74, verrek+7.26
    // Chantal: gestort13, betaald 0, netto12.83, verrek-12.83
    saldi: {
      Beek:     9.19,
      Beer:     8.23,
      Poison: -11.85,
      Tesser:   7.26,
      Chantal: -12.83,
    },
  },
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

function wachtTot(startMs, minuut) {
  const wacht = (startMs + minuut * 60_000) - Date.now()
  if (wacht <= 0) return Promise.resolve()
  const mm = Math.floor(wacht / 60_000)
  const ss = Math.floor((wacht % 60_000) / 1000)
  console.log(`  Wacht ${mm}m ${ss}s tot T+${minuut}min...`)
  return new Promise(r => setTimeout(r, wacht))
}

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

async function main() {
  console.log('\nDigipot Smoke Test T1 (v2)')
  console.log('='.repeat(50))
  console.log(`Scenario: ${SCENARIO.naam}`)
  console.log(`Personen: ${SCENARIO.deelnemers.length} | Duur: ${SCENARIO.duurMinuten}min`)
  console.log('='.repeat(50))

  console.log('\nPotje aanmaken...')
  const [potje] = await sbInsert('potjes', {
    naam: SCENARIO.naam, status: 'open', valuta: SCENARIO.valuta,
  })
  console.log(`OK: ${potje.id}`)
  console.log(`URL: https://digipot.pages.dev/potje/${potje.id}`)

  console.log('\nDeelnemers aanmaken...')
  const dm = {}
  for (const d of SCENARIO.deelnemers) {
    const [rec] = await sbInsert('deelnemers', {
      potje_id:  potje.id,
      naam:      d.naam,
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

    if (ev.type === 'storting') {
      await sbInsert('transacties', {
        potje_id: potje.id, deelnemer_id: dm[ev.naam].id,
        type: 'storting', bedrag: ev.bedrag,
      })
      console.log(`  T+${String(ev.minuut).padStart(2)}m  storting  ${ev.naam.padEnd(8)}  EUR ${ev.bedrag}`)

    } else if (ev.type === 'betaling') {
      await sbInsert('transacties', {
        potje_id: potje.id, deelnemer_id: dm[ev.naam].id,
        type: 'betaling', bedrag: ev.bedrag,
      })
      console.log(`  T+${String(ev.minuut).padStart(2)}m  betaling  ${ev.naam.padEnd(8)}  EUR ${ev.bedrag}`)

    } else if (ev.type === 'sluiting') {
      await sbPatch('potjes', `id=eq.${potje.id}`, {
        status: 'gesloten',
        gesloten_op: new Date().toISOString(),
        gesloten_door: dm['Beek'].id,
      })
      console.log(`  T+${String(ev.minuut).padStart(2)}m  GESLOTEN`)
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
    const vw     = SCENARIO.verwacht.saldi[s.naam] ?? null
    const check  = vw !== null ? Math.abs(s.verrekening - vw) < 0.06 : true
    if (!check) ok = false
    const vwStr  = vw !== null ? `verwacht ${vw >= 0 ? '+' : ''}${vw.toFixed(2)}` : ''
    console.log(
      `  ${check ? 'OK' : 'FOUT'} ${s.naam.padEnd(8)} ` +
      `gestort ${s.gestort.toFixed(2).padStart(6)}  ` +
      `betaald ${s.betaald.toFixed(2).padStart(6)}  ` +
      `verrek ${(s.verrekening >= 0 ? '+' : '') + s.verrekening.toFixed(2).padStart(6)}  ${vwStr}`
    )
  }

  console.log('\n' + '='.repeat(50))
  console.log(ok ? 'T1 GESLAAGD' : 'T1 MISLUKT')
  console.log(`https://digipot.pages.dev/potje/${potje.id}`)
  console.log('='.repeat(50) + '\n')

  if (!ok) process.exit(1)
}

main().catch(err => { console.error('FOUT:', err.message); process.exit(1) })
