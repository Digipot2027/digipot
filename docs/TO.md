# Technisch Ontwerp — Digipot

**Versie:** 2.1
**Datum:** 2026-04-12
**Status:** Actueel
**Auteur:** Projectteam Digipot

---

## Inhoudsopgave

1. Systeemoverzicht
2. Stack en dependencies
3. Projectstructuur
4. Routering
5. Datamodel
6. Supabase — databaseconstraints en RLS
7. Realtime synchronisatie
8. Componenten
9. Pagina's
10. Hooks
11. Utilities
12. State management
13. Gebruikersidentificatie
14. Berekenlogica
15. Foutafhandeling en logging
16. Beveiliging
17. Toegankelijkheid (WCAG 2.1/2.2 AA)
18. Testen
19. Build en deployment
20. Uitgestelde functionaliteit — Multicurrency
21. Wijzigingslog
22. Cloudflare Worker — Lifecycle Cron (vervallen)
23. Supabase Edge Functions — Lifecycle

---

## 1. Systeemoverzicht

Digipot is een client-side React-applicatie die communiceert met een Supabase-backend (PostgreSQL + Realtime). Er is geen eigen server, geen sessiebeheer en geen authenticatie. De applicatie is een SPA (Single Page Application) gebouwd met Vite.

```
Browser (React SPA)
    │
    ├── Supabase REST API  (CRUD via postgrest)
    ├── Supabase Realtime  (WebSocket — Postgres Changes)
    └── Sentry             (foutlogging, alleen productie)

pg_cron (in Supabase DB)
    │  (3 geplande jobs + 2 legacy directe DB-jobs)
    └── net.http_post → Supabase Edge Functions (met x-cron-secret, SEC-CRON)
            ├── lifecycle-sluiten   → lifecycle_sluit_verlopen_potjes()
            ├── lifecycle-verwijderen → lifecycle_verwijder_oude_potjes()
            └── lifecycle-keepalive → GET /potjes?limit=1 (ping)
```

---

## 2. Stack en dependencies

| Onderdeel | Technologie | Versie |
|---|---|---|
| Framework | React | 19 |
| Router | React Router | 7 |
| Bundler | Vite | 8 |
| Backend | Supabase (PostgreSQL + Realtime) | — |
| Foutlogging | Sentry (`@sentry/react`) | — |
| Testen | Vitest + @testing-library/react | — |
| Test-DOM | @testing-library/jest-dom | — |
| Testomgeving | jsdom | — |
| TypeScript | Nee | — |
| UI-library | Nee (eigen CSS-variabelen) | — |
| Global state | Nee (lokale state per hook/component) | — |

### Omgevingsvariabelen (`.env.local`)

| Variabele | Gebruik |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project-URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonieme sleutel (publiek) |
| `VITE_SENTRY_DSN` | Sentry DSN (optioneel, alleen productie) |

Beide Supabase-variabelen worden gevalideerd bij opstarten in `supabaseClient.js`. Ontbrekende variabelen gooien een `Error` vóór de app rendert.

---

## 3. Projectstructuur

