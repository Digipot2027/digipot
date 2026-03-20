# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # Production build (outputs to dist/)
npm run lint      # ESLint check
npm run preview   # Preview production build locally
```

No test framework is configured.

## Architecture

**Digipot** is a Dutch-language collaborative group expense pot app — groups create a shared pot, members join via link, deposit funds, and record expenses. A settlement algorithm calculates who owes what.

**Stack:** React 19 + React Router 7 + Vite 8 + Supabase (PostgreSQL + Realtime). No TypeScript, no UI library, no global state manager.

### Routing

```
/              → PaginaNieuwPotje   (create pot)
/potje/:id     → PaginaPotje        (main interaction + settlement view)
```

`PaginaEindafrekening` is rendered inline within `PaginaPotje` when the pot is closed (not a separate route).

### Supabase tables

- `potjes` — pot records (`id`, `naam`, `status`, `gesloten_op`, `gesloten_door`)
- `deelnemers` — participants (`id`, `potje_id`, `naam`, `device_id`, `aangemaakt_op`)
- `transacties` — transactions (`id`, `potje_id`, `deelnemer_id`, `type`, `bedrag`, `aangemaakt_op`)

Key constraints: unique `(potje_id, naam)`, unique `(potje_id, device_id)`, `bedrag` between €0.01–€999.99, `naam` max 30 chars.

Supabase credentials come from `.env.local` (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`) and are validated at startup in `src/supabaseClient.js`.

### Real-time sync

`PaginaPotje` opens three Supabase Postgres Changes subscriptions (pot status, participant joins, new transactions) and tracks `online` state to show a disconnection banner. Subscriptions are cleaned up on unmount.

### User identification

No authentication. Each device gets a `crypto.randomUUID()` stored in localStorage as `digipot_device_id`. This is matched against `deelnemers.device_id` to identify the current user.

### Settlement calculation

`src/utils/berekenSaldi.js` — time-based fairness: each expense is split equally among members who had joined at the time of that transaction. Returns per-member `gestort` (contributed), `aandeel` (owes), and `verrekening` (net balance).

### Modals

All interactions use bottom-sheet modals controlled by a `modaal` state string in `PaginaPotje`. Components: `ModalDeelnemen` (join), `ModalTransactie` (deposit/expense), `ModalSluiten` (close pot).

## Regel: Synchronisatie Code ↔ Functioneel Ontwerp (FO)

Bij elke wijziging in de code moet het functioneel ontwerp direct worden bijgewerkt:

1. **Beschrijf de functionele impact** — wat verandert er voor de gebruiker of het systeem?
2. **Bepaal welke FO-sectie geraakt wordt** en update die met:
   - Nieuwe of gewijzigde functionaliteit
   - Gewijzigde validaties
   - UI/UX-wijzigingen
3. **Voeg een regel toe aan de wijzigingslog** met:
   - Datum
   - Wijziging
   - Reden
   - Impact

### Localization & error handling

- All UI text is in Dutch (`nl-NL`)
- `src/utils/formatBedrag.js` — formats/parses currency (accepts both `,` and `.` as decimal separator)
- `src/utils/vertaalFout.js` — translates Supabase/network errors to Dutch user-facing messages
