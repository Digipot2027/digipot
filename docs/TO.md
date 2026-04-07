# Technisch Ontwerp — Digipot

**Versie:** 2.0
**Datum:** 2026-04-07
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
│   └── lifecycle-cron/          ← Cloudflare Worker (lifecycle cron)
│       ├── src/
│       │   └── index.js         ← Worker broncode
│       ├── wrangler.toml        ← Cloudflare config + cron triggers
│       ├── package.json
│       ├── .gitignore
│       └── .dev.vars.example    ← Voorbeeld voor lokaal testen
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
│       ├── paginaStorten.insertFout.regressie.test.js  ← nieuw (SEC-H1)
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
│       ├── vertaalFout.nieuw.test.js
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

RLS is ingeschakeld. Vier policies (SELECT / INSERT / UPDATE / DELETE) beperken toegang tot de eigen deelnemer via `x-device-id` header — consistent met de policies op `deelnemers` en `transacties`. Policies zijn toegevoegd via migration `push_subscriptions_rls_policies` (2026-04-04).

### Levenscyclus

Potjes ouder dan 24 uur worden automatisch gesloten. Potjes ouder dan 7 dagen worden verwijderd. De databaselogica zit in `lifecycle_sluit_verlopen_potjes` en `lifecycle_verwijder_oude_potjes` (zie `supabase-migratie-stap19-lifecycle.sql`). De aanroep loopt via Supabase Edge Functions + pg_cron (zie §23). Authenticatie via `x-cron-secret` header (SEC-CRON).

### RLS — `potjes_update_sluiten` (SEC-PRIO2)

Policy bijgewerkt via migration `rls_potjes_update_sluiten_deelnemercheck` (2026-04-07). De `USING`-clausule controleert nu of het aanroepende device een actieve deelnemer is van dat specifieke potje — niet alleen of het potje `open` is. Dit sluit directe REST-aanroepen van buitenstaanders die elk open potje konden sluiten.

### RLS — `transacties_delete` (SEC-PRIO3)

Policy bijgewerkt via migration `rls_transacties_delete_open_potje_check` (2026-04-07). Naast de bestaande eigenaarschapscheck (device_id via deelnemers) is nu ook een check toegevoegd dat het bijbehorende potje de status `open` heeft. Dit voorkomt saldo-manipulatie door stortingen te verwijderen vlak voor of na sluiting.

### RLS — `deelnemers_insert` open-potje-check (SEC-A4)

Policy bijgewerkt via migration `rls_deelnemers_insert_open_potje_check` (2026-04-07). Voorkomt dat een deelnemer wordt toegevoegd aan een gesloten potje via directe REST-aanroep.

### RLS — `transacties_insert` open-potje-check (SEC-A5)

Policy bijgewerkt via migration `rls_transacties_insert_open_potje_check` (2026-04-07). Voegt een open-potje-check toe naast de bestaande actief-deelnemer-check.

### RLS — `potjes_insert` status-check (SEC-A7)

Policy bijgewerkt via migration `rls_potjes_insert_status_check` (2026-04-07). Forceert `status = 'open'` bij aanmaken van een potje.

### Trigger — max deelnemers per potje (SEC-A2)

Trigger `check_max_deelnemers_voor_insert` + functie `controleer_max_deelnemers` toegevoegd via migration `max_deelnemers_per_potje_trigger` (2026-04-07). Blokkeert een INSERT wanneer een potje al 20 deelnemers heeft. Gooit `MAX_DEELNEMERS`-exceptie die door `vertaalFout.js` wordt vertaald.

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

**SEC-L2 toelichting:** Bij een DELETE-event geeft Supabase bij actieve RLS alleen `payload.old.id` terug (het primaire sleutelveld). De reducer filtert puur op dat id: `prev.filter(t => t.id !== verwijderdId)`. Ontbrekend of null id wordt defensief afgevangen (lijst ongewijzigd).

Online/offline wordt bijgehouden via:
- `window.addEventListener('online' / 'offline')`
- Supabase-kanaalstatus: `status === 'SUBSCRIBED'` → online

Kanaal wordt opgeruimd via `supabase.removeChannel(kanaal)` in de cleanup-functie van `useEffect`.

---

## 8. Componenten

### `DeelKnop`

Deelknop die zich aanpast aan platform:
- Mobiel (iOS/Android, via `navigator.share` + user agent check): native share sheet, tekst "👥 Nodig vrienden uit"
- Desktop: klembord-kopiëren, tekst "🔗 Link kopiëren"
- Feedback na kopiëren: tekst wijzigt naar "✅ Link gekopieerd!" voor 2,5 seconden
- `aria-live="polite"` voor screenreader-aankondiging van statuswijziging

### `DeelnemerRij`

Tabelrij voor één deelnemer in het Overzichtscherm.
- `role="button"` + `tabIndex={0}` + `onKeyDown` (Enter/Space) voor toetsenbordtoegang
- Space-handler roept `e.preventDefault()` aan om paginascroll te voorkomen (WCAG 2.1.1)
- Naam-cel: `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap` zodat lange namen bedragkolommen niet wegdrukken
- Badge en pijltje: `flex-shrink: 0` zodat die nooit verdwijnen
- Bedragcellen: `white-space: nowrap`
- `aria-label` op `<tr>` bevat volledige naam (ook als afgekapt)

