# Functioneel Ontwerp — Digipot

**Versie:** 1.2
**Datum:** 2026-04-03
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

Het bedrag rechtsboven is het huidig beschikbare saldo: totaal gestort minus totaal betaald. Dit bedrag heet "nog te besteden" omdat het de ruimte aangeeft voor nieuwe betalingen.

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

### Deelnemer aantikken → DeelnemerDetailSheet

Tikt een gebruiker op een naam, dan opent een bottom-sheet met details van die deelnemer:

- Naam + "Afgemeld"-badge indien van toepassing
- Twee kaartjes: totaal ingelegd (groen) + totaal betaald (rood)
- Lijst van stortingen (tijdgestempeld)
- Lijst van betalingen (tijdgestempeld)
- Sluitknop (✕) en "Sluiten"-knop onderaan

**Toegankelijkheid:** focus gaat bij openen naar de sluitknop; Tab-trap actief; Escape sluit de sheet.

### Modals vanuit dit scherm

**ModalTransactie (betaling):**
- Titel: "🍺 Rondje betaald"
- Invoer: bedrag (vrij tekstveld)
- Validatie: bedrag > 0, ≤ potsaldo, ≤ €999,99
- Na bevestigen: toast + undo-knop (10 seconden)

**ModalSluiten:**
- Bevestigingsvraag met waarschuwing (onomkeerbaar)
- Na sluiten: navigatie naar Scherm 5

**ModalAfmelden:**
- Waarschuwingsblok: onomkeerbare actie, gevolgen expliciet benoemd
- Na afmelden: gebruiker zichtbaar maar kan niet meer storten of betalen

### Realtime synchronisatie

Alle wijzigingen van andere deelnemers verschijnen automatisch zonder herladen. Drie Supabase-abonnementen zijn actief: potjestatus, deelnemers en transacties.

### Toast-meldingen

| Situatie | Tekst | Type | Undo |
|---|---|---|---|
| Storting geregistreerd (via PaginaStorten) | "Storting van [bedrag] geregistreerd." | Groen | Nee |
| Storting geregistreerd (via ModalTransactie) | "Storting van [bedrag] geregistreerd." | Groen | Ja (10s) |
| Betaling geregistreerd | "Betaling van [bedrag] geregistreerd." | Groen | Ja (10s) |
| Afgemeld | "Je bent afgemeld. Je telt niet meer mee bij nieuwe betalingen." | Info | Nee |
| Verbinding hersteld | "Verbinding hersteld." | Groen | Nee |
| Fout bij undo | "Je kunt alleen je eigen transacties ongedaan maken." | Rood | Nee |
| Undo saldo te laag | "Ongedaan maken niet mogelijk: er zijn al betalingen gedaan uit dit bedrag." | Rood | Nee |

**Toast-timing:** 10 seconden bij undo-actie, 5 seconden bij info-type, 3 seconden bij overige types.

### Transactie ongedaan maken (undo)

Voorwaarden:
- Transactie moet van de huidige deelnemer zijn.
- Bij storting: potsaldo ≥ stortingsbedrag.
- Bij betaling: altijd toegestaan.

---

## 8. Scherm 5 — Eindafrekening

**Route:** `/potje/:id` (zelfde URL, andere weergave bij status = 'gesloten')
**Component:** `PaginaEindafrekening`
**Doel:** definitieve eindstand tonen en vereffening begeleiden.

### UI-elementen

**Headerkaart:**
- Potjenaam met 🔒, sluitdatum
- Totaal gestort en totaal uitgegeven
- Tandwiel → Instellingen

**Eindafrekening per deelnemer (uitklapbaar):**
- Naam (afgemelden doorgestreept + badge)
- Betaald + ingelegd
- Verrekening in kleur (groen = ontvangt, rood = bijbetalen)
- Statustekst: "✅ Ontvangt geld terug" / "⚠️ Moet bijbetalen"
- Uitklappen: tijdgestempelde stortingen en betalingen

**Vereffeningskaart:**
- Minimale overboekingen (greedy algoritme, max n−1 voor n deelnemers)
- Per overboeking: "[Van] → [Aan]" + bedrag + Tikkie-knop

**Knoppen:** "🍺 Nieuw potje starten" + "⚙️ Naar instellingen"

### Berekenmodel

Zie §14 voor volledige uitleg. Samenvatting: afgemelden betalen volledige inleg (vast), actieven betalen naar rato (inleg × factor). Verrekening nooit lager dan −ingelegd.

### Tikkie-integratie

Knop opent Tikkie-app via deep link (`tikkie://`). Fallback naar `https://tikkie.me` bij ontbrekende app.

---

## 9. Instellingenscherm S1 — Instellingen

**Route:** `/instellingen`
**Toegang:** tandwiel op Scherm 1 en Scherm 4.

Navigatiemenu: Open potjes (S2), Gesloten potjes (S3), Profiel (S4).

---

## 10. Instellingenscherm S2 — Open potjes

**Route:** `/instellingen/open`

Overzicht van open potjes voor dit apparaat. Per potje: naam, deelnemers, datum, "nog te besteden"-saldo. Lege staat: "Geen open potjes" + startknop.

