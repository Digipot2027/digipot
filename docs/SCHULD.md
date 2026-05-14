# Technische schuld — Digipot

**Versie:** 1.8
**Datum:** 2026-05-13
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
| **Noot (2026-04-26)** | Na Fase 4 is de rate-limit-clausule herschreven naar `auth.uid()`. De migratiebestand-naam is misleidend; consolidatie staat als E3 op de agenda. |

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

## C — Items uit audit 2026-04-21

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

## D — Items uit audit 2026-04-26 (eerste tranche)

### D21 — `device_id` tijdelijk gevuld met willekeurig UUID na Fase 4

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | ✅ Afgelost (2026-04-26) |
| **Omschrijving** | `usePotjeActies.handleDeelnemen` vulde `device_id` bij INSERT met `crypto.randomUUID()` als tijdelijke workaround omdat de kolom `NOT NULL` was. Dit UUID was nooit gekoppeld aan het echte apparaat. |
| **Oplossing** | Migratie `20260426000000_device_id_nullable.sql`: `ALTER TABLE deelnemers ALTER COLUMN device_id DROP NOT NULL`. INSERT in `usePotjeActies.js` bevat geen `device_id` meer. `is_mijn_deelnemer()` gebruikt uitsluitend `auth.uid()` — device_id was al functioneel ongebruikt. |

---

## E — Items uit security-audit 2026-04-26 (tweede tranche)

### E1 — `service_role` secret in `.env.local` zonder `.gitignore`-bescherming

| | |
|---|---|
| **Ernst** | **Kritiek** |
| **Status** | ✅ Afgelost (2026-04-26, SEC-A1) |
| **Omschrijving** | `.env.local` bevatte `SUPABASE_SERVICE_ROLE_KEY=sb_secret_...`. De `service_role`-sleutel omzeilt alle RLS-policies. `.gitignore` (92 bytes) bevatte geen `.env*`-pattern, dus één onbedachte `git add .` zou het secret naar publieke geschiedenis op `https://github.com/Digipot2027/digipot` pushen. |
| **Misbruikscenario** | Aanvaller kloont repo, leest secret uit history, en heeft volledige read/write op alle tabellen, kan `auth.users` uitlezen en de hele database droppen. |
| **Oplossing** | `.gitignore` aangevuld met `.env`, `.env.local`, `.env.*.local`, `.env.development`, `.env.production`. Beheerder roteert het secret in Supabase Dashboard (handmatig — geen MCP-actie mogelijk). |
| **Beheerderstaak (handmatig)** | 1) `git ls-files .env.local` en `git log --all -- .env.local` — leeg = veilig. 2) Secret roteren in Supabase Dashboard → Project Settings → API → Reset service_role key. 3) Nieuwe waarde in `.env.local` plaatsen. |
| **Migratie** | n.v.t. — alleen `.gitignore`. |

---

### E2 — IDOR: `deelnemers_insert` zonder eigenaar-check (impersonation + weesdeelnemer)

| | |
|---|---|
| **Ernst** | **Kritiek** |
| **Status** | ✅ Afgelost (2026-04-26, SEC-A2) |
| **Omschrijving** | De live `deelnemers_insert` policy controleerde alleen dat het potje open is. Een geauthenticeerde anon-gebruiker kon een deelnemer invoegen met `user_id = NULL` (kapt eigenaarschap af) of `user_id = <UUID van een andere gebruiker>` (impersonation). In combinatie met `transacties_insert` (die alleen `is_mijn_deelnemer` op de deelnemer-rij vereist) kon een aanvaller namens een gespoofde identiteit transacties plaatsen op willekeurige open potjes. |
| **Misbruikscenario** | Vrienden A, B, C delen een potje voor een diner. URL lekt via een gedeelde groepschat. Aanvaller D wordt anoniem ingelogd (`auth.uid()` = X), POST `deelnemers` met `naam: "Diana"`, `potje_id`, `user_id: X`. Slaagt. Plaatst betalingen die het potsaldo opmaken. |
| **Oplossing** | Policy aangevuld met `auth.uid() IS NOT NULL AND deelnemers.user_id = auth.uid()`. Frontend (`usePotjeActies.handleDeelnemen`) zet `user_id` al uit `supabase.auth.getUser()` — geen frontend-wijziging nodig. |
| **Migratie** | `supabase/migrations/20260426000100_sec_a2_deelnemers_insert_eigenaar_check.sql` (live toegepast). |
| **Tests** | `src/test/secA2.deelnemerInsertEigenaar.regressie.test.js` (6 cases) + `e2e/pw14-sec-a2-impersonation.spec.js` (4 cases, 5 browsers = 20 e2e-cases). |

---

### E3 — Migratiebestanden uit sync met live DB-policies

