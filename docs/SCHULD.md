# Technische schuld — Digipot

**Versie:** 1.3
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
| **Oplossing** | `src/utils/requestTimeout.js` toegevoegd met `metTimeout(queryPromise, ms)`. Alle Supabase-calls gewrapped. Timeout na 10s → Nederlandse melding via `vertaalFout.js`. |

---

### A9 — `berekenSaldi` saldocheck in `handleUndo` zonder afronding

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | ✅ Afgelost (TO v3.x / audit 2026-04-16, SEC-3) |
| **Omschrijving** | Supabase NUMERIC-kolom kan floating-point residuen teruggeven. De vergelijking gaf false-negatieven bij bedragen als 9.999999999998 vs 10.00. |
| **Oplossing** | Beide zijden gewrapped in `rond()` vóór vergelijking. |

---

### A10 — `potjes`-realtime abonnement ving DELETE stil op als `undefined`

| | |
|---|---|
| **Ernst** | Hoog |
| **Status** | ✅ Afgelost (TO v1.x / audit 2026-04-12, Issue 8) |
| **Omschrijving** | `event: '*'` stuurde `payload.new === undefined` bij DELETE-events. `setPotje(undefined)` brak de UI stilletjes. |
| **Oplossing** | Gesplitst in twee abonnementen: UPDATE (zet `potje`) en DELETE (zet foutmelding + `null`). |

---

### A11 — Realtime INSERT op transacties kon duplicaten tonen

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | ✅ Afgelost (TO v1.x / 2026-04-13) |
| **Omschrijving** | Bij navigate + Realtime-event tegelijk werd dezelfde transactie tweemaal toegevoegd aan de state. |
| **Oplossing** | Deduplicatie op `id` in de Realtime INSERT-handler in `usePotje`. |

---

### A12 — Inline `heeftGestort`-check op meerdere plekken

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | ✅ Afgelost (TO v3.x / audit 2026-04-16, TECH-3) |
| **Omschrijving** | De check stond zowel in `PaginaOverzicht` als in `usePotjeActies`. Bij een drempelwijziging moesten beide worden aangepast. |
| **Oplossing** | Extractie naar `heeftGestort()` in `berekenSaldi.js`. |

---

### A13 — Geen Content Security Policy

