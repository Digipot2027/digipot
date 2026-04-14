# Technisch Ontwerp — Digipot

**Versie:** 2.6
**Datum:** 2026-04-14
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

---

## 3. Projectstructuur

```
digipot/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── periodieke_audit.md
│   ├── workflows/
│   │   └── ci.yml
│   └── dependabot.yml
├── scripts/
│   └── controleer-patronen.js
├── workers/
│   └── lifecycle-cron/          ← vervallen, zie §22
├── docs/
│   ├── FO.md
│   └── TO.md
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
│       ├── hoog.regressie.test.js              ← nieuw (H4/H5/H6)
│       ├── kritiek.regressie.test.js
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
│       ├── usePotjeActies.regressie.test.js    ← PA-00/00b + PA-14..16 toegevoegd
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

React Router 7, `BrowserRouter`, client-side routing. Zie versie 2.2 voor routetabel.

---

## 5–9. Datamodel t/m Pagina's

Zie versie 2.2 (ongewijzigd).

---

## 10. Hooks

### `useDeviceId`

Leest + valideert `digipot_device_id` (UUID v4-patroon). Bij afwezigheid/ongeldig: `crypto.randomUUID()`, opslaan, retourneren. **De enige geautoriseerde bron van device-ID in de gehele applicatie.**

### `useFocusTrap`

Tab-focus binnen containerRef. `onEscape` bij Escape-toets.

### `usePotje`

Laadt potje, deelnemers, transacties parallel. Vijf Realtime-abonnementen. Online/offline-status. Retourneert state-setters.

### `usePotjeActies`

Pure async functies. Fixes 2026-04-12 (audit Q2):

- **`handleDeelnemen`** (audit bevinding 1): deelnemer-ID client-side genereren via `crypto.randomUUID()`. `.select().single()` na de INSERT verwijderd — zelfde patroon als hoog-4. Het deelnemer-object wordt lokaal geconstrueerd en direct aan `setDeelnemer` doorgegeven.
- **`handleTransactie`** (audit bevinding 2): expliciete null-guard op `deelnemer?.id` vóór alle deelnemer-toegangen. Gooit `DEELNEMER_ONTBREEKT` bij null — consistent met `handleSluiten`.
- **`handleAfmelden`**: `.maybeSingle()` i.p.v. `.single()` (kritiek-2).
- **`handleSluiten`**: null-guard op `deelnemer?.id` (kritiek-3).

### `useMijnPotjes`

3 queries ongeacht aantal potjes. `deviceId` via `useDeviceId()` (kritiek-1). Profielnaam case-insensitief bij mijnDeelnemer-lookup (hoog-6).

---

## 11–17. Utilities t/m Toegankelijkheid

Zie versie 2.3 (ongewijzigd).

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
| `vertaalFout.pgrst116.regressie.test.js` | Regressie | VF-116-01…06: PGRST116; LF-116-01…05: Sentry-routing |
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
| `usePotjeActies.regressie.test.js` | Regressie | PA-00..03b: handleTransactie guards incl. DEELNEMER_ONTBREEKT; PA-04..07b: handleUndo; PA-08..10b: handleAfmelden; PA-11..13: toastberichten; PA-14..16: handleDeelnemen client-side UUID ← bijgewerkt |
| `kritiek.regressie.test.js` | Regressie | MP-01…03: useMijnPotjes deviceId; AF-01…03: handleAfmelden .maybeSingle(); SL-01…03: handleSluiten null-guard |
| `hoog.regressie.test.js` | Regressie | H4-01..03b: client-side UUID PaginaNieuwPotje; H5-01..03b: openTikkie visibility; H6-01..05: mijnDeelnemer case-insensitief ← nieuw |
| `deelnemerRij.regressie.test.js` | Regressie | Render, afgemeld |
| `errorBoundary.regressie.test.js` | Regressie | Fallback UI, Sentry |
| `paginaEindafrekening.regressie.test.js` | Regressie | Eindafrekening render |
| `stap1.regressie.test.js` + `stap6.regressie.test.js` | Regressie | Historische regressiescenario's |

### Niet gedekt (gemotiveerd)

| Component | Reden | Alternatief |
|---|---|---|
| `ModalDeelnemen`, `ModalTransactie`, `ModalAfmelden`, `ModalSluiten` | Supabase-afhankelijkheid; logica gedekt via `usePotjeActies` | Integratietest / e2e |

---

## 19. Build en deployment

### CI/CD pipeline

**Stappen `test`-job:** checkout → Node.js 24 → `npm ci` → `npm run lint` → `npm run lint:patronen` → `npm audit` → `npm run test:run`

**Patroon-check:** `scripts/controleer-patronen.js` — blokkerend: `localStorage.getItem(DEVICE_ID_KEY)` buiten `useDeviceId.js`. Waarschuwend: `.single()` buiten INSERT-context, `payload.new` zonder null-guard.

**Periodieke audit:** `.github/ISSUE_TEMPLATE/periodieke_audit.md` — kwartaalaudit. Volgende: 2026-07-12.

---

## 20. Uitgestelde functionaliteit — Multicurrency

Zie versie 2.1 (ongewijzigd).

---

## 21. Wijzigingslog

| Versie | Datum | Wijziging | Reden |
|---|---|---|---|
| 1.0 | 2026-03-01 | Initieel TO opgesteld | Projectstart |
| 1.1 | 2026-04-02 | Valutakeuze verborgen; UX-verbeteringen; mobiele tabel; FO/TO in repository | UX + multicurrency uitgesteld |
| 1.2 | 2026-04-03 | `PaginaNietGevonden`; UUID-validatie (SEC-M1); `.ilike()` → `.eq()` (SEC-H2); WCAG-verbeteringen | Auditbevindingen 2026-04-03 |
| 1.3 | 2026-04-03 | SEC-L2 (DELETE-abonnement); toast progressiebalk (UX-3); nieuwe testbestanden | SEC-L2, UX-3, testdekking |
| 1.4 | 2026-04-04 | SEC-H1 (INSERT error-check); SEC-S4 (tab-napping) | Auditbevindingen 2026-04-04 |
| 1.5 | 2026-04-04 | SEC-C1 (push_subscriptions RLS); SEC-W1 (search_path) | Security-audit |
| 1.6 | 2026-04-04 | §22 Cloudflare Worker lifecycle-cron | Lifecycle had geen aanroeper |
| 1.7 | 2026-04-04 | §22 keep-alive cron trigger | Supabase Free plan pauze |
| 1.8 | 2026-04-07 | §23 Supabase Edge Functions + pg_cron; §22 vervallen | Cloudflare Worker vervangen |
| 1.9 | 2026-04-07 | SEC-CRON x-cron-secret; RLS SEC-PRIO2 + SEC-PRIO3 | Auditbevindingen 2026-04-07 |
| 2.0 | 2026-04-07 | Volledige security audit SEC-A1 t/m SEC-A9 | Security audit 2026-04-07 |
| 2.1 | 2026-04-12 | PGRST116-matcher in `vertaalFout` + `logFout`; VF-116/LF-116 testbestanden | Sentry-issue #17a27ebc |
| 2.2 | 2026-04-12 | Kritieke fixes: `useMijnPotjes` useDeviceId(), `handleAfmelden` .maybeSingle(), `handleSluiten` null-guard; `kritiek.regressie.test.js` | Code-audit 2026-04-12 |
| 2.3 | 2026-04-12 | `scripts/controleer-patronen.js`; CI `lint:patronen`; `periodieke_audit.md` template; §19 CI/CD uitgebreid | Structurele waarborg: patroon-check + kwartaalaudit |
| 2.4 | 2026-04-12 | **Audit Q2 bevindingen 1–4:** (1) `handleDeelnemen`: client-side UUID i.p.v. `.select().single()` — zelfde patroon als hoog-4; (2) `handleTransactie`: null-guard op `deelnemer?.id` → `DEELNEMER_ONTBREEKT` — race condition bij afmelden + betalen tegelijk; (3) `controleer-patronen.js`: overbodige `PaginaNieuwPotje.jsx`-uitzondering voor `.single()` verwijderd; (4) TO §18 dekkingtabel bijgewerkt: `hoog.regressie.test.js` toegevoegd, `usePotjeActies.regressie.test.js` bijgewerkt (PA-00/00b + PA-14..16); `usePotjeActies.regressie.test.js` bijgewerkt met nieuwe guards | Kwartaalaudit 2026-04-12: eerste periodieke audit vond twee medium bevindingen en twee low bevindingen |
| 2.5 | 2026-04-13 | **S1/S2 fix:** secrets uit `cron.job` plaintext naar Supabase Vault; wrapper-functie `digipot_roep_lifecycle_aan()` (SECURITY DEFINER); Supabase API keys geroteerd naar `sb_secret_`/`sb_publishable_` formaat; legacy JWT-based API keys uitgeschakeld; legacy HS256 signing key gerevoked; §23 herschreven | Kritieke bevindingen Q2 audit |
| 2.5b | 2026-04-13 | **Dubbelstorten fix:** `bezigRef` (useRef) synchroon submit-guard in `PaginaStorten`; `idempotency_key` UUID per submit + UNIQUE INDEX op `(deelnemer_id, idempotency_key)` (migratie stap 24); UI-dubbelpost Realtime deduplicatie in `usePotje` INSERT-reducer; patroon-checker uitgebreid met `[...prev, payload.new]` als blokkerend patroon; regressietests DS-01..07 + UP-09a..e | Productiemelding dubbelstorten deelnemer iMac |
| 2.6 | 2026-04-14 | **S3 fix:** `transacties_insert` RLS device-ID check toegevoegd — voorkomt cross-deelnemer inserts (migratie stap 25); **S4 fix:** `wrangler-action` gepind op SHA `da0e0df` (v3.14.1); **S5 fix:** `actions/checkout` en `actions/setup-node` gecorrigeerd van niet-bestaand `@v6` naar `@v4`; **S6:** Sentry-init geverifieerd — `enabled: import.meta.env.PROD` correct aanwezig in `main.jsx` | Resterende bevindingen Q2 audit 2026 afgerond |

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
