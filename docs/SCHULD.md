# Technische schuld — Digipot

**Versie:** 1.0
**Datum:** 2026-04-21
**Status:** Actueel
**Beheerder:** Projectteam Digipot

Dit document is de enige bron van waarheid voor openstaande en afgeloste technische schuld.
Elke wijziging aan schuld-items wordt hier bijgehouden én in de TO-wijzigingslog vermeld.

---

## Legenda

| Status | Betekenis |
|---|---|
| 🔴 Open | Nog niet aangepakt |
| 🟡 Geaccepteerd | Bewust niet opgelost; risico gedocumenteerd |
| ✅ Afgelost | Opgelost; datum en TO-versie vermeld |

| Ernst | Betekenis |
|---|---|
| **Kritiek** | Directe veiligheids- of correctheidsrisico |
| **Hoog** | Significante impact op kwaliteit of betrouwbaarheid |
| **Medium** | Merkbare verslechtering van onderhoudbaarheid of UX |
| **Laag** | Stijl, naamgeving, documentatie, kleine inconsistenties |

---

## A — Harde schuld (code en architectuur)

### A1 — `ModalDeelnemen`: annuleer-knop ontbreekt bij eerste deelname

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | ✅ Afgelost (TO v4.7, 2026-04-20) |
| **Omschrijving** | De annuleer-knop was voorwaardelijk (`{onAnnuleer && …}`). Klasse-logica vereenvoudigd en expliciet gedocumenteerd. Ontbreken van de knop bij eerste deelname is bewust UX-gedrag — de modal is dan verplicht. Dit is nu gedocumenteerd in de JSDoc van de component. |
| **Restrisico** | Geen. Gedrag is correct en gedocumenteerd. |

---

### A2 — Geen `error.insertCheck` op `deelnemers` INSERT

| | |
|---|---|
| **Ernst** | Hoog |
| **Status** | ✅ Afgelost (TO v2.6 / audit 2026-04-04, SEC-H1) |
| **Omschrijving** | `handleDeelnemen` controleerde niet of de INSERT een fout teruggaf. Een mislukte INSERT (bv. naambotsing of RLS-fout) werd stil genegeerd. |
| **Oplossing** | `if (error) throw error` toegevoegd na de INSERT in `usePotjeActies.handleDeelnemen`. Fout wordt nu als exception doorgegeven aan de aanroeper (ModalDeelnemen catch-blok). |

---

### A3 — Tikkie-link opende in zelfde tab (noopener ontbrak)

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | ✅ Afgelost (TO v2.6 / audit 2026-04-04, SEC-S4) |
| **Omschrijving** | De Tikkie-deelknop miste `rel="noopener noreferrer"` bij `target="_blank"`. Risico: opener-toegang vanuit externe pagina. |
| **Oplossing** | `rel="noopener noreferrer"` toegevoegd aan `DeelKnop.jsx`. |

---

### A4 — `.single()` in `handleAfmelden` gooide bij geen resultaat

| | |
|---|---|
| **Ernst** | Kritiek |
| **Status** | ✅ Afgelost (TO v1.x / audit 2026-04-12, kritiek-2) |
| **Omschrijving** | `.single()` gooit bij 0 of 2+ rijen een exception. Als de deelnemer al verwijderd was, crashte afmelden met een onbegrijpelijke fout. |
| **Oplossing** | Vervangen door `.maybeSingle()` + null-guard in `usePotjeActies.handleAfmelden`. |

---

### A5 — Null-guard ontbrak in `handleSluiten`

| | |
|---|---|
| **Ernst** | Kritiek |
| **Status** | ✅ Afgelost (TO v1.x / audit 2026-04-12, kritiek-3) |
| **Omschrijving** | `handleSluiten` ging ervan uit dat `deelnemer` altijd aanwezig was. Bij een edge-case (gebruiker zonder deelnemer-record) gooide de functie een silent JS-crash. |
| **Oplossing** | `if (!deelnemer?.id) throw new Error('DEELNEMER_ONTBREEKT')` toegevoegd. |

---

### A6 — Deelnemer-ID werd door Supabase gegenereerd (IDOR-risico)

| | |
|---|---|
| **Ernst** | Hoog |
| **Status** | ✅ Afgelost (TO v1.x / audit 2026-04-12) |
| **Omschrijving** | Het deelnemer-UUID werd server-side gegenereerd. De client kon het ID niet kennen vóór de INSERT, wat race-conditions en moeilijk te debuggen RLS-fouten gaf. |
| **Oplossing** | `crypto.randomUUID()` client-side aanroepen en meesturen bij INSERT. |

