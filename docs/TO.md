# Technisch Ontwerp — Digipot

**Versie:** 1.3
**Datum:** 2026-04-03
**Status:** Actueel
**Auteur:** Projectteam Digipot

---

## Inhoudsopgave

1. Systeemoverzicht
2. Stack en dependencies
3. Projectstructuur
4. Routering
5. Datamodel
6. Supabase — databaseconstraints en RLS
7. Realtime synchronisatie
8. Componenten
9. Pagina's
10. Hooks
11. Utilities
12. State management
13. Gebruikersidentificatie
14. Berekenlogica
15. Foutafhandeling en logging
16. Beveiliging
17. Toegankelijkheid (WCAG 2.1/2.2 AA)
18. Testen
19. Build en deployment
20. Uitgestelde functionaliteit — Multicurrency
21. Wijzigingslog

---

## 1. Systeemoverzicht

Digipot is een client-side React-applicatie die communiceert met een Supabase-backend (PostgreSQL + Realtime). Er is geen eigen server, geen sessiebeheer en geen authenticatie. De applicatie is een SPA (Single Page Application) gebouwd met Vite.

```
Browser (React SPA)
    │
    ├── Supabase REST API  (CRUD via postgrest)
    ├── Supabase Realtime  (WebSocket — Postgres Changes)
    └── Sentry             (foutlogging, alleen productie)
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
| Testen | Vitest + @testing-library/react | — |
| Test-DOM | @testing-library/jest-dom | — |
| Testomgeving | jsdom | — |
| TypeScript | Nee | — |
| UI-library | Nee (eigen CSS-variabelen) | — |
| Global state | Nee (lokale state per hook/component) | — |

### Omgevingsvariabelen (`.env.local`)

| Variabele | Gebruik |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project-URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonieme sleutel (publiek) |
| `VITE_SENTRY_DSN` | Sentry DSN (optioneel, alleen productie) |

Beide Supabase-variabelen worden gevalideerd bij opstarten in `supabaseClient.js`. Ontbrekende variabelen gooien een `Error` vóór de app rendert.

---

## 3. Projectstructuur

```
digipot/
├── docs/
│   ├── FO.md                  ← Functioneel Ontwerp
│   └── TO.md                  ← Technisch Ontwerp (dit document)
├── public/
├── src/
│   ├── App.jsx                ← routedefinities
│   ├── main.jsx               ← entry point, Sentry init, tekstgrootte
│   ├── index.css              ← globale stijlen en CSS-variabelen
│   ├── supabaseClient.js      ← Supabase client (singleton)
│   ├── constants.js           ← centrale constanten
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
│   │   ├── valideer.js
│   │   └── vertaalFout.js
│   └── test/
│       ├── setup.js
│       ├── berekenSaldi.test.js
│       ├── berekenSaldi.regressie.test.js
│       ├── berekenVereffening.test.js
│       ├── deelLink.test.js
│       ├── deelnemerRij.regressie.test.js
│       ├── errorBoundary.regressie.test.js
│       ├── filterLogica.regressie.test.js
│       ├── formatBedrag.test.js
│       ├── handleUndo.regressie.test.js
│       ├── logFout.supabase.test.js
│       ├── logFout.test.js
│       ├── paginaEindafrekening.regressie.test.js
│       ├── paginaStorten.gesloten.regressie.test.js
│       ├── paginaStorten.regressie.test.js
│       ├── stap1.regressie.test.js
│       ├── stap6.regressie.test.js
│       ├── useDeviceId.regressie.test.js         ← nieuw (SEC-M1)
│       ├── useMijnPotjes.eq.regressie.test.js    ← nieuw (SEC-H2)
│       ├── useMijnPotjes.herlaad.test.js
│       ├── useMijnPotjes.regressie.test.js
│       ├── usePotje.delete.regressie.test.js     ← nieuw (SEC-L2)
│       ├── usePotje.regressie.test.js
│       ├── usePotjeActies.regressie.test.js
│       ├── valideer.test.js
│       ├── vertaalFout.nieuw.test.js
│       └── vertaalFout.test.js
├── supabase-migratie-stap14.sql … stap22.sql
├── supabase-verificatie.sql
├── vite.config.js
├── eslint.config.js
└── package.json
```

---

## 4. Routering

React Router 7, `BrowserRouter`, client-side routing.

| Route | Component | Beschrijving |
|---|---|---|
| `/` | `PaginaNieuwPotje` | Aanmaken |
| `/potje/:id` | `PaginaPotje` | Overzicht, Deelnemer-modal of Eindafrekening |
| `/potje/:id/storten` | `PaginaStorten` | Storten/Inleggen |
| `/instellingen` | `PaginaInstellingen` | Instellingen |
| `/instellingen/profiel` | `PaginaProfiel` | Profiel |
| `/instellingen/open` | `PaginaOpenPotjes` | Open potjes |
| `/instellingen/gesloten` | `PaginaGeslotenPotjes` | Gesloten potjes |
| `*` | `PaginaNietGevonden` | Catch-all voor onbekende routes |

`PaginaEindafrekening` is geen eigen route. Het wordt inline gerenderd door `PaginaPotje` wanneer `potje.status === 'gesloten'`.

`ErrorBoundary` omhult de gehele routerstructuur en vangt onverwachte renderfouten op.

---

## 5. Datamodel

### Tabel: `potjes`

| Kolom | Type | Constraint |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `naam` | varchar(30) | NOT NULL |
| `status` | text | DEFAULT 'open', CHECK IN ('open','gesloten') |
| `valuta` | varchar(3) | DEFAULT 'EUR' |
| `aangemaakt_op` | timestamptz | DEFAULT now() |
| `gesloten_op` | timestamptz | nullable |
| `gesloten_door` | uuid | nullable, FK → deelnemers.id |

### Tabel: `deelnemers`

| Kolom | Type | Constraint |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `potje_id` | uuid | NOT NULL, FK → potjes.id |
| `naam` | varchar(30) | NOT NULL |
| `device_id` | uuid | nullable |
| `actief` | boolean | DEFAULT true |
| `aangemaakt_op` | timestamptz | DEFAULT now() |
| `afgemeld_op` | timestamptz | nullable |

Unieke constraints: `(potje_id, naam)` en `(potje_id, device_id)`.

### Tabel: `transacties`

| Kolom | Type | Constraint |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `potje_id` | uuid | NOT NULL, FK → potjes.id |
| `deelnemer_id` | uuid | NOT NULL, FK → deelnemers.id |
| `type` | text | CHECK IN ('storting','betaling') |
| `bedrag` | numeric(10,2) | CHECK BETWEEN 0.01 AND 999.99 |
| `aangemaakt_op` | timestamptz | DEFAULT now() |

---

## 6. Supabase — databaseconstraints en RLS

### Primaire beveiligingsregel (V2)

Een databasetrigger blokkeert elke betaling waarbij `SUM(betalingen) > SUM(stortingen)` voor dat potje. Dit is de server-side waarborg; de client doet een aanvullende pre-check.

### Row Level Security

RLS is ingeschakeld op alle tabellen. Policies staan gedefinieerd in `supabase-migratie-stap18-rls.sql` en `supabase-migratie-stap22-rls-herstel.sql`. De anonieme sleutel (`anon`) heeft read-toegang tot potjes en deelnemers van potjes waarbij het device betrokken is.

### Levenscyclus

Potjes ouder dan 24 uur zonder transacties worden automatisch gesloten. Potjes ouder dan 7 dagen worden verwijderd. Dit is geïmplementeerd via een geplande Supabase-job (zie `supabase-migratie-stap19-lifecycle.sql`).

---

## 7. Realtime synchronisatie

`usePotje` opent één Supabase-kanaal met **vijf** Postgres Changes-abonnementen per potje:

| Tabel | Event | Actie |
|---|---|---|
| `potjes` | `*` | `setPotje(payload.new)` |
| `deelnemers` | `INSERT` | Deelnemer toevoegen (gesorteerd op `aangemaakt_op`) |
| `deelnemers` | `UPDATE` | Deelnemer bijwerken (incl. eigen deelnemer bij afmelden) |
| `transacties` | `INSERT` | Transactie toevoegen aan state |
| `transacties` | `DELETE` | Transactie verwijderen uit state (SEC-L2 — undo zichtbaar zonder refresh) |

**SEC-L2 toelichting:** Bij een DELETE-event geeft Supabase bij actieve RLS alleen `payload.old.id` terug (het primaire sleutelveld). De reducer filtert puur op dat id: `prev.filter(t => t.id !== verwijderdId)`. Ontbrekend of null id wordt defensief afgevangen (lijst ongewijzigd).

Online/offline wordt bijgehouden via:
- `window.addEventListener('online' / 'offline')`
- Supabase-kanaalstatus: `status === 'SUBSCRIBED'` → online

Kanaal wordt opgeruimd via `supabase.removeChannel(kanaal)` in de cleanup-functie van `useEffect`.

---

## 8. Componenten

### `DeelKnop`

Deelknop die zich aanpast aan platform:
- Mobiel (iOS/Android, via `navigator.share` + user agent check): native share sheet, tekst "👥 Nodig vrienden uit"
- Desktop: klembord-kopiëren, tekst "🔗 Link kopiëren"
- Feedback na kopiëren: tekst wijzigt naar "✅ Link gekopieerd!" voor 2,5 seconden
- `aria-live="polite"` voor screenreader-aankondiging van statuswijziging

### `DeelnemerRij`

Tabelrij voor één deelnemer in het Overzichtscherm.
- `role="button"` + `tabIndex={0}` + `onKeyDown` (Enter/Space) voor toetsenbordtoegang
- Space-handler roept `e.preventDefault()` aan om paginascroll te voorkomen (WCAG 2.1.1)
- Naam-cel: `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap` zodat lange namen bedragkolommen niet wegdrukken
- Badge en pijltje: `flex-shrink: 0` zodat die nooit verdwijnen
- Bedragcellen: `white-space: nowrap`
- `aria-label` op `<tr>` bevat volledige naam (ook als afgekapt)

### `DeelnemerDetailSheet`

Bottom-sheet met details van één deelnemer (naam, ingelegd, betaald, alle transacties gesplitst per type).
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="detail-titel"`
- Tab-trap via `useFocusTrap`
- Initiële focus op sluitknop bij openen (WCAG 2.4.3)
- Sluiten via: sluitknop ✕, "Sluiten"-knop onderaan, klik op backdrop, Escape-toets

