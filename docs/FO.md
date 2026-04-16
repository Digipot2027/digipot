# Functioneel Ontwerp — Digipot

**Versie:** 2.2
**Datum:** 2026-04-16
**Status:** Actueel
**Auteur:** Projectteam Digipot

---

## Inhoudsopgave

1. Productbeschrijving
2. Gebruikers en context
3. Schermen en gebruikersflows
4. Scherm 1 — Aanmaken
5. Scherm 2 — Deelnemer
6. Scherm 3 — Storten/Inleggen
7. Scherm 4 — Overzicht
8. Scherm 5 — Eindafrekening
9. Instellingenscherm S1 — Instellingen
10. Instellingenscherm S2 — Open potjes
11. Instellingenscherm S3 — Gesloten potjes
12. Instellingenscherm S4 — Profiel
13. Scherm 404 — Pagina niet gevonden
14. Dwarsdoorsnijdende functionaliteit
15. Validaties en begrenzingen
16. Uitgestelde functionaliteit
17. Wijzigingslog

---

## 1–13. Productbeschrijving t/m Scherm 404

Zie versie 1.8 (ongewijzigd).

---

## 14. Dwarsdoorsnijdende functionaliteit

### Apparaatidentificatie

UUID in localStorage (`digipot_device_id`). Gevalideerd bij elke sessie via `useDeviceId()`. Ongeldige waarde wordt vervangen door nieuw UUID. De hook wordt altijd gebruikt als bron van het device-ID — nooit `localStorage.getItem()` direct.

**Bootstrap bij module-load:** `supabaseClient.js` roept `bootstrapDeviceId()` aan vóór het aanmaken van de Supabase-client. Dit garandeert dat de `x-device-id` header altijd een geldig UUID bevat, ook bij het eerste bezoek of na een iOS Safari localStorage-reset. Dit is de fix voor Sentry REACT-8 en REACT-9 (RLS 42501 bij INSERT op `transacties`).

### Foutafhandeling

Alle gebruikersfouten via `logFout()` → Sentry + Nederlandse gebruikerstekst. Bekende situaties (verlopen links, ontbrekende deelnemers) geven correcte meldingen zonder Sentry-ruis.

#### Foutmelding bij niet-bestaand of verwijderd potje (PGRST116)

> "Dit potje bestaat niet of is verwijderd. Controleer de link."

#### Foutmelding bij ontbrekend deelnemersprofiel bij afmelden

> "Afmelden mislukt. Je deelnemersprofiel is niet meer beschikbaar."

### Levenscyclus

Open potjes > 24 uur → automatisch gesloten. Potjes > 7 dagen → verwijderd. Via Supabase Edge Functions + pg_cron.

### Monitoring

De beschikbaarheid en gezondheid van de applicatie worden bewaakt via drie lagen:

**UptimeRobot** controleert elke 5 minuten of de app en de Supabase-database bereikbaar zijn. Bij downtime volgt direct een e-mailmelding.

**Sentry** logt alle onverwachte fouten in productie. Een alert wordt verstuurd bij elke nieuw type fout. Wekelijks verschijnt een digest met een overzicht van de meest voorkomende fouten.

**GitHub Actions health check** draait dagelijks om 08:00 UTC en verifieert of Supabase schrijft en leest, de app bereikbaar is op Cloudflare Pages, en de lifecycle Edge Function reageert. Bij een mislukte check volgt automatisch een e-mailmelding via GitHub.

### Geautomatiseerde kwaliteitswaarborg

#### Unit- en regressietests (Vitest)

Business logic wordt getest als pure functies. Alle bekende regressiescenario's zijn gedekt.

#### E2e-tests (Playwright)

13 specs op 5 browsers (Chromium, WebKit, Mobile Safari, Android Chrome, Firefox). 230 tests geslaagd (227 passed, 3 skipped). In CI draait alleen Chromium; de volledige 5-browsers suite draait lokaal. Gedekte scenario's:

