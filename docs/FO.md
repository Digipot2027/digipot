# Functioneel Ontwerp — Digipot

**Versie:** 2.0
**Datum:** 2026-04-13
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

## 1. Productbeschrijving

Digipot is een Nederlandse mobiele webapplicatie waarmee groepen gezamenlijke uitgaven bijhouden. Typische use cases zijn vrijmibo, vakanties en uitjes.

De werkwijze is eenvoudig: één persoon maakt een potje aan en deelt de link via WhatsApp, Signal of een ander kanaal. Deelnemers storten virtueel geld in het potje en registreren wat ze namens de groep hebben betaald. Bij het sluiten berekent de app automatisch wie geld terugkrijgt en wie moet bijbetalen.

Er is geen login, geen account en geen betaalintegratie. Alles draait op apparaatidentificatie via een UUID in de browser.

---

## 2. Gebruikers en context

**Primaire gebruiker:** iemand die geen financiële opleiding heeft, smartphone gebruikt, en gewend is aan apps als WhatsApp en Tikkie.

**Apparaat:** primair mobiele telefoon (iOS/Android). Desktop wordt ondersteund maar is secundair.

**Taal:** alle teksten zijn Nederlands (nl-NL).

**Connectiviteit:** de app toont een verbindingsbanner wanneer de verbinding verbroken is. Wijzigingen worden niet opgeslagen zonder verbinding.

---

## 3. Schermen en gebruikersflows

### Overzicht schermen

| # | Schermnaam | Route | Tandwiel |
|---|---|---|---|
| 1 | Aanmaken | `/` | ✅ |
| 2 | Deelnemer | `/potje/:id` (modal) | ❌ |
| 3 | Storten/Inleggen | `/potje/:id/storten` | ❌ |
| 4 | Overzicht | `/potje/:id` | ✅ |
| 5 | Eindafrekening | `/potje/:id` (inline bij gesloten pot) | ✅ |
| S1 | Instellingen | `/instellingen` | — |
| S2 | Open potjes | `/instellingen/open` | — |
| S3 | Gesloten potjes | `/instellingen/gesloten` | — |
| S4 | Profiel | `/instellingen/profiel` | — |
| 404 | Pagina niet gevonden | `*` (catch-all) | — |

### Hoofdflow nieuw potje

```
Aanmaken (1)
    ↓ link delen
Deelnemer (2)  ← bezoeker opent gedeelde link
    ↓ meedoen
Storten (3)
    ↓ gestort
Overzicht (4)
    ↓ potje sluiten
Eindafrekening (5)
```

### Terugkerende bezoeker (herkend apparaat)

```
/potje/:id  →  direct naar Overzicht (4)  [device_id herkend]
```

---

## 4. Scherm 1 — Aanmaken

**Route:** `/`
**Component:** `PaginaNieuwPotje`
**Doel:** een nieuw groepspotje starten.

### Functionaliteit

De gebruiker geeft het potje een naam. Na aanmaken wordt hij doorgestuurd naar het Overzichtscherm van het nieuwe potje.

### UI-elementen

- Paginatitel: "Nieuw potje — Digipot"
- Koptekst: "🍺 Digipot"
- Subtekst: "Start een nieuw groepspotje en deel de link met je vrienden."
- Invoerveld: naam van het potje (met tekenteller, max 30)
- Knop: "Potje aanmaken →"
- Tandwiel rechtsbovenaan → Instellingen (S1)

### Validaties

| Regel | Foutmelding |
|---|---|
| Naam mag niet leeg zijn | "Geef het potje een naam." |
| Naam maximaal 30 tekens | "De naam van het potje mag maximaal 30 tekens zijn." |

### Gedrag

- Aanmaakknop is uitgeschakeld zolang het naamveld leeg is.
- Na succesvol aanmaken navigeert de app naar `/potje/:id`.
- Bij netwerk- of databasefout verschijnt een rode foutmelding onder het formulier.
- Valuta wordt intern op EUR gezet (zie §16 — Uitgestelde functionaliteit).

---

## 5. Scherm 2 — Deelnemer

**Route:** `/potje/:id`
**Component:** `ModalDeelnemen` (bottom-sheet modal over de potjepagina)
**Doel:** een nieuwe bezoeker laten deelnemen aan een bestaand potje.

### Wanneer dit scherm verschijnt