---

### A7 — `berekenSaldi.js` bevatte alle bereken-logica in één module

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | ✅ Afgelost (TO v3.6, 2026-04-17) |
| **Omschrijving** | Één groot bestand maakte unit-tests onoverzichtelijk en vertraagde future-proofing (bv. venster-regel). |
| **Oplossing** | Gesplitst in vier modules: `berekenSaldi`, `berekenEindafrekening`, `berekenVereffening`, `berekenHelpers`. Interne module (`berekenHelpers`) niet importeerbaar buiten `src/utils/`. |

---

### A8 — Geen query-timeouts op Supabase-calls

| | |
|---|---|
| **Ernst** | Hoog |
| **Status** | ✅ Afgelost (TO v4.8, 2026-04-20) |
| **Omschrijving** | Bij netwerkproblemen hing de UI onbepaald in laadstaat. Geen feedback voor de gebruiker, geen Sentry-melding. |
| **Oplossing** | `src/utils/requestTimeout.js` toegevoegd met `metTimeout(queryPromise, ms)`. Alle Supabase-calls in `usePotje`, `useMijnPotjes`, `usePotjeActies`, `PaginaStorten`, `PaginaNieuwPotje` gewrapped. Timeout na 10s → Nederlandse melding via `vertaalFout.js`. |

---

### A9 — `berekenSaldi` saldocheck in `handleUndo` zonder afronding

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | ✅ Afgelost (TO v3.x / audit 2026-04-16, SEC-3) |
| **Omschrijving** | Supabase NUMERIC-kolom kan floating-point residuen teruggeven. De vergelijking `huidigSaldo < transactie.bedrag` gaf false-negatieven bij bedragen als 9.999999999998 vs 10.00. |
| **Oplossing** | Beide zijden gewrapped in `rond()` vóór vergelijking. |

---

### A10 — `potjes`-realtime abonnement ving DELETE stil op als `undefined`

| | |
|---|---|
| **Ernst** | Hoog |
| **Status** | ✅ Afgelost (TO v1.x / audit 2026-04-12, Issue 8) |
| **Omschrijving** | `event: '*'` op het potjes-abonnement stuurde `payload.new === undefined` bij DELETE-events. `setPotje(undefined)` brak de UI stilletjes. |
| **Oplossing** | Gesplitst in twee abonnementen: UPDATE (zet `potje`) en DELETE (zet foutmelding + `null`). |

---

### A11 — Realtime INSERT op transacties kon duplicaten tonen

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | ✅ Afgelost (TO v1.x / 2026-04-13) |
| **Omschrijving** | Bij navigate + Realtime-event die tegelijk binnenkwamen, werd dezelfde transactie tweemaal toegevoegd aan de state. |
| **Oplossing** | Deduplicatie op `id` in de Realtime INSERT-handler in `usePotje`. |

---

### A12 — Inline `heeftGestort`-check op meerdere plekken

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | ✅ Afgelost (TO v3.x / audit 2026-04-16, TECH-3) |
| **Omschrijving** | De check `(mijnSaldi?.gestort ?? 0) > 0` stond zowel in `PaginaOverzicht` als in `usePotjeActies`. Bij een drempelwijziging moesten beide worden aangepast. |
| **Oplossing** | Extractie naar `heeftGestort()` in `berekenSaldi.js`. Beide aanroepplaatsen gebruiken nu de gedeelde functie. |

---

### A13 — Geen Content Security Policy

