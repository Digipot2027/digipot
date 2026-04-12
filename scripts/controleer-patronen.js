#!/usr/bin/env node
/**
 * scripts/controleer-patronen.js
 *
 * Controleert op verboden codepatronen die eerder tot productiefouten
 * hebben geleid. Faalt de CI als een blokkerend patroon gevonden wordt.
 *
 * GEBRUIK
 *   node scripts/controleer-patronen.js        # lokaal
 *   npm run lint:patronen                      # via package.json script
 *
 * EEN PATROON TOEVOEGEN
 *   Voeg een nieuw object toe aan PATRONEN hieronder. Doe dit altijd
 *   wanneer een fix een structureel risico blootlegt dat op meerdere
 *   plekken in de codebase kan voorkomen.
 *
 * STRUCTUUR PER PATROON
 *   patroon       — letterlijke string om naar te grep'en (geen regex)
 *   reden         — uitleg + verwijzing naar de bug/fix
 *   uitzonderingen — paden (relatief t.o.v. repo-root) waar het patroon WEL mag
 *   waarschuwing  — true = meldt maar blokkeert CI niet; false = blokkeert CI
 *
 * NOOT: testbestanden (src/test/) en commentaarregels worden automatisch
 * uitgesloten — die bevatten het patroon als tekst, niet als code.
 *
 * GESCHIEDENIS
 *   2026-04-12 — initieel: drie patronen uit grondige code-audit
 */

import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const PATRONEN = [
  {
    // Root cause van JAVASCRIPT-REACT-6 (null device_id in DB) én kritiek-1
    // (useMijnPotjes stille lege lijst). Direct aanroepen omzeilt de UUID-validatie
    // en fallback-logica in useDeviceId(). Buiten de uitzonderingen altijd verboden.
    patroon: 'localStorage.getItem(DEVICE_ID_KEY)',
    reden: [
      'Gebruik useDeviceId() in plaats van localStorage.getItem(DEVICE_ID_KEY) direct.',
      'Direct aanroepen omzeilt UUID-validatie en fallback-logica.',
      'Root cause: JAVASCRIPT-REACT-6 (null device_id) + kritiek-1 (stille lege lijst).',
    ].join(' '),
    uitzonderingen: [
      'src/hooks/useDeviceId.js',   // enige geautoriseerde implementatie van de hook zelf
      'src/supabaseClient.js',      // legitiem: meesturen als request-header, geen device-ID-logica
    ],
    waarschuwing: false,
  },

  {
    // .single() gooit PGRST116 wanneer een query 0 rijen retourneert.
    // Bij INSERT is 0 rijen theoretisch onmogelijk — .single() is daar veilig.
    // Bij UPDATE/SELECT kan 0 rijen optreden (race condition, lifecycle-verwijdering).
    // Kritiek-2: handleAfmelden gaf onjuiste "potje bestaat niet"-melding.
    // Gebruik .maybeSingle() als 0 rijen een geldige uitkomst is.
    patroon: '.single()',
    reden: [
      'Controleer of .maybeSingle() beter past.',
      '.single() gooit PGRST116 bij 0 rijen — misleidende foutmelding bij UPDATE/SELECT.',
      'Root cause: kritiek-2 (handleAfmelden onjuiste PGRST116-melding).',
      'Uitzondering: na INSERT is 0 rijen onmogelijk — .single() is daar correct.',
    ].join(' '),
    uitzonderingen: [
      // Na INSERT: DB-constraint garandeert altijd precies 1 rij
      'src/hooks/usePotjeActies.js',    // handleDeelnemen + handleTransactie (INSERT)
      'src/pages/PaginaNieuwPotje.jsx', // potje aanmaken (INSERT)
      // usePotje gebruikt .single() op SELECT — bewust geaccepteerd risico (TO §18 hoog-4)
      // want PGRST116 wordt hier al correct afgevangen door logFout/vertaalFout
      'src/hooks/usePotje.js',
    ],
    waarschuwing: true, // context bepaalt of het veilig is — geen harde blokkade
  },

  {
    // payload.new is undefined bij een Supabase realtime DELETE-event.
    // Gebruik van payload.new zonder null-check kan state op undefined zetten
    // waarna de UI stil breekt. Zie TO §18 risico-8.
    patroon: 'payload.new',
    reden: [
      'Controleer op null/undefined: payload.new is undefined bij DELETE-events.',
      'Gebruik if (payload.new) of abonneer specifiek op UPDATE in plaats van *.',
      'Risico: state wordt undefined, UI breekt zonder fout of Sentry-melding.',
    ].join(' '),
    uitzonderingen: [
      'src/hooks/usePotje.js', // bewust geaccepteerd + gedocumenteerd (TO §18 hoog-8)
    ],
    waarschuwing: true,
  },
]

// ── Uitvoering ────────────────────────────────────────────────────────────────

let aantalFouten = 0
let aantalWaarschuwingen = 0

for (const { patroon, reden, uitzonderingen = [], waarschuwing } of PATRONEN) {
  let grep = ''
  try {
    // --include sluit testbestanden en commentaar-zware utils uit:
    //   src/test/ — testbestanden bevatten patronen als strings/commentaar, geen code
    // Commentaarregels (beginnen met //) worden gefilterd in de post-processing.
    grep = execSync(
      `grep -rn --include="*.js" --include="*.jsx" \
        --exclude-dir="test" \
        "${patroon}" src/`,
      { encoding: 'utf-8', cwd: REPO_ROOT }
    )
  } catch {
    // grep exit code 1 = geen matches — gewenst resultaat
  }

  const gevonden = grep
    .split('\n')
    .filter(Boolean)
    // Sla commentaarregels over — die bevatten het patroon als tekst, niet als code
    .filter(regel => {
      const regeltekst = regel.split(':').slice(2).join(':').trimStart()
      return !regeltekst.startsWith('//')  && !regeltekst.startsWith('*')
    })
    // Sla uitzonderingsbestanden over
    .filter(regel => {
      const relatief = regel.split(':')[0]
      return !uitzonderingen.some(u =>
        relatief === u ||
        relatief.endsWith('/' + u.replace(/^src\//, '')) ||
        ('src/' + relatief).endsWith(u) ||
        relatief.endsWith(u.replace('src/', ''))
      )
    })

  if (gevonden.length === 0) continue

  const label = waarschuwing ? '⚠️  WAARSCHUWING' : '❌ FOUT'
  console.error(`\n${label}: patroon gevonden — "${patroon}"`)
  console.error(`Reden: ${reden}`)
  console.error('Gevonden in:')
  gevonden.forEach(r => console.error(`  ${r}`))

  waarschuwing ? aantalWaarschuwingen++ : aantalFouten++
}

// ── Samenvatting ──────────────────────────────────────────────────────────────

if (aantalFouten === 0 && aantalWaarschuwingen === 0) {
  console.log('✅ Geen verboden patronen gevonden.')
} else {
  if (aantalWaarschuwingen > 0) {
    console.error(`\n⚠️  ${aantalWaarschuwingen} waarschuwing(en) — controleer handmatig of de context correct is.`)
  }
  if (aantalFouten > 0) {
    console.error(`\n❌ ${aantalFouten} blokkerend fout(en) — los op voordat je pusht.`)
    process.exit(1)
  }
}