| | |
|---|---|
| **Ernst** | Hoog |
| **Status** | ✅ Afgelost (TO v4.7, 2026-04-20) |
| **Omschrijving** | Zonder CSP kon XSS-code naar willekeurige externe origins communiceren en externe scripts laden. |
| **Oplossing** | `public/_headers` aangemaakt met strenge CSP. Aanvullend: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`. |

---

### A14 — Stale README (Vite-boilerplate)

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | ✅ Afgelost (TO v5.0, 2026-04-21) |
| **Omschrijving** | README bevatte standaard Vite-boilerplate zonder enige Digipot-specifieke informatie. |
| **Oplossing** | Volledig herschreven met projectbeschrijving, stack, lokaal draaien, testcommando's en documentatieverwijzingen. |

---

### A15 — Inline CSS door hele codebase

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | ✅ Afgelost (TO v3.6–6.0, 2026-04-17/21) |
| **Omschrijving** | Inline stijlen maakten theming en hergebruik onmogelijk. |
| **Oplossing** | CSS-migratie in 10 fasen + C1-vervolgstap. Uitzondering: runtime-dynamische waarden (bv. `--toast-duur`, `opacity`) blijven als inline style — correct en gedocumenteerd. |

---

### A16 — localStorage-aanroepen verspreid door codebase

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | ✅ Afgelost (TO v3.4, 2026-04-16) |
| **Omschrijving** | Directe localStorage-aanroepen in meerdere componenten en hooks. |
| **Oplossing** | `src/utils/storage.js` als abstractielaag geïntroduceerd. Patrooncheck in `controleer-patronen.js`. |

---

### A17 — Geen double-submit guard op formulieren

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | ✅ Afgelost (TO v4.7, 2026-04-20) |
| **Omschrijving** | Snel tweemaal klikken kon duplicate key violations veroorzaken op DB-niveau. |
| **Oplossing** | `bezigRef = useRef(false)` toegevoegd in `ModalDeelnemen` én `ModalTransactie`. |

---

### A18 — 42501 (RLS-fout) uitgesloten van Sentry

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | ✅ Afgelost (TO v4.8, 2026-04-20) |
| **Omschrijving** | 42501-fouten werden als gebruikersfout geclassificeerd en niet naar Sentry gestuurd. Na bootstrapDeviceId-fix zijn nieuwe 42501s bugs. |
| **Oplossing** | `'42501'`-string verwijderd uit `isGebruikersFout`. `vertaalFout.js` behoudt 42501-matcher voor gebruikerstekst. |

---

### A19 — Plaintext credentials in migratiebestand

| | |
|---|---|
| **Ernst** | Kritiek |
| **Status** | ✅ Afgelost (TO v4.7, 2026-04-20, SEC-CRIT) |
| **Omschrijving** | Een migratiebestand bevatte plaintext credentials. Gecensureerd; credentials geroteerd. |

---

### A20 — Migratiebestanden niet gestructureerd

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | ✅ Afgelost (TO v4.7, 2026-04-20, N2) |
| **Omschrijving** | Migratiebestanden stonden los in de root. |
| **Oplossing** | Gestructureerd in `supabase/migrations/`. Nieuwe DDL via `apply_migration`. |

---

## B — Strategische schuld (architectuur en toekomstbestendigheid)

### B1 — Geen TypeScript

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | 🟡 Geaccepteerd |
| **Omschrijving** | Het project gebruikt geen TypeScript. Vergroot de kans op type-gerelateerde bugs bij props en Supabase-responses. |
| **Overweging** | Migratiekosten wegen niet op tegen baten voor een privéproject met kleine teamomvang. |
| **Voorwaarde voor heroverwegen** | Bij uitbreiding van het team of introductie van de venster-regel. |
| **Acceptatiedatum** | 2026-04-21 |

---

### B2 — Geen audit trail voor deleties

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | ✅ Afgelost (TO v5.8, 2026-04-21) |
| **Omschrijving** | Tabel `transacties_log` aangemaakt met trigger `trg_log_verwijderde_transactie` (SECURITY DEFINER). Elke DELETE op `transacties` vastgelegd. Tabel append-only voor anon-rol. |
| **Migratie** | `supabase/migrations/20260421000000_transacties_audit_log.sql` |

---

### B3 — PII in Sentry via `error.message`

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | 🟡 Geaccepteerd |
| **Omschrijving** | `logFout.js` stuurt `error.message` naar Sentry zonder sanitisatie. In de huidige codebase bevatten messages alleen code-gegenereerde strings. |
| **Mitigatie** | JSDoc-commentaar in `logFout.js` beschrijft het bewust geaccepteerde risico (TO v5.2). |
| **Voorwaarde voor heroverwegen** | Bij introductie van velden met gevoeliger PII. |
| **Acceptatiedatum** | 2026-04-21 |

---

### B4 — Geen frontend rate limiting op device-niveau

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | ✅ Afgelost (TO v6.0, 2026-04-21) |
| **Omschrijving** | Migratie `20260421000100_transacties_rate_limit.sql` breidt `transacties_insert` RLS uit met COUNT-subquery: max 10 transacties per device_id per minuut. |

---

### B5 — Geen herstelstrategie bij Supabase-downtime

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | ✅ Afgelost (TO v5.9, 2026-04-21) |
| **Omschrijving** | `src/utils/formulierBuffer.js` toegevoegd. `PaginaStorten` en `ModalTransactie` bewaren ingevoerd bedrag bij timeout/netwerkfout. Herstelbanner bij terugkeer. |

---

### B6 — Multicurrency code-rommel

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | ✅ Afgelost (TO v5.1, 2026-04-21) |
| **Omschrijving** | `VALUTA_OPTIES` en MULTICURRENCY-blokken verwijderd na definitief besluit. `STANDAARD_VALUTA` blijft actief. |

---

### B7 — Testbestanden gekoppeld aan audit-labels

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | ✅ Afgelost (TO v5.0, 2026-04-21) |
| **Omschrijving** | Zeven testbestanden hernoemd van audit-labels naar feature/module-namen. Zie TO v5.0. |

---

## D — Audit 2026-04-26

### D21 — `device_id` tijdelijk gevuld met willekeurig UUID na Fase 4

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | 🔴 Open |
| **Omschrijving** | `usePotjeActies.handleDeelnemen` vult `device_id` bij INSERT met `crypto.randomUUID()` als tijdelijke workaround omdat de kolom `NOT NULL` is. Dit UUID is nooit gekoppeld aan het echte apparaat. RLS-policies die nog op `device_id` steunen (migratie `20260414000000_rls_device_id.sql`) zijn daardoor effectief niet-functioneel voor rijen aangemaakt na Fase 4 (2026-04-25). |
| **Risico** | RLS-policies op `device_id` werken niet voor nieuwe deelnemers. Moeilijk te debuggen. |
| **Oplossing** | Verwijder de `device_id`-kolom via een nieuwe migratie, of maak hem nullable. Verwijder RLS-policies die er nog op steunen. |
| **Gedetecteerd** | Audit 2026-04-26 |

---

## C — Nieuw gesignaleerde items (2026-04-21)

### C1 — Resterende inline stijlen na CSS-migratie

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | ✅ Afgelost (TO v6.0, 2026-04-21) |
| **Omschrijving** | Nieuwe CSS-klassen toegevoegd aan `index.css`. `PaginaOverzicht` en `ModalDeelnemen` volledig inline-stijl-vrij. Uitzondering: runtime-dynamische `opacity` op sluiten-knop blijft als inline style — gedocumenteerde uitzondering. |

---

### C2 — UX: disabled afmeld-knop zonder directe toelichting

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | ✅ Afgelost (TO v6.2, 2026-04-21) |
| **Omschrijving** | `title` toegevoegd aan de disabled afmeld-knop in `PaginaOverzicht`. Toont tooltip bij hover en wordt door screenreaders voorgelezen. |

---

### C3 — Branching-strategie niet gedocumenteerd

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | ✅ Afgelost (TO v6.2, 2026-04-21) |
| **Omschrijving** | Sectie Ontwikkelworkflow toegevoegd aan `README.md` met uitleg over `acceptatie` als integratiebranch, `main` als productiebranch, en stappenplan voor feature branches. |

---

## Overzicht

**Alle schulditems zijn afgelost of bewust geaccepteerd.**

| Item | Ernst | Status |
|---|---|---|
| B1 — Geen TypeScript | Medium | 🟡 Geaccepteerd |
| B3 — PII in Sentry | Laag | 🟡 Geaccepteerd |
| D21 — device_id willekeurig UUID | Medium | 🔴 Open |
| Alle A-items (A1–A20) | — | ✅ Afgelost |
| Alle B-items (B2–B7) | — | ✅ Afgelost |
| Alle C-items (C1–C3) | — | ✅ Afgelost |

---

## Wijzigingslog

| Versie | Datum | Wijziging |
|---|---|---|
| 1.0 | 2026-04-21 | Initieel aangelegd — gereconstrueerd uit TO-wijzigingslog v1.0–5.6, code-audit en sessie-geheugen |
| 1.1 | 2026-04-21 | B2 en B5 afgelost |
| 1.2 | 2026-04-21 | B4 en C1 afgelost |
| 1.3 | 2026-04-21 | C2 en C3 afgelost — schuldenlijst volledig leeg |
| 1.4 | 2026-04-26 | D21 toegevoegd: `device_id` tijdelijk willekeurig UUID na Fase 4 (audit 2026-04-26) |
