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
- [ ] Sentry-feed bekijken: terugkerende fouten die nog niet als
      gebruikerssituatie herkend zijn (gaan naar Sentry maar zijn geen bugs)?

---

## Structurele risico-assen

### Apparaatidentificatie
- [ ] Zijn er nieuwe `localStorage.getItem(DEVICE_ID_KEY)`-aanroepen buiten `useDeviceId.js`?
- [ ] Gebruikt elke hook/component die device-ID nodig heeft `useDeviceId()`?

### Supabase queries
- [ ] Zijn er nieuwe `.single()`-aanroepen na UPDATE of SELECT (niet INSERT)?
      → Overweeg `.maybeSingle()` + null-check
- [ ] Zijn er nieuwe `Promise.all`-blokken zonder foutafhandeling per resultaat?
- [ ] Zijn er nieuwe queries zonder RLS-compatible filter (bijv. ontbrekende `.eq('potje_id', ...)`)?

### Realtime handlers
- [ ] Zijn er nieuwe `payload.new`-aanroepen zonder null-check?
- [ ] Zijn er abonnementen op `event: '*'` die DELETE-events niet verwachten?

### Foutafhandeling
- [ ] Zijn er nieuwe gebruikerssituaties die naar Sentry gaan maar dat niet zouden moeten?
      → Voeg toe aan `isGebruikersFout` in `logFout.js` + `vertaalFout.js`
- [ ] Zijn er nieuwe foutpaden die geen Nederlandse gebruikerstekst geven?
- [ ] Is `vertaalFout.js` volledig voor alle bekende Supabase/PostgREST-codes?

### Race conditions en null-guards
- [ ] Zijn er nieuwe functies die een state-waarde gebruiken die tussen
      render en aanroep null kan worden? (bijv. `deelnemer.id` zonder guard)
- [ ] Zijn er nieuwe async functies zonder try/catch?

### Testdekking
- [ ] Zijn er nieuwe pure functies of beslissingslogica zonder test?
- [ ] Zijn er recent gewijzigde functies waarvan de test niet is meegewijzigd?
- [ ] Is de dekkingtabel in TO §18 nog actueel?

### Documentatie
- [ ] Zijn FO en TO in sync met de code? (versienummers, wijzigingslogs)
- [ ] Zijn er functies met verouderd commentaar na een fix?
- [ ] Zijn er nieuwe patronen die toegevoegd moeten worden aan
      `scripts/controleer-patronen.js`?

---

## Bevindingen

| # | Bestand | Beschrijving | Severity | Actie |
|---|---|---|---|---|
| | | | | |

## Uitgevoerd door

## Datum

## Volgende audit gepland op

