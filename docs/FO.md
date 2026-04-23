# Functioneel Ontwerp — Digipot

**Versie:** 3.5
**Datum:** 2026-04-22
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

**Zombie-preventie (2026-04-18):** een potje mag nooit in de toestand "open zonder actieve deelnemers" komen te staan. Wanneer de laatste actieve deelnemer zich afmeldt, wordt het potje automatisch en direct gesloten door de databasetrigger `trg_sluit_potje_bij_laatste_afmelding`. Het sluittijdstip (`gesloten_op`) wordt gelijkgesteld aan het afmeldtijdstip van die laatste deelnemer. Het veld `gesloten_door` bevat de id van die deelnemer. Voor de eindafrekening telt deze laatste afmelder als "afgemeld", conform de bestaande regel dat afmelden op hetzelfde moment als sluiting telt als niet-actief. De gebruiker die op het punt staat als laatste af te melden, krijgt in de afmeld-modal een aanvullende waarschuwing te zien: *"Het potje wordt direct afgesloten — jij bent de laatste actieve deelnemer. Iedereen ziet meteen de eindafrekening."* De sluiting zelf gebeurt atomair op databaseniveau en wordt via de bestaande realtime-synchronisatie automatisch zichtbaar op alle verbonden apparaten.

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

## 15. Validaties en begrenzingen

Zie versie 1.8 (grotendeels ongewijzigd).

### Bedragvelden — maximaal 2 decimalen (2026-04-23)

Alle invoervelden voor geldbedragen accepteren maximaal 2 cijfers achter de komma (of punt). Dit geldt voor:
- **ModalTransactie** — storting en betaling
- **PaginaStorten** — vrij invoerveld

De beperking werkt op twee lagen:
1. **Preventief (UI-laag):** de `onChange`-handler roept `beperkDecimalen()` aan, die de invoerstring direct afkapt tot 2 decimalen. De gebruiker ziet de extra cijfers dus niet verschijnen.
2. **Verdediging in de diepte (validatielaag):** `valideerTransactieBedrag()` controleert ook op meer dan 2 decimalen en geeft de melding *“Voer maximaal 2 cijfers achter de komma in.”* terug als die check mislukt. Dit vangt edge-cases op zoals programmatisch ingestelde waarden.

Snelknoppen op het stortenscherm zijn vaste gehele getallen en zijn niet geraakt door deze wijziging.

---

## 16. Uitgestelde functionaliteit

### Multicurrency — definitief niet geactiveerd (2026-04-21)

De valutakeuze bij het aanmaken van een potje wordt niet geïmplementeerd. Alle potjes krijgen altijd EUR. Dit is een definitieve beslissing — geen tijdelijke uitstelling.

De DB-kolom `potjes.valuta` en de constante `STANDAARD_VALUTA` blijven aanwezig omdat ze actief worden gebruikt voor de correcte weergave van transactiebedragen via `formatBedrag()`. De `VALUTA_OPTIES`-export en het UI-herstelblok in `PaginaNieuwPotje.jsx` zijn verwijderd uit de codebase.

---

## 17. Wijzigingslog

