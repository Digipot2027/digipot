# Technisch Ontwerp — Digipot

**Versie:** 2.3
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
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── periodieke_audit.md  ← kwartaalaudit template (nieuw 2026-04-12)
│   ├── workflows/
│   │   └── ci.yml               ← patroon-check stap toegevoegd (nieuw 2026-04-12)
│   └── dependabot.yml
├── scripts/
│   └── controleer-patronen.js  ← verboden codepatronen CI-check (nieuw 2026-04-12)
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

## 4–17. Routering t/m Toegankelijkheid

Zie versie 2.2 (ongewijzigd).

---

## 18. Testen

Zie versie 2.2 (ongewijzigd).

---

## 19. Build en deployment

### CI/CD pipeline (GitHub Actions)

De pipeline bestaat uit twee jobs: `test` en `deploy`. De `deploy`-job draait alleen na een groene `test`-job op de `main`-branch.

**Stappen in de `test`-job:**
1. Checkout + Node.js 24 instellen
2. `npm ci` — dependencies installeren
3. `npm run lint` — ESLint
4. `npm run lint:patronen` — verboden codepatronen controleren
5. `npm audit --audit-level=high` — vulnerability scan
6. `npm run test:run` — Vitest CI-mode

### Patroon-check (`lint:patronen`)

`scripts/controleer-patronen.js` controleert bij elke push op verboden codepatronen. De check draait vóór de tests zodat structurele risico's vroeg in de pipeline worden gesignaleerd.

**Blokkerend (faalt de CI):**
- `localStorage.getItem(DEVICE_ID_KEY)` buiten `useDeviceId.js` — root cause JAVASCRIPT-REACT-6 + kritiek-1

**Waarschuwend (meldt, blokkeert niet):**
- `.single()` buiten INSERT-context — risico PGRST116 bij 0 rijen (kritiek-2)
- `payload.new` zonder null-guard — risico undefined state bij DELETE-events

Nieuwe patronen worden toegevoegd in `scripts/controleer-patronen.js`. Het script bevat de uitleg en uitzonderingen per patroon.

### Periodieke audit

`.github/ISSUE_TEMPLATE/periodieke_audit.md` bevat een kwartaalaudit-checklist. De checklist dekt alle structurele risico-assen die bij de grondige audit van 2026-04-12 zijn geïdentificeerd. Aanmaken als GitHub Issue elke drie maanden.

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
| 2.2 | 2026-04-12 | Kritieke fixes grondige audit: `useMijnPotjes` useDeviceId(), `handleAfmelden` .maybeSingle(), `handleSluiten` null-guard; `kritiek.regressie.test.js` | Code-audit 2026-04-12 |
| 2.3 | 2026-04-12 | `scripts/controleer-patronen.js` toegevoegd — geautomatiseerde patroon-check op verboden codepatronen; CI-stap `lint:patronen` toegevoegd aan `.github/workflows/ci.yml`; `npm run lint:patronen` in `package.json`; `.github/ISSUE_TEMPLATE/periodieke_audit.md` — kwartaalaudit template; §3 projectstructuur bijgewerkt; §19 CI/CD-beschrijving uitgebreid | Structurele waarborg: grep-stap na elke fix + periodieke audit verankerd in CI en repository — niet afhankelijk van geheugen of discipline |

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