### `DeelnemerDetailSheet`

Bottom-sheet met details van één deelnemer (naam, ingelegd, betaald, alle transacties gesplitst per type).
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="detail-titel"`
- Tab-trap via `useFocusTrap`
- Initiële focus op sluitknop bij openen (WCAG 2.4.3)
- Sluiten via: sluitknop ✕, "Sluiten"-knop onderaan, klik op backdrop, Escape-toets

### `ErrorBoundary`

React class component. Vangt renderfouten op, logt naar Sentry, toont fallback UI.

### `ModalAfmelden`

Bevestigingsdialoog voor afmelden. Waarschuwingsblok met gevolgen. Onomkeerbaar.
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Tab-trap via `useFocusTrap`

### `ModalDeelnemen`

Formulier voor deelnemen aan een potje.
- Profielnaam vooraf ingevuld indien aanwezig
- Validatie via `valideerDeelnemerNaam()`
- `onAnnuleer` is optioneel (undefined als modal niet sluitbaar is)

### `ModalSluiten`

Bevestigingsdialoog voor sluiten van het potje. Onomkeerbaar.

### `ModalTransactie`

Formulier voor storting of betaling.
- `type`: `'storting'` of `'betaling'`
- Live bedrag-preview bij geldig getal
- Validatie via `valideerTransactieBedrag()`
- Foutafhandeling voor `SALDO_TE_LAAG` en `NIET_ACTIEF` errors

---

## 9. Pagina's

### `PaginaNieuwPotje`

Formulier voor aanmaken potje. Valuta intern vast op `STANDAARD_VALUTA` (`EUR`) — zie §20.

### `PaginaPotje`

Centrale pagina voor `/potje/:id`. Beheert:
- Data via `usePotje(id)`
- Acties via `usePotjeActies(...)`
- Toast-state (inclusief undo-timer via `useRef`)
- Modal-state (`'betaling'` | `'sluiten'` | `null`)
- Conditieel renderen: Deelnemer-modal → Eindafrekening → Overzicht
- `location.state.toast` uitlezen bij aankomst van `PaginaStorten` (eenmalig, daarna state gewist)

**Toast-structuur (UX-3):** de toast gebruikt `.toast-inhoud` (flex-rij met tekst + knop) en `.toast-voortgang` (progressiebalk, alleen bij undo-toast). De duur wordt als CSS custom property `--toast-duur` ingesteld zodat de CSS-animatie synchroon loopt met de JS-timer. De progressiebalk is `aria-hidden="true"` — de tijdsinformatie is niet functioneel voor screenreaders.

**Toast-duren:**
- Undo-toast: 10 000 ms (progressiebalk zichtbaar)
- Info-toast: 5 000 ms
- Overige toasts: 3 000 ms

### `PaginaOverzicht`

Presentatiecomponent zonder eigen data-ophaal. Ontvangt alles via props van `PaginaPotje`.
Eigen lokale state: `gekozenDeelnemer` (voor detail-sheet) en `afmeldenModaal` (boolean voor ModalAfmelden).
Tabel in `overflowX: auto`-wrapper met `table-layout: fixed` en vaste kolombreedtes (72px per bedragkolom). `min-width: 0` op alle gridknoppen.

### `PaginaStorten`

Eigen data-ophaal via `usePotje`. Bevat de snelkeuze-logica en vrij invoerveld als twee exclusieve modi. Bedrag-prioriteit: snelkeuze > vrij invoer. Navigeert na succesvolle storting naar `/potje/:id` met `location.state.toast` voor de bevestigingstoast.

**SEC-H1 (fix 2026-04-04):** `handleStorten` destruktureerde de Supabase INSERT-returnwaarde niet. Database-fouten (RLS, netwerk, constraint) werden stil genegeerd en de app navigeerde altijd door met een valse succesmelding. Fix: `const { error } = await supabase.from('transacties').insert(...)` — als `error` truthy is, wordt hij gegooid en afgehandeld in het `catch`-blok. `.select()` en `.single()` zijn verwijderd: de returnwaarde is niet nodig, en `.single()` maskeert 0-rij-resultaten als fout in plaats van ze zichtbaar te maken.

### `PaginaEindafrekening`

Berekent eindafrekening via `berekenEindafrekening()` en vereffening via `berekenVereffening()` — beide geëxporteerd uit `berekenSaldi.js`. Uitklapbare rijen per deelnemer. Tikkie deep link.

**SEC-S4 (fix 2026-04-04):** `openTikkie()` roept de fallback aan via `window.open('https://tikkie.me', '_blank', 'noopener,noreferrer')`. Zonder het derde argument kon de geopende tab via `window.opener` de originele tab overnemen (tab-napping). `noopener` verbreekt de opener-referentie; `noreferrer` voorkomt dat de Referer-header wordt meegestuurd.

### `PaginaInstellingen`

Navigatiekaart naar S2, S3, S4.

### `PaginaOpenPotjes` / `PaginaGeslotenPotjes`

Beide via `useMijnPotjes(status)`. Lege staat + foutstate + retry-knop.

### `PaginaProfiel`

Naam en tekstgrootte. Tekstgrootte wordt direct toegepast via `document.documentElement.setAttribute('data-tekstgrootte', waarde)`. Importeert `PROFIEL_NAAM_KEY`, `TEKSTGROOTTE_KEY` en `MAX_NAAM` uit `constants.js`.

### `PaginaNietGevonden`

Catch-all voor onbekende routes (`*`). Stelt `document.title` in op "Pagina niet gevonden — Digipot" (WCAG 2.4.2). Biedt één uitweg: knop "← Terug naar home".

---

## 10. Hooks

### `useDeviceId`

Leest `digipot_device_id` uit localStorage. Valideert de waarde tegen het UUID v4-patroon (`/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`). Bij afwezigheid of ongeldige waarde: genereert `crypto.randomUUID()`, slaat op, retourneert. Voorkomt dat een gemanipuleerde waarde (bijv. via XSS of browserextensie) wordt gebruikt als device-identiteit. Retourneert altijd een geldige UUID-string.

### `useFocusTrap`

Gedeelde WCAG-hook. Trekt Tab-focus binnen een containerRef. Roept `onEscape` aan bij Escape-toets. Optionele selector voor focusbare elementen.

### `usePotje`

Laadt potje, deelnemers en transacties parallel via `Promise.all`. Opent **vijf** Supabase Realtime-abonnementen (zie §7). Bijhoudt online/offline-status. Retourneert ook state-setters (`setDeelnemer`, `setDeelnemers`, `setTransacties`) zodat consumers lokale updates kunnen doorvoeren zonder refetch.

### `usePotjeActies`

Pure async functies, geen eigen state, geen JSX. Direct unit-testbaar. Acties:

| Functie | Beschrijving |
|---|---|
| `handleDeelnemen(naam)` | INSERT deelnemer, navigeer naar storten |
| `handleTransactie(type, bedrag)` | INSERT transactie, toon toast + undo |
| `handleUndo(transactieId)` | DELETE eigen transactie na veiligheidscheck |
| `handleSluiten()` | UPDATE potje.status → 'gesloten' |
| `handleAfmelden()` | UPDATE deelnemer.actief → false |

`handleUndo` heeft twee veiligheidslagen:
1. Client-check: transactie.deelnemer_id === deelnemer.id
2. Database-check: `.eq('deelnemer_id', deelnemer.id)` in de DELETE-query

### `useMijnPotjes`

Laadt open of gesloten potjes voor het huidige device/profielnaam. Oplossing voor N+1 query probleem: 3 queries totaal ongeacht het aantal potjes.

Strategie:
1. Zoek potje-IDs via twee aparte deelnemer-queries (device_id + `.eq('naam')` — **niet** ilike), gecombineerd client-side
2. Haal potjes op voor die IDs
3. Haal deelnemers + transacties op in twee parallelle queries
4. Verrijk potjes puur client-side (geen extra DB-calls)

`herlaad()` incrementeert een teller die als `useEffect`-dependency dient, zodat de data opnieuw wordt opgehaald.

---

## 11. Utilities

### `berekenSaldi(deelnemers, transacties)`

Berekent lopende saldi tijdens een actief potje. Retourneert: `potTotaal`, `potUitgaven`, `potSaldo`, `deelnemersSaldi[]` met per deelnemer: `gestort`, `betaald`, `aandeel`, `verrekening`.

### `berekenEindafrekening(deelnemers, transacties, sluitTijdstip)`

Berekent definitieve eindafrekening op basis van actief/afgemeld-status op het sluitmoment. Zie §14 voor het volledige rekenmodel.

### `berekenVereffening(deelnemersSaldi)`

Berekent minimale vereffening via greedy algoritme (grootste debiteur aan grootste crediteur). Geëxporteerd uit `berekenSaldi.js`. Gebruikt door `PaginaEindafrekening` via directe import.

### `formatBedrag(bedrag, valuta?, locale?)`

Formatteert een getal als valutastring via `Intl.NumberFormat`. Default: `EUR`, `nl-NL`. Ondersteunt alle ISO 4217-valuta's.

### `parseBedrag(waarde)`

Parseert een string naar number. Accepteert zowel komma als punt als decimaalteken. Retourneert `0` bij lege of null invoer.

### `deelLink(potjeNaam, onSucces, onFout)`

Deelt de huidige URL. Detecteert mobiel via `navigator.share` + user agent. Klembord-fallback via Clipboard API, daarna `execCommand('copy')`.

### `logFout(error, context)`

Logt naar Sentry met context (componentnaam + actie). Roept `vertaalFout()` aan voor Nederlandse gebruikerstekst. Retourneert die tekst.

### `vertaalFout(error)`

Vertaalt Supabase- en netwerk-errors naar Nederlandse gebruikersteksten op basis van error codes en berichten.

### `valideerDeelnemerNaam(naam, deelnemers, opties?)`

Pure validatiefunctie. Controles: leeg, te lang, potje vol, naam bezet (case-insensitief). Retourneert foutstring of `null`.

### `valideerTransactieBedrag(bedragInvoer, bedragNum, opties)`

Pure validatiefunctie. Controles: leeg/NaN/≤0, boven MAX, betaling boven saldo. Retourneert foutstring of `null`.

---

## 12. State management

Er is geen global state store. State leeft op drie niveaus:

| Niveau | Mechanisme | Voorbeelden |
|---|---|---|
| Applicatie-breed | `localStorage` | device_id, profiel_naam, tekstgrootte |
| Pagina/hook | `useState` in hook | potje, deelnemers, transacties, laden, fout |
| Component-lokaal | `useState` in component | modal-state, toast, formuliervelden |

State-setters worden als props doorgegeven van `usePotje` naar `usePotjeActies` zodat lokale optimistische updates mogelijk zijn zonder refetch.

---

## 13. Gebruikersidentificatie

Geen authenticatie. Identificatie werkt via `digipot_device_id` in localStorage:

1. `useDeviceId` leest de sleutel bij elke paginaweergave.
2. Valideert de waarde tegen UUID v4-patroon (`/^[0-9a-f]{8}-...-4...-[89ab]...-...$/i`).
3. Als niet aanwezig of ongeldig: genereert `crypto.randomUUID()`, slaat op, retourneert.
4. Bij deelnemen: UUID wordt opgeslagen als `deelnemers.device_id` in de database.
5. Bij terugkeer: `deelnemers.find(d => d.device_id === deviceId)` identificeert de gebruiker.

**Beperkingen:**
- Wissen van localStorage verbreekt de koppeling (gebruiker wordt als nieuw behandeld).
- Verschillende browsers op hetzelfde apparaat hebben aparte UUIDs.
- Privémodus genereert een tijdelijk UUID dat na sluiten verloren gaat.

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
  - afgemeld_op ≤ sluitMs → afgemeld (ook bij gelijke tijdstip)

bijdrageAfgemelden = Σ gestort voor afgemelde deelnemers
resterend          = potUitgaven − bijdrageAfgemelden
factor             = resterend ÷ Σ gestort voor actieve deelnemers

nettoBijdrage (actief)   = gestort × factor
nettoBijdrage (afgemeld) = gestort

verrekening = max(betaald − nettoBijdrage, −gestort)
```

