# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # Production build (outputs to dist/)
npm run lint      # ESLint check
npm run preview   # Preview production build locally
```

No test framework is configured.

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

### Settlement calculation

`src/utils/berekenSaldi.js` — time-based fairness: each expense is split equally among members who had joined at the time of that transaction. Returns per-member `gestort` (contributed), `aandeel` (owes), and `verrekening` (net balance).

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
| 5 | **Eindafrekening** | `PaginaEindafrekening` | `/potje/:id` (inline bij gesloten pot) | ❌ |

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
| `gestort` | Inleg van een deelnemer in het potje |
| `betaald` | Wat een deelnemer uit het potje heeft voorgeschoten |
| `aandeel` | Berekend eerlijk deel van de totale uitgaven |
| `verrekening` | `betaald − aandeel` (+ = ontvangt terug, − = moet bijbetalen) |

### Rekenregels

1. **Tijdsgebaseerde verdeling** — een betaling wordt verdeeld over deelnemers die op dat moment actief waren (aangemeld én niet afgemeld)
2. **Volgorde bij gelijke tijdstippen** — eerst aan-/afmelding, daarna pas betaling
3. **Verrekening** = `betaald − aandeel`
4. **Afronding** op 2 decimalen, centcorrectie op de laatste deelnemer
5. **Cap (technisch vangnet)** — verrekening mag nooit lager zijn dan `−gestort`. Dit is een defensieve laag tegen een falende V2-controle, geen primaire functionele regel
6. **Tekortherverdeling** — als cap bijt bij een afgemelde deelnemer, wordt het tekort doorgeschoven naar actieve deelnemers. Ook daar wordt de cap toegepast. Wat daarna overblijft verdwijnt
7. **Iedereen afgemeld** — als er geen actieve deelnemers zijn bij sluiten, verdwijnen resterende tekorten. Dit is gewenst gedrag

### Systeemregels

- **V2 (primaire beveiliging)** — databasetrigger blokkeert elke betaling waarbij `SUM(betalingen) > SUM(stortingen)` voor dat potje. Dit is de enige betrouwbare garantie
- **Afmelden alleen mogelijk als `gestort > 0`** — een deelnemer die nog niets heeft gestort kan zich niet afmelden. Wordt afgedwongen in UI én database
- **Geen heractivatie** — afmelden is definitief
- **Minimaal 2 deelnemers** per potje

### Uitgesloten scenario's

- Afmelden vóór storten — niet mogelijk (systeemregel)
- Betaald > gestort — niet mogelijk (V2 databasetrigger)
- Cap bijt in de praktijk — alleen mogelijk bij falende V2; cap is uitsluitend vangnet

### Referentiescenario's (volledige testdekking)

**Scenario 1 — Basisgeval, één betaalt alles**
```
18:00  A, B, C aangemeld en gestort (€20, €15, €10)
18:15  A betaalt €30 (3 actief → €10 p.p.)
A: betaald €30, aandeel €10 → +€20
B: betaald €0,  aandeel €10 → −€10
C: betaald €0,  aandeel €10 → −€10 (grens exact geraakt)
```

**Scenario 2 — Gespreid aanmelden, betaling vóór instap telt niet mee**
```
18:00  A aangemeld, stort €25
18:15  A betaalt €20 (1 actief → €20 voor A)
18:30  B aangemeld, stort €15
18:45  A betaalt €20 (2 actief → €10 p.p.)
A: betaald €40, aandeel €30 → +€10
B: betaald €0,  aandeel €10 → −€10
```

**Scenario 3 — Afmelding ná storting, vóór betaling**
```
18:00  A, B, C aangemeld en gestort (€20, €20, €20)
18:15  B meldt af
18:30  A betaalt €30 (A en C actief → €15 p.p.)
A: betaald €30, aandeel €15 → +€15
B: betaald €0,  aandeel €0  → +€20 (volledige inleg terug)
C: betaald €0,  aandeel €15 → −€15
```

**Scenario 4 — Afmelding tussen twee betalingen**
```
18:00  A, B aangemeld, A stort €5, B stort €5
18:15  A betaalt €8 (2 actief → €4 p.p.)
18:30  B meldt af
18:45  A betaalt €2 (1 actief → €2 voor A)
A: betaald €10, aandeel €6 → +€4
B: betaald €0,  aandeel €4 → −€4
```

**Scenario 5 — Iedereen afgemeld, tekorten verdwijnen**
```
18:00  A, B aangemeld, A stort €5, B stort €5
18:15  A betaalt €8 (2 actief → €4 p.p.)
18:30  A meldt af, B meldt af
A: betaald €8, aandeel €4 → +€4
B: betaald €0, aandeel €4 → −€4
Geen actieve deelnemers → tekorten verdwijnen
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