Dit scherm verschijnt wanneer het apparaat-ID niet herkend wordt als bestaande deelnemer van het potje. Bij herkend apparaat wordt direct Scherm 4 (Overzicht) getoond.

### Functionaliteit

De gebruiker vult zijn naam in en klikt op "Meedoen". Na deelnemen wordt hij doorgestuurd naar Scherm 3 (Storten).

Als de gebruiker een profielnaam heeft ingesteld (S4), staat die naam alvast ingevuld. De gebruiker kan hem aanpassen.

### UI-elementen

- Modaltitel: "🍺 Meedoen aan [potjenaam]"
- Uitleg: drie bulletpunten (storten, registreren, eerlijke verdeling)
- Invoerveld: naam (met tekenteller, max 30)
- Knop: "Meedoen →"
- Als profielnaam aanwezig: hint "Uit je profiel. Je kunt de naam aanpassen."

### Validaties

| Regel | Foutmelding |
|---|---|
| Naam mag niet leeg zijn | "Vul je naam in om deel te nemen." |
| Naam maximaal 30 tekens | "Je naam mag maximaal 30 tekens zijn." |
| Potje vol (max 20 deelnemers) | "Dit potje heeft het maximum van 20 deelnemers bereikt." |
| Naam al bezet in dit potje | "Deze naam is al bezet in dit potje. Kies een andere naam." |

### Toegankelijkheid

- Focus gaat automatisch naar het naamveld (of de bevestigingsknop bij profielnaam).
- Tab-trap actief: Tab blijft binnen de modal.
- Escape sluit de modal niet (deelnemen is verplicht voor verdere interactie).

---

## 6. Scherm 3 — Storten/Inleggen

**Route:** `/potje/:id/storten`
**Component:** `PaginaStorten`
**Doel:** een deelnemer laat zijn inleg registreren.

### Functionaliteit

De gebruiker kiest een bedrag via snelknoppen (€5, €10, €20, €50) of voert zelf een bedrag in. Na bevestigen wordt de storting geregistreerd en navigeert de app terug naar Scherm 4.

### UI-elementen

- Paginatitel: "Storten — Digipot"
- Terugknop (←) naar Overzicht
- Koptekst: "💰 Storten · [potjenaam] · [deelnemernaam]"
- Informatieblok: totaal al gestort (alleen zichtbaar als > €0)
- 4 snelknoppen: €5, €10, €20, €50 (2×2 grid)
- Optioneel vrij invoerveld (verschijnt na klik op "✏️ Ander bedrag invoeren")
- Samenvatting: geselecteerd bedrag in groen vak
- Knoppen: "Annuleren" + "Storten →"
- Informatieblok onderaan: huidig potsaldo + totaal ingelegd

### Prioriteitslogica bedragselectie

Snelkeuze heeft altijd prioriteit boven vrij invoerveld. De twee kunnen niet tegelijk actief zijn.

### Validaties

| Regel | Foutmelding |
|---|---|
| Geen bedrag geselecteerd | "Kies een bedrag of voer een bedrag in." |
| Bedrag boven €999,99 | "Het maximale bedrag per storting is €999,99." |
| Geen actieve deelnemer | "Je bent geen deelnemer van dit potje." |
| Potje gesloten | "Dit potje is gesloten." |
| Databasefout bij opslaan | Nederlandse foutmelding via `logFout()` |

### Foutafhandeling bij opslaan (SEC-H1)

De storting wordt pas als geregistreerd beschouwd nadat de database een succesvolle bevestiging heeft teruggegeven. Als de database een fout retourneert (RLS-fout, netwerk-onderbreking, constraint-schending), verschijnt een foutmelding en navigeert de app **niet** door. De gebruiker kan het opnieuw proberen.

### Gedrag na storten

Na succesvolle registratie navigeert de app naar `/potje/:id` met een groene toast-melding: "Storting van [bedrag] geregistreerd." De toast verschijnt via `location.state` die `PaginaPotje` uitleest bij aankomst.

---

## 7. Scherm 4 — Overzicht

**Route:** `/potje/:id`
**Component:** `PaginaPotje` → `PaginaOverzicht`
**Doel:** hoofdscherm voor alle interactie tijdens een actief potje.

### Functionaliteit

Het Overzichtscherm toont de actuele stand van het potje: wie heeft gestort, wie heeft betaald, hoeveel is nog te besteden. Van hieruit zijn alle acties beschikbaar.

### UI-elementen

