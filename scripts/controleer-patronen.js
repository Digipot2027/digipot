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
 *   2026-04-12 — PaginaNieuwPotje.jsx uitzondering verwijderd voor .single():
 *                .single() is daar verwijderd na hoog-4 fix (audit bevinding 3)
 *   2026-04-13 — vierde patroon toegevoegd: [...prev, payload.new] zonder deduplicatie
 *                root cause UI-dubbelpost (fetch + Realtime-event race condition)
 *   2026-04-16 — vijfde patroon toegevoegd: localStorage. (directe aanroep)
 *                root cause storage-abstractielaag: alle toegang via src/utils/storage.js
 *                eerste patroon bijgewerkt: uitzonderingen verwijderd na migratie
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
    // Na de storage-abstractielaag (2026-04-16) zijn alle directe aanroepen
    // gemigreerd naar storage.js — dit patroon blijft als extra zekerheidslaag.
    patroon: 'localStorage.getItem(DEVICE_ID_KEY)',
    reden: [
      'Gebruik useDeviceId() in plaats van localStorage.getItem(DEVICE_ID_KEY) direct.',
      'Direct aanroepen omzeilt UUID-validatie en fallback-logica.',
      'Root cause: JAVASCRIPT-REACT-6 (null device_id) + kritiek-1 (stille lege lijst).',
    ].join(' '),
    uitzonderingen: [
      // Na storage-abstractie (2026-04-16): geen uitzonderingen meer nodig.
      // useDeviceId.js en supabaseClient.js gebruiken nu getItem() uit storage.js.
    ],
    waarschuwing: false,
  },

  {
    // .single() gooit PGRST116 wanneer een query 0 rijen retourneert.
    // Bij INSERT is 0 rijen theoretisch onmogelijk — .single() is daar veilig,
    // maar alleen als de returnwaarde niet nodig is voor navigatie of state.
    // Gebruik bij twijfel .maybeSingle() + null-check.
    // Root cause kritiek-2: handleAfmelden gaf onjuiste "potje bestaat niet"-melding.
    // Hoog-4: PaginaNieuwPotje had zelfde patroon — opgelost door client-side UUID.
    // Audit bevinding 1: handleDeelnemen had zelfde patroon — opgelost door client-side UUID.
    patroon: '.single()',
    reden: [
      'Controleer of .maybeSingle() beter past.',
      '.single() gooit PGRST116 bij 0 rijen — misleidende foutmelding bij UPDATE/SELECT.',
      'Na INSERT: overweeg client-side UUID i.p.v. .select().single() (zie hoog-4, bevinding-1).',
    ].join(' '),
    uitzonderingen: [
      // handleTransactie: INSERT op transacties — DB-constraint garandeert 1 rij,
      // returnwaarde is nodig voor de undo-handler (data.id). .single() is hier correct.
      'src/hooks/usePotjeActies.js',
      // usePotje: SELECT op potjes — PGRST116 wordt correct afgevangen door
      // logFout/vertaalFout als "potje niet gevonden". Bewust geaccepteerd risico.
      'src/hooks/usePotje.js',
    ],
    waarschuwing: true,
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
      'src/hooks/useMijnPotjes.js', // payload.new?.id en payload.new?.potje_id — optional chaining, veilig
    ],
    waarschuwing: true,
  },

  {
    // Centrale localStorage-abstractielaag (2026-04-16): alle toegang tot
    // localStorage verloopt via src/utils/storage.js (getItem/setItem/removeItem).
    // Direct aanroepen omzeilt de foutafhandeling en maakt mocking in tests
    // onmogelijk. Enige uitzondering: de abstractielaag zelf.
    patroon: 'localStorage.',
    reden: [
      'Gebruik getItem/setItem/removeItem uit src/utils/storage.js.',
      'Direct localStorage aanroepen omzeilt foutafhandeling en is niet mockbaar.',
      'Zie TO §storage-abstractie (2026-04-16).',
    ].join(' '),
    uitzonderingen: [
      'src/utils/storage.js', // enige geautoriseerde implementatie
    ],
    waarschuwing: false,
  },

  {
    // Root cause UI-dubbelpost (2026-04-13): Realtime INSERT-reducers zonder
    // deduplicatie voegen een rij twee keer toe als de initiële fetch en het
    // Realtime-event elkaar overlappen op het moment van navigatie.
    // Het patroon [...prev, payload.new] is altijd onveilig in een INSERT-handler.
    // Correct: prev.some(t => t.id === payload.new.id) ? prev : [...prev, payload.new]
    patroon: '...prev, payload.new]',
    reden: [
      'Realtime INSERT-reducer zonder deduplicatie — UI kan dezelfde rij twee keer tonen.',
      'Gebruik: prev.some(t => t.id === payload.new.id) ? prev : [...prev, payload.new]',
      'Root cause UI-dubbelpost 2026-04-13: fetch + Realtime-event leverden zelfde rij twee keer.',
    ].join(' '),
    uitzonderingen: [
      // usePotje.js: de deduplicatie-regel zelf bevat het patroon als onderdeel
      // van de safe variant — prev.some(...) ? prev : [...prev, payload.new]
      // Dit is precies de correcte implementatie, geen overtreding.
      'src/hooks/usePotje.js',
      // useMijnPotjes.js: gebruikt herlaad()-strategie, geen [...prev, payload.new]
      // patroon in reducers — de match is een false positive op een includes()-check.
      'src/hooks/useMijnPotjes.js',
    ],
    waarschuwing: false,
  },
]

// ── Uitvoering ────────────────────────────────────────────────────────────────

let aantalFouten = 0
let aantalWaarschuwingen = 0

for (const { patroon, reden, uitzonderingen = [], waarschuwing } of PATRONEN) {
  let grep = ''
  try {
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
    .filter(regel => {
      const regeltekst = regel.split(':').slice(2).join(':').trimStart()
      return !regeltekst.startsWith('//') && !regeltekst.startsWith('*')
    })
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