```
digipot/
├── workers/
│   └── lifecycle-cron/          ← Cloudflare Worker (lifecycle cron, vervallen — zie §22)
│       ├── src/
│       │   └── index.js
│       ├── wrangler.toml
│       ├── package.json
│       ├── .gitignore
│       └── .dev.vars.example
├── docs/
│   ├── FO.md                  ← Functioneel Ontwerp
│   └── TO.md                  ← Technisch Ontwerp (dit document)
├── public/
├── src/
│   ├── App.jsx                ← routedefinities
│   ├── main.jsx               ← entry point, Sentry init, tekstgrootte
│   ├── index.css              ← globale stijlen en CSS-variabelen
│   ├── supabaseClient.js      ← Supabase client (singleton)
│   ├── constants.js           ← centrale constanten
│   ├── components/
│   │   ├── DeelKnop.jsx
│   │   ├── DeelnemerDetailSheet.jsx
│   │   ├── DeelnemerRij.jsx
│   │   ├── ErrorBoundary.jsx
│   │   ├── ModalAfmelden.jsx
│   │   ├── ModalDeelnemen.jsx
│   │   ├── ModalSluiten.jsx
│   │   └── ModalTransactie.jsx
│   ├── hooks/
│   │   ├── useDeviceId.js
│   │   ├── useFocusTrap.js
│   │   ├── useMijnPotjes.js
│   │   ├── usePotje.js
│   │   └── usePotjeActies.js
│   ├── pages/
│   │   ├── PaginaEindafrekening.jsx
│   │   ├── PaginaGeslotenPotjes.jsx
│   │   ├── PaginaInstellingen.jsx
│   │   ├── PaginaNietGevonden.jsx
│   │   ├── PaginaNieuwPotje.jsx
│   │   ├── PaginaOpenPotjes.jsx
│   │   ├── PaginaOverzicht.jsx
│   │   ├── PaginaPotje.jsx
│   │   ├── PaginaProfiel.jsx
│   │   └── PaginaStorten.jsx
│   ├── utils/
│   │   ├── berekenSaldi.js
│   │   ├── deelLink.js
│   │   ├── formatBedrag.js
│   │   ├── logFout.js
│   │   ├── valideer.js
│   │   └── vertaalFout.js
│   └── test/
│       ├── setup.js
│       ├── berekenSaldi.test.js
│       ├── berekenSaldi.regressie.test.js
│       ├── berekenVereffening.test.js
│       ├── deelLink.test.js
│       ├── deelnemerRij.regressie.test.js
│       ├── errorBoundary.regressie.test.js
│       ├── filterLogica.regressie.test.js
│       ├── formatBedrag.test.js
│       ├── handleUndo.regressie.test.js
│       ├── logFout.supabase.test.js
│       ├── logFout.test.js
│       ├── paginaEindafrekening.regressie.test.js
│       ├── paginaStorten.gesloten.regressie.test.js
│       ├── paginaStorten.insertFout.regressie.test.js
│       ├── paginaStorten.regressie.test.js
│       ├── stap1.regressie.test.js
│       ├── stap6.regressie.test.js
│       ├── useDeviceId.regressie.test.js
│       ├── useMijnPotjes.eq.regressie.test.js
│       ├── useMijnPotjes.herlaad.test.js
│       ├── useMijnPotjes.regressie.test.js
│       ├── usePotje.delete.regressie.test.js
│       ├── usePotje.regressie.test.js
│       ├── usePotjeActies.regressie.test.js
│       ├── valideer.test.js
│       ├── vertaalFout.nieuw.test.js        ← VF-N-06 verwachting gecorrigeerd
│       ├── vertaalFout.pgrst116.regressie.test.js  ← nieuw (PGRST116)
│       └── vertaalFout.test.js
├── supabase-migratie-stap14.sql … stap22.sql
├── supabase-verificatie.sql
├── vite.config.js
├── eslint.config.js
└── package.json
```

---

## 4. Routering

React Router 7, `BrowserRouter`, client-side routing.

| Route | Component | Beschrijving |
|---|---|---|
| `/` | `PaginaNieuwPotje` | Aanmaken |
| `/potje/:id` | `PaginaPotje` | Overzicht, Deelnemer-modal of Eindafrekening |
| `/potje/:id/storten` | `PaginaStorten` | Storten/Inleggen |
| `/instellingen` | `PaginaInstellingen` | Instellingen |
| `/instellingen/profiel` | `PaginaProfiel` | Profiel |
| `/instellingen/open` | `PaginaOpenPotjes` | Open potjes |
| `/instellingen/gesloten` | `PaginaGeslotenPotjes` | Gesloten potjes |
| `*` | `PaginaNietGevonden` | Catch-all voor onbekende routes |

`PaginaEindafrekening` is geen eigen route. Het wordt inline gerenderd door `PaginaPotje` wanneer `potje.status === 'gesloten'`.

`ErrorBoundary` omhult de gehele routerstructuur en vangt onverwachte renderfouten op.

---

## 5. Datamodel

### Tabel: `potjes`

| Kolom | Type | Constraint |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `naam` | varchar(30) | NOT NULL |
| `status` | text | DEFAULT 'open', CHECK IN ('open','gesloten') |
| `valuta` | varchar(3) | DEFAULT 'EUR' |
| `aangemaakt_op` | timestamptz | DEFAULT now() |
| `gesloten_op` | timestamptz | nullable |
| `gesloten_door` | uuid | nullable, FK → deelnemers.id |

### Tabel: `deelnemers`

| Kolom | Type | Constraint |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `potje_id` | uuid | NOT NULL, FK → potjes.id |
| `naam` | varchar(30) | NOT NULL |
| `device_id` | uuid | nullable |
| `actief` | boolean | DEFAULT true |
| `aangemaakt_op` | timestamptz | DEFAULT now() |
| `afgemeld_op` | timestamptz | nullable |

Unieke constraints: `(potje_id, naam)` en `(potje_id, device_id)`.

### Tabel: `transacties`

