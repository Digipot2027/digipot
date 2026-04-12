# Technisch Ontwerp — Digipot

**Versie:** 2.2
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
│       ├── src/index.js
│       ├── wrangler.toml
│       ├── package.json
│       ├── .gitignore
│       └── .dev.vars.example
├── docs/
│   ├── FO.md                  ← Functioneel Ontwerp
│   └── TO.md                  ← Technisch Ontwerp (dit document)
├── public/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.css
│   ├── supabaseClient.js
│   ├── constants.js
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
│   │   ├── useMijnPotjes.js       ← useDeviceId() i.p.v. localStorage.getItem (kritiek-1)
│   │   ├── usePotje.js
│   │   └── usePotjeActies.js      ← .maybeSingle() + null-guard deelnemer (kritiek-2/3)
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
│       ├── kritiek.regressie.test.js           ← nieuw (MP-01…03, AF-01…03, SL-01…03)
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
│       ├── vertaalFout.nieuw.test.js
│       ├── vertaalFout.pgrst116.regressie.test.js
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

`PaginaEindafrekening` is geen eigen route — inline gerenderd door `PaginaPotje` wanneer `potje.status === 'gesloten'`.

`ErrorBoundary` omhult de gehele routerstructuur.

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

Databasetrigger blokkeert betalingen waarbij `SUM(betalingen) > SUM(stortingen)`. Client doet aanvullende pre-check.

### Row Level Security

RLS ingeschakeld op alle tabellen. Policies in `supabase-migratie-stap18-rls.sql` en `supabase-migratie-stap22-rls-herstel.sql`.

### Tabel: `push_subscriptions`

Vier RLS-policies (SELECT/INSERT/UPDATE/DELETE) via `x-device-id` header. Policies via migration `push_subscriptions_rls_policies` (2026-04-04).

### Levenscyclus

Potjes > 24 uur → automatisch gesloten. Potjes > 7 dagen → verwijderd. Via Supabase Edge Functions + pg_cron (zie §23). Authenticatie via `x-cron-secret` (SEC-CRON).

### RLS-policies

- `potjes_update_sluiten` (SEC-PRIO2): controleert actief deelnemerschap
- `transacties_delete` (SEC-PRIO3): controleert open-potje-status
- `deelnemers_insert` (SEC-A4): controleert open-potje-status
- `transacties_insert` (SEC-A5): controleert open-potje + actief deelnemerschap
- `potjes_insert` (SEC-A7): forceert `status = 'open'`
- Trigger max deelnemers (SEC-A2): gooit `MAX_DEELNEMERS`-exceptie bij > 20

---

## 7. Realtime synchronisatie

Vijf Postgres Changes-abonnementen in `usePotje`:

| Tabel | Event | Actie |
|---|---|---|
| `potjes` | `*` | `setPotje(payload.new)` |
| `deelnemers` | `INSERT` | Toevoegen gesorteerd op `aangemaakt_op` |
| `deelnemers` | `UPDATE` | Bijwerken incl. eigen deelnemer |
| `transacties` | `INSERT` | Toevoegen aan state |
| `transacties` | `DELETE` | Verwijderen uit state (SEC-L2) |

**SEC-L2:** Bij DELETE geeft Supabase bij actieve RLS alleen `payload.old.id` terug. Reducer filtert op id; null defensief afgevangen.

Online/offline via `window.addEventListener` + Supabase-kanaalstatus. Kanaal opgeruimd bij unmount.

---

## 8. Componenten

Zie versie 2.1 voor componentbeschrijvingen (ongewijzigd).

---

## 9. Pagina's

Zie versie 2.1 voor paginabeschrijvingen (ongewijzigd).

---

## 10. Hooks

### `useDeviceId`

Leest + valideert `digipot_device_id` (UUID v4-patroon). Bij afwezigheid/ongeldig: `crypto.randomUUID()`, opslaan, retourneren. **De enige geautoriseerde bron van device-ID in de gehele applicatie** — `localStorage.getItem(DEVICE_ID_KEY)` mag nooit rechtstreeks worden aangeroepen voor device-identificatiedoeleinden.

### `useFocusTrap`

Tab-focus binnen containerRef. `onEscape` bij Escape-toets.

