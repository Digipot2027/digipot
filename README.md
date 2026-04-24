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

## Git hooks (eenmalige installatie)

Dit project heeft twee git hooks die lokaal geïnstalleerd moeten worden:

```bash
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
cp scripts/pre-push-hook.sh .git/hooks/pre-push
chmod +x .git/hooks/pre-commit .git/hooks/pre-push
```

**pre-commit** — toont alle gewijzigde maar niet-gestagede bestanden vóór elke commit. Blokkeert niet, maar waarschuwt als je iets bent vergeten te stagen.

**pre-push** — blokkeert een push naar `main` als lint, unit tests of e2e-tests niet recent en groen zijn.

### Commit workflow

Vóór elke commit:

```bash
git status                  # zie wat gewijzigd is
git diff --stat             # zie welke bestanden geraakt zijn
git add .                   # stage alles, of benoem bestanden expliciet
git commit -m "..."
```

Nooit committen zonder eerst `git status` te hebben gezien — zo voorkom je dat gewijzigde bestanden achterblijven.

## Ontwikkelworkflow

Dit project gebruikt twee vaste branches:

- `acceptatie` — integratiebranch; alle feature-PR's gaan hier naartoe
- `main` — productiebranch; alleen via PR vanuit `acceptatie`

```
feature/mijn-wijziging
  ↓ PR naar acceptatie   (dagelijkse flow, CI moet groen zijn)
acceptatie
  ↓ PR naar main        (bewuste release-stap)
main → Cloudflare Pages deploy
```

Branch aanmaken:

```bash
git checkout acceptatie
git checkout -b feature/mijn-wijziging
```

## Licentie

Privéproject. Niet bedoeld voor publieke distributie.