| Kolom | Type | Constraint |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `potje_id` | uuid | NOT NULL, FK → potjes.id |
| `deelnemer_id` | uuid | NOT NULL, FK → deelnemers.id |
| `type` | text | CHECK IN ('storting','betaling') |
| `bedrag` | numeric(10,2) | CHECK BETWEEN 0.01 AND 999.99 |
| `aangemaakt_op` | timestamptz | DEFAULT now() |

---

## 6. Supabase — databaseconstraints en RLS

### Primaire beveiligingsregel (V2)

Een databasetrigger blokkeert elke betaling waarbij `SUM(betalingen) > SUM(stortingen)` voor dat potje. Dit is de server-side waarborg; de client doet een aanvullende pre-check.

### Row Level Security

RLS is ingeschakeld op alle tabellen. Policies staan gedefinieerd in `supabase-migratie-stap18-rls.sql` en `supabase-migratie-stap22-rls-herstel.sql`. De anonieme sleutel (`anon`) heeft read-toegang tot potjes en deelnemers van potjes waarbij het device betrokken is.

### Tabel: `push_subscriptions`

| Kolom | Type | Constraint |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `deelnemer_id` | uuid | NOT NULL, FK → deelnemers.id, UNIQUE |
| `potje_id` | uuid | NOT NULL, FK → potjes.id |
| `endpoint` | text | NOT NULL |
| `p256dh` | text | NOT NULL |
| `auth` | text | NOT NULL |
| `aangemaakt_op` | timestamptz | DEFAULT now() |

RLS is ingeschakeld. Vier policies (SELECT / INSERT / UPDATE / DELETE) beperken toegang tot de eigen deelnemer via `x-device-id` header. Policies zijn toegevoegd via migration `push_subscriptions_rls_policies` (2026-04-04).

### Levenscyclus

Potjes ouder dan 24 uur worden automatisch gesloten. Potjes ouder dan 7 dagen worden verwijderd. Aanroep via Supabase Edge Functions + pg_cron (zie §23). Authenticatie via `x-cron-secret` header (SEC-CRON).

### RLS — `potjes_update_sluiten` (SEC-PRIO2)

Policy bijgewerkt via migration `rls_potjes_update_sluiten_deelnemercheck` (2026-04-07). De `USING`-clausule controleert nu of het aanroepende device een actieve deelnemer is van dat specifieke potje.

### RLS — `transacties_delete` (SEC-PRIO3)

Policy bijgewerkt via migration `rls_transacties_delete_open_potje_check` (2026-04-07). Check toegevoegd dat het bijbehorende potje de status `open` heeft.

### RLS — `deelnemers_insert` open-potje-check (SEC-A4)

Policy bijgewerkt via migration `rls_deelnemers_insert_open_potje_check` (2026-04-07).

### RLS — `transacties_insert` open-potje-check (SEC-A5)

Policy bijgewerkt via migration `rls_transacties_insert_open_potje_check` (2026-04-07).

### RLS — `potjes_insert` status-check (SEC-A7)

Policy bijgewerkt via migration `rls_potjes_insert_status_check` (2026-04-07). Forceert `status = 'open'` bij aanmaken.

### Trigger — max deelnemers per potje (SEC-A2)

Trigger `check_max_deelnemers_voor_insert` + functie `controleer_max_deelnemers` via migration `max_deelnemers_per_potje_trigger` (2026-04-07). Gooit `MAX_DEELNEMERS`-exceptie, vertaald door `vertaalFout.js`.

---

## 7. Realtime synchronisatie

`usePotje` opent één Supabase-kanaal met **vijf** Postgres Changes-abonnementen per potje:

| Tabel | Event | Actie |
|---|---|---|
| `potjes` | `*` | `setPotje(payload.new)` |
| `deelnemers` | `INSERT` | Deelnemer toevoegen (gesorteerd op `aangemaakt_op`) |
| `deelnemers` | `UPDATE` | Deelnemer bijwerken (incl. eigen deelnemer bij afmelden) |
| `transacties` | `INSERT` | Transactie toevoegen aan state |
| `transacties` | `DELETE` | Transactie verwijderen uit state (SEC-L2 — undo zichtbaar zonder refresh) |

**SEC-L2 toelichting:** Bij een DELETE-event geeft Supabase bij actieve RLS alleen `payload.old.id` terug. De reducer filtert op dat id. Ontbrekend of null id wordt defensief afgevangen.

Online/offline bijgehouden via `window.addEventListener('online' / 'offline')` + Supabase-kanaalstatus. Kanaal opgeruimd via `supabase.removeChannel(kanaal)` bij unmount.

---

## 8. Componenten

### `DeelKnop`

Mobiel: native share sheet ("👥 Nodig vrienden uit"). Desktop: klembord-kopiëren ("🔗 Link kopiëren"). Feedback: "✅ Link gekopieerd!" voor 2,5 sec. `aria-live="polite"`.