| Spec | Wat wordt getest |
|---|---|
| PW-1: Happy path storten | Snelknop, vrij bedrag, disabled zonder bedrag |
| PW-2: Geen/ongeldig device_id | Geen RLS-crash, bootstrapDeviceId herstelt UUID |
| PW-3: Betaling via modal | Betaling bevestigen, saldo-check, annuleren |
| PW-4: Deelnemen-flow | Naam invullen, validatie, profielnaam, localStorage |
| PW-5: Keyboard-navigatie | Escape, Tab-trap, focus, Enter, detail-sheet |
| PW-6: Responsive | Tabel en knoppen op 320/375/768/1440px |
| PW-7: Profiel en instellingen | Naam opslaan/verwijderen, tekstgrootte, navigatie |
| PW-8: Potjeslijsten en routing | Lege staat, potje in lijst, 404, aanmaken |
| PW-9: Terugkerende deelnemer | Herkend op device_id, afgemelde terugkomer |
| PW-10: Naambotsing | Bezette naam, profielnaam pre-ingevuld, fout-reset |
| PW-11: Realtime sluiting | Potje sluit terwijl op overzicht of stortenscherm |
| PW-12: Twee devices | Realtime sync, naamconflict, afmelding zichtbaar |
| PW-13: Undo en afmelden | Undo flow, betaling bij saldo=0, geblokkeerde undo |

---

## 15–16. Validaties en uitgestelde functionaliteit

Zie versie 1.8 (ongewijzigd).

---

## 17. Wijzigingslog

| Versie | Datum | Wijziging | Reden |
|---|---|---|---|
| 1.0 | 2026-03-01 | Initieel FO opgesteld | Projectstart |
| 1.1 | 2026-04-02 | Valutakeuze verborgen; UX-verbeteringen; mobiele tabel | UX + multicurrency uitgesteld |
| 1.2 | 2026-04-03 | Scherm 404; DeelnemerDetailSheet; toast-timing; UUID-validatie; roving tabindex | Auditbevindingen |
| 1.3 | 2026-04-04 | SEC-H1 (INSERT error-check); SEC-S4 (Tikkie noopener) | Auditbevindingen 2026-04-04 |
| 1.4 | 2026-04-04 | push_subscriptions RLS gedocumenteerd | Security-audit |
| 1.5 | 2026-04-04 | Lifecycle via Cloudflare Worker gedocumenteerd | Lifecycle had geen aanroeper |
| 1.6 | 2026-04-07 | Lifecycle → Supabase Edge Functions + pg_cron; RLS SEC-PRIO2 + SEC-PRIO3 | Auditbevindingen 2026-04-07 |
| 1.7 | 2026-04-12 | §14: PGRST116 melding gedocumenteerd | Sentry-issue #17a27ebc |
| 1.8 | 2026-04-12 | §7 foutafhandeling afmelden + sluiten; §14 apparaatidentificatie aangescherpt | Code-audit 2026-04-12 |
| 1.9 | 2026-04-15 | **§14 uitgebreid:** bootstrapDeviceId gedocumenteerd als fix voor Sentry REACT-8/9; e2e-testdekking (PW-1/2/3) toegevoegd aan §14 dwarsdoorsnijdende functionaliteit | Playwright e2e-infrastructuur opgezet; 27/27 tests groen op Chromium, WebKit, Mobile Safari |
| 2.0 | 2026-04-16 | **§14 monitoring toegevoegd:** UptimeRobot, Sentry alerts, GitHub Actions health check gedocumenteerd; e2e-testoverzicht bijgewerkt naar 13 specs / 342 tests op 5 browsers | Monitoring-stack opgezet; e2e-suite uitgebreid met PW-9 t/m PW-13 |
| 2.1 | 2026-04-16 | **§14 kwaliteitswaarborg bijgewerkt:** e2e-testoverzicht gecorrigeerd naar 230 tests (227 passed, 3 skipped); CI-context toegevoegd (Chromium only in CI, 5 browsers lokaal) | E2e-tests opgenomen in GitHub Actions CI |
| 2.2 | 2026-04-16 | **§14 apparaatidentificatie aangevuld:** centrale localStorage-abstractielaag gedocumenteerd (`src/utils/storage.js`); bug-fix `main.jsx` literal string → `TEKSTGROOTTE_KEY` gedocumenteerd | Storage-abstractielaag geïntroduceerd voor onderhoudbaarheid en testbaarheid |
