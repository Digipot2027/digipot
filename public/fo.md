# Functioneel Ontwerp – Digipot

## Wijzigingslog

| Datum      | Wijziging                         | Reden                          | Impact                        |
|------------|-----------------------------------|--------------------------------|-------------------------------|
| 2026-03-20 | Initieel FO opgesteld             | Documentatie aanmaken          | Geen                          |
| 2026-03-20 | Stap 14: afmelden + uitgaven per deelnemer | Uitbreiding functionaliteit | Deelnemers kunnen zichzelf afmelden; deelnemerstabel toont ingelegd én uitgegeven |
| 2026-03-24 | Stap 15a: RLS-policy transacties  | Database-niveau beveiliging    | Afgemelde deelnemers kunnen geen transacties meer invoeren via de database |
| 2026-03-24 | Stap 15b: Verbeterde visuele indicatie | UX-verbetering           | Afgemelde deelnemers zichtbaar via doorstreeping, grijze achtergrond en badge "Afgemeld" |
| 2026-03-24 | Stap 15e: Formulierblokkering voor afgemelde deelnemers | Defense-in-depth | ModalTransactie disabled + melding; handleTransactie gooit NIET_ACTIEF-fout |
| 2026-03-24 | Stap 15c: Eindafrekening voor afgemelde deelnemers | Fairness-regel   | Nieuwe sluitingslogica: niet-actieve deelnemers betalen nooit meer dan gestort; tekort verdeeld over actieve deelnemers |
| 2026-03-24 | Stap 16: UX-audit verbeteringen (alle behalve K2+G7) | Usability & accessibility | K1 MAX_NAAM fix, K3 contrast, K4 ARIA+focus-trap+Escape, K5 undo-transactie, G1 onboarding, G2 deel-link kaart, G3 "Gestort", G4 bottom-sheet, G5 touch target, G6 betaalknop, V1–V9 diversen |
| 2026-03-26 | Hostingplatform gecorrigeerd van Netlify naar Cloudflare Pages | Correctie onjuiste documentatie | Sectie 6 bijgewerkt |
| 2026-03-26 | Security: RLS ingeschakeld op alle tabellen (stap 18) | Critical security audit | Alle data beveiligd op databaseniveau; anon key alleen leestoegang tenzij geautoriseerd |
| 2026-03-26 | Security: undo-delete beveiligd met eigenaarschapscheck + saldo-check | Critical security audit | Gebruikers kunnen alleen eigen transacties ongedaan maken; storting-undo geblokkeerd als saldo ontoereikend |
| 2026-03-26 | UX: bevestigingsdialoog toegevoegd bij afmelden (ModalAfmelden) | High UX audit | Afmelden vereist nu expliciete bevestiging met waarschuwing over onomkeerbaarheid |
| 2026-03-26 | UX: helpteksten afmelden/sluiten zichtbaar op mobiel | High UX audit | title-attribuut vervangen door inline helptekst (werkt op touch) |
| 2026-03-26 | UX: terugknoppen gebruiken navigate(-1) i.p.v. hardcoded pad | High UX audit | Profiel, Open potjes, Gesloten potjes navigeren correct terug via browserhistory |
| 2026-03-26 | UX: profielnaam-vergelijking synchroon via useRef | Bug fix | Opslaan-knop toont correct enabled/disabled-staat na opslaan of verwijderen |
| 2026-03-26 | WCAG 1.3.1: deelnemerlijst omgezet naar semantische table | Critical accessibility audit | Screenreaders koppelen kolomhoofden correct aan celwaarden |
| 2026-03-26 | WCAG 2.4.7: focus-ring toegevoegd op knoppen en tabelrijen | High accessibility audit | Toetsenbordgebruikers zien zichtbare focus bij navigatie |
| 2026-03-26 | WCAG 2.1.1: Escape-toets in DeelnemerDetailSheet | High accessibility audit | Sheet sluit bij Escape, consistent met alle andere modals |
| 2026-03-26 | WCAG 4.1.3: role=status + aria-live op toast | High accessibility audit | Screenreaders kondigen statusberichten aan zonder gebruiker te onderbreken |
| 2026-03-26 | Fix: naam-match case-insensitief via ilike | Medium security/UX audit | Profielnaam "jan" matcht nu ook deelnemer "Jan" in Open/Gesloten potjes |