### `DeelnemerRij`

Tabelrij. `role="button"` + `tabIndex={0}` + `onKeyDown` (Enter/Space). Space: `e.preventDefault()` (WCAG 2.1.1). Naam-cel: ellipsis. `aria-label` bevat volledige naam.

### `DeelnemerDetailSheet`

Bottom-sheet per deelnemer. `role="dialog"`, `aria-modal="true"`, `aria-labelledby="detail-titel"`. Tab-trap via `useFocusTrap`. Initiële focus op sluitknop. Sluiten via ✕, knop, backdrop of Escape.

### `ErrorBoundary`

React class component. Vangt renderfouten op, logt naar Sentry, toont fallback UI.

### `ModalAfmelden`

Bevestigingsdialoog. `role="dialog"`, `aria-modal="true"`, `aria-labelledby`. Tab-trap via `useFocusTrap`.

### `ModalDeelnemen`

Formulier deelnemen. Profielnaam vooraf ingevuld indien aanwezig. Validatie via `valideerDeelnemerNaam()`.

### `ModalSluiten`

Bevestigingsdialoog sluiten potje. Onomkeerbaar.

### `ModalTransactie`

Formulier storting of betaling. Live bedrag-preview. Validatie via `valideerTransactieBedrag()`. Foutafhandeling voor `SALDO_TE_LAAG` en `NIET_ACTIEF`.

---

## 9. Pagina's

### `PaginaNieuwPotje`

Formulier aanmaken potje. Valuta intern vast op `STANDAARD_VALUTA` (`EUR`) — zie §20.

### `PaginaPotje`

Centrale pagina `/potje/:id`. Data via `usePotje(id)`, acties via `usePotjeActies(...)`. Toast-state (undo-timer via `useRef`). Modal-state. Conditieel renderen: Deelnemer-modal → Eindafrekening → Overzicht. `location.state.toast` uitlezen bij aankomst van `PaginaStorten`.

**Toast-duren:** Undo 10 000 ms, info 5 000 ms, overig 3 000 ms. `--toast-duur` CSS custom property synchroon met JS-timer. Progressiebalk `aria-hidden="true"`.

### `PaginaOverzicht`

Presentatiecomponent. Props van `PaginaPotje`. Lokale state: `gekozenDeelnemer`, `afmeldenModaal`. Tabel: `table-layout: fixed`, 72px bedragkolommen.

### `PaginaStorten`

Data via `usePotje`. Snelkeuze > vrij invoer. Navigeert na succes naar `/potje/:id` met `location.state.toast`.

**SEC-H1 (fix 2026-04-04):** INSERT error-check — app navigeert alleen na bevestigde schrijfoperatie.

### `PaginaEindafrekening`

`berekenEindafrekening()` + `berekenVereffening()`. Uitklapbare rijen. Tikkie deep link.

**SEC-S4 (fix 2026-04-04):** `window.open(..., 'noopener,noreferrer')` voorkomt tab-napping.

### `PaginaInstellingen`

Navigatiekaart naar S2, S3, S4.

### `PaginaOpenPotjes` / `PaginaGeslotenPotjes`

Via `useMijnPotjes(status)`. Lege staat + foutstate + retry-knop.

### `PaginaProfiel`

Naam en tekstgrootte. `document.documentElement.setAttribute('data-tekstgrootte', waarde)`.

### `PaginaNietGevonden`

Catch-all `*`. `document.title` = "Pagina niet gevonden — Digipot" (WCAG 2.4.2). Knop "← Terug naar home".

---

## 10. Hooks

### `useDeviceId`

Leest + valideert `digipot_device_id` (UUID v4-patroon). Bij afwezigheid/ongeldig: `crypto.randomUUID()`, opslaan, retourneren.

### `useFocusTrap`

Tab-focus binnen containerRef. `onEscape` bij Escape-toets.

### `usePotje`

Laadt potje, deelnemers, transacties parallel via `Promise.all`. Vijf Realtime-abonnementen (zie §7). Online/offline-status. Retourneert state-setters.

### `usePotjeActies`

Pure async functies, geen eigen state, geen JSX.

| Functie | Beschrijving |
|---|---|
| `handleDeelnemen(naam)` | INSERT deelnemer, navigeer naar storten |
| `handleTransactie(type, bedrag)` | INSERT transactie, toon toast + undo |
| `handleUndo(transactie, deelnemerOverride)` | DELETE eigen transactie na veiligheidscheck |
| `handleSluiten()` | UPDATE potje.status → 'gesloten' |
| `handleAfmelden()` | UPDATE deelnemer.actief → false |

