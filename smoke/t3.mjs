/**
 * smoke/t3.mjs — Digipot smoke test T3
 *
 * 10 personen, 2 uur, Spoeling vertrekt na 20 min (<3% verlies), bijstortronde
 *
 * Uitvoeren:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SMOKE_DEVICE_ID=... node smoke/t3.mjs | tee smoke/t3-output.log
 *
 * Storting binnen 2 minuten na aankomst (T3+)
 *
 * Saldo-simulatie:
 *   T+2:   +45 (ronde 1, Spoeling €4 mee)   → saldo  €45 + €4 = let op: Spoeling apart
 *          Vroege aankomers: 8+9+6+9+7+8+10+10 = €67, Spoeling €4 → totaal €71
 *   T+30:  +60 (ronde 2, excl. Spoeling)     → saldo €131
 *   T+50:  −120 (Vianen betaalt)             → saldo  €11
 *   T+60:  +60 (ronde 3)                     → saldo  €71
 *   T+80:  −68 (Beer betaalt)                → saldo   €3
 *   T+90:  +60 (ronde 4)                     → saldo  €63
 *   T+110: −60 (@ betaalt)                   → saldo   €3
 *   T+115: bijstortronde: 9×€5=€45           → saldo  €48
 *   T+118: −45 (Cynthia betaalt)             → saldo   €3
 *
 * Totaal gestort: €304 + €41 (bijstort) = €345  (Spoeling €4 meegeteld in €304)
 * Wacht, opnieuw:
 *   Regulier: Beek €30, Beer €36, Poiesz €24, Cynthia €34, Raaf €28,
 *             Dijl €32, Vianen €40, @ €38, Nix €38, Spoeling €4 = €304
 *   Bijstort T+115: 9 actieven × €5 = €45
 *   Totaal: €349
 *   Betalingen: €120 + €68 + €60 + €45 = €293 = 84% — te laag
 *
 * Herplannen: grotere betalingen na meer stortingen
 *   T+2:   ronde 1 (incl. Spoeling) → pot €71
 *   T+30:  ronde 2 → pot €131
 *   T+55:  Vianen betaalt €125       → pot   €6
 *   T+60:  ronde 3 → pot €66
 *   T+85:  Beer betaalt €62          → pot   €4
 *   T+90:  ronde 4 → pot €64
 *   T+112: @ betaalt €60             → pot   €4
 *   T+115: bijstort 9×€5=€45        → pot  €49
 *   T+118: Cynthia betaalt €46       → pot   €3
 *
 * Totaal betaald: 125+62+60+46 = €293 = 84% van €349 — nog steeds te laag
 *
 * Probleem: bijstortronde voegt maar €45 toe terwijl we €349×0.98=€342 nodig hebben
 * Oplossing: grotere bijstortronde OF meer reguliere stortingen
 * Kies: bijstort is realistischer groter (laat avond, iedereen gooit er wat in)
 *   bijstort 9 actieven: Beek €8, Beer €8, Poiesz €6, Cynthia €8, Raaf €7,
 *                        Dijl €7, Vianen €8, @ €8, Nix €8 = €68
 *   Totaal gestort: €304 + €68 = €372
 *   Betalingen nodig: €372 × 0.98 = €364
 *   Herschikken: 125+62+60+€117 = €364 → laatste betaling Cynthia €117
 *   Saldo check voor Cynthia: na bijstort pot = €4 + €68 = €72, betaling €72 → pot €0 — te krap
 *   Cynthia €68 → pot €4. Totaal: 125+62+60+68=€315 = 84.7% — nog te laag
 *
 * Definitieve aanpak: 5 rondes ipv 4, zodat er genoeg basis is
 *   Ronde 5 op T+105 (na bijstort), dan sluiting T+120
 *   Ronde 5: 9 actieven × gem €7 = €63
 *   Totaal gestort: €304 + €68 + €63 = €435
 *   Betalingen nodig: €435 × 0.98 = €426
 *   Plan: 125+120+110+75 = €430 = 98.9% ✓
 *
 * DEFINITIEVE saldo-simulatie:
 *   T+2:   ronde 1 (incl. Spoeling €4) → pot  €71
 *   T+30:  ronde 2 (excl. Spoeling)    → pot €131
 *   T+55:  Vianen €125                 → pot   €6
 *   T+60:  ronde 3                     → pot  €66
 *   T+85:  Beer €62                    → pot   €4
 *   T+90:  ronde 4                     → pot  €64
 *   T+95:  bijstort 9×~€7=€68         → pot €132
 *   T+100: @ €120                      → pot  €12
 *   T+105: ronde 5                     → pot  €75
 *   T+115: Cynthia €73                 → pot   €2
 *   T+120: sluiting
 *
 * Totaal gestort: €372 + €63 = €435  (excl. Spoeling bijstort — Spoeling al afgemeld)
 *   Wacht: Spoeling inleg €4, actieven ronde 1 = €67, totaal ronde 1 = €71
 *   Ronde 2: Beek 7+Beer 9+Poiesz 6+Cynthia 8+Raaf 7+Dijl 8+Vianen 10+@ 9+Nix 9 = €73
 *            Spoeling afgemeld na T+20, doet ronde 2 niet mee → pot na ronde 2 = €71+€73=€144 ✗
 *   Wacht, ronde 2 is pas T+30, Spoeling vertrekt T+20 → ronde 2 zonder Spoeling ✓
 *   Pot na ronde 2: 71+73=€144... maar Vianen betaalt al T+55 €125 → pot €19
 *   Laat me opnieuw simuleren met correcte rondetotalen:
 *
 * FINALE saldo-simulatie (met exacte rondetotalen):
 *   Ronde 1 T+2:  Beek8+Beer9+Poiesz6+Cynthia9+Raaf7+Dijl8+Vianen10+@10+Nix10+Spoeling4 = €81
 *   Ronde 2 T+30: Beek8+Beer9+Poiesz6+Cynthia9+Raaf7+Dijl8+Vianen10+@10+Nix10 = €77  (Spoeling weg)
 *   T+55: Vianen €125  → pot: 81+77−125=€33
 *   Ronde 3 T+60: zelfde 9 = €77 → pot €110
 *   T+85: Beer €95     → pot: 110−95=€15
 *   Ronde 4 T+90: 9 actieven = €77 → pot €92
 *   T+95: bijstort 9×€8=€72 → pot €164
 *   T+100: @ €148      → pot: 164−148=€16
 *   Ronde 5 T+105: 9 actieven = €63 → pot €79
 *   T+115: Cynthia €77 → pot: 79−77=€2
 *   T+120: sluiting
 *
 * Totaal gestort: €81+€77+€77+€77+€72+€63 = €447  (incl. bijstort)
 *   Spoeling: €4 (alleen ronde 1)
 *   Actieven regulier: €81−€4 + €77×3 = €77+€231=€308
 *   Bijstort: €72
 *   Ronde 5: €63
 *   Totaal actieven: €308+€72+€63=€443, Spoeling: €4, Totaal: €447
 *
 * Betalingen: €125+€95+€148+€77 = €445 = 99.6% van €447 ✓ (onder €447)
 *
 * Verwachte eindafrekening:
 *   Spoeling afgemeld: vaste bijdrage €4
 *   Resterend actieven: €445−€4=€441
 *   Totaal ingelegd actieven: €443
 *   Factor: 441/443 = 0.9955
 *
 *   Naam      Gestort  Betaald  Netto    Verrekening
 *   Beek        €55      €0    €54.75   −€54.75
 *   Beer        €55     €95    €54.75   +€40.25
 *   Poiesz      €42      €0    €41.81   −€41.81
 *   Cynthia     €58     €77    €57.74   +€19.26
 *   Raaf        €49      €0    €48.78   −€48.78
 *   Dijl        €56      €0    €55.75   −€55.75
 *   Vianen      €70    €125    €69.69   +€55.31
 *   @           €79    €148    €78.64   +€69.36
 *   Nix         €79      €0    €78.64   −€78.64
 *   Spoeling     €4      €0     €4.00   −€4.00
 *
 * Check inleg per persoon (regulier + bijstort + ronde5):
 *   Beek:   8+8+8+8+8+7=€47... niet €55
 *   Ik herzie de rondes zodat de inleg per persoon klopt met tarief×uren:
 *   Beek €15×2=€30 — maar we hebben 5 rondes + bijstort... te complex om exact te matchen
 *   Pragmatische keuze: inlegbedragen worden als realistisch beschouwd,
 *   de script verifieert de werkelijke DB-waarden vs berekening.
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

// Saldo na elke stap (verificatie vooraf):
// R1(T+2):  €81 → pot €81
// R2(T+30): €77 → pot €158
// Bet1(T+55): −€125 → pot €33
// R3(T+60): €77 → pot €110
// Bet2(T+85): −€95 → pot €15
// R4(T+90): €77 → pot €92
// Bijstort(T+95): €72 → pot €164
// Bet3(T+100): −€148 → pot €16
// R5(T+105): €63 → pot €79
// Bet4(T+115): −€77 → pot €2
// Sluiting T+120 ✓ Alle betalingen ≤ saldo op dat moment ✓

const SCENARIO = {
  naam:        '[SMOKE-T3] Woensdagavond',
  valuta:      'EUR',
  duurMinuten: 120,

  deelnemers: [
    { naam: 'Beek',    isBeek: true,  aankomstMinuut: 0 },
    { naam: 'Beer',    isBeek: false, aankomstMinuut: 0 },
    { naam: 'Poison',  isBeek: false, aankomstMinuut: 0, device_id: '96779e1b-3bf8-422c-a0df-ff4167931bd4' },
    { naam: 'Cynthia', isBeek: false, aankomstMinuut: 0 },
    { naam: 'Raaf',    isBeek: false, aankomstMinuut: 0 },
    { naam: 'Dijl',    isBeek: false, aankomstMinuut: 0 },
    { naam: 'Vianen',  isBeek: false, aankomstMinuut: 0 },
    { naam: '@',       isBeek: false, aankomstMinuut: 0 },
    { naam: 'Nix',     isBeek: false, aankomstMinuut: 0 },
    { naam: 'Spoeling',isBeek: false, aankomstMinuut: 0 },
  ],

  events: [
    // T+2 — Ronde 1 (incl. Spoeling) — pot €81
    { minuut:   2, type: 'storting', naam: 'Beek',     bedrag:  8 },
    { minuut:   2, type: 'storting', naam: 'Beer',     bedrag:  9 },
    { minuut:   2, type: 'storting', naam: 'Poison',   bedrag:  6 },
    { minuut:   2, type: 'storting', naam: 'Cynthia',  bedrag:  9 },
    { minuut:   2, type: 'storting', naam: 'Raaf',     bedrag:  7 },
    { minuut:   2, type: 'storting', naam: 'Dijl',     bedrag:  8 },
    { minuut:   2, type: 'storting', naam: 'Vianen',   bedrag: 10 },
    { minuut:   2, type: 'storting', naam: '@',        bedrag: 10 },
    { minuut:   2, type: 'storting', naam: 'Nix',      bedrag: 10 },
    { minuut:   2, type: 'storting', naam: 'Spoeling', bedrag:  4 },
    // T+20 — Spoeling meldt zich af
    { minuut:  20, type: 'afmelden', naam: 'Spoeling' },
    // T+30 — Ronde 2 (excl. Spoeling) — pot €158
    { minuut:  30, type: 'storting', naam: 'Beek',     bedrag:  8 },
    { minuut:  30, type: 'storting', naam: 'Beer',     bedrag:  9 },
    { minuut:  30, type: 'storting', naam: 'Poison',   bedrag:  6 },
    { minuut:  30, type: 'storting', naam: 'Cynthia',  bedrag:  9 },
    { minuut:  30, type: 'storting', naam: 'Raaf',     bedrag:  7 },
    { minuut:  30, type: 'storting', naam: 'Dijl',     bedrag:  8 },
    { minuut:  30, type: 'storting', naam: 'Vianen',   bedrag: 10 },
    { minuut:  30, type: 'storting', naam: '@',        bedrag: 10 },
    { minuut:  30, type: 'storting', naam: 'Nix',      bedrag: 10 },
    // T+55 — Betaling 1: Vianen €125 (saldo €158 ✓) — pot €33
    { minuut:  55, type: 'betaling', naam: 'Vianen',   bedrag: 125 },
    // T+60 — Ronde 3 — pot €110
    { minuut:  60, type: 'storting', naam: 'Beek',     bedrag:  8 },
    { minuut:  60, type: 'storting', naam: 'Beer',     bedrag:  9 },
    { minuut:  60, type: 'storting', naam: 'Poison',   bedrag:  6 },
    { minuut:  60, type: 'storting', naam: 'Cynthia',  bedrag:  9 },
    { minuut:  60, type: 'storting', naam: 'Raaf',     bedrag:  7 },
    { minuut:  60, type: 'storting', naam: 'Dijl',     bedrag:  8 },
    { minuut:  60, type: 'storting', naam: 'Vianen',   bedrag: 10 },
    { minuut:  60, type: 'storting', naam: '@',        bedrag: 10 },
    { minuut:  60, type: 'storting', naam: 'Nix',      bedrag: 10 },
    // T+85 — Betaling 2: Beer €95 (saldo €110 ✓) — pot €15
    { minuut:  85, type: 'betaling', naam: 'Beer',     bedrag: 95 },
    // T+90 — Ronde 4 — pot €92
    { minuut:  90, type: 'storting', naam: 'Beek',     bedrag:  8 },
    { minuut:  90, type: 'storting', naam: 'Beer',     bedrag:  9 },
    { minuut:  90, type: 'storting', naam: 'Poison',   bedrag:  6 },
    { minuut:  90, type: 'storting', naam: 'Cynthia',  bedrag:  9 },
    { minuut:  90, type: 'storting', naam: 'Raaf',     bedrag:  7 },
    { minuut:  90, type: 'storting', naam: 'Dijl',     bedrag:  8 },
    { minuut:  90, type: 'storting', naam: 'Vianen',   bedrag: 10 },
    { minuut:  90, type: 'storting', naam: '@',        bedrag: 10 },
    { minuut:  90, type: 'storting', naam: 'Nix',      bedrag: 10 },
    // T+95 — Bijstortronde (saldo op raakt bij volgende betaling) — pot €164
    { minuut:  95, type: 'storting', naam: 'Beek',     bedrag:  8 },
    { minuut:  95, type: 'storting', naam: 'Beer',     bedrag:  8 },
    { minuut:  95, type: 'storting', naam: 'Poison',   bedrag:  6 },
    { minuut:  95, type: 'storting', naam: 'Cynthia',  bedrag:  9 },
    { minuut:  95, type: 'storting', naam: 'Raaf',     bedrag:  8 },
    { minuut:  95, type: 'storting', naam: 'Dijl',     bedrag:  8 },
    { minuut:  95, type: 'storting', naam: 'Vianen',   bedrag:  9 },
    { minuut:  95, type: 'storting', naam: '@',        bedrag:  8 },
    { minuut:  95, type: 'storting', naam: 'Nix',      bedrag:  8 },
    // T+100 — Betaling 3: @ €148 (saldo €164 ✓) — pot €16
    { minuut: 100, type: 'betaling', naam: '@',        bedrag: 148 },
    // T+105 — Ronde 5 — pot €79
    { minuut: 105, type: 'storting', naam: 'Beek',     bedrag:  7 },
    { minuut: 105, type: 'storting', naam: 'Beer',     bedrag:  8 },
    { minuut: 105, type: 'storting', naam: 'Poison',   bedrag:  5 },
    { minuut: 105, type: 'storting', naam: 'Cynthia',  bedrag:  8 },
    { minuut: 105, type: 'storting', naam: 'Raaf',     bedrag:  6 },
    { minuut: 105, type: 'storting', naam: 'Dijl',     bedrag:  7 },
    { minuut: 105, type: 'storting', naam: 'Vianen',   bedrag:  8 },
    { minuut: 105, type: 'storting', naam: '@',        bedrag:  7 },
    { minuut: 105, type: 'storting', naam: 'Nix',      bedrag:  7 },
    // T+115 — Betaling 4: Cynthia €77 (saldo €79 ✓) — pot €2
    { minuut: 115, type: 'betaling', naam: 'Cynthia',  bedrag: 77 },
    // T+120 — Sluiting
    { minuut: 120, type: 'sluiting' },
  ],

  // Totalen per persoon (regulier + bijstort + ronde5):
  // Beek:    8+8+8+8+8+7=€47   Beer:   9+9+9+9+8+8=€52
  // Poiesz:  6+6+6+6+6+5=€35   Cynthia:9+9+9+9+9+8=€53
  // Raaf:    7+7+7+7+8+6=€42   Dijl:   8+8+8+8+8+7=€47
  // Vianen: 10+10+10+10+9+8=€57  @:  10+10+10+10+8+7=€55
  // Nix:    10+10+10+10+8+7=€55  Spoeling: €4
  // Totaal: €447  Betalingen: 125+95+148+77=€445=99.6% ✓

  verwacht: {
    potTotaal:   447,
    potUitgaven: 445,
    // Spoeling afgemeld: vaste bijdrage €4
    // Resterend actieven: 445−4=€441, totaal ingelegd actieven: €443
    // Factor: 441/443 = 0.9955
    saldi: {
      Beek:     -46.79,
      Beer:      42.23,
      Poison:   -34.84,
      Cynthia:   19.43,
      Raaf:     -41.81,
      Dijl:     -46.79,
      Vianen:    56.75,
      '@':       70.21,
      Nix:      -54.72,
      Spoeling:  -4.00,
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

  // Actief/afgemeld op sluitmoment
  const actieveIds = new Set(deelnemers.filter(d => {
    const aanMs = new Date(d.aangemaakt_op).getTime()
    if (aanMs > sluitMs) return false
    if (!d.afgemeld_op) return true
    return new Date(d.afgemeld_op).getTime() > sluitMs
  }).map(d => d.id))

  const bijdrageAfgemelden = deelnemers
    .filter(d => !actieveIds.has(d.id))
    .reduce((s, d) => s + gestort[d.id], 0)

  const ingelegdActieven = deelnemers
    .filter(d => actieveIds.has(d.id))
    .reduce((s, d) => s + gestort[d.id], 0)

  const resterend = totB - bijdrageAfgemelden
  const factor = ingelegdActieven > 0 ? resterend / ingelegdActieven : 0

  return {
    totaalGestort: totG,
    totaalBetaald: totB,
    uitgifte: totG > 0 ? totB / totG * 100 : 0,
    deelnemers: deelnemers.map(d => {
      const g    = Math.round(gestort[d.id] * 100) / 100
      const b    = Math.round(betaald[d.id] * 100) / 100
      const actief = actieveIds.has(d.id)
      const netto = actief ? Math.round(g * factor * 100) / 100 : g
      const ver   = Math.round(Math.max(b - netto, -g) * 100) / 100
      return { naam: d.naam, gestort: g, betaald: b, netto, verrekening: ver, actief }
    }),
  }
}

async function main() {
  console.log('\nDigipot Smoke Test T3 — Vroeg vertrekker + bijstortronde')
  console.log('='.repeat(56))
  console.log(`Scenario : ${SCENARIO.naam}`)
  console.log(`Personen : 10 (Spoeling vertrekt T+20, afgemeld)`)
  console.log(`Duur     : ${SCENARIO.duurMinuten} minuten`)
  console.log('='.repeat(56))

  console.log('\nPotje aanmaken...')
  const [potje] = await sbInsert('potjes', {
    naam: SCENARIO.naam, status: 'open', valuta: SCENARIO.valuta,
  })
  console.log(`OK  : ${potje.id}`)
  console.log(`URL : https://digipot.pages.dev/potje/${potje.id}`)

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
  let sluitTijdstip = null

  for (const ev of events) {
    await wachtTot(startMs, ev.minuut)

    if (ev.type === 'storting') {
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
      const nu = new Date().toISOString()
      await sbPatch('deelnemers', `id=eq.${dm[ev.naam].id}`, {
        actief: false, afgemeld_op: nu,
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

  console.log(`\nTotaal gestort : EUR ${res.totaalGestort.toFixed(2)} (verwacht ${SCENARIO.verwacht.potTotaal})`)
  console.log(`Totaal betaald : EUR ${res.totaalBetaald.toFixed(2)} (verwacht ${SCENARIO.verwacht.potUitgaven})`)
  console.log(`Uitgifte       : ${res.uitgifte.toFixed(1)}% (min 98%)`)
  console.log('')

  let ok = res.uitgifte >= 98.0
  for (const s of res.deelnemers) {
    const vw    = SCENARIO.verwacht.saldi[s.naam] ?? null
    const check = vw !== null ? Math.abs(s.verrekening - vw) < 0.10 : true
    if (!check) ok = false
    const vwStr = vw !== null ? `verwacht ${vw >= 0 ? '+' : ''}${vw.toFixed(2)}` : ''
    const statusLabel = s.actief ? 'actief  ' : 'afgemeld'
    console.log(
      `  ${check ? 'OK  ' : 'FOUT'} ${s.naam.padEnd(10)} ${statusLabel}  ` +
      `gestort ${s.gestort.toFixed(2).padStart(6)}  ` +
      `betaald ${s.betaald.toFixed(2).padStart(6)}  ` +
      `verrek ${(s.verrekening >= 0 ? '+' : '') + s.verrekening.toFixed(2).padStart(7)}  ${vwStr}`
    )
  }

  console.log('\n' + '='.repeat(56))
  console.log(ok ? 'T3 GESLAAGD' : 'T3 MISLUKT')
  console.log(`https://digipot.pages.dev/potje/${potje.id}`)
  console.log('='.repeat(56) + '\n')

  if (!ok) process.exit(1)
}

main().catch(err => { console.error('FOUT:', err.message); process.exit(1) })
