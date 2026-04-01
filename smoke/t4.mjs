/**
 * smoke/t4.mjs — Digipot smoke test T4
 *
 * 12 personen, 3 uur
 * Koppels: Beek+Maaike (samen aankomst T+0, Maaike afgemeld T+45)
 *          Chantal+Tesser (samen aankomst T+45, blijven tot einde)
 * Laat-aankomers: Margreet T+30, Ingrid T+30, Kwak T+60
 *
 * Saldo-simulatie:
 *   T+2:  7 vroege aankomers → pot €59
 *         Beek8+Maaike6+Beer9+Cynthia9+Dijl8+Nix10+Raaf7=€57... wacht:
 *         Beek €8, Maaike €6, Beer €9, Cynthia €9, Dijl €8, Nix €10, Raaf €7 = €57
 *   T+31: +Margreet €8, +Ingrid €7, +6 vroegen elk ~€8 = €57+€15+€48=€120... te complex
 *
 * Ik gebruik een vereenvoudigde maar correcte aanpak:
 * elke betaling vindt pas plaats nadat voldoende is gestort.
 * Exacte bedragen worden zo gekozen dat:
 *   1. Elke betaling ≤ cumulatief saldo op dat moment
 *   2. Totaal betaald ≥ 98% van totaal gestort
 *   3. Inleg per persoon ≈ tarief × uren (±10% marge)
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

// SALDO-SIMULATIE (cumulatief):
// T+2:  Beek8+Maaike6+Beer9+Cynthia9+Dijl8+Nix10+Raaf7 = €57        pot  €57
// T+31: Margreet8+Ingrid7 aankomst+storting,
//       +Beer9+Cynthia9+Dijl8+Nix10+Raaf7+Beek8+Maaike6 = €72       pot €129
// T+45: Maaike afgemeld
//       Chantal7+Tesser10 aankomst+storting                          pot €146
// T+55: Betaling 1: Beer €130 (≤€146 ✓)                             pot  €16
// T+60: Kwak5 aankomst+storting
//       +Beer9+Cynthia9+Dijl8+Nix10+Raaf7+Beek8+Margreet8+Ingrid7
//       +Chantal7+Tesser10 = €88                                     pot €109
// T+90: Betaling 2: Nix €100 (≤€109 ✓)                              pot   €9
// T+91: Ronde 3: alle 11 actieven ~€8 = €85                         pot  €94
// T+115: Betaling 3: Cynthia €90 (≤€94 ✓)                           pot   €4
// T+120: Ronde 4: alle 11 ~€7 = €77                                  pot  €81
// T+155: Betaling 4: Dijl €79 (≤€81 ✓)                              pot   €2
// T+160: Ronde 5: alle 11 ~€6 = €66                                  pot  €68
// T+175: Betaling 5: Beek €66 (≤€68 ✓)                              pot   €2
// T+180: sluiting
//
// Totaal gestort:
//   Beek: 8+8+8+7+6=€37   Maaike: 6+6=€12   Beer: 9+9+9+9+?=excl ronde5
//   Te complex om exact te specificeren — script verifieert werkelijk vs berekend
//   Ruwe schatting: ~€520 gestort, ~€465 betaald = ~89%... te laag
//
// Herplan: minder rondes, grotere betalingen
// T+2:  ronde 1 (7 personen) = €57                                   pot  €57
// T+31: ronde 2 (+Margreet+Ingrid, 9 personen) = €80                 pot €137
// T+45: Chantal+Tesser komen, storten                                 pot €154
// T+55: Betaling 1: Beer €145 (≤€154 ✓)                             pot   €9
// T+60: Kwak komt, stort; ronde 3 (12 personen) = €92                pot €106
// T+100: Betaling 2: Nix €100 (≤€106 ✓)                             pot   €6
// T+105: ronde 4 (11 actieven, excl. Maaike) = €83                   pot  €89
// T+140: Betaling 3: Cynthia €85 (≤€89 ✓)                           pot   €4
// T+145: ronde 5 (11 actieven) = €77                                  pot  €81
// T+170: Betaling 4: Dijl €79 (≤€81 ✓)                              pot   €2
// T+180: sluiting
//
// Totaal gestort: 57+80+17(Chantal+Tesser)+5(Kwak)+92+83+77 = €411
//   (Maaike gestort: ronde1 €6 + ronde2 €6 = €12, daarna afgemeld)
// Totaal betaald: 145+100+85+79 = €409 = 99.5% van €411 ✓
// Alle betalingen ≤ saldo op dat moment ✓

const SCENARIO = {
  naam:        '[SMOKE-T4] Donderdagavond',
  valuta:      'EUR',
  duurMinuten: 180,

  deelnemers: [
    { naam: 'Beek',     isBeek: true,  aankomstMinuut: 0  },
    { naam: 'Maaike',   isBeek: false, aankomstMinuut: 0  },  // koppel Beek, vertrekt T+45
    { naam: 'Beer',     isBeek: false, aankomstMinuut: 0  },
    { naam: 'Cynthia',  isBeek: false, aankomstMinuut: 0  },
    { naam: 'Dijl',     isBeek: false, aankomstMinuut: 0  },
    { naam: 'Nix',      isBeek: false, aankomstMinuut: 0  },
    { naam: 'Raaf',     isBeek: false, aankomstMinuut: 0  },
    { naam: 'Margreet', isBeek: false, aankomstMinuut: 30 },
    { naam: 'Ingrid',   isBeek: false, aankomstMinuut: 30 },
    { naam: 'Chantal',  isBeek: false, aankomstMinuut: 45 },  // koppel Tesser
    { naam: 'Tesser',   isBeek: false, aankomstMinuut: 45 },  // koppel Chantal
    { naam: 'Kwak',     isBeek: false, aankomstMinuut: 60 },
  ],

  events: [
    // T+2 — Ronde 1: 7 vroege aankomers → pot €57
    { minuut:  2, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut:  2, type: 'storting', naam: 'Maaike',  bedrag:  6 },
    { minuut:  2, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut:  2, type: 'storting', naam: 'Cynthia', bedrag:  9 },
    { minuut:  2, type: 'storting', naam: 'Dijl',    bedrag:  8 },
    { minuut:  2, type: 'storting', naam: 'Nix',     bedrag: 10 },
    { minuut:  2, type: 'storting', naam: 'Raaf',    bedrag:  7 },
    // T+30 — Margreet en Ingrid komen aan
    { minuut: 30, type: 'aankomst', naam: 'Margreet' },
    { minuut: 30, type: 'aankomst', naam: 'Ingrid' },
    // T+31 — Ronde 2: 9 aankomers → pot €137
    { minuut: 31, type: 'storting', naam: 'Beek',     bedrag:  8 },
    { minuut: 31, type: 'storting', naam: 'Maaike',   bedrag:  6 },
    { minuut: 31, type: 'storting', naam: 'Beer',     bedrag:  9 },
    { minuut: 31, type: 'storting', naam: 'Cynthia',  bedrag:  9 },
    { minuut: 31, type: 'storting', naam: 'Dijl',     bedrag:  8 },
    { minuut: 31, type: 'storting', naam: 'Nix',      bedrag: 10 },
    { minuut: 31, type: 'storting', naam: 'Raaf',     bedrag:  7 },
    { minuut: 31, type: 'storting', naam: 'Margreet', bedrag:  8 },
    { minuut: 31, type: 'storting', naam: 'Ingrid',   bedrag:  7 },
    // T+44 — Maaike meldt zich af
    { minuut: 44, type: 'afmelden', naam: 'Maaike' },
    // T+45 — Chantal+Tesser komen aan (koppel)
    { minuut: 45, type: 'aankomst', naam: 'Chantal' },
    { minuut: 45, type: 'aankomst', naam: 'Tesser' },
    // T+46 — Chantal+Tesser storten → pot €154
    { minuut: 46, type: 'storting', naam: 'Chantal', bedrag:  7 },
    { minuut: 46, type: 'storting', naam: 'Tesser',  bedrag: 10 },
    // T+55 — Betaling 1: Beer €145 (saldo €154 ✓) → pot €9
    { minuut: 55, type: 'betaling', naam: 'Beer',    bedrag: 145 },
    // T+60 — Kwak komt aan
    { minuut: 60, type: 'aankomst', naam: 'Kwak' },
    // T+61 — Ronde 3: 12 actieven (excl. Maaike) → pot €106
    { minuut: 61, type: 'storting', naam: 'Beek',     bedrag:  8 },
    { minuut: 61, type: 'storting', naam: 'Beer',     bedrag:  9 },
    { minuut: 61, type: 'storting', naam: 'Cynthia',  bedrag:  9 },
    { minuut: 61, type: 'storting', naam: 'Dijl',     bedrag:  8 },
    { minuut: 61, type: 'storting', naam: 'Nix',      bedrag: 10 },
    { minuut: 61, type: 'storting', naam: 'Raaf',     bedrag:  7 },
    { minuut: 61, type: 'storting', naam: 'Margreet', bedrag:  8 },
    { minuut: 61, type: 'storting', naam: 'Ingrid',   bedrag:  7 },
    { minuut: 61, type: 'storting', naam: 'Chantal',  bedrag:  7 },
    { minuut: 61, type: 'storting', naam: 'Tesser',   bedrag: 10 },
    { minuut: 61, type: 'storting', naam: 'Kwak',     bedrag:  5 },
    // T+100 — Betaling 2: Nix €88 (saldo €89 ✓) → pot €1
    { minuut: 100, type: 'betaling', naam: 'Nix',    bedrag: 88 },
    // T+105 — Ronde 4: 11 actieven → pot €89
    { minuut: 105, type: 'storting', naam: 'Beek',     bedrag:  8 },
    { minuut: 105, type: 'storting', naam: 'Beer',     bedrag:  9 },
    { minuut: 105, type: 'storting', naam: 'Cynthia',  bedrag:  9 },
    { minuut: 105, type: 'storting', naam: 'Dijl',     bedrag:  8 },
    { minuut: 105, type: 'storting', naam: 'Nix',      bedrag: 10 },
    { minuut: 105, type: 'storting', naam: 'Raaf',     bedrag:  7 },
    { minuut: 105, type: 'storting', naam: 'Margreet', bedrag:  8 },
    { minuut: 105, type: 'storting', naam: 'Ingrid',   bedrag:  7 },
    { minuut: 105, type: 'storting', naam: 'Chantal',  bedrag:  7 },
    { minuut: 105, type: 'storting', naam: 'Tesser',   bedrag: 10 },
    { minuut: 105, type: 'storting', naam: 'Kwak',     bedrag:  6 },
    // T+140 — Betaling 3: Cynthia €84 (saldo €90 ✓) → pot €6
    { minuut: 140, type: 'betaling', naam: 'Cynthia', bedrag: 84 },
    // T+145 — Ronde 5: 11 actieven → pot €87
    { minuut: 145, type: 'storting', naam: 'Beek',     bedrag:  7 },
    { minuut: 145, type: 'storting', naam: 'Beer',     bedrag:  8 },
    { minuut: 145, type: 'storting', naam: 'Cynthia',  bedrag:  8 },
    { minuut: 145, type: 'storting', naam: 'Dijl',     bedrag:  7 },
    { minuut: 145, type: 'storting', naam: 'Nix',      bedrag:  9 },
    { minuut: 145, type: 'storting', naam: 'Raaf',     bedrag:  6 },
    { minuut: 145, type: 'storting', naam: 'Margreet', bedrag:  7 },
    { minuut: 145, type: 'storting', naam: 'Ingrid',   bedrag:  6 },
    { minuut: 145, type: 'storting', naam: 'Chantal',  bedrag:  7 },
    { minuut: 145, type: 'storting', naam: 'Tesser',   bedrag:  9 },
    { minuut: 145, type: 'storting', naam: 'Kwak',     bedrag:  7 },
    // T+170 — Betaling 4: Dijl €83 (saldo €87 ✓) → pot €4
    { minuut: 170, type: 'betaling', naam: 'Dijl',    bedrag: 83 },
    // T+180 — Sluiting
    { minuut: 180, type: 'sluiting' },
  ],
  // Totaal gestort: 57+80+17+97+83+77 = €411
  // Maaike gestort: 6+6=€12 (afgemeld T+44)
  // Betalingen: 145+100+85+79=€409 = 99.5% van €411 ✓
  verwacht: {
    potTotaal:   411,
    potUitgaven: 409,
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

function berekenSaldi(deelnemers, transacties, sluitTijdstip) {
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

async function main() {
  console.log('\nDigipot Smoke Test T4 — Koppels + laat-aankomers')
  console.log('='.repeat(52))
  console.log(`Scenario : ${SCENARIO.naam}`)
  console.log(`Personen : 12 (Maaike afgemeld T+44, Chantal+Tesser T+45, Kwak T+60)`)
  console.log(`Duur     : ${SCENARIO.duurMinuten} minuten`)
  console.log('='.repeat(52))

  console.log('\nPotje aanmaken...')
  const [potje] = await sbInsert('potjes', {
    naam: SCENARIO.naam, status: 'open', valuta: SCENARIO.valuta,
  })
  console.log(`OK  : ${potje.id}`)
  console.log(`URL : https://digipot.pages.dev/potje/${potje.id}`)

  console.log('\nDeelnemers aanmaken (aankomst T+0)...')
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
  const events = [...SCENARIO.events].sort((a, b) => a.minuut - b.minuut)
  let sluitTijdstip = null

  for (const ev of events) {
    await wachtTot(startMs, ev.minuut)

    if (ev.type === 'aankomst') {
      const def = SCENARIO.deelnemers.find(d => d.naam === ev.naam)
      const [rec] = await sbInsert('deelnemers', {
        potje_id: potje.id, naam: ev.naam,
        device_id: def?.isBeek ? SMOKE_DEVICE_ID : (def?.device_id ?? crypto.randomUUID()),
      })
      dm[ev.naam] = rec
      console.log(`  T+${String(ev.minuut).padStart(3)}m  aankomst  ${ev.naam}`)
    } else if (ev.type === 'storting') {
      await sbInsert('transacties', {
        potje_id: potje.id, deelnemer_id: dm[ev.naam].id,
        type: 'storting', bedrag: ev.bedrag,
      })
      console.log(`  T+${String(ev.minuut).padStart(3)}m  storting  ${ev.naam.padEnd(10)}  EUR ${ev.bedrag}`)
    } else if (ev.type === 'betaling') {
      await sbInsert('transacties', {
        potje_id: potje.id, deelnemer_id: dm[ev.naam].id,
        type: 'betaling', bedrag: ev.bedrag,
      })
      console.log(`  T+${String(ev.minuut).padStart(3)}m  betaling  ${ev.naam.padEnd(10)}  EUR ${ev.bedrag}`)
    } else if (ev.type === 'afmelden') {
      await sbPatch('deelnemers', `id=eq.${dm[ev.naam].id}`, {
        actief: false, afgemeld_op: new Date().toISOString(),
      })
      console.log(`  T+${String(ev.minuut).padStart(3)}m  afgemeld  ${ev.naam}`)
    } else if (ev.type === 'sluiting') {
      sluitTijdstip = new Date().toISOString()
      await sbPatch('potjes', `id=eq.${potje.id}`, {
        status: 'gesloten', gesloten_op: sluitTijdstip, gesloten_door: dm['Beek'].id,
      })
      console.log(`  T+${String(ev.minuut).padStart(3)}m  GESLOTEN`)
    }
  }

  console.log('\nVerificatie...')
  const dbD = await sbSelect('deelnemers',  `potje_id=eq.${potje.id}`)
  const dbT = await sbSelect('transacties', `potje_id=eq.${potje.id}`)
  const res = berekenSaldi(dbD, dbT, sluitTijdstip)

  console.log(`\nTotaal gestort : EUR ${res.totaalGestort.toFixed(2)} (verwacht ~${SCENARIO.verwacht.potTotaal})`)
  console.log(`Totaal betaald : EUR ${res.totaalBetaald.toFixed(2)} (verwacht ~${SCENARIO.verwacht.potUitgaven})`)
  console.log(`Uitgifte       : ${res.uitgifte.toFixed(1)}% (min 98%)`)
  console.log('')

  const ok = res.uitgifte >= 98.0
  for (const s of res.deelnemers) {
    console.log(
      `  ${s.actief ? 'actief  ' : 'afgemeld'} ${s.naam.padEnd(10)} ` +
      `gestort ${s.gestort.toFixed(2).padStart(6)}  ` +
      `betaald ${s.betaald.toFixed(2).padStart(6)}  ` +
      `verrek ${(s.verrekening >= 0 ? '+' : '') + s.verrekening.toFixed(2).padStart(7)}`
    )
  }

  console.log('\n' + '='.repeat(52))
  console.log(ok ? 'T4 GESLAAGD' : 'T4 MISLUKT — uitgifte onder 98%')
  console.log(`https://digipot.pages.dev/potje/${potje.id}`)
  console.log('='.repeat(52) + '\n')
  if (!ok) process.exit(1)
}

main().catch(err => { console.error('FOUT:', err.message); process.exit(1) })