### Vereffeningsalgoritme (`berekenVereffening`)

Greedy pairing: grootste debiteur aan grootste crediteur. Maximaal n−1 transacties voor n deelnemers. Afronden op €0,01.

### Afrondingsregel

`rond(waarde) = Math.round(waarde * 100) / 100`, met correctie voor −0 → 0.

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
                      └── Sentry.captureException(error, { extra: context })
```

Sentry is alleen actief in productie (`import.meta.env.PROD`). In ontwikkeling gaan fouten alleen naar `console.error`.

### Regels

- Nooit een fout tonen zonder te loggen.
- `vertaalFout()` nooit rechtstreeks aanroepen, altijd via `logFout()`.
- Geen persoonsgegevens (namen, bedragen) in Sentry-context.
- Context bevat altijd minimaal: `component` en `actie`.

---

## 16. Beveiliging

### Transactie-eigenaarschap

Undo van een transactie heeft twee controlelagen:
1. Client: `transactie.deelnemer_id === deelnemer.id`
2. Database: `.delete().eq('deelnemer_id', deelnemer.id)`

De client-check geeft directe feedback; de database-check is de bindende beveiliging.

### Saldo-integriteit

Primaire beveiliging via databasetrigger (V2): blokkeert betalingen waarbij `SUM(betalingen) > SUM(stortingen)`. Client-check is aanvullend.

### Input-validatie

Alle invoer wordt gevalideerd op de client (zie `valideer.js`) én gecontroleerd via databaseconstraints. De server is leidend.

### Supabase-injectie

`useMijnPotjes` gebruikt geen string-interpolatie in queries. Device_id en profielnaam worden doorgegeven als geparametriseerde waarden via `.eq()` — nooit via `.ilike()` of string-concatenatie.

### API-sleutels

`.env.local` staat in `.gitignore`. De `anon`-sleutel is publiek zichtbaar in de browser; de server-side sleutel (`service_role`) wordt nooit in de client gebruikt.

### Sentry

`sendDefaultPii: false` — geen persoonlijk identificeerbare informatie naar Sentry.

### Device ID validatie

`useDeviceId` valideert de UUID uit localStorage bij elke sessie. Een ongeldige waarde (bijv. gemanipuleerd door een kwaadaardige browserextensie) wordt genegeerd en vervangen door een nieuw UUID.

### INSERT error-check (SEC-H1)

`PaginaStorten.handleStorten()` destruktureerde de Supabase INSERT-returnwaarde niet, waardoor database-fouten stil werden genegeerd. Fix: `const { error } = await supabase.from('transacties').insert(...)` gevolgd door `if (error) throw error`. De app navigeert alleen bij een bevestigde succesvolle schrijfoperatie.

### Push Subscriptions toegang (SEC-C1)

`push_subscriptions` had RLS ingeschakeld zonder enige policy — dit resulteerde in een volledige blokkade van alle queries (PostgreSQL-standaard: geen policy = geen toegang). Vier policies zijn toegevoegd die toegang beperken tot de eigen deelnemer via `x-device-id` header.

### search_path hijacking (SEC-W1)

Drie functies (`controleer_potsaldo`, `lifecycle_sluit_verlopen_potjes`, `lifecycle_verwijder_oude_potjes`) hadden een veranderlijke `search_path`. Opgelost via migration `fix_function_search_path`: `ALTER FUNCTION ... SET search_path = public`.

### Tab-napping via externe links (SEC-S4)

`PaginaEindafrekening.openTikkie()` opent de Tikkie-fallback met `window.open('https://tikkie.me', '_blank', 'noopener,noreferrer')`. Zonder `noopener` kon de geopende tab via `window.opener` de originele tab overnemen.

### Lifecycle-functies — EXECUTE-rechten ingetrokken (SEC-A1)

`lifecycle_sluit_verlopen_potjes` en `lifecycle_verwijder_oude_potjes` zijn `SECURITY DEFINER`. EXECUTE-rechten voor `anon` en `PUBLIC` zijn ingetrokken via migration `revoke_anon_execute_lifecycle_functies` (2026-04-07). De functies zijn nu alleen aanroepbaar door de pg_cron scheduler (superuser) en via de Edge Functions (service_role). Directe REST/RPC-aanroep door `anon` geeft HTTP 403.

### Foutvertaling — te brede `auth`-matcher (SEC-A8)

`vertaalFout.js` matchte op de string `'auth'`, wat ook niet-JWT berichten kon raken. Vervangen door specifieke JWT-foutstrings: `'JWT'`, `'Invalid JWT'`, `'JWTExpired'`, `'not authenticated'`.

### CI/CD supply-chain (SEC-A9)

De GitHub Actions workflow gebruikt `cloudflare/wrangler-action@v3` zonder SHA-pin. Commentaar toegevoegd in `ci.yml` met aanbeveling om te pinnen op een specifieke commit-SHA.

### potjes_naam_check aangescherpt naar 30 tekens (SEC-A3)

De database constraint stond op 50 tekens terwijl code, FO en TO 30 beschrijven. Twee smoke-testpotjes met namen van 31–33 tekens zijn bijgeknipt via migration `potjes_naam_bijknippen_en_aanscherpen` (2026-04-07). Daarna is de constraint aangepast naar `char_length(naam) <= 30`, consistent met de rest van het systeem.

### Edge Function authenticatie (SEC-CRON)

Alle drie lifecycle Edge Functions (`lifecycle-sluiten`, `lifecycle-verwijderen`, `lifecycle-keepalive`) valideren een `x-cron-secret` header tegen de `CRON_SECRET` Function Secret. Aanroepen zonder correct secret worden geblokkeerd met HTTP 401. Een lege `CRON_SECRET` blokkeert alle aanroepen met HTTP 500 als failsafe. De pg_cron jobs sturen het secret mee in elke aanroep. Gevalideerd live: juist secret → 200, geen secret → 401.

---

## 17. Toegankelijkheid (WCAG 2.1/2.2 AA)

| Richtlijn | Implementatie |
|---|---|
| 1.3.1 Info and Relationships | Semantische `<table>` met `<th scope="col">` |
| 1.4.3 Contrast (Minimum) | CSS-variabelen gedocumenteerd met contrastwaarden (min 4,5:1 voor tekst) |
| 1.4.4 Resize Text | `font-size` op `:root` + `rem` overal; drie tekstgrootten (16/19/22px) |
| 2.1.1 Keyboard | Alle interactieve elementen bereikbaar via Tab en Enter/Space; Space roept `e.preventDefault()` aan in `DeelnemerRij` om paginascroll te voorkomen |
| 2.4.2 Page Titled | Unieke `document.title` per scherm via `useEffect`, incl. `PaginaNietGevonden` |
| 2.4.3 Focus Order | Tab-volgorde volgt visuele volgorde; modals + sheets gebruiken `useFocusTrap` + initiële focusset |
| 2.4.7 Focus Visible | `:focus-visible` met 3px blauwe outline op alle knoppen en tabelrijen |
| 4.1.2 Name, Role, Value | `aria-label`, `aria-pressed`, `aria-checked`, `aria-expanded`, `role` op alle interactieve elementen; roving tabindex op radiogroup in `PaginaProfiel` |
| 4.1.3 Status Messages | `role="status"`, `aria-live="polite"`, `aria-atomic="true"` op toasts |

### Radiogroup (PaginaProfiel)

Tekstgrootte-kiezer implementeert roving tabindex:
- Alleen de geselecteerde optie heeft `tabIndex={0}`; de overige hebben `tabIndex={-1}`
- Pijltjestoetsen (`ArrowRight`/`ArrowDown` = volgende, `ArrowLeft`/`ArrowUp` = vorige) wisselen selectie én verplaatsen focus
- `useRef`-array bijhoudt DOM-referenties van alle radio-elementen voor programmatische focus

### Mobiel

- `env(safe-area-inset-*)` voor iPhone notch en home indicator
- `min-height: 48px` op knoppen (Apple HIG touch target)
- `font-size: max(1rem, 16px)` op inputs (voorkomt iOS-zoom)
- `-webkit-tap-highlight-color: transparent`

### Tabelweergave op smalle schermen

- Wrapper `overflowX: auto` + `-webkit-overflow-scrolling: touch`
- `table-layout: fixed` + `<colgroup>` met 72px per bedragkolom
- Naam-cel: `overflow: hidden` + `text-overflow: ellipsis` + `white-space: nowrap`
- `aria-label` op `<tr>` bevat altijd volledige naam

---

## 18. Testen

### Framework

Vitest + @testing-library/react + @testing-library/jest-dom, jsdom-omgeving.

### Teststrategie

Business logic en pure functies worden getest als geëxtraheerde functies — geen Supabase-mock, geen component-mount. Componenten met Supabase-afhankelijkheid worden getest via regressietests op de geëxtraheerde logica.

### Huidige dekking

| Bestand | Type | Wat wordt getest |
|---|---|---|
| `berekenSaldi.test.js` | Unit | Vijf referentiescenario's, alle rekenregels |
| `berekenSaldi.regressie.test.js` | Regressie | Null-transacties, onbekende deelnemer_id, string-bedragen, scenario D |
| `berekenVereffening.test.js` | Unit | Greedy algoritme, minimale transacties |
| `formatBedrag.test.js` | Unit | Opmaak en parseren, komma/punt |
| `logFout.test.js` + `logFout.supabase.test.js` | Unit | Logging, Sentry-routing, Supabase-errors |
| `vertaalFout.test.js` + `vertaalFout.nieuw.test.js` | Unit | Error-vertaling naar nl-NL |
| `valideer.test.js` | Unit | Alle validatiepaden voor naam en bedrag |
| `deelLink.test.js` | Unit | Alle zes share/clipboard-codepaden |
| `handleUndo.regressie.test.js` | Regressie | UD-1 t/m UD-8: eigenaarschap, saldo-check, grenzen |
| `paginaStorten.regressie.test.js` | Regressie | Prioriteitslogica bedrag, grenscondities |
| `paginaStorten.gesloten.regressie.test.js` | Regressie | Gesloten potje-scenario |
| `paginaStorten.insertFout.regressie.test.js` | Regressie | SEC-H1: INSERT error-check (SH-1 t/m SH-8) |
| `filterLogica.regressie.test.js` | Regressie | Filter-opbouw useMijnPotjes |
| `useMijnPotjes.regressie.test.js` + `herlaad.test.js` | Regressie | Potje-verrijking, retry |
| `useMijnPotjes.eq.regressie.test.js` | Regressie | SEC-H2: eq vs ilike filtering (EQ-01 t/m EQ-09) |
| `useDeviceId.regressie.test.js` | Regressie | SEC-M1: UUID v4-validatie (UID-01 t/m UID-09) |
| `usePotje.regressie.test.js` | Regressie | Data-ophaal, realtime INSERT-reducers |
| `usePotje.delete.regressie.test.js` | Regressie | SEC-L2: DELETE-reducer (TD-01 t/m TD-08) |
| `usePotjeActies.regressie.test.js` | Regressie | Alle vijf acties |
| `deelnemerRij.regressie.test.js` | Regressie | Render, klasse, afgemeld |
| `errorBoundary.regressie.test.js` | Regressie | Fallback UI, Sentry-aanroep |
| `paginaEindafrekening.regressie.test.js` | Regressie | Eindafrekening render |
| `stap1.regressie.test.js` + `stap6.regressie.test.js` | Regressie | Historische regressiescenario's |

### Niet gedekt (gemotiveerd)

| Component | Reden | Alternatief |
|---|---|---|
| `ModalDeelnemen`, `ModalTransactie`, `ModalAfmelden`, `ModalSluiten` | Supabase-afhankelijkheid; logica zit in `usePotjeActies` (gedekt) | Integratietest / e2e |

### Testcommando's

```bash
npm run test        # watch mode
npm run test:run    # CI-mode (eenmalig)
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