**Headerkaart:**
- Potjenaam
- "Welkom, [naam]"
- Bedrag "nog te besteden" rechtsbovenaan in groen (grijs als €0)
- Tandwiel → Instellingen (S1)
- Badge "Afgemeld" als de huidige gebruiker afgemeld is
- Knop "👥 Nodig vrienden uit" (mobiel) / "🔗 Link kopiëren" (desktop)

**Deelnemerskaart:**
- Koptekst: "Deelnemers (actief/totaal)"
- Hint: "Tik op een naam voor details"
- Tabel met kolommen: Naam / Ingelegd / Betaald
- Lange namen worden afgekort met ellipsis (…); volledige naam zichtbaar via detail-sheet en aria-label

**Actiekaart:**
- Rij 1: "💰 Storten" + "🍺 Betaald"
- Helptekst bij €0 saldo: "Geen saldo beschikbaar. Voeg eerst een storting toe."
- Rij 2: "👋 Afmelden" + "🔒 Pot sluiten"
- Helpteksten: "Eerst storten om je te kunnen afmelden." / "Pot sluiten kan pas als er transacties zijn."

### "Nog te besteden"

Het bedrag rechtsboven is het huidig beschikbare saldo: totaal gestort minus totaal betaald.

### "Nodig vrienden uit" / "Link kopiëren"

Op mobiel: opent het native deelmenu van het besturingssysteem.
Op desktop: kopieert de URL naar het klembord. Knoptekst verandert tijdelijk naar "✅ Link gekopieerd!".

### Acties en hun condities

| Actie | Voorwaarde | Gedrag |
|---|---|---|
| Storten | Deelnemer actief | Navigeert naar Scherm 3 |
| Betaald | Actief + saldo > €0 | Opent ModalTransactie (betaling) |
| Afmelden | Actief + heeft gestort | Opent ModalAfmelden |
| Pot sluiten | Ten minste één transactie | Opent ModalSluiten |

### Foutafhandeling bij afmelden

Als de deelnemer ondertussen verwijderd is door de lifecycle-cron (uitzonderingsgeval), toont de app:

> "Afmelden mislukt. Je deelnemersprofiel is niet meer beschikbaar."

### Foutafhandeling bij sluiten

Als de deelnemer-state null is op het moment van bevestigen (race condition: afmelden en sluiten tegelijk), toont de app een generieke foutmelding en logt de situatie naar Sentry. Dit is een bewust defensieve guard — in de normale gebruikersflow kan dit niet optreden.

### Realtime synchronisatie

Alle wijzigingen van andere deelnemers verschijnen automatisch zonder herladen. Vijf Supabase-abonnementen zijn actief: potjestatus, deelnemers INSERT, deelnemers UPDATE, transacties INSERT, transacties DELETE.

### Toast-meldingen

| Situatie | Tekst | Type | Undo |
|---|---|---|---|
| Storting geregistreerd (via PaginaStorten) | "Storting van [bedrag] geregistreerd." | Groen | Nee |
| Storting geregistreerd (via ModalTransactie) | "Storting van [bedrag] geregistreerd." | Groen | Ja (10s) |
| Betaling geregistreerd | "Betaling van [bedrag] geregistreerd." | Groen | Ja (10s) |
| Afgemeld | "Je bent afgemeld. Je telt niet meer mee bij nieuwe betalingen." | Info | Nee |
| Afmelden mislukt (profiel weg) | "Afmelden mislukt. Je deelnemersprofiel is niet meer beschikbaar." | Rood | Nee |
| Verbinding hersteld | "Verbinding hersteld." | Groen | Nee |
| Fout bij undo | "Je kunt alleen je eigen transacties ongedaan maken." | Rood | Nee |
| Undo saldo te laag | "Ongedaan maken niet mogelijk: er zijn al betalingen gedaan uit dit bedrag." | Rood | Nee |

**Toast-timing:** 10 seconden bij undo-actie, 5 seconden bij info-type, 3 seconden bij overige types.

### Transactie ongedaan maken (undo)

Voorwaarden: transactie moet van de huidige deelnemer zijn. Bij storting: potsaldo ≥ stortingsbedrag. Bij betaling: altijd toegestaan.

---

## 8. Scherm 5 — Eindafrekening

**Route:** `/potje/:id`
**Component:** `PaginaEindafrekening`
**Doel:** definitieve eindstand tonen en vereffening begeleiden.

### Berekenmodel