### `usePotje`

Laadt potje, deelnemers, transacties parallel. Vijf Realtime-abonnementen. Online/offline-status. Retourneert state-setters.

### `usePotjeActies`

Pure async functies. Alle vijf acties. Twee beveiligingslagen in `handleUndo`. Kritieke fixes 2026-04-12:

- **`handleAfmelden`** gebruikt `.maybeSingle()` in plaats van `.single()`. Bij 0 rijen (deelnemer ondertussen verwijderd) retourneert `.maybeSingle()` `{ data: null, error: null }`. Expliciete null-check geeft de melding "Afmelden mislukt. Je deelnemersprofiel is niet meer beschikbaar." in plaats van de onjuiste PGRST116-melding.
- **`handleSluiten`** heeft een null-guard op `deelnemer?.id`. Bij ontbrekende deelnemer (race condition) wordt `DEELNEMER_ONTBREEKT` gegooid in plaats van een TypeError. `ModalSluiten` vangt deze fout op via `logFout` en toont een generieke foutmelding.

### `useMijnPotjes`

3 queries ongeacht aantal potjes. Device_id via `.eq()` (niet ilike). `herlaad()` via teller-dependency. Kritieke fix 2026-04-12:

- **`deviceId`** wordt nu opgehaald via `useDeviceId()` op hook-niveau, niet via `localStorage.getItem(DEVICE_ID_KEY)` binnen `useEffect`. Bij lege localStorage retourneerde `getItem` null, waardoor de deelnemersqueries werden overgeslagen en een stille lege lijst werd getoond (zelfde root cause als JAVASCRIPT-REACT-6). `useDeviceId()` garandeert altijd een geldige UUID v4. `deviceId` is toegevoegd als dependency aan `useEffect`.

---

## 11. Utilities

### `berekenSaldi` / `berekenEindafrekening` / `berekenVereffening`

Zie versie 2.1 (ongewijzigd).

### `logFout(error, context)`

Logt naar Sentry. Bekende gebruikerssituaties niet naar Sentry: `SALDO_TE_LAAG`, `NIET_ACTIEF`, `duplicate key`, `PGRST116`, `JSON object requested...`, `Cannot coerce...`.

### `vertaalFout(error)`

Matchervolgorde — PGRST116 vóór generieke PGRST-catch (zie versie 2.1 voor volledige volgorde).

### `valideerDeelnemerNaam` / `valideerTransactieBedrag` / `formatBedrag` / `parseBedrag` / `deelLink`

Zie versie 2.1 (ongewijzigd).

---

## 12–14. State management / Gebruikersidentificatie / Berekenlogica

Zie versie 2.1 (ongewijzigd).

---

## 15. Foutafhandeling en logging

Zie versie 2.1. Aanvulling:

### Nieuwe foutcodes / situaties

| Fout | Situatie | Naar Sentry? |
|---|---|---|
| `DEELNEMER_ONTBREEKT` | Race condition: deelnemer null bij sluiten | Ja — onverwachte situatie |
| `.maybeSingle()` → data null | Deelnemer verwijderd bij afmelden | Nee — wordt als correcte melding getoond |

---

## 16–17. Beveiliging / Toegankelijkheid

Zie versie 2.1 (ongewijzigd).

---

## 18. Testen

### Huidige dekking (aanvulling op versie 2.1)

| Bestand | Type | Wat wordt getest |
|---|---|---|
| `kritiek.regressie.test.js` | Regressie | MP-01…03: useMijnPotjes deviceId-logica; AF-01…03: handleAfmelden .maybeSingle() null-check; SL-01…03: handleSluiten null-guard ← nieuw |

Alle overige testbestanden: zie versie 2.1.

---

## 19–20. Build en deployment / Multicurrency

Zie versie 2.1 (ongewijzigd).

---

## 21. Wijzigingslog