### Status

De multicurrency-infrastructuur is volledig aanwezig en functioneel. De UI-keuze op Scherm 1 is tijdelijk verborgen.

### Aanwezig

- `VALUTA_OPTIES` in `constants.js`: EUR, USD, GBP, CHF, DKK, NOK, SEK
- `STANDAARD_VALUTA = 'EUR'` in `constants.js`
- `formatBedrag(bedrag, valuta, locale)` ondersteunt alle ISO 4217-valuta's
- `potjes.valuta` kolom in de database (migratie stap 20-21)
- Valuta wordt doorgegeven aan alle format-aanroepen in de hele applicatie

### Verborgen

`PaginaNieuwPotje` toont geen valutaselect. De `valuta`-state staat vast op `STANDAARD_VALUTA` via `useState(STANDAARD_VALUTA)` zonder setter.

### Activeren

1. Open `PaginaNieuwPotje.jsx`
2. Herstel de import: voeg `VALUTA_OPTIES` toe aan de import uit `constants`
3. Verander `const [valuta] = useState(STANDAARD_VALUTA)` naar `const [valuta, setValuta] = useState(STANDAARD_VALUTA)`
4. Herstel het uitgecommentarieerde `<div className="veld">` blok (het volledige herstelblok staat als commentaar in het bestand)