| | |
|---|---|
| **Ernst** | Hoog |
| **Status** | ✅ Afgelost (2026-04-27, SEC-A3) |
| **Omschrijving** | De drie laatste RLS-migraties in `/supabase/migrations` gebruikten nog de `x-device-id`-header. De live DB-policies gebruiken sinds Fase 4 `is_mijn_deelnemer()` met `auth.uid()`. Bij DB-rebuild zouden de oude policies worden toegepast — alle UPDATE/INSERT-operaties zouden falen met 42501. |
| **Oplossing** | Twee consoliderende migraties toegevoegd: `20260427000000_is_mijn_deelnemer_function.sql` (helper-functie, ontbrak volledig in repo) en `20260427000100_rls_fase4_consolidatie.sql` (volledige policy-set, exact live state). Vier obsolete migraties gemarkeerd met OBSOLETE-header, originele SQL uitgecommentarieerd. `supabase/migrations/README.md` herschreven met actief/obsolete-overzicht en rebuild-instructie. Geen DB-wijziging — live staat was al correct. |

---

### E4 — `push_subscriptions` tabel zonder feature-implementatie

| | |
|---|---|
| **Ernst** | Hoog |
| **Status** | ✅ Afgelost (2026-05-13, TO v8.7) |
| **Omschrijving** | DB-tabel `push_subscriptions` bestond met vier RLS-policies maar de codebase bevatte geen enkele referentie. Aanvalsoppervlak zonder business-doel; feature stond niet op de roadmap. |
| **Oplossing** | `DROP TABLE IF EXISTS public.push_subscriptions CASCADE` in migratie `20260530000100_drop_push_subscriptions.sql`. CASCADE verwijdert de vier RLS-policies automatisch. Geen codewijziging nodig — geen referenties aanwezig. |
| **Migratie** | `supabase/migrations/20260530000100_drop_push_subscriptions.sql` |

---

### E5 — Onnodig brede privileges op alle tabellen

| | |
|---|---|
| **Ernst** | Hoog |
| **Status** | ✅ Afgelost (2026-05-13, TO v8.7) |
| **Omschrijving** | `anon` en `authenticated` hadden `TRUNCATE`, `REFERENCES`, `TRIGGER` en andere onnodige privileges op alle tabellen. RLS blokkeert vandaag misbruik, maar defense-in-depth ontbrak. |
| **Oplossing** | Migratie `20260530000000_data_api_grants.sql`: `REVOKE ALL` op alle tabellen voor `anon` en `authenticated`, gevolgd door exacte `GRANT`s per tabel op basis van de RLS-policy-set. Principle of least privilege: `potjes` SELECT/INSERT/UPDATE, `deelnemers` SELECT/INSERT/UPDATE, `transacties` SELECT/INSERT/DELETE, `transacties_log` geen directe toegang. |
| **Migratie** | `supabase/migrations/20260530000000_data_api_grants.sql` |

---

### E6 — Geen rate-limit op `potjes_insert`

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | 🔴 Open (SEC-A6) |
| **Omschrijving** | Iedereen kan ongelimiteerd potjes aanmaken. Spam/DoS-risico — 100k potjes in een minuut belast lifecycle-cron en raakt free-tier rij-limieten. |
| **Oplossing** | Rate-limit toevoegen aan `potjes_insert` policy: max 10 potjes per `auth.uid()` per uur. |

---

### E7 — Open SELECT op `potjes/deelnemers/transacties` (privacy-by-design)

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | 🟡 Geaccepteerd (privacy-by-design) |
| **Omschrijving** | `SELECT TO anon USING (true)` op alle drie tabellen. Iedereen met UUID ziet alle data. Bewuste keuze voor het sharemodel (link → potje openen). |
| **Mitigatie** | Documenteer in FO §[Privacy] en TO §[Securitymaatregelen]. Vandaag al gemitigeerd door random UUIDv4 (122 bits entropie) en CSP-headers die referer-leak beperken. |
| **Voorwaarde voor heroverwegen** | Bij introductie van gevoelige velden (bedragen >€5000, IBAN, SEPA) of bij wettelijk vereiste vertrouwelijkheid. |

---

### E8 — `document.title` accepteert Unicode bidi-control characters

| | |
|---|---|
| **Ernst** | Medium |
| **Status** | 🔴 Open (SEC-A8) |
| **Omschrijving** | Potje- en deelnemernamen kunnen `\u202E` (RTL override), `\u200B` (ZWSP) en andere bidi-control characters bevatten. Geen XSS, wel social engineering via misleidende tabtitels. |
| **Oplossing** | Strip `[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]` in `valideerPotjeNaam`/`valideerDeelnemerNaam`. Aanvullend DB-CHECK-constraint via `regexp_replace`. |

---

### E9 — Geen rate-limit op `deelnemers_update`

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | 🔴 Open (SEC-A10) |
| **Omschrijving** | Onbeperkt afmelden → realtime-broadcast spam naar abonnees op het kanaal. |
| **Oplossing** | Rate-limit op `deelnemers_update`: max 30 updates per minuut per `auth.uid()`. |

