# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # Production build (outputs to dist/)
npm run lint      # ESLint check
npm run preview   # Preview production build locally
npm run test      # Run tests in watch mode (Vitest)
npm run test:run  # Run tests once (CI-mode)
npm run test:ui   # Run tests with Vitest UI
npm run e2e           # Alle 5 browsers (lokaal)
npm run e2e:chromium  # Chromium only — snelste feedback
npm run e2e:report    # HTML rapport openen
```

## Git-workflow

Elke wijziging gaat via een feature branch en Pull Request — nooit direct naar `main`.

```bash
# 1. Nieuwe branch aanmaken
git checkout -b beschrijvende-naam

# 2. Wijzigingen maken, committen
git add <bestanden>
git commit -m "beschrijving"

# 3. Branch naar GitHub pushen
git push -u origin beschrijvende-naam

# 4. Pull Request aanmaken op GitHub
# → CI draait automatisch (unit tests + e2e)
# → Als alles groen: vink "Merge without waiting for requirements" aan
# → Klik "Merge pull request"

# 5. Lokaal bijwerken na merge
git checkout main
git pull
```

**Branch protection op `main`:**
- Direct pushen naar `main` is geblokkeerd
- Unit tests (Vitest) zijn verplicht voor merge
- E2e tests (Chromium) zijn verplicht voor merge
- Als eigenaar kun je mergen via "Merge without waiting for requirements (bypass rules)"
- Deploy naar Cloudflare Pages gebeurt automatisch na merge op `main`

**Branch-naamgeving:** elke feature branch krijgt een unieke naam per traject. Gebruik het patroon `feat/traject-N-korte-omschrijving`, bijvoorbeeld:
- `feat/traject-3-storten-ux-redesign`
- `feat/traject-4-venster-regel`

Nooit twee trajecten op dezelfde branch combineren. Na een merge begin je altijd een nieuwe branch.

**Commit-naamgeving:** kort en beschrijvend, in het Nederlands of Engels.
Voorbeelden: `css: fase 3 — kleine modals`, `fix: RLS race condition in supabaseClient`

---

## Lokale kwaliteitswaarborg

Vóór elke push naar `main` moeten de volgende checks slagen — identiek aan CI:

```bash
npm run lint && npm run test:run && npm run e2e:chromium
```

De pre-push hook (`.git/hooks/pre-push`) doet dit automatisch bij `git push`. Installatie éénmalig per developer:

```bash
cp scripts/pre-push-hook.sh .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

Overslaan bij noodgeval: `git push --no-verify` (documenteer waarom in de commit).

**Test framework: Vitest + @testing-library/react + @testing-library/jest-dom** (`jsdom` environment, setup in `src/test/setup.js`).

Current test coverage (`src/test/`):
- `berekenSaldi.test.js` — settlement calculation, all 5 reference scenarios (unit)
- `berekenSaldi.regressie.test.js` — regression gaps: null transacties, unknown deelnemer_id, string bedragen (Supabase JSON), aandeel=ingelegd invariant, scenario D (five members, one inactive)
- `formatBedrag.test.js` — currency formatting and parsing (unit)
- `logFout.test.js` — error logging and Sentry routing (unit)
- `vertaalFout.test.js` — error code translation (unit)
- `deelLink.test.js` — all 6 share/clipboard code paths: native share (success, AbortError, fallback), clipboard API, execCommand fallback, both failing
- `paginaStorten.regressie.test.js` — bedrag priority logic (snelkeuze vs vrije invoer), bedragGeldig boundary conditions, handleStorten validation paths
- `filterLogica.regressie.test.js` — filter array construction (no id/name, device only, name only, both), potje-ID deduplication, mijnDeelnemer matching, mijnVerrekening null handling, logFout null contract for SALDO_TE_LAAG

Not yet covered: modal components (ModalDeelnemen, ModalTransactie, ModalAfmelden, ModalSluiten), page components with Supabase dependency.

## Architecture

**Digipot** is a Dutch-language collaborative group expense pot app — groups create a shared pot, members join via link, deposit funds, and record expenses. A settlement algorithm calculates who owes what.

**Stack:** React 19 + React Router 7 + Vite 8 + Supabase (PostgreSQL + Realtime). No TypeScript, no UI library, no global state manager.

### Routing

```
/              → PaginaNieuwPotje   (create pot)
/potje/:id     → PaginaPotje        (main interaction + settlement view)
```

`PaginaEindafrekening` is rendered inline within `PaginaPotje` when the pot is closed (not a separate route).

### Supabase tables

- `potjes` — pot records (`id`, `naam`, `status`, `gesloten_op`, `gesloten_door`)
- `deelnemers` — participants (`id`, `potje_id`, `naam`, `device_id`, `aangemaakt_op`)
- `transacties` — transactions (`id`, `potje_id`, `deelnemer_id`, `type`, `bedrag`, `aangemaakt_op`)