`handleUndo` heeft twee veiligheidslagen: client-check (deelnemer_id) + database-check (`.eq('deelnemer_id', ...)`).

### `useMijnPotjes`

3 queries ongeacht aantal potjes. Device_id + profielnaam via `.eq()` (niet ilike). `herlaad()` incrementeert teller als `useEffect`-dependency.

---

## 11. Utilities

### `berekenSaldi(deelnemers, transacties)`

Lopende saldi. Retourneert `potTotaal`, `potUitgaven`, `potSaldo`, `deelnemersSaldi[]`.

### `berekenEindafrekening(deelnemers, transacties, sluitTijdstip)`

Definitieve eindafrekening. Zie §14 voor rekenmodel.

### `berekenVereffening(deelnemersSaldi)`

Minimale vereffening via greedy algoritme. Geëxporteerd uit `berekenSaldi.js`.

### `formatBedrag(bedrag, valuta?, locale?)`

`Intl.NumberFormat`. Default EUR/nl-NL.

### `parseBedrag(waarde)`

Komma en punt als decimaalteken. Retourneert `0` bij leeg/null.

### `deelLink(potjeNaam, onSucces, onFout)`

Mobiel: `navigator.share`. Klembord-fallback via Clipboard API → `execCommand('copy')`.

### `logFout(error, context)`

Logt naar Sentry. Roept `vertaalFout()` aan. Retourneert Nederlandse gebruikerstekst.

Bekende gebruikersfouten die **niet** naar Sentry gaan: `SALDO_TE_LAAG`, `NIET_ACTIEF`, `duplicate key`, `PGRST116`, `JSON object requested, multiple (or no) rows returned`, `Cannot coerce the result to a single JSON object`.

### `vertaalFout(error)`

Vertaalt Supabase- en netwerk-errors naar Nederlandse gebruikersteksten. Volgorde van matchers (relevant voor PGRST116-fix):

1. `SALDO_TE_LAAG` → null
2. `MAX_DEELNEMERS` → "maximum bereikt"
3. `duplicate key naam` → "naam bezet"
4. `duplicate key device` → "al meedoende"
5. `potjes` + `gesloten` → "al gesloten"
6. `check_violation bedrag` → "bedrag ongeldig"
7. `check_violation naam` → "naam te lang"
8. JWT-fouten → "sessie verlopen"
9. Netwerk-fouten → "verbinding verbroken"
10. `42703` / `column ... does not exist` → "kolom ontbreekt"
11. `42P01` / `relation ... does not exist` → "tabel ontbreekt"
12. **`PGRST116` / `JSON object requested...` / `Cannot coerce...`** → "potje niet gevonden" ← nieuw (2026-04-12)
13. `PGRST` / `406` / `400` → "verbindingsfout"
14. Fallback → "iets misgegaan"

---

## 12. State management

| Niveau | Mechanisme | Voorbeelden |
|---|---|---|
| Applicatie-breed | `localStorage` | device_id, profiel_naam, tekstgrootte |
| Pagina/hook | `useState` in hook | potje, deelnemers, transacties, laden, fout |
| Component-lokaal | `useState` in component | modal-state, toast, formuliervelden |

---

## 13. Gebruikersidentificatie

`digipot_device_id` in localStorage. UUID v4-validatie bij elke sessie. Bij deelnemen opgeslagen als `deelnemers.device_id`. Terugkeer: `deelnemers.find(d => d.device_id === deviceId)`.

**Beperkingen:** localStorage wissen verbreekt koppeling. Aparte browsers = aparte UUIDs. Privémodus = tijdelijk UUID.

---

## 14. Berekenlogica

### Lopende saldi (`berekenSaldi`)

```
potSaldo    = Σ stortingen − Σ betalingen
verrekening = betaald − gestort, min −gestort
```

### Eindafrekening (`berekenEindafrekening`)

```
sluitMs = new Date(potje.gesloten_op).getTime()

wasActiefOp(d, sluitMs):
  - aangemeld_op ≤ sluitMs EN (geen afmelding OF afgemeld_op > sluitMs) → actief
  - afgemeld_op ≤ sluitMs → afgemeld

bijdrageAfgemelden = Σ gestort voor afgemelde deelnemers
resterend          = potUitgaven − bijdrageAfgemelden
factor             = resterend ÷ Σ gestort voor actieve deelnemers

nettoBijdrage (actief)   = gestort × factor
nettoBijdrage (afgemeld) = gestort

verrekening = max(betaald − nettoBijdrage, −gestort)
```

### Vereffeningsalgoritme (`berekenVereffening`)