---

## 11. Instellingenscherm S3 — Gesloten potjes

**Route:** `/instellingen/gesloten`

Overzicht van gesloten potjes voor dit apparaat. Per potje: naam, sluitdatum, eigen verrekening.

**Verrekeningstatus:** positief bedrag toont "te ontvangen", negatief bedrag toont "bij te betalen". Deze labels drukken de toekomstige actie uit — niet een voltooide handeling.

Lege staat: "Geen gesloten potjes".

---

## 12. Instellingenscherm S4 — Profiel

**Route:** `/instellingen/profiel`

Naam instellen (max 30 tekens, lokaal opgeslagen, verwijderbaar).
Tekstgrootte instellen: Normaal / Groot / Extra groot (live preview).

**Tekstgrootte-kiezer:** radiogroup met roving tabindex — alleen de actieve optie zit in de Tab-volgorde, de andere opties zijn bereikbaar via pijltjestoetsen.

Privacy: geen persoonsgegevens worden verstuurd.

---

## 13. Scherm 404 — Pagina niet gevonden

**Route:** `*` (catch-all voor alle onbekende routes)
**Component:** `PaginaNietGevonden`
**Doel:** gebruiker informeren over een onbekende URL en terugsturen.

### UI-elementen

- Paginatitel: "Pagina niet gevonden — Digipot"
- Pictogram: 🔍
- Koptekst: "Pagina niet gevonden"
- Uitleg: "Deze pagina bestaat niet. Controleer de link of ga terug naar de startpagina."
- Knop: "← Terug naar home" (navigeert naar `/`)

### Gedrag

Er is geen terugknop naar de vorige pagina — de catch-all is bedoeld voor ongeldige links. De enige uitweg is de home-knop.

---

## 14. Dwarsdoorsnijdende functionaliteit

### Apparaatidentificatie

Elk apparaat krijgt bij eerste gebruik een UUID opgeslagen in localStorage (`digipot_device_id`). Dit ID bepaalt welke deelnemer "jij" bent. De UUID wordt gevalideerd bij elke sessie; een ongeldige of gemanipuleerde waarde wordt vervangen door een nieuw UUID.

### Berekenlogica eindafrekening

Actief/afgemeld bepaald op sluitmoment. Afgemelden: netto bijdrage = volledige inleg. Actieven: netto bijdrage = ingelegd × factor. Factor = resterend voor actieven ÷ totaal ingelegd actieven. Verrekening = betaald − netto bijdrage, nooit lager dan −ingelegd. Tekorten verdwijnen; resterend saldo verdwijnt bij sluiting.

### Foutafhandeling

Alle gebruikersfouten lopen via `logFout()` → Sentry (productie) + Nederlandse gebruikerstekst.

### Skeletonladers

Alle data-schermen tonen een geanimeerde skeletonlader tijdens laden.

### Verbindingsstatus

Online/offline detectie via browser-events én Supabase WebSocket-status. Rode banner bij verbindingsverlies op Scherm 4.

---

## 15. Validaties en begrenzingen

| Gegeven | Minimum | Maximum |
|---|---|---|
| Potjenaam | 1 teken | 30 tekens |
| Deelnemersnaam | 1 teken | 30 tekens |
| Deelnemers per potje | — | 20 |
| Transactiebedrag | €0,01 | €999,99 |
| Betaling | — | huidig potsaldo |

Databaseconstraints spiegelen alle clientvalidaties. De server is leidend bij conflicten.

---

## 16. Uitgestelde functionaliteit

### Multicurrency

Interne ondersteuning voor EUR, USD, GBP, CHF, DKK, NOK, SEK is aanwezig. De valutakeuze op Scherm 1 is tijdelijk verborgen; alle nieuwe potjes krijgen automatisch EUR.

**Activeren:** herstel het uitgecommentarieerde valutaveld in `PaginaNieuwPotje.jsx` (zie commentaar in dat bestand voor het exacte herstelblok).

---

## 17. Wijzigingslog

| Versie | Datum | Wijziging | Reden |
|---|---|---|---|
| 1.0 | 2026-03-01 | Initieel FO opgesteld | Projectstart |
| 1.1 | 2026-04-02 | Valutakeuze verborgen op Scherm 1; "Deel potje" → "Nodig vrienden uit" (mobiel); "saldo" → "nog te besteden" op Scherm 4; tabel mobiel-robuust; FO en TO opgenomen in repository | UX-verbetering, multicurrency uitgesteld, mobiele optimalisatie |
| 1.2 | 2026-04-03 | Scherm 404 (PaginaNietGevonden) toegevoegd aan §13; DeelnemerDetailSheet beschreven in §7; toast-timing gedocumenteerd; "ontvangen/bijbetaald" → "te ontvangen/bij te betalen" in S3; roving tabindex radiogroup gedocumenteerd in S4; toast via location.state na storting gedocumenteerd; UUID-validatie bij apparaatidentificatie beschreven | Auditbevindingen: ontbrekende documentatie, UX-correcties, security-toelichting |