| | |
|---|---|
| **Ernst** | Hoog |
| **Status** | ✅ Afgelost (TO v4.7, 2026-04-20) |
| **Omschrijving** | Zonder CSP kon XSS-code naar willekeurige externe origins communiceren en externe scripts laden. |
| **Oplossing** | `public/_headers` aangemaakt met strenge CSP (default-src 'self'; geen unsafe-eval; connect-src beperkt tot Supabase + Sentry). Aanvullend: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`. |

---

### A14 — Stale README (Vite-boilerplate)

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | ✅ Afgelost (TO v5.0, 2026-04-21) |
| **Omschrijving** | README bevatte standaard Vite-boilerplate zonder enige Digipot-specifieke informatie. |
| **Oplossing** | Volledig herschreven met projectbeschrijving, stack, lokaal draaien, testcommando's en documentatieverwijzingen. |

---

### A15 — Inline CSS (`style={{}}`) door hele codebase

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | ✅ Afgelost (TO v3.6–4.5, 2026-04-17) |
| **Omschrijving** | Inline stijlen maakten theming, dark mode en hergebruik onmogelijk; geen centrale plek voor design tokens. |
| **Oplossing** | CSS-migratie in 10 fasen: utility-klassen + component-klassen toegevoegd aan `index.css`; alle componenten inline-stijl-vrij gemaakt. Uitzondering: CSS custom properties die runtime dynamisch worden ingesteld (bv. `--toast-duur`) blijven als inline style — dit is correct en geen migratie-achterstand. |
| **Resterende afwijkingen** | `PaginaOverzicht` bevat nog `style={{ marginTop: -4 }}` (3×) en `style={{ minWidth: 0 }}` (2×), en `style={{ textAlign: 'right' }}` (1×) en `style={{ fontSize: 22, padding: '2px 0 0 0' }}` op de instellingen-knop. `ModalDeelnemen` bevat `style={{ fontSize: 12, color: 'var(--grijs-600)', marginTop: 4 }}`. Dit zijn negatieve margins en micro-aanpassingen die bewust niet in `index.css` zijn opgenomen omdat ze component-specifiek en contextafhankelijk zijn. **Aanbeveling:** documenteer dit expliciet als geaccepteerde uitzondering of extraheer naar een `.overzicht-header__rechts button`-klasse. |

---

### A16 — localStorage-aanroepen verspreid door codebase

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | ✅ Afgelost (TO v3.4, 2026-04-16) |
| **Omschrijving** | Directe `localStorage.getItem/setItem/removeItem`-aanroepen in meerdere componenten en hooks maakten foutafhandeling (bv. QuotaExceededError, iOS Safari private mode) inconsistent en unit-tests omslachtig. |
| **Oplossing** | `src/utils/storage.js` als abstractielaag geïntroduceerd. `scripts/controleer-patronen.js` uitgebreid met patrooncheck op `localStorage.` buiten de abstractiemodule. `main.jsx` bugfix: literal string → `TEKSTGROOTTE_KEY`. |

---

### A17 — Geen double-submit guard op formulieren

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | ✅ Afgelost (TO v4.7, 2026-04-20) |
| **Omschrijving** | Snel tweemaal klikken op "Meedoen" of "Betalen" kon duplicate key violations veroorzaken op DB-niveau, omdat de `laden`-state de async round-trip niet bijhoudt. |
| **Oplossing** | `bezigRef = useRef(false)` toegevoegd in `ModalDeelnemen` én `ModalTransactie`. Guard controleert en zet de ref synchroon vóór de eerste await. |

---

### A18 — 42501 (RLS-fout) uitgesloten van Sentry

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | ✅ Afgelost (TO v4.8, 2026-04-20) |
| **Omschrijving** | 42501-fouten werden als gebruikersfout geclassificeerd en niet naar Sentry gestuurd. Na de `bootstrapDeviceId`-fix zijn echter geen legitieme gebruikers-42501s meer te verwachten. Nieuwe 42501s zijn dus bugs. |
| **Oplossing** | `'42501'`-string verwijderd uit `isGebruikersFout` in `logFout.js`. `'row-level security'`-matcher blijft als gebruikersfout. `REQUEST_TIMEOUT` toegevoegd als gebruikersfout. `vertaalFout.js` behoudt 42501-matcher voor Nederlandse gebruikerstekst (orthogonaal aan Sentry-routing). |

---

### A19 — Plaintext credentials in migratiebestand `stap23`

| | |
|---|---|
| **Ernst** | Kritiek |
| **Status** | ✅ Afgelost (TO v4.7, 2026-04-20, SEC-CRIT) |
| **Omschrijving** | Een migratiebestand bevatte plaintext credentials. |
| **Oplossing** | Gecensureerd/gesaniteerd. Credentials geroteerd indien van toepassing. |

---

### A20 — Migratiebestanden niet gestructureerd in `supabase/migrations/`

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | ✅ Afgelost (TO v4.7, 2026-04-20, N2) |
| **Omschrijving** | Migratiebestanden stonden los in de root of scripts-map, waardoor migratie-geschiedenis niet aaneengesloten was. |
| **Oplossing** | Gestructureerd in `supabase/migrations/`. Nieuwe DDL-wijzigingen gaan via `apply_migration`. |

---

## B — Strategische schuld (architectuur en toekomstbestendigheid)

### B1 — Geen TypeScript

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | 🟡 Geaccepteerd |
| **Omschrijving** | Het project gebruikt geen TypeScript. Dit vergroot de kans op type-gerelateerde bugs, met name bij het doorgeven van props (bv. `achtergelatenBedrag: null \| number`) en Supabase-responses. |
| **Overweging** | TypeScript toevoegen aan een bestaand React-project zonder TS vereist significant migratiewerk. Voor een privéproject met beperkte teamgrootte wegen de kosten niet op tegen de baten op korte termijn. |
| **Voorwaarde voor heroverwegen** | Bij uitbreiding van het team, of bij introductie van de venster-regel (meer complexe domeinlogica). |
| **Acceptatiedatum** | 2026-04-21 |

---

### B2 — Geen audit trail voor deleties

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | ✅ Afgelost (TO v5.8, 2026-04-21) |
| **Omschrijving** | Tabel `transacties_log` aangemaakt met trigger `trg_log_verwijderde_transactie` (SECURITY DEFINER). Elke DELETE op `transacties` — zowel via undo als via lifecycle-CASCADE — wordt vastgelegd met transactie_id, potje_id, deelnemer_id, type, bedrag, aangemaakt_op, verwijderd_op en verwijderd_door (device_id of NULL bij server-side jobs). Tabel is append-only voor de anon-rol. Beheer via service-rol of Supabase dashboard. |
| **Migratie** | `supabase/migrations/20260421000000_transacties_audit_log.sql` |

---

### B3 — PII in Sentry via `error.message`

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | 🟡 Geaccepteerd |
| **Omschrijving** | `logFout.js` stuurt `error.message` naar Sentry zonder sanitisatie. In de huidige codebase bevatten messages alleen door de code gegenereerde strings, niet de gebruikersinvoer zelf. Het risico dat een voornaam via een foutmelding in Sentry belandt, is verwaarloosbaar maar niet nul. |
| **Mitigatie** | JSDoc-commentaar in `logFout.js` beschrijft het bewust geaccepteerde risico (TO v5.2). |
| **Voorwaarde voor heroverwegen** | Bij introductie van velden met gevoeliger PII (e-mail, achternaam, telefoonnummer). |
| **Acceptatiedatum** | 2026-04-21 |

---

### B4 — Geen frontend rate limiting op device-niveau

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | 🔴 Open |
| **Omschrijving** | A17 dekt double-submit (één klik → één request). Er is echter geen beperking op het aantal requests per device per tijdseenheid. Een kwaadwillende of kapotte client kan in theorie honderden stortingen of betalingen per seconde aanmaken. Supabase-RLS biedt geen rate-limiting. |
| **Risico** | Laag: de applicatie vereist een geldig potje-ID en deelnemer-ID (niet openbaar voorspelbaar). Misbruik is mogelijk maar niet triviaal. |
| **Aanbeveling** | Cloudflare Rate Limiting rule op `POST /rest/v1/transacties` (bv. max 10 req/min per IP). Alternatief: Supabase DB-functie met check op recente transactiefrequentie. Uitgesteld tot misbruik zich voordoet. |

---

### B5 — Geen herstelstrategie bij Supabase-downtime

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | ✅ Afgelost (TO v5.9, 2026-04-21) |
| **Omschrijving** | `src/utils/formulierBuffer.js` toegevoegd met sessionStorage-gebaseerde best-effort buffer. `PaginaStorten` en `ModalTransactie` bewaren het ingevoerde bedrag bij REQUEST_TIMEOUT of netwerkfout. Bij terugkeer op hetzelfde tabblad verschijnt een herstelbanner en is het bedrag vooringevuld. Buffer wordt gewist na een succesvolle submit. Full offline-first (service worker + IndexedDB) is bewust niet geïmplementeerd — niet proportioneel voor dit project. |

---

### B6 — Multicurrency code-rommel

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | ✅ Afgelost (TO v5.1, 2026-04-21) |
| **Omschrijving** | `VALUTA_OPTIES`, MULTICURRENCY-commentaarblokken en herstelblok in `PaginaNieuwPotje.jsx` stonden nog in de codebase na het definitief besluit multicurrency niet te activeren. |
| **Oplossing** | `VALUTA_OPTIES` verwijderd uit `constants.js`; commentaarblokken en herstelblok verwijderd uit `PaginaNieuwPotje.jsx`; regressietests bijgewerkt. `STANDAARD_VALUTA` blijft actief in gebruik. |

---

### B7 — Testbestanden gekoppeld aan audit-labels

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | ✅ Afgelost (TO v5.0, 2026-04-21) |
| **Omschrijving** | Testbestanden hadden namen als `kritiek`, `hoog`, `laag.bevindingen` — audit-terminologie die geen relatie heeft met de te testen feature. Na de audit zijn de labels betekenisloos. |
| **Oplossing** | Zeven bestanden hernoemd naar feature/module-gebaseerde namen. Zie TO v5.0 voor de volledige mapping. |

---

## Nieuw gesignaleerde items (2026-04-21)

### C1 — Resterende inline stijlen na CSS-migratie

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | 🔴 Open |
| **Omschrijving** | De CSS-migratie is als "voltooid" gedocumenteerd (TO v4.5), maar `PaginaOverzicht` en `ModalDeelnemen` bevatten nog micro-aanpassingen als inline stijl (`marginTop: -4`, `minWidth: 0`, `fontSize: 12`, `textAlign: 'right'`). Dit zijn geen runtime-dynamische waarden en horen thuis in CSS-klassen of component-specifieke regels. |
| **Aanbeveling** | Extraheer naar klassen in `index.css` of documenteer expliciet als geaccepteerde uitzondering en pas de definitie van "CSS-migratie voltooid" aan in de TO. |

---

### C2 — UX: disabled afmeld-knop zonder directe toelichting

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | 🔴 Open |
| **Omschrijving** | De afmeld-knop is `disabled` zolang de gebruiker niet gestort heeft. De helptekst staat ónder de knop-rij en kan op kleine schermen onzichtbaar zijn of buiten de visuele focus vallen. Op het moment dat de gebruiker de knop probeert te klikken (en faalt), is er geen directe feedback. |
| **Aanbeveling** | Voeg `title="Eerst storten om je te kunnen afmelden"` toe aan de disabled knop. Optioneel: `aria-describedby` voor screenreaders. |

---

### C3 — Branching-strategie niet gedocumenteerd voor medewerkers

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | 🔴 Open |
| **Omschrijving** | De `acceptatie`-branch is toegevoegd aan de CI-pipeline (TO v5.4), maar het ontwikkelproces (wanneer vertrek je vanaf `acceptatie` vs `main`, wat is de PR-flow, wie reviewt) staat niet gedocumenteerd in README of TO. |
| **Aanbeveling** | Voeg een §"Ontwikkelworkflow" toe aan de README of TO met: feature branch → PR naar `acceptatie` → review → merge → PR `acceptatie` → `main`. |

---

## Overzicht open items

| Item | Ernst | Status |
|---|---|---|
| B2 — Geen audit trail voor deleties | Medium | ✅ Afgelost |
| B5 — Geen herstelstrategie bij downtime | Medium | ✅ Afgelost |
| B4 — Geen frontend rate limiting | Laag | 🔴 Open |
| C1 — Resterende inline stijlen | Laag | 🔴 Open |
| C2 — Disabled knop zonder directe feedback | Laag | 🔴 Open |
| C3 — Branching-strategie niet gedocumenteerd | Laag | 🔴 Open |

---

## Aanbevolen volgorde voor afhandeling

1. **B5** — Herstelstrategie bij Supabase-downtime: directe gebruikersimpact (data-verlies).
2. **B2** — Audit trail: neemt toe in belang als het project groeit.
3. **C1** — Inline stijlen: kleine investering, volledige documentatie-consistentie.
4. **C2** — Disabled-knop UX: één attribuut.
5. **C3** — Branching-strategie documenteren: één alinea in README.
6. **B4** — Rate limiting: pas actie als misbruik zich voordoet.

---

## Wijzigingslog

| Versie | Datum | Wijziging |
|---|---|---|
| 1.0 | 2026-04-21 | Initieel aangelegd — gereconstrueerd uit TO-wijzigingslog v1.0–5.6, code-audit en sessie-geheugen |
| 1.1 | 2026-04-21 | B2 en B5 afgelost; status bijgewerkt in overzicht |
