# Technisch Ontwerp — Digipot

**Versie:** 6.8
**Datum:** 2026-04-24
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
24. Technische schuld

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
│   ├── pw8-potjeslijsten-en-routing.spec.js
│   ├── pw9-terugkerende-deelnemer.spec.js
│   ├── pw10-naambotsing.spec.js
│   ├── pw11-realtime-sluiting.spec.js
│   ├── pw12-twee-devices.spec.js
│   └── pw13-undo-en-afmelden.spec.js
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
│   │   ├── storage.js          ← localStorage-abstractielaag (2026-04-16)
│   │   ├── tijdUtils.js        ← tijdformattering-utilities (2026-04-16)
│   │   ├── valideer.js
│   │   └── vertaalFout.js
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

### Unit/regressie — 841 tests

| Categorie | Wat gedekt |
|---|---|
| Berekenlogica | Alle 5 referentiescenario's, nullcases, stringbedragen, tijdgrenzen |
| Validatie | `valideerPotjeNaam`, `valideerDeelnemerNaam`, `valideerTransactieBedrag`, `beperkDecimalen` — alle paden en grenzen incl. decimalen-beperking |
| Foutvertaling | Alle matchers incl. RLS/42501, PGRST116, JWT, netwerk |
| Foutlogging | Sentry-routing, plain objects, gebruikersfout-uitsluitingen incl. RLS |
| Tijdlabel | `tijdLabel()` en `volledigTijdLabel()` — vandaag/eerder, uit `tijdUtils.js` |
| Hooks logica | Guards, reducers, filter-opbouw, UUID-validatie |
| Storage | `getItem`, `setItem`, `removeItem` — happy path, foutpaden, QuotaExceededError |
| Regressie fixes | Kritiek-1/2/3, Hoog-4/5/6, Issue 7/8/9/10, medium- en lage bevindingen 2026-04-16 |

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

Alle 5 browsers gedekt. Totaal 230 tests (46 per browser).

**Platform-skip:** PW-5c (Tab-focus op knoppen) is geskipped op WebKit, Mobile Safari en Android Chrome. Safari en Android focussen standaard geen `<button>`-elementen via Tab — dit is een OS-platformbeperking, geen codebug.

### CI-gedrag (`process.env.CI === 'true'`)

In de GitHub Actions e2e-job draait Playwright in CI-modus:
- **Alleen Chromium** — `playwright.config.js` selecteert op basis van `isCI` automatisch één project
- **`reuseExistingServer: false`** — dev-server start altijd opnieuw in CI
- **`retries: 1`** — flakiness-buffer
- **`forbidOnly: true`** — `test.only()` blokkeert de CI-run
- **Browser-cache:** `~/.cache/ms-playwright` gecached op Playwright-versie + OS
- **Artifact bij falen:** HTML-rapport (`playwright-report/`) bewaard 14 dagen

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
npm run test:run      # Vitest CI (728 unit tests)
npm run e2e           # Alle 5 browsers (lokaal)
npm run e2e:chromium  # Chromium only — snelste feedback
npm run e2e:webkit    # WebKit/Safari
npm run e2e:mobile    # iPhone 14
npm run e2e:report    # HTML rapport
```

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

**Pre-push hook (lokaal):** Blokkeert een push naar `main` als e2e-tests niet succesvol en recent (< 24 uur) zijn gedraaid.

```bash
cp scripts/pre-push-hook.sh .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

---

## 20–23. Multicurrency t/m Edge Functions

Zie versie 2.6 (ongewijzigd).

---

## 24. Technische schuld

De volledige schuldenlijst (harde schuld A1–A20, strategische schuld B1–B7, nieuw gesignaleerde items C1–C3) wordt bijgehouden in `docs/SCHULD.md`. Dat bestand is de enige bron van waarheid voor openstaande en afgeloste technische schuld.

**Openstaand (per 2026-04-21):**

| Item | Ernst | Omschrijving |
|---|---|---|
| B4 | Laag | Rate limiting — afgelost via RLS-frequentiecheck (max 10/min per device) |
| C1 | Laag | Inline stijlen — afgelost, zie TO v6.0 |
| C2 | Laag | Disabled afmeld-knop — afgelost, zie TO v6.2 |
| C3 | Laag | Branching-strategie — afgelost, zie TO v6.2 |