Key constraints: unique `(potje_id, naam)`, unique `(potje_id, device_id)`, `bedrag` between €0.01–€999.99, `naam` max 30 chars.

Supabase credentials come from `.env.local` (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`) and are validated at startup in `src/supabaseClient.js`.

### Real-time sync

`PaginaPotje` opens three Supabase Postgres Changes subscriptions (pot status, participant joins, new transactions) and tracks `online` state to show a disconnection banner. Subscriptions are cleaned up on unmount.

### User identification

No authentication. Each device gets a `crypto.randomUUID()` stored in localStorage as `digipot_device_id`. This is matched against `deelnemers.device_id` to identify the current user.

### localStorage keys

| Key | Inhoud | Beheerd door |
|---|---|---|
| `digipot_device_id` | UUID, uniek per device | `PaginaPotje` bij eerste bezoek |
| `digipot_profiel_naam` | Naam uit Profielscherm (optioneel) | `PaginaProfiel` (S4) |
| `digipot_tekstgrootte` | `normaal` / `groot` / `extra-groot` | `PaginaProfiel` (S4) |

### Deelneemflow bij nieuw potje bezoek

Als `deelnemer` null is (device_id niet bekend in dit potje):
1. **`digipot_profiel_naam` aanwezig** → naam alvast ingevuld in Deelneemscherm, gebruiker bevestigt met één tik → Stortingscherm
2. **Geen profielnaam** → naam invoeren in Deelneemscherm → Stortingscherm

Na succesvol deelnemen navigeert `PaginaPotje` altijd naar `/potje/:id/storten`.

### Settlement calculation

`src/utils/berekenSaldi.js` — inleg/factor-based model: verrekening = werkelijk betaald − ingelegd. For active members a factor is applied (total paid ÷ total contributed by actives). Inactive members always contribute their full inleg. Returns per-member `gestort` (contributed), `betaald` (paid to venue), `aandeel` (netto bijdrage), and `verrekening` (net balance).

### Modals

All interactions use bottom-sheet modals controlled by a `modaal` state string in `PaginaPotje`. Components: `ModalDeelnemen` (join), `ModalTransactie` (deposit/expense), `ModalSluiten` (close pot).

---

## Schermnamen (officiële terminologie)

Gebruik altijd deze namen in FO, TO, code-commentaar en gesprekken. Nooit de bestandsnaam als schermnaam.

### Hoofdschermen (gebruikersflow)

| # | Schermnaam | Huidig component | Route | Tandwiel ⚙️ |
|---|---|---|---|---|
| 1 | **Aanmaken** | `PaginaNieuwPotje` | `/` | ✅ |
| 2 | **Deelnemer** | `ModalDeelnemen` (inline in PaginaPotje) | `/potje/:id` | ❌ |
| 3 | **Storten/Inleggen** | `ModalTransactie` (inline in PaginaPotje) | `/potje/:id` | ❌ |
| 4 | **Overzicht** | `PaginaPotje` (kern) | `/potje/:id` | ✅ |
| 5 | **Eindafrekening** | `PaginaEindafrekening` | `/potje/:id` (inline bij gesloten pot) | ✅ |

### Instellingenschermen (via tandwiel ⚙️)

Het tandwiel staat rechtsboven op scherm 1 (Aanmaken) en scherm 4 (Overzicht). Klikken opent een aparte volledige pagina. De drie sub-schermen zijn bereikbaar vanuit dat instellingenscherm.

| # | Schermnaam | Component | Route |
|---|---|---|---|
| S1 | **Instellingen** | `PaginaInstellingen` *(nieuw)* | `/instellingen` |
| S2 | **Open potjes** | `PaginaOpenPotjes` *(nieuw)* | `/instellingen/open` |
| S3 | **Gesloten potjes** | `PaginaGeslotenPotjes` *(nieuw)* | `/instellingen/gesloten` |
| S4 | **Profiel** | `PaginaProfiel` *(nieuw)* | `/instellingen/profiel` |

### Regels schermnamen
- Gebruik **altijd** de schermnaam uit bovenstaande tabel, nooit de componentnaam in gesprekken of documentatie
- Schermen 2 en 3 zijn momenteel modals — dit wordt in een toekomstige iteratie omgebouwd naar eigen routes
- Het tandwiel staat **alleen** op scherm 1 en 4, op geen enkel ander scherm

## Berekenlogica eindafrekening

### Terminologie

| Term | Betekenis |
|---|---|
| `gestort` | Totaal ingelegd door een deelnemer in het potje (virtueel) |
| `betaald` | Wat een deelnemer werkelijk aan de horeca heeft voorgeschoten |
| `aandeel` | Netto bijdrage van de deelnemer (voor weergave op eindafrekening) |
| `verrekening` | `betaald − netto bijdrage` (+ = ontvangt terug, − = moet bijbetalen) |

### Rekenregels

1. **Verrekening = werkelijk betaald − ingelegd** (basisformule)
2. **Afgemelde deelnemers** — vaste bijdrage = volledige inleg. Verrekening = betaald − ingelegd
3. **Actieve deelnemers** — netto bijdrage = ingelegd × factor
   - Factor = resterend voor actieven ÷ totaal ingelegd door actieven
   - Resterend voor actieven = totaal betaald aan horeca − bijdrage afgemelde deelnemers
4. **Cap** — verrekening nooit lager dan `−gestort` (je betaalt nooit meer bij dan je hebt ingelegd)
5. **Tekorten verdwijnen** — worden NIET doorgeschoven naar anderen
6. **Virtueel saldo verdwijnt** — resterend saldo bij sluiting wordt niet verdeeld of teruggestort

### Gelijktijdigheidsregels (bij sluiting)

- **Aanmelden op zelfde moment als sluiting** → deelnemer telt **mee** (actief)
- **Afmelden op zelfde moment als sluiting** → deelnemer telt **niet** mee (afgemeld)
- Actief/afgemeld wordt bepaald op basis van `potje.gesloten_op` via `wasActiefOp()`

### Systeemregels

- **V2 (primaire beveiliging)** — databasetrigger blokkeert elke betaling waarbij `SUM(betalingen) > SUM(stortingen)` voor dat potje
- **Afmelden alleen mogelijk als `gestort > 0`** — afgedwongen in UI én database
- **Geen heractivatie** — afmelden is definitief
- **Minimaal 2 deelnemers** per potje

### Uitgesloten scenario's

- Afmelden vóór storten — niet mogelijk (systeemregel)
- Betaald > gestort — niet mogelijk (V2 databasetrigger)

### Referentiescenario's (volledige testdekking)

**Scenario A — Vier deelnemers, niemand afgemeld**
```
Alice: ingelegd €25, betaald €36 → factor 0,700 → netto €17,50 → +€18,50
Bob:   ingelegd €35, betaald €20 → netto €24,50 → −€4,50
Charlie: ingelegd €45, betaald €20 → netto €31,50 → −€11,50
David: ingelegd €55, betaald €36 → netto €38,50 → −€2,50
```

**Scenario B — Vier deelnemers, één afgemeld (Charlie)**
```
Charlie afgemeld: vaste bijdrage €25
Resterend actieven: €112 − €25 = €87, factor = 87/135 = 0,6444
Alice: betaald €56, netto €16,11 → +€39,89
Bob:   betaald €24, netto €29,00 → −€5,00
David: betaald €32, netto €41,89 → −€9,89
```

**Scenario C — Vijf deelnemers, twee afgemeld (Bob, David)**
```
Bob afgemeld: €20. David afgemeld: €45. Totaal: €65
Resterend actieven: €90 − €65 = €25, factor = 25/110 = 0,2273
Alice: betaald €30, netto €4,55 → +€25,45
Charlie: betaald €30, netto €10,23 → +€19,77
Eva: betaald €30, netto €10,23 → +€19,77
```

## Foutafhandeling en logging (verplicht)

### Richtlijn
Alle foutmeldingen die zichtbaar zijn voor eindgebruikers moeten worden gelogd via Sentry.
Logs worden periodiek geanalyseerd op terugkerende problemen en trends.

Een fout is pas afgehandeld wanneer:
1. De oorzaak is vastgesteld
2. De code is hersteld
3. Een unit test is toegevoegd die aantoont dat de fout niet opnieuw kan optreden

### Implementatie
Alle zichtbare fouten lopen via `src/utils/logFout.js`:
- `logFout(error, context)` — logt naar Sentry met context, geeft vertaalde gebruikerstekst terug
- Sentry is geconfigureerd in `main.jsx` (alleen actief in productie)
- Fouten zonder Sentry-DSN worden alleen naar `console.error` geschreven

### Regels
- Nooit een fout tonen aan de gebruiker zonder deze te loggen
- `vertaalFout()` alleen gebruiken via `logFout()` — niet rechtstreeks aanroepen
- Context meegeven bij logging: minimaal de componentnaam en actie
- Geen persoonlijke data (namen, bedragen) in de Sentry-context

## Regel: Synchronisatie Code ↔ Functioneel Ontwerp (FO)

Bij elke wijziging in de code moet het functioneel ontwerp direct worden bijgewerkt:

1. **Beschrijf de functionele impact** — wat verandert er voor de gebruiker of het systeem?
2. **Bepaal welke FO-sectie geraakt wordt** en update die met:
   - Nieuwe of gewijzigde functionaliteit
   - Gewijzigde validaties
   - UI/UX-wijzigingen
3. **Voeg een regel toe aan de wijzigingslog** met:
   - Datum
   - Wijziging
   - Reden
   - Impact

### Localization & error handling

- All UI text is in Dutch (`nl-NL`)
- `src/utils/formatBedrag.js` — formats/parses currency (accepts both `,` and `.` as decimal separator)
- `src/utils/vertaalFout.js` — translates Supabase/network errors to Dutch user-facing messages