Afgemelden betalen volledige inleg (vast), actieven betalen naar rato (inleg × factor). Verrekening nooit lager dan −ingelegd.

### Tikkie-integratie

Knop opent Tikkie-app via deep link (`tikkie://`). Fallback naar `https://tikkie.me` met `noopener,noreferrer` (SEC-S4).

---

## 9. Instellingenscherm S1 — Instellingen

**Route:** `/instellingen`. Navigatiemenu: S2, S3, S4.

---

## 10. Instellingenscherm S2 — Open potjes

**Route:** `/instellingen/open`. Lege staat: "Geen open potjes" + startknop.

---

## 11. Instellingenscherm S3 — Gesloten potjes

**Route:** `/instellingen/gesloten`. Labels: "te ontvangen" / "bij te betalen".

---

## 12. Instellingenscherm S4 — Profiel

**Route:** `/instellingen/profiel`. Naam + tekstgrootte. Roving tabindex radiogroup.

---

## 13. Scherm 404 — Pagina niet gevonden

**Route:** `*`. Knop "← Terug naar home".

---

## 14. Dwarsdoorsnijdende functionaliteit

### Apparaatidentificatie

UUID in localStorage (`digipot_device_id`). Gevalideerd bij elke sessie via `useDeviceId()`. Ongeldige waarde wordt vervangen door nieuw UUID. De hook wordt altijd gebruikt als bron van het device-ID — nooit `localStorage.getItem()` direct.

### Foutafhandeling

Alle gebruikersfouten via `logFout()` → Sentry + Nederlandse gebruikerstekst. Bekende situaties (verlopen links, ontbrekende deelnemers) geven correcte meldingen zonder Sentry-ruis.

#### Foutmelding bij niet-bestaand of verwijderd potje (PGRST116)

> "Dit potje bestaat niet of is verwijderd. Controleer de link."

#### Foutmelding bij ontbrekend deelnemersprofiel bij afmelden

> "Afmelden mislukt. Je deelnemersprofiel is niet meer beschikbaar."

### Levenscyclus

Open potjes > 24 uur → automatisch gesloten. Potjes > 7 dagen → verwijderd. Via Supabase Edge Functions + pg_cron.

---

## 15. Validaties en begrenzingen

| Gegeven | Minimum | Maximum |
|---|---|---|
| Potjenaam | 1 teken | 30 tekens |
| Deelnemersnaam | 1 teken | 30 tekens |
| Deelnemers per potje | — | 20 |
| Transactiebedrag | €0,01 | €999,99 |
| Betaling | — | huidig potsaldo |

---

## 16. Uitgestelde functionaliteit

### Multicurrency

EUR, USD, GBP, CHF, DKK, NOK, SEK aanwezig. Valutakeuze op Scherm 1 verborgen — vast op EUR.

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
| 1.8 | 2026-04-12 | §7 foutafhandeling afmelden + sluiten gedocumenteerd; §7 toast-tabel uitgebreid met "afmelden mislukt"-toast; §14 apparaatidentificatie aangescherpt: useDeviceId() is de enige geldige bron van device-ID; kritieke fixes: useMijnPotjes gebruikt nu useDeviceId() (stille lege lijst voorkomen), handleAfmelden gebruikt .maybeSingle() (onjuiste PGRST116-melding voorkomen), handleSluiten heeft null-guard op deelnemer (TypeError voorkomen) | Grondige code-audit 2026-04-12: drie kritieke kwetsbaarheden gevonden en opgelost |
| 1.9 | 2026-04-13 | §7 toast-tabel: fout-toasts krijgen directe schermlezermelding (role=alert/assertive); §5 validatieconstanten gesynchroniseerd met constants.js; §4 overzicht: afmeldknop toont aria-disabled + not-allowed cursor als al afgemeld (WCAG 4.1.2) | Medium audit-bevindingen 2026-04-13: SEC-M1, WCAG-2, UX-1 opgelost |
| 2.0 | 2026-04-13 | §14: SEC-L2 gedocumenteerd (x-device-id getter leest localStorage direct, bewuste keuze); §5 SEC-M2 gedocumenteerd (aangemaakt_op client-side is tijdelijke weergavewaarde); §5 WCAG-3 gedocumenteerd (Escape no-op bij verplicht deelnemen is bewuste keuze) | Low audit-bevindingen 2026-04-13: SEC-L2, SEC-M2, WCAG-3 gedocumenteerd |