| Versie | Datum | Wijziging | Reden |
|---|---|---|---|
| 1.0 | 2026-03-01 | Initieel TO opgesteld | Projectstart |
| 1.1 | 2026-04-02 | Valutakeuze verborgen; UX-verbeteringen; mobiele tabel; FO/TO in repository | UX + multicurrency uitgesteld |
| 1.2 | 2026-04-03 | `PaginaNietGevonden`; `berekenVereffening` correctie; UUID-validatie (SEC-M1); `.ilike()` → `.eq()` (SEC-H2); WCAG-verbeteringen; beveiligingssectie | Auditbevindingen 2026-04-03 |
| 1.3 | 2026-04-03 | Vijfde realtime-abonnement transacties DELETE (SEC-L2); toast progressiebalk (UX-3); drie nieuwe testbestanden | SEC-L2, UX-3, testdekking |
| 1.4 | 2026-04-04 | INSERT error-check (SEC-H1); noopener,noreferrer (SEC-S4); insertFout testbestand | Stille INSERT-mislukking + tab-napping |
| 1.5 | 2026-04-04 | `push_subscriptions` RLS (SEC-C1); search_path fixes (SEC-W1) | Security-audit |
| 1.6 | 2026-04-04 | §22 Cloudflare Worker lifecycle-cron | Lifecycle had geen aanroeper |
| 1.7 | 2026-04-04 | §22 keep-alive cron trigger | Supabase Free plan pauze |
| 1.8 | 2026-04-07 | §23 Supabase Edge Functions + pg_cron; §22 gemarkeerd vervallen | Cloudflare Worker vervangen |
| 1.9 | 2026-04-07 | SEC-CRON x-cron-secret; RLS SEC-PRIO2 + SEC-PRIO3 | Auditbevindingen 2026-04-07 |
| 2.0 | 2026-04-07 | Volledige security audit SEC-A1 t/m SEC-A9 | Security audit 2026-04-07 |
| 2.1 | 2026-04-12 | PGRST116-matcher in `vertaalFout` + `logFout`; testbestanden VF-116, LF-116; §11 matchervolgorde; §15 gebruikersfouten-tabel | Sentry-issue #17a27ebc |
| 2.2 | 2026-04-12 | **Kritieke fixes grondige audit:** (1) `useMijnPotjes`: `useDeviceId()` i.p.v. `localStorage.getItem()` — stille lege lijst bij lege storage voorkomen; (2) `handleAfmelden`: `.single()` → `.maybeSingle()` + null-check — onjuiste PGRST116-melding bij verwijderde deelnemer voorkomen; (3) `handleSluiten`: null-guard op `deelnemer?.id` → `DEELNEMER_ONTBREEKT` error — TypeError bij race condition voorkomen; nieuw testbestand `kritiek.regressie.test.js` (MP-01…03, AF-01…03, SL-01…03); §3 projectstructuur + §10 hooks bijgewerkt; §15 foutafhandeling uitgebreid; `DEVICE_ID_KEY` niet langer geïmporteerd in `useMijnPotjes` | Grondige code-audit 2026-04-12: zelfde root cause als JAVASCRIPT-REACT-6 aanwezig in `useMijnPotjes`; `.single()` op UPDATE genereerde onjuiste PGRST116-melding in `handleAfmelden`; TypeError mogelijk bij race condition in `handleSluiten` |

---

## 22. Cloudflare Worker — Lifecycle Cron

> **Status: vervallen.** Vervangen door Supabase Edge Functions + pg_cron (zie §23).

---

## 23. Supabase Edge Functions — Lifecycle

### Edge Functions

| Naam | Taak |
|---|---|
| `lifecycle-sluiten` | `lifecycle_sluit_verlopen_potjes()` |
| `lifecycle-verwijderen` | `lifecycle_verwijder_oude_potjes()` |
| `lifecycle-keepalive` | Keep-alive ping |

`verify_jwt: false`. Authenticatie via `Authorization: Bearer <service_role>` in pg_cron job.

### Cron schema (pg_cron)

| Jobnaam | Schema | Taak |
|---|---|---|
| `digipot-lifecycle-sluiten` | `0 * * * *` | Verlopen potjes sluiten |
| `digipot-lifecycle-verwijderen` | `0 3 * * *` | Oude potjes verwijderen |
| `digipot-lifecycle-keepalive` | `0 0 */5 * *` | Keep-alive ping |
| `digipot-sluit-verlopen-potjes` | `*/15 * * * *` | Legacy backup |
| `digipot-verwijder-oude-potjes` | `0 3 * * *` | Legacy backup |