### `ErrorBoundary`

React class component. Vangt renderfouten op, logt naar Sentry, toont fallback UI.

### `ModalAfmelden`

Bevestigingsdialoog voor afmelden. Waarschuwingsblok met gevolgen. Onomkeerbaar.
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Tab-trap via `useFocusTrap`

### `ModalDeelnemen`

Formulier voor deelnemen aan een potje.
- Profielnaam vooraf ingevuld indien aanwezig
- Validatie via `valideerDeelnemerNaam()`
- `onAnnuleer` is optioneel (undefined als modal niet sluitbaar is)

### `ModalSluiten`

Bevestigingsdialoog voor sluiten van het potje. Onomkeerbaar.

### `ModalTransactie`

Formulier voor storting of betaling.
- `type`: `'storting'` of `'betaling'`
- Live bedrag-preview bij geldig getal
- Validatie via `valideerTransactieBedrag()`
- Foutafhandeling voor `SALDO_TE_LAAG` en `NIET_ACTIEF` errors

---

## 9. Pagina's

### `PaginaNieuwPotje`

Formulier voor aanmaken potje. Valuta intern vast op `STANDAARD_VALUTA` (`EUR`) — zie §20.

### `PaginaPotje`

Centrale pagina voor `/potje/:id`. Beheert:
- Data via `usePotje(id)`
- Acties via `usePotjeActies(...)`
- Toast-state (inclusief undo-timer via `useRef`)
- Modal-state (`'betaling'` | `'sluiten'` | `null`)
- Conditieel renderen: Deelnemer-modal → Eindafrekening → Overzicht
- `location.state.toast` uitlezen bij aankomst van `PaginaStorten` (eenmalig, daarna state gewist)