Greedy pairing. Maximaal n−1 transacties. Afronden op €0,01.

### Afrondingsregel

`Math.round(waarde * 100) / 100`, correctie voor −0 → 0.

---

## 15. Foutafhandeling en logging

### Principe

Een fout is pas afgehandeld wanneer:
1. De oorzaak is vastgesteld
2. De code is hersteld
3. Een unit test is toegevoegd die herhaling voorkomt

### Implementatie

```
component/hook → logFout(error, context)
                      ├── vertaalFout(error) → Nederlandse gebruikerstekst
                      └── Sentry.captureException(error, { extra: context }) [alleen niet-gebruikersfouten]
```

Sentry is alleen actief in productie (`import.meta.env.PROD`).

### Regels

- Nooit een fout tonen zonder te loggen.
- `vertaalFout()` nooit rechtstreeks aanroepen.
- Geen PII in Sentry-context.
- Context: altijd `component` + `actie`.

### Gebruikersfouten vs. bugs

`logFout` onderscheidt bekende gebruikerssituaties van echte bugs. Gebruikerssituaties gaan **niet** naar Sentry:

| Foutcode | Situatie |
|---|---|
| `SALDO_TE_LAAG` | Betaling boven potsaldo |
| `NIET_ACTIEF` | Afgemelde deelnemer probeert te betalen |
| `duplicate key` | Naam al bezet of device al deelnemer |
| `PGRST116` / `Cannot coerce...` | Potje-UUID niet gevonden (verouderde link, lifecycle-verwijderd) |

---

## 16. Beveiliging

### Transactie-eigenaarschap

1. Client: `transactie.deelnemer_id === deelnemer.id`
2. Database: `.delete().eq('deelnemer_id', deelnemer.id)`

### Saldo-integriteit

Databasetrigger (V2): blokkeert betalingen waarbij `SUM(betalingen) > SUM(stortingen)`. Client-check aanvullend.

### Input-validatie

Client + databaseconstraints. Server is leidend.

### Supabase-injectie

Geparametriseerde `.eq()`-aanroepen, nooit string-interpolatie.

### API-sleutels

`.env.local` in `.gitignore`. `service_role` nooit in client.

### Sentry

`sendDefaultPii: false`.

### Device ID validatie

UUID v4-patroon bij elke sessie.

### INSERT error-check (SEC-H1)

`PaginaStorten.handleStorten`: `const { error } = await supabase.from('transacties').insert(...)`. App navigeert alleen bij succesvolle schrijfoperatie.

### Push Subscriptions (SEC-C1)

Vier RLS-policies via `x-device-id` header.

### search_path hijacking (SEC-W1)

`ALTER FUNCTION ... SET search_path = public` voor drie functies.

### Tab-napping (SEC-S4)

`window.open('https://tikkie.me', '_blank', 'noopener,noreferrer')`.

### Lifecycle-functies EXECUTE-rechten (SEC-A1)

REVOKE anon/PUBLIC EXECUTE op `lifecycle_sluit_verlopen_potjes` en `lifecycle_verwijder_oude_potjes`.

### Foutvertaling auth-matcher (SEC-A8)

Specifieke JWT-strings: `'JWT'`, `'Invalid JWT'`, `'JWTExpired'`, `'not authenticated'`.

### CI/CD supply-chain (SEC-A9)

Commentaar SHA-pin in `ci.yml`. `actions/checkout` + `actions/setup-node` bijgewerkt naar v5.

### potjes_naam_check 30 tekens (SEC-A3)

Constraint aangepast van 50 naar 30 via migration.

### Edge Function authenticatie (SEC-CRON)

`x-cron-secret` header op alle drie Edge Functions. Lege secret → HTTP 500 als failsafe.

---

## 17. Toegankelijkheid (WCAG 2.1/2.2 AA)

| Richtlijn | Implementatie |
|---|---|
| 1.3.1 Info and Relationships | Semantische `<table>` met `<th scope="col">` |
| 1.4.3 Contrast (Minimum) | CSS-variabelen, min 4,5:1 voor tekst |
| 1.4.4 Resize Text | `font-size` op `:root` + `rem`; drie tekstgrootten (16/19/22px) |
| 2.1.1 Keyboard | Tab + Enter/Space; Space: `e.preventDefault()` in `DeelnemerRij` |
| 2.4.2 Page Titled | Unieke `document.title` per scherm via `useEffect` |
| 2.4.3 Focus Order | Tab-volgorde = visuele volgorde; modals + sheets: `useFocusTrap` + initiële focus |
| 2.4.7 Focus Visible | `:focus-visible` 3px blauwe outline |
| 4.1.2 Name, Role, Value | `aria-label`, `aria-pressed`, `aria-checked`, `aria-expanded`, `role`; roving tabindex radiogroup |
| 4.1.3 Status Messages | `role="status"`, `aria-live="polite"`, `aria-atomic="true"` op toasts |