---

## 22. Cloudflare Worker — Lifecycle Cron

> **Status:** vervangen door Supabase Edge Functions + pg_cron (zie §23). De Worker-code staat lokaal in `workers/lifecycle-cron/` maar is nooit gedeployed naar Cloudflare.

### Locatie

`workers/lifecycle-cron/`

### Doel

De Supabase-databasefuncties `lifecycle_sluit_verlopen_potjes` en `lifecycle_verwijder_oude_potjes` bevatten de logica maar hadden geen aanroeper. Deze Worker levert de ontbrekende scheduler.

### Cron schema

| Cron-expressie | Tijdstip (UTC) | Taak |
|---|---|---|
| `0 * * * *` | Elk uur op minuut 0 | `lifecycle_sluit_verlopen_potjes` — sluit potjes ouder dan 24 uur |
| `0 3 * * *` | Elke nacht om 03:00 | `lifecycle_verwijder_oude_potjes` — verwijdert potjes ouder dan 7 dagen |
| `0 0 */5 * *` | Elke 5 dagen om 00:00 | Keep-alive ping — voorkomt Supabase Free-plan pauze |

### Authenticatie

| Secret | Key | Gebruik |
|---|---|---|
| `SUPABASE_URL` | — | Basis-URL voor alle API-aanroepen |
| `SUPABASE_ANON_KEY` | Publiek (anon) | Keep-alive ping — alleen lezen, geen RLS-bypass |
| `SUPABASE_SERVICE_KEY` | Privé (service_role) | Lifecycle-functies — `SECURITY DEFINER`, elevated privileges |

