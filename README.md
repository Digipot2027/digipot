# Digipot

Groepsuitgaven bijhouden en eerlijk verdelen — zonder account, zonder gedoe.

## Wat is het?

Digipot is een Nederlandse webapp waarmee groepen gezamenlijke uitgaven kunnen bijhouden. Deelnemers storten geld in een gedeeld potje, registreren betalingen, en krijgen bij afsluiting een eerlijke eindafrekening met wie wie nog wat verschuldigd is.

Geen account nodig. Toegang via een gedeelde link. Apparaatidentificatie via een UUID in localStorage.

## Stack

| Onderdeel | Technologie |
|---|---|
| Frontend | React 19 + Vite 8 |
| Backend | Supabase (PostgreSQL 17 + Realtime) |
| Routing | React Router 7 |
| Foutlogging | Sentry |
| Tests (unit) | Vitest + @testing-library/react |
| Tests (e2e) | Playwright |
| Deployment | Cloudflare Pages |
| CI | GitHub Actions |

## Lokaal draaien

```bash
npm install
cp .env.example .env.local   # vul VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY in
npm run dev
```

## Tests

```bash
npm run test:run        # unit tests (Vitest)
npm run e2e:chromium    # e2e tests (Playwright, Chromium)
npm run lint            # ESLint
```

## Documentatie

- `docs/FO.md` — Functioneel Ontwerp (gebruikersflows, schermen, validaties)
- `docs/TO.md` — Technisch Ontwerp (architectuur, datamodel, security, testen)

## Licentie

Privéproject. Niet bedoeld voor publieke distributie.
