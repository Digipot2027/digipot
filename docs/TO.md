# Technisch Ontwerp — Digipot

**Versie:** 8.5
**Datum:** 2026-04-26
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
| Analytics | PostHog (`posthog-js`) | — |
| Icoonbibliotheek | Lucide React (`lucide-react`) | — |
| Testen (unit) | Vitest + @testing-library/react | — |
| Testen (e2e) | Playwright | ^1.52 |
| Test-DOM | @testing-library/jest-dom | — |
| Testomgeving (unit) | jsdom | — |
| TypeScript | Nee | — |
| UI-library | Nee (eigen CSS-variabelen) | — |
| Global state | Nee (lokale state per hook/component) | — |

### Lucide React — icoonconventies

- Iconen worden geïmporteerd als named imports: `import { ArrowUp, Lock } from 'lucide-react'`
- Standaard grootte: `size={16}` inline, `size={20}` voor headers en navigatie, `size={22}` voor terugknoppen
- Standaard strokeWidth: `strokeWidth={1.5}` voor decoratieve icons, `strokeWidth={2}` voor functionele icons
- Alle iconen krijgen `aria-hidden="true"` — de toegankelijke naam zit altijd op de omliggende knop
- Tree-shaking via Vite/Rollup — ongebruikte icons worden niet gebundeld

### Omgevingsvariabelen (`.env.local`)

| Variabele | Gebruik |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project-URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonieme sleutel (publiek) |
| `VITE_SENTRY_DSN` | Sentry DSN (optioneel, alleen productie) |
| `VITE_POSTHOG_KEY` | PostHog project API key (alleen productie) |
| `VITE_POSTHOG_HOST` | PostHog host (`https://eu.i.posthog.com`) |

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

## 17a. PostHog — Volledige eventlijst

Alle events die via `logMelding()` naar PostHog worden gestuurd. Events zijn alleen actief in productie (`import.meta.env.PROD`).

### Succesevents

| Event | Component/hook | Beschrijving |
|---|---|---|
| `succes_potje_aangemaakt` | `PaginaNieuwPotje` | Potje succesvol aangemaakt |
| `succes_deelgenomen` | `usePotjeActies` | Deelnemer heeft zich aangemeld |
| `succes_storting_geslaagd` | `PaginaStorten` | Storting via stortenscherm geslaagd |
| `succes_storting_modal_geslaagd` | `usePotjeActies` | Storting via modal geslaagd |
| `succes_betaling_geslaagd` | `usePotjeActies` | Betaling via modal geslaagd |
| `succes_transactie_ongedaan` | `usePotjeActies` | Undo van transactie geslaagd |
| `succes_potje_gesloten` | `usePotjeActies` | Potje handmatig gesloten |
| `succes_afgemeld` | `usePotjeActies` | Deelnemer afgemeld |
| `succes_profiel_opgeslagen` | `PaginaProfiel` | Profielnaam opgeslagen |
| `succes_tekstgrootte_gewijzigd` | `PaginaProfiel` | Tekstgrootte aangepast |
| `succes_profielnaam_verwijderd` | `PaginaProfiel` | Profielnaam verwijderd uit localStorage |
| `succes_verbinding_hersteld` | `PaginaPotje` | Internetverbinding hersteld na onderbreking |
| `succes_link_gekopieerd` | `DeelKnop` | Deellink gekopieerd naar klembord |

### Gebruiksfouten (bekende blokkades)