Alle drie worden opgeslagen als Cloudflare Worker Secret, nooit in code of wrangler.toml.

### Bestanden

| Bestand | Doel |
|---|---|
| `src/index.js` | Worker broncode — `scheduled` + `fetch` handler |
| `wrangler.toml` | Cloudflare config, Worker naam, twee cron triggers |
| `package.json` | Dev-dependency wrangler, testscripts |
| `.gitignore` | Sluit `node_modules/`, `.wrangler/`, `.dev.vars` uit |
| `.dev.vars.example` | Voorbeeld voor lokale secrets (nooit committen) |

### Lokaal testen

```bash
cd workers/lifecycle-cron
cp .dev.vars.example .dev.vars
# Vul SUPABASE_SERVICE_KEY in .dev.vars
npm install
npm run dev
# In tweede terminal:
npm run test-scheduled-sluiten
npm run test-scheduled-verwijderen
```

### Deployen

```bash
cd workers/lifecycle-cron
npm install
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SUPABASE_SERVICE_KEY
npm run deploy
```

### Security

- `service_role` en `anon` sleutels alleen via Cloudflare Secrets, nooit in code of git
- HTTP `fetch` handler geeft altijd 404 in productie — geen publieke endpoints
- `valideerServiceOmgeving()` gooit expliciete fout bij ontbrekende secrets voor lifecycle-taken
- Keep-alive mislukkingen worden gelogd maar gooien geen `Error` — een mislukte ping mag de lifecycle-runs niet blokkeren
- Foutende lifecycle-runs gooien wél een `Error` — Cloudflare markeert dit als gefaald in het Cron Events dashboard