---

### E10 — `Referrer-Policy: strict-origin-when-cross-origin` lekt origin

| | |
|---|---|
| **Ernst** | Laag |
| **Status** | 🔴 Open (SEC-A13) |
| **Omschrijving** | Bij Tikkie-fallback wordt `Referer: https://digipot.app` meegestuurd. Niet ernstig (origin is publiek), wel netter als `no-referrer`. |
| **Oplossing** | `_headers` aanpassen: `Referrer-Policy: no-referrer`. |

---

## F — Supabase Data API GRANT-verplichting (2026-05-30)

### F1 — Geen expliciete GRANTs in migratiepad

| | |
|---|---|
| **Ernst** | Hoog |
| **Status** | ✅ Afgelost (2026-05-13, TO v8.7) |
| **Omschrijving** | Supabase vereist vanaf 30 mei 2026 expliciete GRANTs op public-tabellen voor nieuwe projecten; vanaf 30 oktober 2026 voor alle bestaande projecten. Het Digipot-migratiepad bevatte geen `GRANT`-statements. Bij een fresh rebuild na die datum zouden alle Data API-calls falen met fout 42501. |
| **Oplossing** | Migratie `20260530000000_data_api_grants.sql` toegevoegd. Combineert de GRANTs met E5-opschoning (REVOKE ALL + exacte GRANT per tabel/rol). Migratie is idempotent en veilig opnieuw uitvoerbaar. |
| **Migratie** | `supabase/migrations/20260530000000_data_api_grants.sql` |
| **Productie-actie** | `apply_migration` uitvoeren vóór 30 oktober 2026 op het productieproject (`aqeuehfjgnpytfibncwy`). |

---

## Overzicht

| Item | Ernst | Status |
|---|---|---|
| B1 — Geen TypeScript | Medium | 🟡 Geaccepteerd |
| B3 — PII in Sentry | Laag | 🟡 Geaccepteerd |
| E1 — service_role secret in .env.local | Kritiek | ✅ Afgelost |
| E2 — IDOR deelnemers_insert | Kritiek | ✅ Afgelost |
| E3 — Migratiebestanden uit sync | Hoog | ✅ Afgelost |
| E4 — push_subscriptions tabel | Hoog | ✅ Afgelost |
| E5 — Onnodig brede privileges | Hoog | ✅ Afgelost |
| E6 — Geen rate-limit potjes_insert | Medium | 🔴 Open |
| E7 — Open SELECT op alle tabellen | Medium | 🟡 Geaccepteerd |
| E8 — Unicode bidi in namen | Medium | 🔴 Open |
| E9 — Geen rate-limit deelnemers_update | Laag | 🔴 Open |
| E10 — Referrer-Policy | Laag | 🔴 Open |
| F1 — Geen expliciete GRANTs in migratiepad | Hoog | ✅ Afgelost |
| Alle A-items (A1–A20) | — | ✅ Afgelost |
| Alle B-items (B2, B4–B7) | — | ✅ Afgelost |
| Alle C-items (C1–C3) | — | ✅ Afgelost |
| D21 | Medium | ✅ Afgelost |

---

## Wijzigingslog

| Versie | Datum | Wijziging |
|---|---|---|
| 1.0 | 2026-04-21 | Initieel aangelegd — gereconstrueerd uit TO-wijzigingslog v1.0–5.6, code-audit en sessie-geheugen |
| 1.1 | 2026-04-21 | B2 en B5 afgelost |
| 1.2 | 2026-04-21 | B4 en C1 afgelost |
| 1.3 | 2026-04-21 | C2 en C3 afgelost — schuldenlijst volledig leeg |
| 1.4 | 2026-04-26 | D21 toegevoegd: `device_id` tijdelijk willekeurig UUID na Fase 4 (audit 2026-04-26) |
| 1.5 | 2026-04-26 | D21 afgelost: migratie `device_id_nullable`, INSERT zonder `device_id`, UX-1/UX-5/CODE-2/CODE-4/WCAG-6 opgelost |
| 1.6 | 2026-04-26 | E-sectie toegevoegd uit security-audit 2026-04-26: E1 en E2 afgelost (Critical), E3–E10 als open/geaccepteerd opgenomen |
| 1.7 | 2026-04-27 | E3 afgelost: `20260427000000` helper-functie + `20260427000100` volledige RLS-consolidatie + vier obsolete migraties gemarkeerd + README herschreven |
| 1.8 | 2026-05-13 | E4 afgelost: DROP TABLE push_subscriptions (migratie `20260530000100`). E5 afgelost: REVOKE ALL + exacte GRANTs per tabel (migratie `20260530000000`). F1 toegevoegd en afgelost: Supabase Data API GRANT-verplichting opgelost met dezelfde migratie. |