| Event | Component/hook | Beschrijving | Properties |
|---|---|---|---|
| `fout_validatie_deelnemen` | `ModalDeelnemen` | Validatiefout bij naamkeuze deelnemer | `actie`: foutmelding |
| `fout_validatie_geen_bedrag` | `PaginaStorten` | Geen bedrag gekozen bij storting | — |
| `fout_validatie_bedrag_te_hoog` | `PaginaStorten` | Bedrag boven maximum (>€999,99) | — |
| `fout_gebruiker_saldo_te_laag` | `ModalTransactie` | Betaling geweigerd: onvoldoende saldo | `actie`: type ('betaling') |
| `fout_gebruiker_niet_actief` | `ModalTransactie`, `PaginaStorten` | Actie geweigerd: deelnemer is afgemeld | `actie`: type |
| `fout_gebruiker_deelnemer_ontbreekt` | `ModalTransactie` | Actie geweigerd: geen deelnemersprofiel gevonden | `actie`: type |
| `fout_gebruiker_potje_gesloten` | `PaginaStorten` | Storting geweigerd: potje is gesloten | — |
| `fout_gebruiker_geen_deelnemer` | `PaginaStorten` | Storting geweigerd: gebruiker is geen deelnemer | — |
| `fout_gebruiker_undo_niet_eigen` | `usePotjeActies` | Undo geweigerd: niet eigen transactie | — |
| `fout_gebruiker_undo_saldo_te_laag` | `usePotjeActies` | Undo geweigerd: al betalingen gedaan uit dit bedrag | — |
| `fout_gebruiker_afmelden_niet_gestort` | `usePotjeActies` | Afmelden geweigerd: nog niet gestort | — |
| `fout_link_kopieer_mislukt` | `DeelKnop` | Clipboard API gefaald | — |

### Technische fouten

| Event | Component/hook | Beschrijving |
|---|---|---|
| `fout_technisch` | `logFout` util | Onverwachte DB/netwerkfout — naast Sentry |
| `fout_technisch_crash` | `ErrorBoundary` | React-crash op applicatieniveau — naast Sentry |

### Event-properties (altijd aanwezig)

Alle events bevatten minimaal `{ component: '<naam>' }`. Aanvullende properties zijn per event gespecificeerd in de tabel hierboven. Er worden geen persoonsgegevens meegestuurd.

---

## 18. Testen

### Framework

**Unit/regressie:** Vitest + @testing-library/react + @testing-library/jest-dom, jsdom-omgeving.
**E2e:** Playwright tegen lokale dev-server. `vite.config.js` sluit `e2e/**` uit van Vitest.

### Teststrategie

Business logic en pure functies via unit tests — geen Supabase-mock, geen component-mount.
E2e-tests draaien tegen echte Supabase met `[E2E]`-prefix en cleanup via `afterEach`.
Testprioriteit op basis van risico, niet op regelcoverage.

### Unit/regressie — 870 tests

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
| `pw1-happy-path.spec.js` | PW-1a/b/c/d/e/f | Storten snelknop, vrij bedrag, disabled, successtate, max-fout, decimaal-afkapping statusmelding |
| `pw2-geen-device-id.spec.js` | PW-2a/b/c | Geen device_id, geen RLS-crash, bootstrapDeviceId |
| `pw3-betaling-modal.spec.js` | PW-3a/b/c | Modal betaling, saldo-check, annuleren |
| `pw4-deelnemen.spec.js` | PW-4a..e | Deelnemen-flow, validatie, profielnaam, localStorage |
| `pw5-keyboard-focus.spec.js` | PW-5a..h | Escape, Tab-trap, focus op invoerveld, Enter, detail-sheet, uitnodigknop focusbaar, action-list Tab-focus |
| `pw6-responsive.spec.js` | PW-6a..e × 4 viewports (PW-6e afzonderlijk) | Tabel op 320/375/768/1440px, knoppen, snelknoppen, action-list op 320px |
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

De volledige schuldenlijst (harde schuld A1–A20, strategische schuld B1–B7, items C1–C3 uit audit 2026-04-21, D21 uit audit 2026-04-26 eerste tranche, E1–E10 uit security-audit 2026-04-26 tweede tranche) wordt bijgehouden in `docs/SCHULD.md` v1.6. Dat bestand is de enige bron van waarheid voor openstaande en afgeloste technische schuld.

**Openstaand (per 2026-04-26 na security-audit):**

| Item | Ernst | Omschrijving |
|---|---|---|
| E3 | Hoog | Migratiebestanden uit sync met live DB-policies (RLS Fase 4) |
| E4 | Hoog | `push_subscriptions` tabel zonder feature-implementatie |
| E5 | Hoog | Onnodig brede privileges op alle tabellen (TRUNCATE, REFERENCES op anon) |
| E6 | Medium | Geen rate-limit op `potjes_insert` |
| E8 | Medium | Unicode bidi-control characters niet gefilterd in namen |
| E9 | Laag | Geen rate-limit op `deelnemers_update` |
| E10 | Laag | `Referrer-Policy: strict-origin-when-cross-origin` lekt origin |

**Afgelost in deze TO-versie (8.5):**