---

## 23. Supabase Edge Functions — Lifecycle

### Waarom Edge Functions in plaats van Cloudflare Worker

De Cloudflare Worker vereist een API token en lokale Wrangler-deploy. De Supabase Edge Functions + pg_cron aanpak is volledig beheerd binnen de bestaande Supabase-infrastructuur — geen extra accounts of tokens nodig.

### Edge Functions (Deno, TypeScript)

| Naam | URL | Taak |
|---|---|---|
| `lifecycle-sluiten` | `/functions/v1/lifecycle-sluiten` | Roept `lifecycle_sluit_verlopen_potjes` aan |
| `lifecycle-verwijderen` | `/functions/v1/lifecycle-verwijderen` | Roept `lifecycle_verwijder_oude_potjes` aan |
| `lifecycle-keepalive` | `/functions/v1/lifecycle-keepalive` | Keep-alive ping via anon key |

Alle drie: `verify_jwt: false` — aanroep verloopt via `Authorization: Bearer <service_role>` in de cron job zelf. De functies accepteren alleen POST.

### Cron schema (pg_cron)

| Jobnaam | Schema | Taak |
|---|---|---|
| `digipot-lifecycle-sluiten` | `0 * * * *` — elk uur (UTC) | Verlopen potjes sluiten |
| `digipot-lifecycle-verwijderen` | `0 3 * * *` — 03:00 UTC | Oude potjes verwijderen |
| `digipot-lifecycle-keepalive` | `0 0 */5 * *` — elke 5 dagen | Keep-alive ping |
| `digipot-sluit-verlopen-potjes` | `*/15 * * * *` — elke 15 min | Legacy: directe DB-aanroep (backup) |
| `digipot-verwijder-oude-potjes` | `0 3 * * *` — 03:00 UTC | Legacy: directe DB-aanroep (backup) |

De legacy jobs zijn bewust actief gehouden als vangnet naast de Edge Function jobs.

### Migrations

| Migration | Inhoud |
|---|---|
| `lifecycle_cron_schedules` | Eerste aanmaak (met fout schema) |
| `lifecycle_cron_fix_net_schema` | Herstel naar `net.http_post` (correct schema) |

### Systeemoverzicht (bijgewerkt)

```
Browser (React SPA)
    │
    ├── Supabase REST API  (CRUD via postgrest)
    ├── Supabase Realtime  (WebSocket)
    └── Sentry             (foutlogging)

pg_cron (in Supabase DB)
    │  (3 geplande jobs + 2 legacy)
    └── net.http_post → Supabase Edge Functions
            ├── lifecycle-sluiten   → lifecycle_sluit_verlopen_potjes()
            ├── lifecycle-verwijderen → lifecycle_verwijder_oude_potjes()
            └── lifecycle-keepalive → GET /potjes?limit=1 (ping)
```

---

## 21. Wijzigingslog