**Toast-structuur (UX-3):** de toast gebruikt `.toast-inhoud` (flex-rij met tekst + knop) en `.toast-voortgang` (progressiebalk, alleen bij undo-toast). De duur wordt als CSS custom property `--toast-duur` ingesteld zodat de CSS-animatie synchroon loopt met de JS-timer. De progressiebalk is `aria-hidden="true"` — de tijdsinformatie is niet functioneel voor screenreaders.

**Toast-duren:**
- Undo-toast: 10 000 ms (progressiebalk zichtbaar)
- Info-toast: 5 000 ms
- Overige toasts: 3 000 ms

### `PaginaOverzicht`

Presentatiecomponent zonder eigen data-ophaal. Ontvangt alles via props van `PaginaPotje`.
Eigen lokale state: `gekozenDeelnemer` (voor detail-sheet) en `afmeldenModaal` (boolean voor ModalAfmelden).
Tabel in `overflowX: auto`-wrapper met `table-layout: fixed` en vaste kolombreedtes (72px per bedragkolom). `min-width: 0` op alle gridknoppen.

### `PaginaStorten`

Eigen data-ophaal via `usePotje`. Bevat de snelkeuze-logica en vrij invoerveld als twee exclusieve modi. Bedrag-prioriteit: snelkeuze > vrij invoer. Navigeert na succesvolle storting naar `/potje/:id` met `location.state.toast` voor de bevestigingstoast.