| Item | Ernst | Oplossing |
|---|---|---|
| E1 | Kritiek | `.gitignore` aangevuld met `.env*`. Beheerder roteert service_role secret handmatig. |
| E2 | Kritiek | RLS-policy `deelnemers_insert` aangevuld met `auth.uid() IS NOT NULL AND user_id = auth.uid()`. Migratie `20260426000100`. Tests: `secA2.deelnemerInsertEigenaar.regressie.test.js` (6 cases) + `pw14-sec-a2-impersonation.spec.js` (4 cases × 5 browsers).

**Geaccepteerd:**

| Item | Ernst | Reden |
|---|---|---|
| B1 | Medium | TypeScript-migratie te duur voor privéproject |
| B3 | Laag | PII via `error.message` in Sentry — alleen code-strings vandaag |
| E7 | Medium | Open SELECT op alle tabellen — bewuste keuze voor sharemodel |

---

## 21. Wijzigingslog

| Versie | Datum | Wijziging | Reden |
|---|---|---|---|
| 7.4 | 2026-04-25 | **Statusmelding bij afkapping 3e decimaal:** `PaginaStorten.jsx` — `decimaalStatus`-state toegevoegd. `handleVrijeInvoerWijziging` vergelijkt decimaallengte van rauwe invoer vs. afgekapte waarde via regex `[,.]`; bij afkapping (ruw > 2, afgekapt = 2) wordt `decimaalStatus` gezet op `'Bedragen hebben maximaal 2 decimalen.'`. Melding rendeert als `<div role="status">` met klasse `.info-tekst`. State wordt gereset in `handleSnelkeuze` en `handleVrijeInvoerToggle`. `index.css`: `.info-tekst` toegevoegd (zelfde grootte als `.fout-tekst`, kleur `var(--grijs-500)`, WCAG 1.4.3 contrast 4.6:1). `valideerBedragRealtime.test.js`: 4 nieuwe tests in describe-blok '2 decimalen (grenswaarde afkapping)' die borgen dat de validatiefunctie na afkapping altijd `null` teruggeeft. | UX: stille afkapping schond Nielsen heuristiek #1 |
| 7.3 | 2026-04-24 | **Cache-fix `index.html`:** `public/_headers` uitgebreid met specifieke regel `/index.html` met `Cache-Control: no-cache, no-store, must-revalidate`. Zonder deze regel cacht Cloudflare Pages de HTML-shell, waardoor browsers na een deploy de oude bundle-hash laden — ook bij een gewone refresh. Vite genereert content-hashed JS/CSS-assets die nooit verouderen; alleen `index.html` zelf moet altijd vers zijn. | Bug: stale deploy zichtbaar op desktop na Traject-2 deploy |
| 7.2 | 2026-04-24 | **Traject-3: stortenscherm invoervalidatie + kleur:** `beperkDecimalen()` filtert nu ook niet-cijfer/komma/punt tekens (regex `[^0-9,.]`). `valideerBedragRealtime()`: `isNaN` geeft nu foutmelding "Voer alleen cijfers in." i.p.v. `null`; enkel `,` of `.` geeft nog steeds `null`. CSS: `.snelkeuze-knop` rust = `var(--groen-licht)` + border `#bbf7d0`, actief = `var(--groen)` + witte tekst. `beperkDecimalen.test.js`: BD-16 gecorrigeerd (minteken gefilterd), BD-19/20/21/22 nieuw. `valideerBedragRealtime.test.js`: sectie "letters en ongeldige tekens" nieuw (4 tests). `pw6-responsive.spec.js` PW-6e: y-stacking assert herschreven met expliciete `afmeldenBox.y < sluitBox.y` + 60px marge voor hint-paragraaf. | Bug + UX |
| 7.1 | 2026-04-24 | **Tests gesynchroniseerd met traject-2:** Unit UX-01/02 verwijderd (conditionele helptekst-logica bestaat niet meer); UX-03/04/05 toegevoegd (vaste helptekst). E2e: PW-5g (`.knop-uitnodigen` focusbaar via `focus()`), PW-5h (action-list `aria-label` bereikbaar via Tab, Chromium only), PW-6e (action-list verticaal gestapeld op 320px, niet buiten viewport). `pw5-keyboard-focus.spec.js` en `pw6-responsive.spec.js` bijgewerkt. | Testdekking actueel na overzichtscherm redesign |
| 7.0 | 2026-04-24 | **Traject-2: overzichtscherm redesign:** `PaginaOverzicht.jsx` herschreven. Nieuwe `variant="uitnodigen"` op `DeelKnop` voor dashed-border knop boven het actiegrid. Beheer-sectie: van `grid-2` naar `actie-lijst` (BEM) — twee rijen met `ChevronRight`-icon rechts; `aria-label` op beide rijen. Helptekst altijd zichtbaar (`actie-lijst__helptekst`). CSS: `.knop-uitnodigen` (dashed border, hover), `.actie-lijst` en alle BEM-subklassen toegevoegd aan `index.css`. `ChevronRight` geïmporteerd uit `lucide-react`. `DeelKnop.jsx`: `variant="uitnodigen"` afgehandeld als derde classnaam-tak. | UX-review traject 2 |
| 6.9 | 2026-04-24 | **Lucide-icoonmigratie:** `lucide-react` toegevoegd aan `dependencies` in `package.json`. Alle decoratieve emoji's en de custom instellingen-SVG vervangen door Lucide SVG-icons in alle componenten en pagina's (`DeelKnop`, `DeelnemerDetailSheet`, `ModalAfmelden`, `ModalSluiten`, `PaginaOverzicht`, `PaginaNieuwPotje`, `PaginaEindafrekening`, `PaginaInstellingen`, `PaginaOpenPotjes`, `PaginaGeslotenPotjes`, `PaginaProfiel`, `PaginaStorten`, `PaginaNietGevonden`). Conventies: `aria-hidden="true"` op alle icons; size 16/20/22px; strokeWidth 1.5 decoratief / 2 functioneel. §2 dependency-tabel bijgewerkt. | Consistente, styleerbare icoonset; cross-platform gelijke weergave; emoji's niet styleerbaar via CSS |
| 6.8 | 2026-04-24 | **UX stortenscherm:** `PaginaStorten.jsx` — naam deelnemer uit subtitel; gestort-banner verwijderd; preview-kaart verwijderd; knop altijd enabled + inline foutmelding bij klikken zonder bedrag; `geslaagd`-state toegevoegd voor inline successtate ("✓ €X,XX gestort", 1,2s timeout, daarna `navigate`); `setBezig(false)` alleen nog in catch (niet finally, want bij succes navigeert de component weg). `PaginaPotje.jsx` — `useLocation`-import en state-toast-handler verwijderd; `location`-variabele verwijderd. Terminologie: 'inleggen' → 'storten' uniform in UI, FO, TO. E2e PW-1 selector bijgewerkt (knoptekst zonder preview). | UX-review 2026-04-24 |
| 6.7 | 2026-04-23 | **Audit 2026-04-23 — drie bevindingen opgelost:** (#1) `usePotje.js` partial failure commentaar verduidelijkt — `Promise.all` gooit de meest specifieke fout per query zodat `vertaalFout()` een begrijpelijke melding geeft. (#2) `scripts/controleer-patronen.js` uitgebreid met zesde patroon: directe `sessionStorage.`-aanroepen buiten `formulierBuffer.js` zijn nu geblokkeerd in CI. (#3) TO en FO wijzigingslogs bijgewerkt. | Periodieke code-audit 2026-04-23 |
| 6.6 | 2026-04-23 | **`beperkDecimalen()` toegevoegd aan `valideer.js`:** pure exportfunctie kapt invoerstrings af tot maximaal 2 decimalen (komma én punt als scheidingsteken). Geïmporteerd en aangeroepen in `onChange`-handlers van `ModalTransactie` en `PaginaStorten`. `valideerTransactieBedrag()` uitgebreid met decimalen-check als verdediging in de diepte (na de nul-check, vóór de max-check). Testbestand `beperkDecimalen.test.js` toegevoegd (26 tests: 18 voor `beperkDecimalen`, 8 voor de decimalen-check in `valideerTransactieBedrag`). Testcount: 841. | Gebruikers konden meer dan 2 decimalen invullen in bedragvelden |
| 6.5 | 2026-04-22 | **Bottom-sheet restyling `ModalAfmelden`:** titel 'Afmelden?' zonder emoji; subtekst `.modal-afmelden-subtekst`; genummerde lijst `.modal-afmelden-lijst` met `.modal-afmelden-lijst__nummer` cirkels; oranje banner `.modal-afmelden-banner` met icoon (los van de lijst, alleen bij `achtergelatenBedrag > 0`); knoppen gestapeld via `.modal-knoppen--gestapeld`; knoptekst 'Ja, meld me af' (`.knop-gevaar`); drag handle, outside-click, swipe-down. `deelnemerNaam`-prop vervallen uit JSX (niet meer zichtbaar in titel). | UX-restyling conform mockup |
| 6.4 | 2026-04-22 | **Bottom-sheet restyling `ModalSluiten`:** waarschuwingsicoon (roze cirkel, `.modal-sluiten-icoon`), gecentreerde titel (`.modal-titel--center`), subtekst (`.modal-sluiten-subtekst`), rode infobanner (`.modal-sluiten-banner`) met deelnemercount. Prop `aantalActiefDeelnemers` toegevoegd; `PaginaPotje` geeft `deelnemers.filter(d => d.actief !== false).length` door. Slide-up animatie, drag handle, outside-click en swipe-down zelfde patroon als `ModalTransactie`. `potjeNaam`-prop blijft aanwezig (backward-compatible). Knoptekst: 'Ja, sluit de pot'. | UX-restyling conform mockup |
| 6.3 | 2026-04-22 | **Bottom-sheet restyling `ModalTransactie`:** `modal-panel--sheet` animatieklasse (slide-up cubic-bezier 0.32 0.72 0 1, 300ms); `.modal-handle` drag handle met touch swipe-to-dismiss; `.modal-knoppen--gestapeld` gestapelde knoplayout; `.knop-bevestig-inactief` en `.knop-sheet-annuleer` nieuwe knopklassen; `handleOverlayClick` sluit bij klik buiten panel; overlay backdrop aangepast naar `rgba(0,0,0,0.4)`. E2e selectors bijgewerkt in `pw3-betaling-modal.spec.js` en `pw13-undo-en-afmelden.spec.js` (label `Betaald bedrag`, knoptekst `Bevestigen`). | UX-restyling conform moderne bottom-sheet patroon |
| 6.2 | 2026-04-21 | **C2 + C3 afgelost:** `title` op disabled afmeld-knop; sectie Ontwikkelworkflow toegevoegd aan `README.md`. SCHULD.md v1.3: alle items afgelost of geaccepteerd. | Laatste twee schulditems afgelost |
| 1.0–2.9 | 2026-03-01–15 | Zie eerdere versies | — |
| 3.0 | 2026-04-15 | **Android Chrome + Firefox toegevoegd** | Volledige browser-dekking |
| 3.1 | 2026-04-16 | **PW-9 t/m PW-13 toegevoegd;** unit tests 571 → 668 | Gap-analyse na praktijktest |
| 3.2 | 2026-04-16 | **§19 monitoring uitgebreid:** UptimeRobot, Sentry alerts, health check | Monitoring-stack opgezet |
| 3.3 | 2026-04-16 | **§18 CI-gedrag + §19 3-jobs pipeline:** Playwright e2e in CI gedocumenteerd | E2e in GitHub Actions |
| 3.4 | 2026-04-16 | **localStorage-abstractielaag:** `src/utils/storage.js` geïntroduceerd | Technische schuld gesaneerd |
| 3.5 | 2026-04-16 | **Audit-fix:** 2 gemiste overtredingen gemigreerd | Naverificatie |
| 3.6 | 2026-04-17 | **Technische schuld afgelost + CSS-migratie fase 1** | Schuld items 1/5/6 |
| 3.7–4.5 | 2026-04-17 | **CSS-migratie fasen 2–10** | CSS-migratie voltooid |
| 4.6 | 2026-04-18 | **Zombie-preventie trigger** | Potje kon zombie-toestand belanden |
| 4.7 | 2026-04-20 | **4 schulditems + SEC-CRIT** | Audit 2026-04-20 |
| 4.8 | 2026-04-20 | **3 schulditems afgelost** | Audit 2026-04-20 tweede batch |
| 4.9 | 2026-04-21 | **Testinfrastructuur fix** | JSX-transform Vitest isolatie |
| 5.0 | 2026-04-21 | **README + testbestandshernoeming** | A14 + B7 afgelost |
| 5.1 | 2026-04-21 | **Multicurrency definitief niet geactiveerd** | Definitieve beslissing |
| 5.2 | 2026-04-21 | **B3 PII-risico gedocumenteerd** | Bewust geaccepteerd |
| 5.3 | 2026-04-21 | **Gemiddeld saldo per persoon** | UX-verzoek |
| 5.4 | 2026-04-21 | **CI acceptatie-branch** | Stabiele acceptatieomgeving |
| 5.5 | 2026-04-21 | **berekenAchtergelatenBedrag()** | Achtergelaten bedrag waarschuwing |
| 5.6 | 2026-04-21 | **Uitnodigen naar Beheer-sectie** | Header te druk |
| 5.7 | 2026-04-21 | **SCHULD.md aangelegd** | Enige bron van waarheid |
| 5.8 | 2026-04-21 | **B2 afgelost — audit trail** | Verwijderde transacties vastgelegd |
| 5.9 | 2026-04-21 | **B5 afgelost — formulierherstel** | Buffer bij downtime |
| 6.0 | 2026-04-21 | **B4 + C1 afgelost** | Schuld afgelost |
| 6.1 | 2026-04-21 | **UX overzichtscherm** | Screenshot-review |
| 8.4 | 2026-04-26 | **Undo verwijderd:** `handleUndo` verwijderd uit `usePotjeActies`. Toast bij betaling toont geen undo-knop meer. `toonToast` vereenvoudigd (geen actie-parameter). `TOAST_DUUR_UNDO` verwijderd. `PW-13` e2e herschreven. | UX: undo was verwarrend en zelden gebruikt |
| 8.3 | 2026-04-26 | **UX ModalTransactie:** knop groen (`knop-primair`) i.p.v. rood — rood suggereert gevaar. Bedrag op de knop: 'Storten €X,XX' / 'Bevestig €X,XX'. Bedrag-preview verwijderd. | UX-review |
| 8.2 | 2026-04-26 | **CSP Sentry EU-regio fix:** `https://*.ingest.de.sentry.io` toegevoegd aan `connect-src` — Sentry EU-projecten sturen naar `.ingest.de.sentry.io` i.p.v. `.ingest.sentry.io`; browser blokkeerde alle Sentry-requests. **CI PostHog build-vars:** `VITE_POSTHOG_KEY` en `VITE_POSTHOG_HOST` toegevoegd aan de build-stap in `ci.yml` — Vite-env vars zijn alleen beschikbaar als ze tijdens de build worden meegegeven. | Sentry geblokkeerd door CSP; PostHog token leeg in productie |
| 8.1 | 2026-04-26 | **Testopruiming:** (1) `modalDeelnemen.dubbelSubmit.regressie.test.js` en `modalTransactie.dubbelSubmit.regressie.test.js` verwijderd — lege placeholder-bestanden zonder tests. (2) `useMijnPotjes.eq.regressie.test.js` en `useMijnPotjes.ilike.regressie.test.js` samengevoegd tot `useMijnPotjes.naamMatching.test.js` — beide testten overlappende naam-matching logica (SEC-H2 + N4). (3) `multicurrency.constants.formatBedrag.regressie.test.js` hernoemd naar `formatBedrag.valuta.test.js` — naam dekte de lading niet meer na verwijdering van VALUTA_OPTIES. | Testanalyse: overbodige en misleidende testbestanden opgeruimd |
| 8.0 | 2026-04-26 | **Audit laag + D21 afgelost:** D21 kolom nullable; `ModalDeelnemen` Lucide-icons; verbindingsbanner `WifiOff`; `✓`/`!` aria-hidden; `role="list"` potjeslijsten; root-migratiebestanden verwijderd. | Audit lage bevindingen 2026-04-26 |
| 7.9 | 2026-04-26 | **Audit hoge + medium bevindingen opgelost:** CSP PostHog; CI actions v4; `.detail-sluit-knop` WCAG fixes; §17a eventlijst aangevuld; §3 utils-blok aangevuld; D21 gedocumenteerd. | Audit 2026-04-26 |
| 7.8 | 2026-04-26 | **Bugfix kolombreedte 'Uitgegeven':** `col` breedte verhoogd van 72 naar 80px in `PaginaOverzicht.jsx`. **Pot sluiten beperkt tot actieve deelnemers:** `disabled={!heeftTransacties || !ikBenActief}` — afgemelde deelnemers kunnen het potje niet meer sluiten. | Kolomkop 'N' werd afgekapt; sluitlogica beperkt tot actieve deelnemers |
| 7.7 | 2026-04-26 | **Bugfix: ChevronLeft → ChevronRight op Afmelden-rij:** `PaginaOverzicht.jsx` — `ChevronLeft` vervangen door `ChevronRight` op de Afmelden-actierij; `ChevronLeft` verwijderd uit import. | Visuele typefout: pijl wees links (←) i.p.v. rechts (→) |
| 7.6 | 2026-04-26 | **PostHog eventdekking uitgebreid:** `logMelding()` toegevoegd op 13 plaatsen in 7 bestanden. `ModalDeelnemen`: import + `fout_validatie_deelnemen` na validatiefout. `ModalTransactie`: import + `fout_gebruiker_saldo_te_laag` / `fout_gebruiker_niet_actief` / `fout_gebruiker_deelnemer_ontbreekt` per catch-tak. `PaginaStorten`: `fout_validatie_geen_bedrag`, `fout_validatie_bedrag_te_hoog`, `fout_gebruiker_potje_gesloten`, `fout_gebruiker_geen_deelnemer`, `fout_gebruiker_niet_actief` per guard-return. `usePotjeActies`: `fout_gebruiker_undo_niet_eigen`, `fout_gebruiker_undo_saldo_te_laag`, `fout_gebruiker_afmelden_niet_gestort` vóór `toonToast`. `PaginaPotje`: import + `succes_verbinding_hersteld` naast `toonToast`. `DeelKnop`: import + `succes_link_gekopieerd` / `fout_link_kopieer_mislukt`. `ErrorBoundary`: import als module-import (class component, geen hook) + `fout_technisch_crash` na `Sentry.captureException`. §17a (eventlijst) toegevoegd als living reference. | Volledige PostHog dekking op alle gebruikerspaden |
| 8.5 | 2026-04-26 | **SEC-A1 + SEC-A2 (Critical) afgelost:** (1) `.gitignore` aangevuld met `.env`, `.env.local`, `.env.*.local`, `.env.development`, `.env.production` om accidentele commit van `SUPABASE_SERVICE_ROLE_KEY` te voorkomen. Beheerder roteert het secret handmatig in Supabase Dashboard (geen MCP). (2) RLS-policy `deelnemers_insert` aangepast: extra clausules `auth.uid() IS NOT NULL` en `user_id = auth.uid()` toegevoegd. Hierdoor kan een geauthenticeerde anon-gebruiker geen weesdeelnemer (`user_id=NULL`) of impersonation-deelnemer (`user_id=<vreemd>`) meer aanmaken. Migratie `20260426000100_sec_a2_deelnemers_insert_eigenaar_check.sql` live + in repo. Tests: `src/test/secA2.deelnemerInsertEigenaar.regressie.test.js` (6 unit-cases) en `e2e/pw14-sec-a2-impersonation.spec.js` (4 e2e-cases × 5 browsers = 20 testlooppaden). `usePotjeActies.handleDeelnemen` was al correct (zet `user_id` uit `auth.getUser()`); geen frontend-wijziging nodig. SCHULD.md v1.6 met nieuwe E-sectie. Aanvullende open items E3–E10 gerapporteerd. | Security-audit 2026-04-26 — Critical IDOR + secret-leakage |
| 7.5 | 2026-04-25 | **PostHog analytics geïntegreerd:** `posthog-js` toegevoegd aan `dependencies`. `src/utils/logMelding.js` aangemaakt als centrale util voor gebruiksevents. `main.jsx` uitgebreid met `posthog.init()` (EU-host, IP-masking, autocapture uit, alleen productie). `logFout.js` uitgebreid met `bepaalFoutCode()`: bekende gebruiksfouten sturen `fout_gebruiker_<code>` event; technische fouten sturen `fout_technisch` event naast Sentry. `PaginaNieuwPotje`, `PaginaStorten`, `PaginaProfiel` en `usePotjeActies` loggen succesevents. §2 dependency-tabel en omgevingsvariabelen bijgewerkt. | Meldingfrequentie meetbaar; foutpatronen inzichtelijk via PostHog |