### Mobiel

`env(safe-area-inset-*)`, `min-height: 48px`, `font-size: max(1rem, 16px)`, `-webkit-tap-highlight-color: transparent`.

### Tabel op smalle schermen

`overflowX: auto`, `table-layout: fixed`, 72px bedragkolommen, naam-cel ellipsis, `aria-label` met volledige naam.

---

## 18. Testen

### Framework

Vitest + @testing-library/react + @testing-library/jest-dom, jsdom-omgeving.

### Teststrategie

Business logic en pure functies als geëxtraheerde functies — geen Supabase-mock, geen component-mount.

### Huidige dekking

| Bestand | Type | Wat wordt getest |
|---|---|---|
| `berekenSaldi.test.js` | Unit | Vijf referentiescenario's |
| `berekenSaldi.regressie.test.js` | Regressie | Null-transacties, onbekende deelnemer_id, string-bedragen, scenario D |
| `berekenVereffening.test.js` | Unit | Greedy algoritme |
| `formatBedrag.test.js` | Unit | Opmaak en parseren |
| `logFout.test.js` + `logFout.supabase.test.js` | Unit | Logging, Sentry-routing |
| `vertaalFout.test.js` + `vertaalFout.nieuw.test.js` | Unit | Error-vertaling |
| `vertaalFout.pgrst116.regressie.test.js` | Regressie | VF-116-01…06: PGRST116 niet-gevonden; LF-116-01…05: Sentry-routing ← nieuw |
| `valideer.test.js` | Unit | Validatiepaden naam en bedrag |
| `deelLink.test.js` | Unit | Zes share/clipboard-paden |
| `handleUndo.regressie.test.js` | Regressie | UD-1 t/m UD-8 |
| `paginaStorten.regressie.test.js` | Regressie | Bedraglogica |
| `paginaStorten.gesloten.regressie.test.js` | Regressie | Gesloten potje |
| `paginaStorten.insertFout.regressie.test.js` | Regressie | SEC-H1: SH-1 t/m SH-8 |
| `filterLogica.regressie.test.js` | Regressie | Filter-opbouw |
| `useMijnPotjes.regressie.test.js` + `herlaad.test.js` | Regressie | Verrijking, retry |
| `useMijnPotjes.eq.regressie.test.js` | Regressie | EQ-01 t/m EQ-09 |
| `useDeviceId.regressie.test.js` | Regressie | UID-01 t/m UID-09 |
| `usePotje.regressie.test.js` | Regressie | Data-ophaal, INSERT-reducers |
| `usePotje.delete.regressie.test.js` | Regressie | TD-01 t/m TD-08 |
| `usePotjeActies.regressie.test.js` | Regressie | Alle vijf acties |
| `deelnemerRij.regressie.test.js` | Regressie | Render, afgemeld |
| `errorBoundary.regressie.test.js` | Regressie | Fallback UI, Sentry |
| `paginaEindafrekening.regressie.test.js` | Regressie | Eindafrekening render |
| `stap1.regressie.test.js` + `stap6.regressie.test.js` | Regressie | Historische regressiescenario's |

### Niet gedekt (gemotiveerd)

| Component | Reden | Alternatief |
|---|---|---|
| `ModalDeelnemen`, `ModalTransactie`, `ModalAfmelden`, `ModalSluiten` | Supabase-afhankelijkheid; logica gedekt via `usePotjeActies` | Integratietest / e2e |

### Testcommando's

```bash
npm run test        # watch mode
npm run test:run    # CI-mode
npm run test:ui     # Vitest UI
```

---

## 19. Build en deployment

```bash
npm run dev       # Vite dev server met HMR
npm run build     # Productie build → dist/
npm run preview   # Preview van productie build
npm run lint      # ESLint
```

---

## 20. Uitgestelde functionaliteit — Multicurrency

`VALUTA_OPTIES` en `STANDAARD_VALUTA` aanwezig in `constants.js`. `potjes.valuta` in de database. Valutaselect op Scherm 1 verborgen — staat vast op EUR.

**Activeren:** zie commentaar in `PaginaNieuwPotje.jsx`.

---

## 21. Wijzigingslog