### `PaginaEindafrekening`

Berekent eindafrekening via `berekenEindafrekening()` en vereffening via `berekenVereffening()` — beide geëxporteerd uit `berekenSaldi.js`. Uitklapbare rijen per deelnemer. Tikkie deep link.

### `PaginaInstellingen`

Navigatiekaart naar S2, S3, S4.

### `PaginaOpenPotjes` / `PaginaGeslotenPotjes`

Beide via `useMijnPotjes(status)`. Lege staat + foutstate + retry-knop.

### `PaginaProfiel`

Naam en tekstgrootte. Tekstgrootte wordt direct toegepast via `document.documentElement.setAttribute('data-tekstgrootte', waarde)`. Importeert `PROFIEL_NAAM_KEY`, `TEKSTGROOTTE_KEY` en `MAX_NAAM` uit `constants.js`.

### `PaginaNietGevonden`

Catch-all voor onbekende routes (`*`). Stelt `document.title` in op "Pagina niet gevonden — Digipot" (WCAG 2.4.2). Biedt één uitweg: knop "← Terug naar home".

---

## 10. Hooks

### `useDeviceId`

Leest `digipot_device_id` uit localStorage. Valideert de waarde tegen het UUID v4-patroon (`/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`). Bij afwezigheid of ongeldige waarde: genereert `crypto.randomUUID()`, slaat op, retourneert. Voorkomt dat een gemanipuleerde waarde (bijv. via XSS of browserextensie) wordt gebruikt als device-identiteit. Retourneert altijd een geldige UUID-string.

### `useFocusTrap`

Gedeelde WCAG-hook. Trekt Tab-focus binnen een containerRef. Roept `onEscape` aan bij Escape-toets. Optionele selector voor focusbare elementen.

### `usePotje`

Laadt potje, deelnemers en transacties parallel via `Promise.all`. Opent **vijf** Supabase Realtime-abonnementen (zie §7). Bijhoudt online/offline-status. Retourneert ook state-setters (`setDeelnemer`, `setDeelnemers`, `setTransacties`) zodat consumers lokale updates kunnen doorvoeren zonder refetch.

### `usePotjeActies`

Pure async functies, geen eigen state, geen JSX. Direct unit-testbaar. Acties:

| Functie | Beschrijving |
|---|---|
| `handleDeelnemen(naam)` | INSERT deelnemer, navigeer naar storten |
| `handleTransactie(type, bedrag)` | INSERT transactie, toon toast + undo |
| `handleUndo(transactieId)` | DELETE eigen transactie na veiligheidscheck |
| `handleSluiten()` | UPDATE potje.status → 'gesloten' |
| `handleAfmelden()` | UPDATE deelnemer.actief → false |

`handleUndo` heeft twee veiligheidslagen:
1. Client-check: transactie.deelnemer_id === deelnemer.id
2. Database-check: `.eq('deelnemer_id', deelnemer.id)` in de DELETE-query

### `useMijnPotjes`

Laadt open of gesloten potjes voor het huidige device/profielnaam. Oplossing voor N+1 query probleem: 3 queries totaal ongeacht het aantal potjes.

Strategie:
1. Zoek potje-IDs via twee aparte deelnemer-queries (device_id + `.eq('naam')` — **niet** ilike), gecombineerd client-side
2. Haal potjes op voor die IDs
3. Haal deelnemers + transacties op in twee parallelle queries
4. Verrijk potjes puur client-side (geen extra DB-calls)

`herlaad()` incrementeert een teller die als `useEffect`-dependency dient, zodat de data opnieuw wordt opgehaald.