| Versie | Datum | Wijziging | Reden |
|---|---|---|---|
| 1.0 | 2026-03-01 | Initieel TO opgesteld | Projectstart |
| 1.1 | 2026-04-02 | Valutakeuze verborgen in `PaginaNieuwPotje` (multicurrency uitgesteld); DeelKnop tekst "Nodig vrienden uit" (mobiel); label "nog te besteden" in PaginaOverzicht; tabel mobiel-robuust; FO en TO opgenomen in repository | UX-verbetering, multicurrency uitgesteld, mobiele optimalisatie |
| 1.2 | 2026-04-03 | `PaginaNietGevonden` toegevoegd aan routering; `berekenVereffening` gecorrigeerd; `PaginaOverzicht` state gedocumenteerd; `useDeviceId` UUID-validatie (SEC-M1); `useMijnPotjes` `.ilike()` → `.eq()` (SEC-H2); `DeelnemerRij` Space+preventDefault (WCAG-3); `DeelnemerDetailSheet` initiële focus (WCAG-6); radiogroup roving tabindex `PaginaProfiel` (WCAG-7); location.state-toast gedocumenteerd; beveiligingssectie uitgebreid; WCAG-tabel bijgewerkt | Auditbevindingen 2026-04-03 verwerkt |
| 1.3 | 2026-04-03 | `usePotje`: vijfde abonnement toegevoegd voor transacties DELETE (SEC-L2); §7 tabel bijgewerkt + toelichting RLS payload-beperking; toast-structuur uitgebreid met progressiebalk (UX-3): `.toast-inhoud`, `.toast-voortgang`, `--toast-duur` CSS custom property, `@keyframes toastVoortgang`; `TOAST_DUUR_*` constanten in `PaginaPotje`; drie nieuwe testbestanden: `useDeviceId.regressie.test.js` (UID-01…09), `useMijnPotjes.eq.regressie.test.js` (EQ-01…09), `usePotje.delete.regressie.test.js` (TD-01…08); §3 projectstructuur en §18 dekkingtabel bijgewerkt | Resterende auditpunten SEC-L2, UX-3 en testdekking nieuw geïmplementeerde code |
| 1.4 | 2026-04-04 | `PaginaStorten.handleStorten`: INSERT error-check toegevoegd (SEC-H1); `PaginaEindafrekening.openTikkie`: noopener,noreferrer (SEC-S4); nieuw testbestand `paginaStorten.insertFout.regressie.test.js` (SH-1 t/m SH-8) | Auditbevindingen 2026-04-04: stille INSERT-mislukking en tab-napping opgelost |
| 1.5 | 2026-04-04 | §6 uitgebreid: `push_subscriptions`-tabel + vier RLS-policies gedocumenteerd (SEC-C1); §16 uitgebreid: SEC-C1 en SEC-W1 toegevoegd; `search_path` fixes drie functies gedocumenteerd (SEC-W1) | Security-audit: push_subscriptions volledig geblokkeerd door ontbrekende RLS-policies; search_path hijacking risico gesloten |
| 1.6 | 2026-04-04 | §1 systeemoverzicht uitgebreid met Cloudflare Worker; §3 projectstructuur bijgewerkt met `workers/lifecycle-cron/`; §6 levenscyclus bijgewerkt; §22 nieuw: volledige documentatie Cloudflare Worker lifecycle-cron | Lifecycle-functies bestonden in DB maar hadden geen aanroeper — Cloudflare Worker met Cron Trigger opgelost dit |
| 1.7 | 2026-04-04 | §22 bijgewerkt: derde cron trigger keep-alive toegevoegd; authenticatietabel uitgebreid | Supabase Free plan pauzeert na ~7 dagen inactiviteit |
| 1.8 | 2026-04-07 | §22 gemarkeerd als vervallen; §23 nieuw: drie Supabase Edge Functions gedeployed (`lifecycle-sluiten`, `lifecycle-verwijderen`, `lifecycle-keepalive`); pg_cron jobs aangemaakt via migrations `lifecycle_cron_schedules` en `lifecycle_cron_fix_net_schema`; systeemoverzicht §1 bijgewerkt | Cloudflare Worker vereiste lokale deploy — vervangen door volledig beheerde Supabase Edge Functions + pg_cron oplossing; live getest: HTTP 200 ok |
| 1.9 | 2026-04-07 | §1 systeemoverzicht bijgewerkt naar pg_cron + Edge Functions; §6 levenscyclus bijgewerkt (SEC-PRIO2, SEC-PRIO3 toegevoegd); §16 SEC-CRON toegevoegd: x-cron-secret validatie op alle drie Edge Functions; §21 bijgewerkt | Auditbevindingen 2026-04-07: RLS-policies versterkt, Edge Functions beveiligd met CRON_SECRET |
| 2.0 | 2026-04-07 | Volledige security audit uitgevoerd (alle lagen); §16 uitgebreid met SEC-A1 t/m SEC-A9; fixes live: REVOKE anon EXECUTE op lifecycle-functies (SEC-A1), trigger max-deelnemers (SEC-A2), potjes_naam_check 50→30 geblokkeerd door bestaande data (SEC-A3 open), RLS open-potje-checks op deelnemers_insert (SEC-A4) + transacties_insert (SEC-A5) + potjes_insert (SEC-A7), vertaalFout.js te brede auth-matcher (SEC-A8), CI/CD commentaar supply-chain (SEC-A9); §6 bijgewerkt met nieuwe policies en trigger | Security audit 2026-04-07 |