| Versie | Datum | Wijziging | Reden |
|---|---|---|---|
| 3.7 | 2026-04-23 | **Audit 2026-04-23:** `sessionStorage.`-patroon toegevoegd aan `controleer-patronen.js`; partial failure in `usePotje.js` verduidelijkt; UX-wijzigingen stortenscherm (knop toont bedrag, infoblok verwijderd) en modals gedocumenteerd. | Periodieke code-audit 2026-04-23 |
| 3.6 | 2026-04-23 | **§15 Validaties bijgewerkt — max. 2 decimalen bij bedragvelden:** invoervelden voor geldbedragen (`ModalTransactie`, `PaginaStorten` vrij bedrag) beperken invoer actief tot maximaal 2 decimalen via `beperkDecimalen()` in de `onChange`-handler. Als verdediging in de diepte weigert `valideerTransactieBedrag()` ook programmatisch ingevoerde waarden met meer dan 2 decimalen. | Gebruikers konden meer dan 2 decimalen invullen in bedragvelden, wat niet overeenkomt met een geldig eurobedrag |
| 3.5 | 2026-04-22 | **§7 Afmelden modal — bottom-sheet restyling:** titel 'Afmelden?' zonder emoji; subtekst 'Dit is onomkeerbaar. Na het afmelden:'; genummerde lijst (1–3, optioneel 4 bij laatste actieve deelnemer); oranje waarschuwingsbanner voor achtergelaten bedrag (los van de lijst); knoppen gestapeld ('Ja, meld me af' rood boven 'Annuleren' wit); drag handle + slide-up + outside-click + swipe-down. | UX-restyling conform mockup |
| 3.4 | 2026-04-22 | **§7 Pot sluiten modal — bottom-sheet restyling:** waarschuwingsicoon in roze cirkel; titel 'Pot sluiten?'; subtekst met 'onomkeerbaar' bold; rode infobanner met actief deelnemercount; knoppen gestapeld ('Ja, sluit de pot' rood boven 'Annuleren' wit); drag handle + slide-up + outside-click + swipe-down. Nieuwe prop `aantalActiefDeelnemers` doorgegeven vanuit `PaginaPotje`. | UX-restyling conform mockup |
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
| 2.3 | 2026-04-17 | **Technische schuld afgelost (3 items):** E2e in CI, `berekenSaldi.js` gesplitst in vier modules (`berekenSaldi`, `berekenEindafrekening`, `berekenVereffening`, `berekenHelpers`), localStorage-abstractielaag volledig doorgevoerd | Technische schuld items 1/5/6 uit schuldenlijst |
| 2.4 | 2026-04-17 | **CSS-migratie fase 1:** utility-klassen en component-specifieke klassen toegevoegd aan `index.css` (`.flex`, `.grid-2`, `.truncate`, `.knop-icoon`, `.nav-rij`, `.kaart-header`, `.skeleton-*`, `.lege-staat`, `.saldo-display`, e.a.); dit is de eerste stap van de gefaseerde migratie van inline `style={{}}` naar CSS | Technische schuld: inline stijlen (hoog volume) — fase 1 van 10 |
| 2.5 | 2026-04-18 | **§14 zombie-preventie gedocumenteerd:** laatste afmelding sluit automatisch het potje via DB-trigger; afmeld-modal toont extra waarschuwing wanneer gebruiker de laatste actieve deelnemer is | Uit testpraktijk bleek dat een potje in zombie-toestand kon belanden (status=open zonder actieve deelnemers), onherstelbaar via de reguliere flow door RLS-policy |
| 2.7 | 2026-04-20 | **Technische schuld 3 items afgelost (A8, N4, A18):** query timeouts via `metTimeout()` op alle Supabase-calls — bij overschrijding ziet de gebruiker "Het verzoek duurde te lang. Controleer je verbinding en probeer het opnieuw."; naam-matching in Open/Gesloten potjes nu case-insensitief (profielnaam "jan" vindt deelnemer "Jan"); 42501-fouten (RLS na stabiele bootstrapDeviceId-fix) worden voortaan als bugs naar Sentry gestuurd voor monitoring. | Technische schuld audit 2026-04-20 — tweede batch |
| 2.8 | 2026-04-21 | **§16 multicurrency definitief niet geactiveerd:** valutakeuze wordt niet geïmplementeerd; potjes krijgen altijd EUR; `VALUTA_OPTIES` en UI-herstelblok verwijderd uit codebase; §16 herschreven van "uitgesteld" naar "definitief niet geactiveerd" | Definitieve beslissing multicurrency |
| 2.9 | 2026-04-21 | **§4 Overzichtscherm aangevuld:** gemiddeld resterend saldo per actieve deelnemer (`potSaldo ÷ actieveDeelnemers.length`) getoond onder het pot-saldo in de header-kaart. Verborgen bij ≤1 actieve deelnemer (niet informatief). | UX-verzoek: inzicht in gemiddeld beschikbaar saldo per persoon |
| 3.0 | 2026-04-21 | **§7 afmeld-modal uitgebreid:** extra waarschuwingsbullet getoond wanneer de deelnemer bij afmelding een bedrag van ≥ €2 achterlaat in het potje. Tekst: *"Je laat ~€XX,XX achter in het potje — dit geld ben je kwijt."* Berekening: evenredig aandeel op basis van `(eigen gestort / potTotaal) × potSaldo`. Drempel €2 voorkomt melding bij verwaarloosbare bedragen. Berekening in `berekenAchtergelatenBedrag()` in `berekenSaldi.js`. | Deelnemer was onbewust geld kwijt bij afmelding zonder waarschuwing |
| 3.1 | 2026-04-21 | **§7 Overzichtscherm — "Nodig vrienden uit" verplaatst naar Beheer-sectie:** knop stond voorheen in de header-kaart (altijd zichtbaar), maar is een eenmalige actie per potje. Verplaatst naar de Beheer-sectie onderaan, onder de afmeld- en afsluitknoppen. Header-kaart toont nu alleen naam, welkomsttekst, saldo en gemiddelde. | Header te druk; uitnodigen is een beheersactie, geen primaire actie |
| 3.2 | 2026-04-21 | **§14 audit trail (B2):** verwijderde transacties worden voortaan vastgelegd in `transacties_log` via DB-trigger `trg_log_verwijderde_transactie`. Undo en lifecycle-CASCADE zijn niet langer definitief verloren. **§14 downtime-herstel (B5):** bij REQUEST_TIMEOUT of netwerkfout op het stortenscherm of de betalingsmodal wordt het ingevoerde bedrag bewaard in sessionStorage via `formulierBuffer.js`; bij terugkeer op hetzelfde tabblad verschijnt een herstelbanner met het bewaarde bedrag. | Technische schuld B2 en B5 opgelost |