---

## 11. Utilities

### `berekenSaldi(deelnemers, transacties)`

Berekent lopende saldi tijdens een actief potje. Retourneert: `potTotaal`, `potUitgaven`, `potSaldo`, `deelnemersSaldi[]` met per deelnemer: `gestort`, `betaald`, `aandeel`, `verrekening`.

### `berekenEindafrekening(deelnemers, transacties, sluitTijdstip)`

Berekent definitieve eindafrekening op basis van actief/afgemeld-status op het sluitmoment. Zie §14 voor het volledige rekenmodel.

### `berekenVereffening(deelnemersSaldi)`

Berekent minimale vereffening via greedy algoritme (grootste debiteur aan grootste crediteur). Geëxporteerd uit `berekenSaldi.js`. Gebruikt door `PaginaEindafrekening` via directe import.

### `formatBedrag(bedrag, valuta?, locale?)`

Formatteert een getal als valutastring via `Intl.NumberFormat`. Default: `EUR`, `nl-NL`. Ondersteunt alle ISO 4217-valuta's.

### `parseBedrag(waarde)`

Parseert een string naar number. Accepteert zowel komma als punt als decimaalteken. Retourneert `0` bij lege of null invoer.

### `deelLink(potjeNaam, onSucces, onFout)`

Deelt de huidige URL. Detecteert mobiel via `navigator.share` + user agent. Klembord-fallback via Clipboard API, daarna `execCommand('copy')`.

### `logFout(error, context)`

Logt naar Sentry met context (componentnaam + actie). Roept `vertaalFout()` aan voor Nederlandse gebruikerstekst. Retourneert die tekst.

### `vertaalFout(error)`

Vertaalt Supabase- en netwerk-errors naar Nederlandse gebruikersteksten op basis van error codes en berichten.

### `valideerDeelnemerNaam(naam, deelnemers, opties?)`

Pure validatiefunctie. Controles: leeg, te lang, potje vol, naam bezet (case-insensitief). Retourneert foutstring of `null`.

### `valideerTransactieBedrag(bedragInvoer, bedragNum, opties)`

Pure validatiefunctie. Controles: leeg/NaN/≤0, boven MAX, betaling boven saldo. Retourneert foutstring of `null`.

---

## 12. State management

Er is geen global state store. State leeft op drie niveaus:

| Niveau | Mechanisme | Voorbeelden |
|---|---|---|
| Applicatie-breed | `localStorage` | device_id, profiel_naam, tekstgrootte |
| Pagina/hook | `useState` in hook | potje, deelnemers, transacties, laden, fout |
| Component-lokaal | `useState` in component | modal-state, toast, formuliervelden |

State-setters worden als props doorgegeven van `usePotje` naar `usePotjeActies` zodat lokale optimistische updates mogelijk zijn zonder refetch.

---

## 13. Gebruikersidentificatie

Geen authenticatie. Identificatie werkt via `digipot_device_id` in localStorage:

1. `useDeviceId` leest de sleutel bij elke paginaweergave.
2. Valideert de waarde tegen UUID v4-patroon (`/^[0-9a-f]{8}-...-4...-[89ab]...-...$/i`).
3. Als niet aanwezig of ongeldig: genereert `crypto.randomUUID()`, slaat op, retourneert.
4. Bij deelnemen: UUID wordt opgeslagen als `deelnemers.device_id` in de database.
5. Bij terugkeer: `deelnemers.find(d => d.device_id === deviceId)` identificeert de gebruiker.

**Beperkingen:**
- Wissen van localStorage verbreekt de koppeling (gebruiker wordt als nieuw behandeld).
- Verschillende browsers op hetzelfde apparaat hebben aparte UUIDs.
- Privémodus genereert een tijdelijk UUID dat na sluiten verloren gaat.

---

## 14. Berekenlogica

### Lopende saldi (`berekenSaldi`)

```
potSaldo    = Σ stortingen − Σ betalingen
verrekening = betaald − gestort, min −gestort
```

### Eindafrekening (`berekenEindafrekening`)