| Versie | Datum | Wijziging | Reden |
|---|---|---|---|
| 1.0 | 2026-03-01 | Initieel TO opgesteld | Projectstart |
| 1.1 | 2026-04-02 | Valutakeuze verborgen; DeelKnop tekst; "nog te besteden"; tabel mobiel-robuust; FO/TO in repository | UX + multicurrency uitgesteld |
| 1.2 | 2026-04-03 | `PaginaNietGevonden`; `berekenVereffening` correctie; UUID-validatie (SEC-M1); `.ilike()` → `.eq()` (SEC-H2); WCAG-verbeteringen; beveiligingssectie | Auditbevindingen 2026-04-03 |
| 1.3 | 2026-04-03 | Vijfde realtime-abonnement transacties DELETE (SEC-L2); toast progressiebalk (UX-3); drie nieuwe testbestanden (UID, EQ, TD) | SEC-L2, UX-3, testdekking |
| 1.4 | 2026-04-04 | INSERT error-check (SEC-H1); noopener,noreferrer (SEC-S4); `paginaStorten.insertFout.regressie.test.js` | Stille INSERT-mislukking + tab-napping opgelost |
| 1.5 | 2026-04-04 | `push_subscriptions` tabel + RLS-policies (SEC-C1); search_path fixes (SEC-W1) | Security-audit |
| 1.6 | 2026-04-04 | §22 Cloudflare Worker lifecycle-cron | Lifecycle had geen aanroeper |
| 1.7 | 2026-04-04 | §22 keep-alive cron trigger | Supabase Free plan pauze |
| 1.8 | 2026-04-07 | §23 Supabase Edge Functions + pg_cron; §22 gemarkeerd vervallen | Cloudflare Worker vervangen |
| 1.9 | 2026-04-07 | SEC-CRON x-cron-secret; RLS SEC-PRIO2 + SEC-PRIO3 | Auditbevindingen 2026-04-07 |
| 2.0 | 2026-04-07 | Volledige security audit SEC-A1 t/m SEC-A9 | Security audit 2026-04-07 |
| 2.1 | 2026-04-12 | `vertaalFout.js`: PGRST116-matcher toegevoegd vóór generieke PGRST-catch → "Dit potje bestaat niet of is verwijderd. Controleer de link."; `logFout.js`: PGRST116 + "Cannot coerce..." aan `isGebruikersFout`-lijst toegevoegd — niet naar Sentry; `vertaalFout.nieuw.test.js`: VF-N-06 verwachting gecorrigeerd van generieke PGRST-melding naar PGRST116-melding; nieuw testbestand `vertaalFout.pgrst116.regressie.test.js` (VF-116-01…06, LF-116-01…05); §3 projectstructuur bijgewerkt; §11 `vertaalFout` matchervolgorde gedocumenteerd; §15 PGRST116 toegevoegd aan gebruikersfouten-tabel | Sentry-issue #17a27ebc (2026-04-10): lifecycle-verwijderde potjes genereerden onterechte Sentry-ruis ("Cannot coerce the result to a single JSON object") — root cause: PGRST116 niet herkend als gebruikerssituatie |

---

## 22. Cloudflare Worker — Lifecycle Cron

> **Status: vervallen.** Vervangen door Supabase Edge Functions + pg_cron (zie §23). Code staat lokaal in `workers/lifecycle-cron/` maar is nooit gedeployed.

Zie versie 1.6–1.7 van dit document voor de volledige beschrijving.

---

## 23. Supabase Edge Functions — Lifecycle

### Edge Functions (Deno, TypeScript)

| Naam | URL | Taak |
|---|---|---|
| `lifecycle-sluiten` | `/functions/v1/lifecycle-sluiten` | `lifecycle_sluit_verlopen_potjes()` |
| `lifecycle-verwijderen` | `/functions/v1/lifecycle-verwijderen` | `lifecycle_verwijder_oude_potjes()` |
| `lifecycle-keepalive` | `/functions/v1/lifecycle-keepalive` | Keep-alive ping |

`verify_jwt: false`. Authenticatie via `Authorization: Bearer <service_role>` in pg_cron job. Alleen POST.

### Cron schema (pg_cron)

| Jobnaam | Schema | Taak |
|---|---|---|
| `digipot-lifecycle-sluiten` | `0 * * * *` | Verlopen potjes sluiten |
| `digipot-lifecycle-verwijderen` | `0 3 * * *` | Oude potjes verwijderen |
| `digipot-lifecycle-keepalive` | `0 0 */5 * *` | Keep-alive ping |
| `digipot-sluit-verlopen-potjes` | `*/15 * * * *` | Legacy backup |
| `digipot-verwijder-oude-potjes` | `0 3 * * *` | Legacy backup |

### Migrations

`lifecycle_cron_schedules` + `lifecycle_cron_fix_net_schema`.
