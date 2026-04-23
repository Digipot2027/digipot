---
name: Periodieke code-audit
about: Kwartaalaudit — onafhankelijk van Sentry-meldingen
title: 'Periodieke code-audit Q[X] [JAAR]'
labels: audit
assignees: ''
---

## Doel

Deze audit is bewust onafhankelijk van Sentry-meldingen. Sentry signaleert
problemen nadat ze opgetreden zijn. Deze audit zoekt structurele risico's
voordat ze optreden.

Achtergrond: de audit van 2026-04-12 vond drie kritieke kwetsbaarheden die
alleen zichtbaar waren door de volledige codebase langs vaste risico-assen
te lopen — niet via Sentry of een specifieke bugmelding.

---

## Voorbereiding

- [ ] `npm run lint:patronen` uitvoeren — zijn er nieuwe verboden patronen?
- [ ] `npm run test:run` uitvoeren — zijn alle tests groen?
- [ ] Sentry-feed bekijken: terugkerende fouten die nog niet als gebruikerssituatie herkend zijn?
- [ ] GitHub Actions health check logs bekijken — DB-bereikbaarheid, Edge Functions, Cloudflare Pages.

---

## Structurele risico-assen

De assen staan op volgorde van historisch risico — begin bovenaan.

### 1. Supabase queries (hoogste risico)
- [ ] Zijn er nieuwe `.single()`-aanroepen na UPDATE of SELECT?
      → Overweeg `.maybeSingle()` + null-check. `.single()` is alleen veilig na INSERT met client-side UUID.
- [ ] Zijn er nieuwe queries zonder RLS-compatibel filter (bijv. ontbrekend `.eq('potje_id', ...)`)?
- [ ] Zijn er nieuwe `Promise.all`-blokken zonder foutafhandeling per resultaat?
- [ ] Zijn alle nieuwe Supabase-aanroepen gewrapped in `metTimeout()`?

### 2. Race conditions en null-guards
- [ ] Zijn er nieuwe async submit-handlers zonder `bezigRef`-guard tegen dubbele submit?
- [ ] Zijn er nieuwe functies die een state-waarde gebruiken die tussen render en aanroep null kan worden?
      (bijv. `deelnemer?.id` zonder guard vóór de async call)
- [ ] Zijn er nieuwe async functies zonder try/catch?

### 3. Foutafhandeling
- [ ] Zijn er nieuwe gebruikerssituaties die naar Sentry gaan maar dat niet zouden moeten?
      → Voeg toe aan `isGebruikersFout` in `logFout.js` én `vertaalFout.js`
- [ ] Zijn er nieuwe foutpaden die geen Nederlandse gebruikerstekst geven?
- [ ] Is `vertaalFout.js` volledig voor alle bekende Supabase/PostgREST-codes?
- [ ] Bevatten alle nieuwe catch-blokken `logFout()` (niet een hardcoded string)?

### 4. Realtime handlers
- [ ] Zijn er nieuwe `payload.new`-aanroepen zonder null-check?
- [ ] Zijn er abonnementen op `event: '*'` die DELETE-events niet verwachten?

### 5. Apparaatidentificatie en opslag
- [ ] Zijn er nieuwe directe `localStorage.getItem/setItem/removeItem`-aanroepen buiten `storage.js`?
- [ ] Zijn er nieuwe directe `sessionStorage`-aanroepen buiten `formulierBuffer.js`?
- [ ] Gebruikt elke hook/component die het device-ID nodig heeft `useDeviceId()`?

### 6. Testdekking
- [ ] Zijn er nieuwe pure functies of beslissingslogica zonder unit test?
- [ ] Zijn er recent gewijzigde functies waarvan de test niet is meegewijzigd?
- [ ] Is de dekkingtabel in TO §18 nog actueel (testcount, nieuwe categorieën)?

### 7. Documentatie en patronen
- [ ] Zijn FO en TO in sync met de code? (versienummers, wijzigingslogs, datums)
- [ ] Zijn er functies met verouderd commentaar na een recente fix?
- [ ] Zijn er nieuwe patronen die toegevoegd moeten worden aan `scripts/controleer-patronen.js`?
- [ ] Zijn er nieuwe inline `style={{}}`-attributen buiten de gedocumenteerde uitzonderingen?

---

## Bevindingen

| # | Bestand | Beschrijving | Severity | Gevonden in | Status | Actie |
|---|---|---|---|---|---|---|
| | | | Critical / High / Medium / Low | audit datum | Open / Afgelost / Geaccepteerd | |

---

## Actiepunten

| # | Bevinding | Eigenaar | Deadline | Status |
|---|---|---|---|---|
| | | | | |

---

## Uitgevoerd door

## Datum

## Volgende audit gepland op