```
sluitMs = new Date(potje.gesloten_op).getTime()

wasActiefOp(d, sluitMs):
  - aangemeld_op ≤ sluitMs EN (geen afmelding OF afgemeld_op > sluitMs) → actief
  - afgemeld_op ≤ sluitMs → afgemeld (ook bij gelijke tijdstip)

bijdrageAfgemelden = Σ gestort voor afgemelde deelnemers
resterend          = potUitgaven − bijdrageAfgemelden
factor             = resterend ÷ Σ gestort voor actieve deelnemers

nettoBijdrage (actief)   = gestort × factor
nettoBijdrage (afgemeld) = gestort

verrekening = max(betaald − nettoBijdrage, −gestort)
```

### Vereffeningsalgoritme (`berekenVereffening`)

Greedy pairing: grootste debiteur aan grootste crediteur. Maximaal n−1 transacties voor n deelnemers. Afronden op €0,01.

### Afrondingsregel

`rond(waarde) = Math.round(waarde * 100) / 100`, met correctie voor −0 → 0.

---

## 15. Foutafhandeling en logging

### Principe

Een fout is pas afgehandeld wanneer:
1. De oorzaak is vastgesteld
2. De code is hersteld
3. Een unit test is toegevoegd die herhaling voorkomt

### Implementatie

```
component/hook → logFout(error, context)
                      ├── vertaalFout(error) → Nederlandse gebruikerstekst
                      └── Sentry.captureException(error, { extra: context })
```

Sentry is alleen actief in productie (`import.meta.env.PROD`). In ontwikkeling gaan fouten alleen naar `console.error`.

### Regels

- Nooit een fout tonen zonder te loggen.
- `vertaalFout()` nooit rechtstreeks aanroepen, altijd via `logFout()`.
- Geen persoonsgegevens (namen, bedragen) in Sentry-context.
- Context bevat altijd minimaal: `component` en `actie`.

---

## 16. Beveiliging

### Transactie-eigenaarschap

Undo van een transactie heeft twee controlelagen:
1. Client: `transactie.deelnemer_id === deelnemer.id`
2. Database: `.delete().eq('deelnemer_id', deelnemer.id)`

De client-check geeft directe feedback; de database-check is de bindende beveiliging.

### Saldo-integriteit

Primaire beveiliging via databasetrigger (V2): blokkeert betalingen waarbij `SUM(betalingen) > SUM(stortingen)`. Client-check is aanvullend.

### Input-validatie

Alle invoer wordt gevalideerd op de client (zie `valideer.js`) én gecontroleerd via databaseconstraints. De server is leidend.

### Supabase-injectie

`useMijnPotjes` gebruikt geen string-interpolatie in queries. Device_id en profielnaam worden doorgegeven als geparametriseerde waarden via `.eq()` — nooit via `.ilike()` of string-concatenatie.

### API-sleutels

`.env.local` staat in `.gitignore`. De `anon`-sleutel is publiek zichtbaar in de browser; de server-side sleutel (`service_role`) wordt nooit in de client gebruikt.

### Sentry

`sendDefaultPii: false` — geen persoonlijk identificeerbare informatie naar Sentry.

### Device ID validatie

`useDeviceId` valideert de UUID uit localStorage bij elke sessie. Een ongeldige waarde (bijv. gemanipuleerd door een kwaadaardige browserextensie) wordt genegeerd en vervangen door een nieuw UUID.

---

## 17. Toegankelijkheid (WCAG 2.1/2.2 AA)

| Richtlijn | Implementatie |
|---|---|
| 1.3.1 Info and Relationships | Semantische `<table>` met `<th scope="col">` |
| 1.4.3 Contrast (Minimum) | CSS-variabelen gedocumenteerd met contrastwaarden (min 4,5:1 voor tekst) |
| 1.4.4 Resize Text | `font-size` op `:root` + `rem` overal; drie tekstgrootten (16/19/22px) |
| 2.1.1 Keyboard | Alle interactieve elementen bereikbaar via Tab en Enter/Space; Space roept `e.preventDefault()` aan in `DeelnemerRij` om paginascroll te voorkomen |
| 2.4.2 Page Titled | Unieke `document.title` per scherm via `useEffect`, incl. `PaginaNietGevonden` |
| 2.4.3 Focus Order | Tab-volgorde volgt visuele volgorde; modals + sheets gebruiken `useFocusTrap` + initiële focusset |
| 2.4.7 Focus Visible | `:focus-visible` met 3px blauwe outline op alle knoppen en tabelrijen |
| 4.1.2 Name, Role, Value | `aria-label`, `aria-pressed`, `aria-checked`, `aria-expanded`, `role` op alle interactieve elementen; roving tabindex op radiogroup in `PaginaProfiel` |
| 4.1.3 Status Messages | `role="status"`, `aria-live="polite"`, `aria-atomic="true"` op toasts |