---

## 1. Inleiding

Digipot is een mobiele webapplicatie waarmee groepen gezamenlijk een digitaal potje kunnen beheren. Deelnemers storten geld, betalen rondes en krijgen aan het einde een eerlijke afrekening op basis van wanneer ze zijn ingestapt.

De applicatie vereist geen account of login. Identificatie verloopt via een apparaat-ID dat in de lokale opslag van de browser wordt opgeslagen.

---

## 2. Gebruikersrollen

| Rol         | Omschrijving                                              |
|-------------|-----------------------------------------------------------|
| Aanmaker    | Maakt het potje aan en krijgt automatisch de eerste link  |
| Deelnemer   | Stapt in via de gedeelde link en neemt deel aan het potje |

Er is geen technisch onderscheid in rechten. Iedere deelnemer kan storten, betalingen registreren en het potje sluiten (mits er transacties zijn).

---

## 3. Functionaliteiten

### 3.1 Potje aanmaken

- De aanmaker vult een naam in voor het potje (max. 30 tekens, overeenkomstig de database-constraint).
- Na aanmaken wordt de gebruiker doorgestuurd naar de potje-pagina.
- Er wordt een unieke link gegenereerd op basis van het potje-ID.

**Validaties:**
- Naam is verplicht.
- Naam mag niet leeg zijn (na trimmen).
- Naam mag maximaal 30 tekens bevatten (K1: UI en database consistent).

---

### 3.2 Deelnemen aan potje

- Nieuwe deelnemers die de link openen, krijgen een modal te zien om een naam in te voeren.
- Per apparaat kan een deelnemer maar één keer deelnemen aan hetzelfde potje.
- Dubbele namen binnen één potje zijn niet toegestaan.

**Validaties:**
- Naam is verplicht.
- Naam mag niet al in gebruik zijn binnen het potje (databaseconstraint: uniek op `potje_id + naam`).
- Een apparaat kan slechts één keer deelnemen (databaseconstraint: uniek op `potje_id + device_id`).

---

### 3.3 Storten

- Een deelnemer kan een bedrag storten in het potje.
- Stortingen worden direct zichtbaar voor alle deelnemers via realtime synchronisatie.
- Alleen actieve deelnemers kunnen storten.

**Validaties:**
- Bedrag is verplicht en moet tussen €0,01 en €999,99 liggen.
- Alleen eigen deelnemers (herkend via apparaat-ID) kunnen storten.
- Deelnemer moet actief zijn (niet afgemeld).
- **Database-niveau:** RLS-policy op `transacties` blokkeert INSERT als de deelnemer niet actief is (`actief = true` vereist).

---

### 3.4 Betaling registreren

- Een deelnemer kan een betaling (bijv. een rondje) registreren ten laste van het potje.
- Het bedrag wordt afgetrokken van het groepssaldo.
- Alleen actieve deelnemers kunnen betalingen registreren.

**Validaties:**
- Bedrag mag niet hoger zijn dan het actuele potsaldo.
- Bedrag moet tussen €0,01 en €999,99 liggen.
- Deelnemer moet actief zijn (niet afgemeld).
- **Database-niveau:** dezelfde RLS-policy op `transacties` blokkeert INSERT voor afgemelde deelnemers.

---

### 3.5 Afmelden

- Een deelnemer kan zichzelf afmelden via de knop "👋 Afmelden" op de potje-pagina.
- Een afgemelde deelnemer telt niet meer mee bij toekomstige betalingen.
- Historische betalingen (vóór het afmeldmoment) blijven ongewijzigd verdeeld.
- Afmelden is **onomkeerbaar** — een afgemelde deelnemer kan niet opnieuw worden aangemeld.
- Vóór het afmelden verschijnt een bevestigingsdialoog (ModalAfmelden) met een waarschuwing over de drie gevolgen: niet meer meetellen bij betalingen, geen heractivatie mogelijk, inleg blijft zichtbaar.
- Afgemelde deelnemers worden in de deelnemerslijst getoond met verminderde opaciteit, doorstreepte naam, lichtgrijze achtergrond en een badge "Afgemeld".
- Storten en betalingen registreren is uitgeschakeld voor afgemelde deelnemers op vier niveaus:
  1. **Knoppen uitgeschakeld** — "Storten" en "Rondje betaald" zijn disabled; er verschijnt de melding *"Je hebt je afgemeld en kunt geen transacties meer invoeren."*
  2. **Formulier disabled** — als `ModalTransactie` toch wordt geopend, zijn het invoerveld en de bevestigingsknop uitgeschakeld.
  3. **Handler-guard** — `handleTransactie()` gooit een `NIET_ACTIEF`-fout vóór elke databaseaanroep.
  4. **Database-niveau** — RLS blokkeert INSERT voor afgemelde deelnemers.

