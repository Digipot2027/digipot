# Technisch Ontwerp — Digipot

**Versie:** 2.7
**Datum:** 2026-04-13
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
│   │   ├── tijdUtils.js
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
│       ├── hoog.regressie.test.js
│       ├── kritiek.regressie.test.js
│       ├── logFout.supabase.test.js
│       ├── logFout.test.js
│       ├── medium.regressie.test.js
│       ├── medium2.regressie.test.js
│       ├── modals.test.js
│       ├── paginaEindafrekening.regressie.test.js
│       ├── paginaStorten.gesloten.regressie.test.js
│       ├── paginaStorten.insertFout.regressie.test.js
│       ├── paginaStorten.regressie.test.js
│       ├── stap1.regressie.test.js
│       ├── stap6.regressie.test.js
│       ├── tijdUtils.test.js
│       ├── useDeviceId.regressie.test.js
│       ├── useMijnPotjes.eq.regressie.test.js
│       ├── useMijnPotjes.herlaad.test.js
│       ├── useMijnPotjes.regressie.test.js
│       ├── usePotje.delete.regressie.test.js
│       ├── usePotje.online.test.js
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

### `tijdUtils.js` (nieuw, 2026-04-13)

Pure hulpfuncties geëxtraheerd uit `PaginaEindafrekening`, `PaginaStorten`, `PaginaProfiel` en `DeelnemerDetailSheet`:
- `tijdLabel` — ISO → "HH:MM"
- `volledigTijdLabel` — ISO → "HH:MM" (vandaag) of "dag mnd HH:MM" (ouder)
- `transactiesVoor` — filter + sorteer per deelnemer
- `bouwSluitRegel` — sluitregel met/zonder sluitersnaam
- `bepaalEffectiefBedrag` — snelkeuze vs vrije invoer prioriteitslogica
- `isBedragGeldig` — bedragvalidatie voor storten
- `valideerProfielNaam` — profielnaam validatie
- `heeftProfielWijziging` — opslaan-knop activatielogica

Overige utilities: zie versie 2.3 (ongewijzigd).

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
| `medium.regressie.test.js` | Regressie | IS7/IS8/IS9/IS10: race conditions, realtime, valuta |
| `medium2.regressie.test.js` | Regressie | SM1-01..04b, WC2-01..05b, UX1-01..05b, SL2-01..03, SM2-01..03, WC3-01..02 |
| `deelnemerRij.regressie.test.js` | Regressie | Render, afgemeld |
| `errorBoundary.regressie.test.js` | Regressie | Fallback UI, Sentry |
| `paginaEindafrekening.regressie.test.js` | Regressie | Eindafrekening render |
| `stap1.regressie.test.js` + `stap6.regressie.test.js` | Regressie | Historische regressiescenario's |
| `useFocusTrap.test.js` | Unit | FT-01..12: Escape, Tab-trap, Shift+Tab, cleanup, aangepaste selector, preventDefault |
| `tijdUtils.test.js` | Unit | TL-01..02, VT-01..03, TV-01..04, SR-01..03, EB-01..06, BG-01..07, PN-01..05, HW-01..04 |
| `usePotje.online.test.js` | Unit | PO-01..04: online/offline transitie; PD-01..04: deelnemer-matching; PF-01..02: laadData foutpad |
| `modals.test.js` | Unit | MD-01..05: ModalDeelnemen validatie; MT-01..08: ModalTransactie foutclassificatie + bedragvalidatie; MA-01..02: ModalAfmelden; MS-01..02: ModalSluiten |

### Niet gedekt (gemotiveerd)

| Component/bestand | Reden | Alternatief |
|---|---|---|
| `ModalDeelnemen`, `ModalTransactie`, `ModalAfmelden`, `ModalSluiten` — component-mount + DOM | Supabase-afhankelijkheid in callbacks; logica gedekt via `usePotjeActies` + `modals.test.js` | e2e (Playwright/Cypress) |
| `PaginaInstellingen`, `PaginaOpenPotjes`, `PaginaGeslotenPotjes`, `PaginaNietGevonden` | Minimale business logic — alleen render + navigatie | e2e happy path |
| `usePotje.laadData` DB-aanroepen | Supabase-afhankelijk — 3 parallelle queries | Integratietest tegen Supabase-testproject |
| `useMijnPotjes.laadPotjes` DB-aanroepen | Supabase-afhankelijk — 3 queries | Integratietest tegen Supabase-testproject |
| `DeelKnop` component-state | Indirect gedekt via `deelLink.test.js`; component-mount voegt weinig toe | Optioneel: `@testing-library/react` render |

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
| 2.5 | 2026-04-13 | **Medium audit-bevindingen SEC-M1, WCAG-2, UX-1:** (SEC-M1) `ModalDeelnemen`: hardcoded `MAX_NAAM`/`MAX_DEELNEMERS` vervangen door import uit `constants.js`; (WCAG-2) `PaginaPotje` toast: `role` en `aria-live` afhankelijk van toast-type — `fout` krijgt `role=alert`/`aria-live=assertive`, overige typen behouden `role=status`/`aria-live=polite` (WCAG 4.1.3); (UX-1) `PaginaOverzicht` afmeldknop: `aria-disabled` + `cursor: not-allowed` toegevoegd als deelnemer al afgemeld is (WCAG 4.1.2); `medium2.regressie.test.js` toegevoegd: SM1-01..04b, WC2-01..05b, UX1-01..05b | Medium audit-bevindingen 2026-04-13 |
| 2.6 | 2026-04-13 | **Low audit-bevindingen SEC-L2, SEC-M2, WCAG-3:** (SEC-L2) `supabaseClient.js`: JSDoc uitgebreid; (SEC-M2) `usePotjeActies.js`: comment uitgebreid; (WCAG-3) `ModalDeelnemen.jsx`: comment verduidelijkt; `medium2.regressie.test.js` uitgebreid met SL2-01..03, SM2-01..03, WC3-01..02 | Low audit-bevindingen 2026-04-13 |
| 2.7 | 2026-04-13 | **Testvolgorde uitgevoerd (stappen 1–6):** (1) `useFocusTrap.test.js` — FT-01..12; (2+3) `tijdUtils.js` aangemaakt — 8 pure functies geëxtraheerd uit PaginaEindafrekening, PaginaStorten, PaginaProfiel, DeelnemerDetailSheet; `tijdUtils.test.js` — 35 tests; (4) `usePotje.online.test.js` — PO/PD/PF-reeks; (5) `modals.test.js` — MD/MT/MA/MS-reeks; (6) TO §3/§11/§18 bijgewerkt; `medium.regressie.test.js` + testbestandenlijst in projectstructuur bijgewerkt; “Niet gedekt” sectie herzien | Testvolgorde 2026-04-13: dekking van ~44% naar ~58% |

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