### Radiogroup (PaginaProfiel)

Tekstgrootte-kiezer implementeert roving tabindex:
- Alleen de geselecteerde optie heeft `tabIndex={0}`; de overige hebben `tabIndex={-1}`
- Pijltjestoetsen (`ArrowRight`/`ArrowDown` = volgende, `ArrowLeft`/`ArrowUp` = vorige) wisselen selectie én verplaatsen focus
- `useRef`-array bijhoudt DOM-referenties van alle radio-elementen voor programmatische focus

### Mobiel

- `env(safe-area-inset-*)` voor iPhone notch en home indicator
- `min-height: 48px` op knoppen (Apple HIG touch target)
- `font-size: max(1rem, 16px)` op inputs (voorkomt iOS-zoom)
- `-webkit-tap-highlight-color: transparent`

### Tabelweergave op smalle schermen

- Wrapper `overflowX: auto` + `-webkit-overflow-scrolling: touch`
- `table-layout: fixed` + `<colgroup>` met 72px per bedragkolom
- Naam-cel: `overflow: hidden` + `text-overflow: ellipsis` + `white-space: nowrap`
- `aria-label` op `<tr>` bevat altijd volledige naam

---

## 18. Testen

### Framework

Vitest + @testing-library/react + @testing-library/jest-dom, jsdom-omgeving.

### Teststrategie

Business logic en pure functies worden getest als geëxtraheerde functies — geen Supabase-mock, geen component-mount. Componenten met Supabase-afhankelijkheid worden getest via regressietests op de geëxtraheerde logica.

### Huidige dekking

| Bestand | Type | Wat wordt getest |
|---|---|---|
| `berekenSaldi.test.js` | Unit | Vijf referentiescenario's, alle rekenregels |
| `berekenSaldi.regressie.test.js` | Regressie | Null-transacties, onbekende deelnemer_id, string-bedragen, scenario D |
| `berekenVereffening.test.js` | Unit | Greedy algoritme, minimale transacties |
| `formatBedrag.test.js` | Unit | Opmaak en parseren, komma/punt |
| `logFout.test.js` + `logFout.supabase.test.js` | Unit | Logging, Sentry-routing, Supabase-errors |
| `vertaalFout.test.js` + `vertaalFout.nieuw.test.js` | Unit | Error-vertaling naar nl-NL |
| `valideer.test.js` | Unit | Alle validatiepaden voor naam en bedrag |
| `deelLink.test.js` | Unit | Alle zes share/clipboard-codepaden |
| `handleUndo.regressie.test.js` | Regressie | UD-1 t/m UD-8: eigenaarschap, saldo-check, grenzen |
| `paginaStorten.regressie.test.js` | Regressie | Prioriteitslogica bedrag, grenscondities |
| `paginaStorten.gesloten.regressie.test.js` | Regressie | Gesloten potje-scenario |
| `filterLogica.regressie.test.js` | Regressie | Filter-opbouw useMijnPotjes |
| `useMijnPotjes.regressie.test.js` + `herlaad.test.js` | Regressie | Potje-verrijking, retry |
| `useMijnPotjes.eq.regressie.test.js` | Regressie | SEC-H2: eq vs ilike filtering (EQ-01 t/m EQ-09) |
| `useDeviceId.regressie.test.js` | Regressie | SEC-M1: UUID v4-validatie (UID-01 t/m UID-09) |
| `usePotje.regressie.test.js` | Regressie | Data-ophaal, realtime INSERT-reducers |
| `usePotje.delete.regressie.test.js` | Regressie | SEC-L2: DELETE-reducer (TD-01 t/m TD-08) |
| `usePotjeActies.regressie.test.js` | Regressie | Alle vijf acties |
| `deelnemerRij.regressie.test.js` | Regressie | Render, klasse, afgemeld |
| `errorBoundary.regressie.test.js` | Regressie | Fallback UI, Sentry-aanroep |
| `paginaEindafrekening.regressie.test.js` | Regressie | Eindafrekening render |
| `stap1.regressie.test.js` + `stap6.regressie.test.js` | Regressie | Historische regressiescenario's |

