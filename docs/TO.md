# Technisch Ontwerp — Digipot

**Versie:** 3.3
**Datum:** 2026-04-16
**Status:** Actueel
**Auteur:** Projectteam Digipot

---

## Inhoudsopgave

1. Systeemoverzicht
2. Stack en dependencies
3. Projectstructuur
4–17. Routering t/m Toegankelijkheid
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
| Testen (unit) | Vitest + @testing-library/react | — |
| Testen (e2e) | Playwright | ^1.52 |
| Test-DOM | @testing-library/jest-dom | — |
| Testomgeving (unit) | jsdom | — |
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
├── e2e/                                     ← Playwright e2e tests
│   ├── helpers.js
│   ├── pw1-happy-path.spec.js
│   ├── pw2-geen-device-id.spec.js
│   ├── pw3-betaling-modal.spec.js
│   ├── pw4-deelnemen.spec.js
│   ├── pw5-keyboard-focus.spec.js
│   ├── pw6-responsive.spec.js
│   ├── pw7-profiel-instellingen.spec.js
│   └── pw8-potjeslijsten-en-routing.spec.js
├── scripts/
│   └── controleer-patronen.js
├── smoke/
│   ├── runner.mjs
│   └── t1.mjs … t10.mjs
├── docs/
│   ├── FO.md
│   └── TO.md
├── src/
│   ├── components/
│   ├── hooks/
│   ├── pages/
│   ├── utils/
│   └── test/
├── playwright.config.js
├── vite.config.js
└── package.json
```

---

## 4–17. Routering t/m Toegankelijkheid

Zie versie 2.6 (ongewijzigd).

---

## 18. Testen

### Framework

**Unit/regressie:** Vitest + @testing-library/react + @testing-library/jest-dom, jsdom-omgeving.
**E2e:** Playwright tegen lokale dev-server. `vite.config.js` sluit `e2e/**` uit van Vitest.

### Teststrategie

Business logic en pure functies via unit tests — geen Supabase-mock, geen component-mount.
E2e-tests draaien tegen echte Supabase met `[E2E]`-prefix en cleanup via `afterEach`.
Testprioriteit op basis van risico, niet op regelcoverage.

### Unit/regressie — 571 tests

| Categorie | Wat gedekt |
|---|---|
| Berekenlogica | Alle 5 referentiescenario's, nullcases, stringbedragen, tijdgrenzen |
| Validatie | `valideerPotjeNaam`, `valideerDeelnemerNaam`, `valideerTransactieBedrag` — alle paden en grenzen |
| Foutvertaling | Alle matchers incl. RLS/42501, PGRST116, JWT, netwerk |
| Foutlogging | Sentry-routing, plain objects, gebruikersfout-uitsluitingen incl. RLS |
| Tijdlabel | `volledigTijdLabel()` vandaag/eerder |
| Hooks logica | Guards, reducers, filter-opbouw, UUID-validatie |
| Regressie fixes | Kritiek-1/2/3, Hoog-4/5/6, Issue 7/8/9/10 |

### E2e — 230 tests (227 passed, 3 skipped)

| Bestand | Scenario's | Wat gedekt |
|---|---|---|
| `pw1-happy-path.spec.js` | PW-1a/b/c | Storten snelknop, vrij bedrag, disabled |
| `pw2-geen-device-id.spec.js` | PW-2a/b/c | Geen device_id, geen RLS-crash, bootstrapDeviceId |
| `pw3-betaling-modal.spec.js` | PW-3a/b/c | Modal betaling, saldo-check, annuleren |
| `pw4-deelnemen.spec.js` | PW-4a..e | Deelnemen-flow, validatie, profielnaam, localStorage |
| `pw5-keyboard-focus.spec.js` | PW-5a..f | Escape, Tab-trap, focus op invoerveld, Enter, detail-sheet |
| `pw6-responsive.spec.js` | PW-6a..d × 4 viewports | Tabel op 320/375/768/1440px, knoppen, snelknoppen |
| `pw7-profiel-instellingen.spec.js` | PW-7a..h | Naam opslaan/verwijderen, navigatie, radiogroep |
| `pw8-potjeslijsten-en-routing.spec.js` | PW-8a..g | Lege staat, potje in lijst, 404, aanmaken |
| `pw9-terugkerende-deelnemer.spec.js` | PW-9a..e | Terugkerende deelnemer herkend op device_id, afgemelde terugkomer |
| `pw10-naambotsing.spec.js` | PW-10a..e | Bezette naam, profielnaam pre-ingevuld, fout-reset, trim, casing |
| `pw11-realtime-sluiting.spec.js` | PW-11a..d | Realtime sluiting op overzicht en stortenscherm, handmatig sluiten |
| `pw12-twee-devices.spec.js` | PW-12a..d | Twee devices zelfde potje, realtime sync, naamconflict, afmelding zichtbaar |
| `pw13-undo-en-afmelden.spec.js` | PW-13a..e | Undo flow, undo na afmelden, betaling bij saldo=0, geblokkeerde undo |

### Browsers

| Browser | Project | Apparaat |
|---|---|---|
| Chromium | `chromium` | Desktop Chrome/Edge/Brave |
| WebKit | `webkit` | Desktop Safari (macOS) |
| Mobile Safari | `mobile-safari` | iPhone 14 (iOS Safari) |
| Android Chrome | `android-chrome` | Pixel 7 (Android Chrome) |
| Firefox | `firefox` | Desktop Firefox |

Alle 5 browsers gedekt. Totaal 230 tests (46 per browser) + 25 nieuwe scenario's in PW-9 t/m PW-13.

**Platform-skip:** PW-5c (Tab-focus op knoppen) is geskipped op WebKit, Mobile Safari en Android Chrome. Safari en Android focussen standaard geen `<button>`-elementen via Tab — dit is een OS-platformbeperking, geen codebug. Chromium en Firefox implementeren Tab-focus op knoppen wel conform de WCAG-spec.

### Helpers (`e2e/helpers.js`)

| Functie | Doel |
|---|---|
| `maakSupabaseClient(deviceId?)` | Client met optionele `x-device-id` header |
| `maakTestPotje(supabase, naam)` | Potje met `[E2E]`-prefix (max 30 tekens) |
| `maakDeelnemer(supabase, potjeId, naam, deviceId)` | Deelnemer aanmaken |
| `maakTransactie(potjeId, deelnemerId, type, bedrag, deviceId)` | Transactie mét RLS-header |
| `verwijderTestPotje(supabase, potjeId)` | Cleanup via CASCADE |
| `wachtOpToastMetTekst(page, tekst, timeout?)` | Toast met specifieke tekst |
| `nieuweTestDeviceId()` | UUID v4 voor test-device |

### Testcommando's

```bash
npm run test:run      # Vitest CI (668 unit tests)
npm run e2e           # Alle 5 browsers (lokaal)
npm run e2e:chromium  # Chromium only — snelste feedback
npm run e2e:webkit    # WebKit/Safari
npm run e2e:mobile    # iPhone 14
npm run e2e:report    # HTML rapport
```

### CI-gedrag (`process.env.CI === 'true'`)

In de GitHub Actions e2e-job draait Playwright in CI-modus:
- **Alleen Chromium** — `playwright.config.js` selecteert op basis van `isCI` automatisch één project
- **`--project=chromium`** wordt ook expliciet meegegeven aan `npx playwright test` als vangnet
- **`reuseExistingServer: false`** — in CI start de webServer altijd opnieuw (dev-server `npm run dev` met Supabase-env)
- **`retries: 1`** — flakiness-buffer; mislukte test krijgt één herkansing
- **`forbidOnly: true`** — `test.only()` blokkeert de CI-run
- **Browser-cache:** `~/.cache/ms-playwright` gecached op Playwright-versie + OS; bij cache miss volgt `npx playwright install --with-deps chromium`
- **`install-deps chromium`** draait altijd — systeem-libraries (libglib etc.) zijn niet gecached
- **Artifact bij falen:** het HTML-rapport (`playwright-report/`) wordt 14 dagen bewaard als GitHub Actions artifact

### Niet gedekt door unit tests (gemotiveerd)

| Component | Reden | Alternatief |
|---|---|---|
| `ModalDeelnemen`, `ModalAfmelden`, `ModalSluiten` | Supabase-afhankelijkheid; logica gedekt via `usePotjeActies` | E2e flows |
| `ModalTransactie` | Idem; bedragslogica gedekt via `valideer.js` | PW-3 |

---

## 19. Build en deployment

**CI-pipeline:** Drie jobs in volgorde:

1. **`test`** — `npm ci` → `lint` → `lint:patronen` → `npm audit` → `test:run` (Vitest)
2. **`e2e`** — draait na `test`; Chromium only; Playwright browser gecached; HTML-rapport als artifact bij falen
3. **`deploy`** — draait na `test` én `e2e`; alleen op `main` bij push

Deploy naar Cloudflare Pages vereist dat zowel unit tests als e2e slagen.

**Health check:** `.github/workflows/health.yml` draait dagelijks om 08:00 UTC en verifieert:
- App bereikbaar op Cloudflare Pages
- Supabase REST bereikbaar + anon key geldig
- INSERT + DELETE werken (mini smoke test)
- Lifecycle Edge Function bereikbaar

GitHub stuurt automatisch een email bij een mislukte workflow.

E2e-tests draaien in CI via de `e2e`-job. De dev-server (`npm run dev`) start automatisch via de `webServer`-configuratie in `playwright.config.js`. Supabase-verbinding loopt via repository secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) die als env-variabelen worden doorgegeven aan zowel de dev-server als de Playwright-process.

**Pre-push hook (lokaal):** Blokkeert een push naar `main` als e2e-tests niet succesvol en recent (< 24 uur) zijn gedraaid. Installatie éénmalig per developer:

```bash
cp scripts/pre-push-hook.sh .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

De hook leest `test-results/e2e-resultaat.json` — gegenereerd door `npm run e2e`. Bij 0 mislukte tests en tijdstempel < 24 uur wordt de push toegelaten. Overslaan bij noodgeval: `git push --no-verify` (documenteer waarom in de commit).

---

## 20–23. Multicurrency t/m Edge Functions

Zie versie 2.6 (ongewijzigd).

---

## 21. Wijzigingslog

| Versie | Datum | Wijziging | Reden |
|---|---|---|---|
| 1.0–2.9 | 2026-03-01–15 | Zie eerdere versies | — |
| 3.0 | 2026-04-15 | **Android Chrome + Firefox toegevoegd:** `playwright.config.js` uitgebreid met `android-chrome` (Pixel 7) en `firefox` (Desktop Firefox); `npx playwright install firefox` uitgevoerd; 230 tests (227 passed, 3 skipped); §18 browsers-tabel bijgewerkt; platform-skip PW-5c uitgebreid met Android Chrome | Volledige browser-dekking: Chrome desktop + Android + Firefox ontbraken nog |
| 3.1 | 2026-04-16 | **PW-9 t/m PW-13 toegevoegd:** 5 nieuwe e2e-specs; unit tests uitgebreid van 571 naar 668 | Gap-analyse na meerdaagse praktijktest |
| 3.2 | 2026-04-16 | **§19 monitoring uitgebreid:** UptimeRobot, Sentry alerts en GitHub Actions health check gedocumenteerd; TO-versie bijgewerkt | Monitoring-stack volledig opgezet |
| 3.3 | 2026-04-16 | **§18 CI-gedrag toegevoegd:** Playwright e2e in CI-pipeline gedocumenteerd (Chromium only, browser-cache, artifact-upload, `isCI`-logica in config); **§19 CI-pipeline** bijgewerkt naar 3-jobs structuur (test → e2e → deploy) | E2e-tests opgenomen in GitHub Actions CI |