**Datamodel:**
- `actief boolean DEFAULT true` — geeft aan of de deelnemer actief meedoet.
- `afgemeld_op timestamptz` — tijdstip van afmelden, gebruikt voor tijdgebaseerde verdelingsberekening.

---

### 3.6 Potje sluiten

- Elke deelnemer kan het potje sluiten, mits er minimaal één transactie is geregistreerd.
- Na sluiten is het potje alleen-lezen en wordt de eindafrekening getoond.
- Sluiten is onomkeerbaar.

**Validaties:**
- Er moeten transacties aanwezig zijn.
- Het potje moet de status `open` hebben.

---

### 3.7 Eindafrekening

- Na sluiten wordt een afrekenpagina getoond met per deelnemer:
  - Gestort bedrag
  - Aandeel in de uitgaven (op basis van tijdstip van deelname en actief-status)
  - Verrekening (positief = tegoed, negatief = schuld)
- De afrekening gebruikt tijdsgewogen verdeling: deelnemers betalen alleen mee aan uitgaven die zijn gedaan nadat zij zijn ingestapt én terwijl zij actief waren.
- Afgemelde deelnemers worden getoond met doorstreepte naam en "Afgemeld"-badge.

**Sluitingslogica voor niet-actieve deelnemers:**

| Situatie | Uitkomst |
|---|---|
| Aandeel < gestort | Ontvangt het verschil terug (positieve verrekening) |
| Aandeel > gestort, maar ≤ 2× gestort | Ontvangt een tikkie voor het verschil (negatieve verrekening, maar nooit meer dan gestort) |
| Aandeel > 2× gestort (extreme cap) | Verrekening = −gestort; het resterende tekort wordt gelijkelijk verdeeld over actieve deelnemers |

**Sluitingslogica voor actieve deelnemers:**
- Zelfde normale berekening (gestort − aandeel).
- Plus hun evenredig aandeel in het tekort van gecapte inactieve deelnemers (gelijk deel per actieve deelnemer).

---

## 4. Realtime synchronisatie

De applicatie luistert via Supabase Realtime naar drie typen databasewijzigingen:

| Kanaal         | Trigger                          | Effect in de UI                    |
|----------------|----------------------------------|------------------------------------|
| potjes         | Statuswijziging (bijv. sluiten)  | Potje-state wordt bijgewerkt       |
| deelnemers     | INSERT (nieuwe deelnemer)        | Deelnemerslijst wordt aangevuld    |
| deelnemers     | UPDATE (bijv. afmelden)          | Deelnemersstatus wordt bijgewerkt  |
| transacties    | Nieuwe transactie (INSERT)       | Transactielijst wordt aangevuld    |

Bij verbindingsverlies toont de app een waarschuwingsbanner. Wijzigingen worden dan niet opgeslagen totdat de verbinding is hersteld.

---

## 5. Gebruikersinterface

### 5.1 Hoofdschermen

| # | Schermnaam      | Route                    | Beschrijving                                      | Tandwiel |
|---|-----------------|--------------------------|---------------------------------------------------|----------|
| 1 | Aanmaken        | `/`                      | Formulier om een potje aan te maken               | ✅        |
| 2 | Deelnemer       | `/potje/:id` (modal)     | Naam invoeren om deel te nemen                    | ❌        |
| 3 | Storten         | `/potje/:id/storten`     | Bedrag kiezen en storten                          | ❌        |
| 4 | Overzicht       | `/potje/:id`             | Hoofdscherm met deelnemers en acties              | ✅        |
| 5 | Eindafrekening  | `/potje/:id` (inline)    | Getoond na sluiten; per deelnemer afrekening      | ✅        |

