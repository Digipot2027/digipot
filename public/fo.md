# Functioneel Ontwerp – Digipot

## Wijzigingslog

| Datum      | Wijziging                         | Reden                          | Impact                        |
|------------|-----------------------------------|--------------------------------|-------------------------------|
| 2026-03-20 | Initieel FO opgesteld             | Documentatie aanmaken          | Geen                          |

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

- De aanmaker vult een naam in voor het potje (max. 50 tekens in de UI, max. 30 tekens in de database).
- Na aanmaken wordt de gebruiker doorgestuurd naar de potje-pagina.
- Er wordt een unieke link gegenereerd op basis van het potje-ID.

**Validaties:**
- Naam is verplicht.
- Naam mag niet leeg zijn (na trimmen).
- Naam mag maximaal 50 tekens bevatten.

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

**Validaties:**
- Bedrag is verplicht en moet tussen €0,01 en €999,99 liggen.
- Alleen eigen deelnemers (herkend via apparaat-ID) kunnen storten.

---

### 3.4 Betaling registreren

- Een deelnemer kan een betaling (bijv. een rondje) registreren ten laste van het potje.
- Het bedrag wordt afgetrokken van het groepssaldo.

**Validaties:**
- Bedrag mag niet hoger zijn dan het actuele potsaldo.
- Bedrag moet tussen €0,01 en €999,99 liggen.

---

### 3.5 Potje sluiten

- Elke deelnemer kan het potje sluiten, mits er minimaal één transactie is geregistreerd.
- Na sluiten is het potje alleen-lezen en wordt de eindafrekening getoond.
- Sluiten is onomkeerbaar.

**Validaties:**
- Er moeten transacties aanwezig zijn.
- Het potje moet de status `open` hebben.

---

### 3.6 Eindafrekening

- Na sluiten wordt een afrekenpagina getoond met per deelnemer:
  - Gestort bedrag
  - Aandeel in de uitgaven (op basis van tijdstip van deelname)
  - Verrekening (positief = tegoed, negatief = schuld)
- De afrekening gebruikt tijdsgewogen verdeling: deelnemers betalen alleen mee aan uitgaven die zijn gedaan nadat zij zijn ingestapt.

---

## 4. Realtime synchronisatie

De applicatie luistert via Supabase Realtime naar drie typen databasewijzigingen:

| Kanaal         | Trigger                          | Effect in de UI                    |
|----------------|----------------------------------|------------------------------------|
| potjes         | Statuswijziging (bijv. sluiten)  | Potje-state wordt bijgewerkt       |
| deelnemers     | Nieuwe deelnemer (INSERT)        | Deelnemerslijst wordt aangevuld    |
| transacties    | Nieuwe transactie (INSERT)       | Transactielijst wordt aangevuld    |

Bij verbindingsverlies toont de app een waarschuwingsbanner. Wijzigingen worden dan niet opgeslagen totdat de verbinding is hersteld.

---

## 5. Gebruikersinterface

### 5.1 Schermen

| Scherm                | Route            | Beschrijving                             |
|-----------------------|------------------|------------------------------------------|
| Nieuw potje           | `/`              | Formulier om een potje aan te maken      |
| Potje                 | `/potje/:id`     | Hoofdscherm met transacties en acties    |
| Eindafrekening        | (inline)         | Getoond binnen `/potje/:id` na sluiten   |

### 5.2 Modals

| Modal           | Trigger                        | Beschrijving                          |
|-----------------|--------------------------------|---------------------------------------|
| Deelnemen       | Eerste bezoek aan potje-link   | Naam invoeren om deel te nemen        |
| Storting        | Knop "Storten"                 | Bedrag invoeren voor storting         |
| Betaling        | Knop "Rondje betaald"          | Bedrag invoeren voor betaling         |
| Potje sluiten   | Knop "Potje sluiten"           | Bevestigingsdialoog                   |

### 5.3 Feedback aan gebruiker

- **Toast-meldingen:** korte bevestigingen na acties (3 seconden zichtbaar).
- **Foutmeldingen:** inline bij formuliervelden of boven de modal.
- **Verbindingsbanner:** zichtbaar bovenaan de pagina bij offline-status.

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
| Hosting             | Netlify (SPA-redirect ingesteld)|
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