---

## 21. Wijzigingslog

| Versie | Datum | Wijziging | Reden |
|---|---|---|---|
| 1.0–2.9 | 2026-03-01–15 | Zie eerdere versies | — |
| 3.0 | 2026-04-15 | **Android Chrome + Firefox toegevoegd** | Volledige browser-dekking |
| 3.1 | 2026-04-16 | **PW-9 t/m PW-13 toegevoegd;** unit tests 571 → 668 | Gap-analyse na praktijktest |
| 3.2 | 2026-04-16 | **§19 monitoring uitgebreid:** UptimeRobot, Sentry alerts, health check | Monitoring-stack opgezet |
| 3.3 | 2026-04-16 | **§18 CI-gedrag + §19 3-jobs pipeline:** Playwright e2e in CI gedocumenteerd | E2e in GitHub Actions |
| 3.4 | 2026-04-16 | **localStorage-abstractielaag:** `src/utils/storage.js` geïntroduceerd; `controleer-patronen.js` uitgebreid met `localStorage.`-patroon; unit tests storage.test.js toegevoegd (10 tests); TEKSTGROOTTE_KEY bugfix in `main.jsx` via `getItem()` | Technische schuld: directe localStorage-aanroepen gesaneerd |
| 3.5 | 2026-04-16 | **Audit-fix:** 2 gemiste overtredingen alsnog gemigreerd (`useMijnPotjes.js` r57, `PaginaPotje.jsx` r162); §3 projectstructuur bijgewerkt met `storage.js` en `tijdUtils.js` en pw9–pw13; §18 testcount bijgewerkt naar 728 | Naverificatie na storage-abstractie audit |
| 3.6 | 2026-04-17 | **Technische schuld afgelost + CSS-migratie fase 1:** utility-klassen en component-specifieke CSS toegevoegd aan `index.css`; basis gereed voor fasen 2–10 | Technische schuld items 1/5/6; CSS-migratie fase 1 van 10 |
| 3.7 | 2026-04-17 | **CSS-migratie fase 2:** `DeelKnop` en `PaginaNietGevonden` inline-stijl-vrij | CSS-migratie stap 2 van 10 |
| 3.8 | 2026-04-17 | **CSS-migratie fase 3:** vier modals inline-stijl-vrij | CSS-migratie stap 3 van 10 |
| 3.9 | 2026-04-17 | **CSS-migratie fase 4:** `PaginaNieuwPotje` en `PaginaProfiel` inline-stijl-vrij | CSS-migratie stap 4 van 10 |
| 4.0 | 2026-04-17 | **CSS-migratie fase 5:** `PaginaInstellingen` inline-stijl-vrij | CSS-migratie stap 5 van 10 |
| 4.1 | 2026-04-17 | **CSS-migratie fase 6:** `PaginaOpenPotjes` en `PaginaGeslotenPotjes` inline-stijl-vrij | CSS-migratie stap 6 van 10 |
| 4.2 | 2026-04-17 | **CSS-migratie fase 7:** `DeelnemerRij` inline-stijl-vrij | CSS-migratie stap 7 van 10 |
| 4.3 | 2026-04-17 | **CSS-migratie fase 8:** `DeelnemerDetailSheet` inline-stijl-vrij | CSS-migratie stap 8 van 10 |
| 4.4 | 2026-04-17 | **CSS-migratie fase 9:** `PaginaStorten` inline-stijl-vrij | CSS-migratie stap 9 van 10 |
| 4.5 | 2026-04-17 | **CSS-migratie fase 10 (afsluiting):** `PaginaPotje`, `PaginaOverzicht`, `PaginaEindafrekening` inline-stijl-vrij; alle inline stijlen projectbreed gemigreerd naar CSS-klassen | CSS-migratie voltooid |
| 4.6 | 2026-04-18 | **Zombie-preventie trigger:** nieuwe migratie `laatste_afmelding_sluit_potje` voegt `sluit_potje_bij_laatste_afmelding()` (SECURITY DEFINER, search_path=public) en trigger `trg_sluit_potje_bij_laatste_afmelding` op `deelnemers.actief` toe. Sluit automatisch een potje zodra de laatste actieve deelnemer zich afmeldt. Frontend: `ModalAfmelden` krijgt prop `isLaatsteActieve`; `PaginaOverzicht` bepaalt deze en geeft door. Regressietests: `zombiePreventie.isLaatsteActieve.regressie.test.js` (9 scenario's). Integratietest via SQL DO-block op drie scenario's (niet-laatste, laatste, idempotent) — alle drie geslaagd | Een potje kon in zombie-toestand belanden (status=open zonder actieve deelnemers), onherstelbaar via reguliere flow door RLS-policy `potjes_update_sluiten` die een actieve deelnemer op hetzelfde device eist |
| 4.7 | 2026-04-20 | **Technische schuld 4 items + SEC-CRIT:** (A13) `public/_headers` aangemaakt met Content-Security-Policy; (A1) `ModalDeelnemen` annuleer-knop klasse-logica vereenvoudigd; (A17) `bezigRef`-guard toegevoegd aan `ModalDeelnemen` én `ModalTransactie`; (N2) migratiebestanden gestructureerd in `supabase/migrations/`. (SEC-CRIT) `stap23` plaintext credentials gesaniteerd. Regressietests: `modalDeelnemen.dubbelSubmit.regressie.test.jsx` (4) + `modalTransactie.dubbelSubmit.regressie.test.jsx` (4). Testbestanden hebben extensie `.jsx` omdat Vitest/Rollup JSX-syntax alleen transformeert in `.jsx`-bestanden. De lege `.js`-stubs blijven als documentatie van de naamwijziging. | Technische schuld audit 2026-04-20 |
| 4.8 | 2026-04-20 | **Technische schuld 3 items afgelost:** (A8) `src/utils/requestTimeout.js` toegevoegd met `metTimeout(queryPromise, ms)` helper — wraps alle Supabase-queries in `usePotje`, `useMijnPotjes`, `usePotjeActies`, `PaginaStorten`, `PaginaNieuwPotje` met 10-seconden timeout; gooit `REQUEST_TIMEOUT` bij overschrijding; `vertaalFout.js` vertaalt naar Nederlandse melding; `logFout.js` behandelt als gebruikersfout (geen Sentry). (N4) `.eq('naam', profielNaam)` in `useMijnPotjes` vervangen door `.ilike('naam', profielNaam)` voor case-insensitieve naam-matching; downstream `mijnDeelnemer`-logica was al case-insensitief via `.toLowerCase()` — nu consistent. (A18) `'42501'`-string verwijderd uit `isGebruikersFout` in `logFout.js`; bootstrapDeviceId-fix stabiel gebleken (TO v4.6); `row-level security`-matcher blijft als gebruikersfout; `REQUEST_TIMEOUT` toegevoegd als gebruikersfout; bestaande test `LF-RLS-02` bijgewerkt om nieuw gedrag te documenteren. `vertaalFout.js` behoudt `42501`-matcher voor gebruikerstekst (orthogonaal aan Sentry-routing). Regressietests: `requestTimeout.test.js` (7), `logFout.42501.regressie.test.js` (5), `vertaalFout.timeout.test.js` (5), `useMijnPotjes.ilike.regressie.test.js` (11). Totaal unit tests: 793. | Technische schuld audit 2026-04-20 — tweede batch |
| 4.9 | 2026-04-21 | **Testinfrastructuur fix:** `import React` toegevoegd aan `ModalDeelnemen.jsx`, `ModalTransactie.jsx` én beide `.jsx`-regressietestbestanden. Oorzaak: `@vitejs/plugin-react` v6 + Vitest v3 + jsdom verwerkt modules via een per-module isolatiepipeline waarbij de automatische JSX-transform niet consistent wordt toegepast; zowel de component die JSX retourneert als het testbestand dat JSX schrijft moeten `React` expliciet in scope hebben. In Vite-productie treedt dit niet op omdat alle modules als één bundel worden verwerkt. Lege `.js`-stubs (`modalDeelnemen/modalTransactie.dubbelSubmit.regressie.test.js`) toegevoegd aan `exclude`-lijst in `vite.config.js` — Vitest faalde met "No test suite found" op bestanden zonder tests. Geen wijziging in testcount (793). | Twee testbestanden kapot na introductie `.jsx`-equivalenten in v4.7; oorzaak zat in beide lagen (component én testbestand) door Vitest module-isolatie |
| 5.0 | 2026-04-21 | **Technische schuld A14 + B7 afgelost:** `README.md` volledig herschreven — Vite-boilerplate vervangen door Digipot-specifieke documentatie (wat, stack, lokaal draaien, tests, docs). Zeven testbestanden hernoemd van audit-label-namen naar feature/module-namen: `kritiek` → `usePotjeActies.kritiekeFixes`, `hoog` → `paginaNieuwPotje.uuid.tikkieFallback`, `laag.bevindingen` → `tijdUtils.profielPagina.heeftGestort`, `medium.bevindingen` → `modalAfmelden.saldocheck.standaardValuta`, `medium` → `paginaStorten.usePotje.useMijnPotjes`, `stap1` → `constants.useDeviceId.useFocusTrap`, `stap6` → `multicurrency.constants.formatBedrag`. Geen logicawijzigingen — puur hernoeming. Testcount ongewijzigd (793). | Technische schuld audit 2026-04-17: A14 (stale README) en B7 (testbestandsnamen gekoppeld aan audit-labels i.p.v. features) |
| 5.1 | 2026-04-21 | **Technische schuld B6 afgelost — multicurrency definitief niet geactiveerd:** `VALUTA_OPTIES` verwijderd uit `constants.js`; MULTICURRENCY-commentaarblokken en herstelblok verwijderd uit `PaginaNieuwPotje.jsx`; `multicurrency.constants.formatBedrag.regressie.test.js` herschreven — VALUTA_OPTIES-tests verwijderd, formatBedrag-tests op vaste valutacodes behouden; `constants.useDeviceId.useFocusTrap.regressie.test.js` — VALUTA_OPTIES import + 2 tests verwijderd. `STANDAARD_VALUTA` blijft — actief gebruikt als default in `formatBedrag.js`. FO §16 bijgewerkt: multicurrency expliciet als definitief niet geactiveerd gedocumenteerd. Testcount: 789 (793 − 4 VALUTA_OPTIES-tests). | Definitieve beslissing: multicurrency wordt niet geactiveerd voor eindgebruikers |
| 5.2 | 2026-04-21 | **B3 PII-risico gedocumenteerd in `logFout.js`:** JSDoc-commentaar toegevoegd dat het bewust geaccepteerde risico beschrijft dat `error.message` naar Sentry wordt gestuurd zonder sanitisatie. In de huidige codebase bevatten messages alleen door de code gegenereerde strings — geen gebruikersinvoer. Risico is verwaarloosbaar voor dit privéproject met voornamen als enige invoer. Geen codewijziging; puur documentatie. | B3 uit technische schuld audit bewust geaccepteerd en vastgelegd |
| 5.3 | 2026-04-21 | **`PaginaOverzicht`: gemiddeld saldo per persoon:** `gemiddeldePerPersoon = potSaldo / actieveDeelnemers.length` berekend in component; getoond als `.saldo-display__gem` direct onder het pot-saldo-label. Verborgen bij ≤1 actieve deelnemer. CSS-klasse `.saldo-display__gem` toegevoegd aan `index.css` (11px, grijs-500). Geen nieuwe pure functie nodig — alle data al aanwezig in bestaande state. | UX-verzoek: inzicht in gemiddeld beschikbaar saldo per persoon |
| 5.4 | 2026-04-21 | **CI uitgebreid met `acceptatie`-branch:** `on.push.branches` en `on.pull_request.branches` bevatten nu ook `acceptatie`. Deploy-job blijft beperkt tot `main`. Werkwijze: feature branches vertrekken vanaf `acceptatie`, PR naar `acceptatie`, na goedkeuring PR van `acceptatie` naar `main`. | Stabiele acceptatieomgeving via vaste branch |
| 5.5 | 2026-04-21 | **`berekenSaldi.js`: `berekenAchtergelatenBedrag()` toegevoegd.** Pure exportfunctie berekent het evenredige aandeel van een deelnemer in het resterende potsaldo bij afmelding: `(gestort / potTotaal) × potSaldo`, afgerond op 2 decimalen. Retourneert 0 als het aandeel onder de drempel valt (standaard €2), potsaldo ≤0 is, of deelnemer niet gevonden wordt. `ModalAfmelden` krijgt nieuwe prop `achtergelatenBedrag` (default `null`); toont extra bullet als waarde > 0. `PaginaOverzicht` berekent de waarde en geeft haar door. Testbestand `berekenSaldi.achtergelatenBedrag.regressie.test.js` toegevoegd (15 tests). Testcount: 804. | Deelnemer was onbewust geld kwijt bij afmelding zonder waarschuwing |
| 5.6 | 2026-04-21 | **`PaginaOverzicht`: "Nodig vrienden uit" verplaatst van header naar Beheer-sectie.** Knop stond in de header-kaart als volle-breedte secundaire knop. Verplaatst naar onderaan de Beheer-sectie, na de afmeld- en afsluitknoppen. CSS-klasse `.deelknop-in-kaart` blijft ongewijzigd bruikbaar. | Header te druk; uitnodigen is een eenmalige beheersactie, geen primaire actie |
| 5.7 | 2026-04-21 | **§24 technische schuld toegevoegd:** `docs/SCHULD.md` aangelegd als enige bron van waarheid voor alle schulditems (A1–A20, B1–B7, nieuw C1–C3). TO §24 verwijst naar dit bestand en bevat een beknopt overzicht van openstaande items. Inhoudsopgave bijgewerkt. | Schuldenlijst bestond niet als bestand — verliesrisico tussen sessies |
| 5.8 | 2026-04-21 | **B2 afgelost — audit trail voor verwijderde transacties:** migratie `20260421000000_transacties_audit_log.sql` voegt tabel `transacties_log` toe met trigger `trg_log_verwijderde_transactie` (SECURITY DEFINER, search_path=public). Elke DELETE op `transacties` — via undo én via lifecycle-CASCADE — vastgelegd met `transactie_id`, `potje_id`, `deelnemer_id`, `type`, `bedrag`, `aangemaakt_op`, `verwijderd_op` en `verwijderd_door` (device_id uit request-header, NULL bij server-side jobs). Index op `potje_id`. Tabel append-only voor anon-rol. Geen frontend-wijziging. | Technische schuld B2: undo en lifecycle-verwijderingen waren definitief onherstelbaar |
| 5.9 | 2026-04-21 | **B5 afgelost — formulierherstel na Supabase-downtime:** `src/utils/formulierBuffer.js` toegevoegd (`slaagFormulierOp`, `laadFormulier`, `wisFormulier`) — sessionStorage best-effort buffer. `PaginaStorten` bewaart ingevoerd bedrag bij REQUEST_TIMEOUT/netwerkfout en toont herstelbanner bij terugkeer. `ModalTransactie` krijgt prop `potjeId` (default `null`); buffer ook actief bij betalingen. `PaginaPotje` geeft `potjeId={id}` door. Buffer gewist na succesvolle submit. `formulierBuffer.test.js` toegevoegd (11 tests). Testcount: 815. §24 openstaande items bijgewerkt. | Technische schuld B5: bij timeout ging ingevulde data verloren zonder hersteloptie |
| 6.0 | 2026-04-21 | **B4 + C1 afgelost** | Technische schuld B4 en C1 afgelost |
| 6.1 | 2026-04-21 | **UX overzichtscherm:** pottitel ellipsis, DeelKnop als tekstlink, helptekst op juiste plek, ademruimte Beheer. | UX-verbeteringen na screenshot-review |
| 6.8 | 2026-04-24 | **UX stortenscherm:** `PaginaStorten.jsx` — naam deelnemer uit subtitel; gestort-banner verwijderd; preview-kaart verwijderd; knop altijd enabled + inline foutmelding bij klikken zonder bedrag; `geslaagd`-state toegevoegd voor inline successtate ("✓ €X,XX gestort", 1,2s timeout, daarna `navigate`); `setBezig(false)` alleen nog in catch (niet finally, want bij succes navigeert de component weg). `PaginaPotje.jsx` — `useLocation`-import en state-toast-handler verwijderd; `location`-variabele verwijderd. Terminologie: 'inleggen' → 'storten' uniform in UI, FO, TO. E2e PW-1 selector bijgewerkt (knoptekst zonder preview). | UX-review 2026-04-24 |
| 6.7 | 2026-04-23 | **Audit 2026-04-23 — drie bevindingen opgelost:** (#1) `usePotje.js` partial failure commentaar verduidelijkt — `Promise.all` gooit de meest specifieke fout per query zodat `vertaalFout()` een begrijpelijke melding geeft. (#2) `scripts/controleer-patronen.js` uitgebreid met zesde patroon: directe `sessionStorage.`-aanroepen buiten `formulierBuffer.js` zijn nu geblokkeerd in CI. (#3) TO en FO wijzigingslogs bijgewerkt. | Periodieke code-audit 2026-04-23 |
| 6.6 | 2026-04-23 | **`beperkDecimalen()` toegevoegd aan `valideer.js`:** pure exportfunctie kapt invoerstrings af tot maximaal 2 decimalen (komma én punt als scheidingsteken). Geïmporteerd en aangeroepen in `onChange`-handlers van `ModalTransactie` en `PaginaStorten`. `valideerTransactieBedrag()` uitgebreid met decimalen-check als verdediging in de diepte (na de nul-check, vóór de max-check). Testbestand `beperkDecimalen.test.js` toegevoegd (26 tests: 18 voor `beperkDecimalen`, 8 voor de decimalen-check in `valideerTransactieBedrag`). Testcount: 841. | Gebruikers konden meer dan 2 decimalen invullen in bedragvelden |
| 6.5 | 2026-04-22 | **Bottom-sheet restyling `ModalAfmelden`:** titel 'Afmelden?' zonder emoji; subtekst `.modal-afmelden-subtekst`; genummerde lijst `.modal-afmelden-lijst` met `.modal-afmelden-lijst__nummer` cirkels; oranje banner `.modal-afmelden-banner` met icoon (los van de lijst, alleen bij `achtergelatenBedrag > 0`); knoppen gestapeld via `.modal-knoppen--gestapeld`; knoptekst 'Ja, meld me af' (`.knop-gevaar`); drag handle, outside-click, swipe-down. `deelnemerNaam`-prop vervallen uit JSX (niet meer zichtbaar in titel). | UX-restyling conform mockup |
| 6.4 | 2026-04-22 | **Bottom-sheet restyling `ModalSluiten`:** waarschuwingsicoon (roze cirkel, `.modal-sluiten-icoon`), gecentreerde titel (`.modal-titel--center`), subtekst (`.modal-sluiten-subtekst`), rode infobanner (`.modal-sluiten-banner`) met deelnemercount. Prop `aantalActiefDeelnemers` toegevoegd; `PaginaPotje` geeft `deelnemers.filter(d => d.actief !== false).length` door. Slide-up animatie, drag handle, outside-click en swipe-down zelfde patroon als `ModalTransactie`. `potjeNaam`-prop blijft aanwezig (backward-compatible). Knoptekst: 'Ja, sluit de pot'. | UX-restyling conform mockup |
| 6.3 | 2026-04-22 | **Bottom-sheet restyling `ModalTransactie`:** `modal-panel--sheet` animatieklasse (slide-up cubic-bezier 0.32 0.72 0 1, 300ms); `.modal-handle` drag handle met touch swipe-to-dismiss; `.modal-knoppen--gestapeld` gestapelde knoplayout; `.knop-bevestig-inactief` en `.knop-sheet-annuleer` nieuwe knopklassen; `handleOverlayClick` sluit bij klik buiten panel; overlay backdrop aangepast naar `rgba(0,0,0,0.4)`. E2e selectors bijgewerkt in `pw3-betaling-modal.spec.js` en `pw13-undo-en-afmelden.spec.js` (label `Betaald bedrag`, knoptekst `Bevestigen`). | UX-restyling conform moderne bottom-sheet patroon |
| 6.2 | 2026-04-21 | **C2 + C3 afgelost:** `title` op disabled afmeld-knop; sectie Ontwikkelworkflow toegevoegd aan `README.md`. SCHULD.md v1.3: alle items afgelost of geaccepteerd. | Laatste twee schulditems afgelost |