### 5.2 Instellingenschermen

| # | Schermnaam      | Route                        | Beschrijving                                      |
|---|-----------------|------------------------------|---------------------------------------------------|
| S1 | Instellingen   | `/instellingen`              | Navigatiehub naar sub-schermen                    |
| S2 | Open potjes    | `/instellingen/open`         | Lijst van actieve potjes op dit apparaat          |
| S3 | Gesloten potjes| `/instellingen/gesloten`     | Lijst van afgeronde potjes met eigen verrekening  |
| S4 | Profiel        | `/instellingen/profiel`      | Naam instellen en tekstgrootte kiezen             |

### 5.3 Modals

| Modal           | Trigger                        | Beschrijving                                        |
|-----------------|--------------------------------|-----------------------------------------------------|
| Deelnemen       | Eerste bezoek aan potje-link   | Naam invoeren om deel te nemen                      |
| Transactie      | Knop "Betaald"                 | Bedrag invoeren voor betaling uit het potje         |
| Afmelden        | Knop "👋 Afmelden"              | Bevestigingsdialoog met waarschuwing (onomkeerbaar) |
| Potje sluiten   | Knop "🔒 Pot sluiten"          | Bevestigingsdialoog (onomkeerbaar)                  |

### 5.4 Feedback aan gebruiker

- **Toast-meldingen:** korte bevestigingen na acties, met optionele undo-knop (10 seconden zichtbaar). Aangekondigd via `role="status"` en `aria-live="polite"`.
- **Foutmeldingen:** inline bij formuliervelden of in de modal.
- **Verbindingsbanner:** fixed bovenaan de pagina bij offline-status.
- **Helpteksten:** zichtbaar onder uitgeschakelde knoppen op mobiel (vervangt `title`-attribuut).

---

## 6. Technische randvoorwaarden

| Onderdeel           | Keuze                          |
|---------------------|--------------------------------|
| Frontend framework  | React 19                       |
| Routing             | React Router 7                 |
| Build tool          | Vite 8                         |
| Backend / database  | Supabase (PostgreSQL + Realtime)|
| Authenticatie       | Geen — apparaat-ID via localStorage |
| Taal / locale       | Nederlands (nl-NL)             |
| Hosting             | Cloudflare Pages               |
| Valuta-notatie      | €0,00 (Nederlandse notatie)    |

---

## 7. Gegevensmodel

### Tabel: `potjes`

| Kolom        | Type        | Beschrijving                         |
|--------------|-------------|--------------------------------------|
| id           | UUID        | Primaire sleutel                     |
| naam         | text        | Naam van het potje (max. 30 tekens)  |
| status       | text        | `open` of `gesloten`                 |
| gesloten_op  | timestamptz | Tijdstip van sluiten                 |
| gesloten_door| UUID        | Deelnemer-ID die heeft gesloten      |

### Tabel: `deelnemers`

| Kolom        | Type        | Beschrijving                         |
|--------------|-------------|--------------------------------------|
| id           | UUID        | Primaire sleutel                     |
| potje_id     | UUID        | Verwijzing naar `potjes`             |
| naam         | text        | Naam van de deelnemer                |
| device_id    | text        | Uniek apparaat-ID (localStorage)     |
| aangemaakt_op| timestamptz | Tijdstip van deelname                |
| actief       | boolean     | `true` = actief, `false` = afgemeld  |
| afgemeld_op  | timestamptz | Tijdstip van afmelden (null = actief)|

**Constraints:** uniek op `(potje_id, naam)` en `(potje_id, device_id)`.

### Tabel: `transacties`

| Kolom        | Type        | Beschrijving                         |
|--------------|-------------|--------------------------------------|
| id           | UUID        | Primaire sleutel                     |
| potje_id     | UUID        | Verwijzing naar `potjes`             |
| deelnemer_id | UUID        | Verwijzing naar `deelnemers`         |
| type         | text        | `storting` of `betaling`             |
| bedrag       | numeric     | Bedrag in euro (€0,01 – €999,99)     |
| aangemaakt_op| timestamptz | Tijdstip van registratie             |

---

*Dit document wordt bijgehouden conform de synchronisatieregel: elke codewijziging vereist een update van dit FO inclusief een entry in de wijzigingslog.*