### Niet gedekt (gemotiveerd)

| Component | Reden | Alternatief |
|---|---|---|
| `ModalDeelnemen`, `ModalTransactie`, `ModalAfmelden`, `ModalSluiten` | Supabase-afhankelijkheid; logica zit in `usePotjeActies` (gedekt) | Integratietest / e2e |

### Testcommando's

```bash
npm run test        # watch mode
npm run test:run    # CI-mode (eenmalig)
npm run test:ui     # Vitest UI
```

---

## 19. Build en deployment

```bash
npm run dev       # Vite dev server met HMR
npm run build     # Productie build → dist/
npm run preview   # Preview van productie build
npm run lint      # ESLint
```

---

## 20. Uitgestelde functionaliteit — Multicurrency

### Status

De multicurrency-infrastructuur is volledig aanwezig en functioneel. De UI-keuze op Scherm 1 is tijdelijk verborgen.

### Aanwezig

- `VALUTA_OPTIES` in `constants.js`: EUR, USD, GBP, CHF, DKK, NOK, SEK
- `STANDAARD_VALUTA = 'EUR'` in `constants.js`
- `formatBedrag(bedrag, valuta, locale)` ondersteunt alle ISO 4217-valuta's
- `potjes.valuta` kolom in de database (migratie stap 20-21)
- Valuta wordt doorgegeven aan alle format-aanroepen in de hele applicatie

### Verborgen

`PaginaNieuwPotje` toont geen valutaselect. De `valuta`-state staat vast op `STANDAARD_VALUTA` via `useState(STANDAARD_VALUTA)` zonder setter.

### Activeren

1. Open `PaginaNieuwPotje.jsx`
2. Herstel de import: voeg `VALUTA_OPTIES` toe aan de import uit `constants`
3. Verander `const [valuta] = useState(STANDAARD_VALUTA)` naar `const [valuta, setValuta] = useState(STANDAARD_VALUTA)`
4. Herstel het uitgecommentarieerde `<div className="veld">` blok (het volledige herstelblok staat als commentaar in het bestand)

---

## 21. Wijzigingslog

| Versie | Datum | Wijziging | Reden |
|---|---|---|---|
| 1.0 | 2026-03-01 | Initieel TO opgesteld | Projectstart |
| 1.1 | 2026-04-02 | Valutakeuze verborgen in `PaginaNieuwPotje` (multicurrency uitgesteld); DeelKnop tekst "Nodig vrienden uit" (mobiel); label "nog te besteden" in PaginaOverzicht; tabel mobiel-robuust; FO en TO opgenomen in repository | UX-verbetering, multicurrency uitgesteld, mobiele optimalisatie |
| 1.2 | 2026-04-03 | `PaginaNietGevonden` toegevoegd aan routering; `berekenVereffening` gecorrigeerd; `PaginaOverzicht` state gedocumenteerd; `useDeviceId` UUID-validatie (SEC-M1); `useMijnPotjes` `.ilike()` → `.eq()` (SEC-H2); `DeelnemerRij` Space+preventDefault (WCAG-3); `DeelnemerDetailSheet` initiële focus (WCAG-6); radiogroup roving tabindex `PaginaProfiel` (WCAG-7); location.state-toast gedocumenteerd; beveiligingssectie uitgebreid; WCAG-tabel bijgewerkt | Auditbevindingen 2026-04-03 verwerkt |
| 1.3 | 2026-04-03 | `usePotje`: vijfde abonnement toegevoegd voor transacties DELETE (SEC-L2); §7 tabel bijgewerkt + toelichting RLS payload-beperking; toast-structuur uitgebreid met progressiebalk (UX-3): `.toast-inhoud`, `.toast-voortgang`, `--toast-duur` CSS custom property, `@keyframes toastVoortgang`; `TOAST_DUUR_*` constanten in `PaginaPotje`; drie nieuwe testbestanden: `useDeviceId.regressie.test.js` (UID-01…09), `useMijnPotjes.eq.regressie.test.js` (EQ-01…09), `usePotje.delete.regressie.test.js` (TD-01…08); §3 projectstructuur en §18 dekkingtabel bijgewerkt | Resterende auditpunten SEC-L2, UX-3 en testdekking nieuw geïmplementeerde code |
