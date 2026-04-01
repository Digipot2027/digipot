/**
 * smoke/t9.mjs — T9: Klein feestje 6 personen, 1,5 uur, Maaike blijft tot einde
 *
 * Beek+Maaike komen samen, Maaike blijft dit keer tot het einde.
 * Geen afmeldingen. Eenvoudig happy path met 6 personen.
 *
 * Saldo-simulatie:
 *   T+2:  4 vroegen: Beek8+Maaike6+Nix10+Alex9 = €33             pot  €33
 *   T+21: Ingrid aankomst+storting €7                             pot  €40
 *   T+31: Kwak aankomst+storting €5                              pot  €45
 *   T+32: Ronde 2: 6 personen = €45                               pot  €90
 *   T+50: Betaling 1: Nix €85 (≤€90 ✓)                           pot   €5
 *   T+55: Ronde 3: 6 personen = €43                               pot  €48
 *   T+80: Betaling 2: Alex €45 (≤€48 ✓)                          pot   €3
 *   T+85: Ronde 4: 6 personen = €42                               pot  €45
 *   T+88: Betaling 3: Beek €43 (≤€45 ✓)                          pot   €2
 *   T+90: sluiting
 *
 * Totaal gestort: 33+7+5+45+43+42 = €175
 * Betalingen: 85+45+43 = €173 = 98.9% ✓
 */

import { runScenario } from './runner.mjs'

await runScenario({
  naam:        '[SMOKE-T9] Snelle borrel',
  duurMinuten: 90,

  deelnemers: [
    { naam: 'Beek',   isBeek: true,  aankomstMinuut: 0  },
    { naam: 'Maaike', isBeek: false, aankomstMinuut: 0  }, // koppel Beek, blijft dit keer
    { naam: 'Nix',    isBeek: false, aankomstMinuut: 0  },
    { naam: 'Alex',   isBeek: false, aankomstMinuut: 0  },
    { naam: 'Ingrid', isBeek: false, aankomstMinuut: 20 },
    { naam: 'Kwak',   isBeek: false, aankomstMinuut: 30 },
  ],

  events: [
    // T+2 — Ronde 1: 4 vroegen → pot €33
    { minuut:  2, type: 'storting', naam: 'Beek',   bedrag:  8 },
    { minuut:  2, type: 'storting', naam: 'Maaike', bedrag:  6 },
    { minuut:  2, type: 'storting', naam: 'Nix',    bedrag: 10 },
    { minuut:  2, type: 'storting', naam: 'Alex',   bedrag:  9 },
    // T+20 — Ingrid aankomst
    { minuut: 20, type: 'aankomst', naam: 'Ingrid' },
    { minuut: 21, type: 'storting', naam: 'Ingrid', bedrag:  7 },
    // T+30 — Kwak aankomst
    { minuut: 30, type: 'aankomst', naam: 'Kwak' },
    { minuut: 31, type: 'storting', naam: 'Kwak',   bedrag:  5 },
    // T+32 — Ronde 2: 6 personen → pot €90
    { minuut: 32, type: 'storting', naam: 'Beek',   bedrag:  8 },
    { minuut: 32, type: 'storting', naam: 'Maaike', bedrag:  6 },
    { minuut: 32, type: 'storting', naam: 'Nix',    bedrag: 10 },
    { minuut: 32, type: 'storting', naam: 'Alex',   bedrag:  9 },
    { minuut: 32, type: 'storting', naam: 'Ingrid', bedrag:  7 },
    { minuut: 32, type: 'storting', naam: 'Kwak',   bedrag:  5 },
    // T+50 — Betaling 1: Nix €85 (≤€90 ✓) → pot €5
    { minuut: 50, type: 'betaling', naam: 'Nix',    bedrag: 85 },
    // T+55 — Ronde 3: 6 personen → pot €48
    { minuut: 55, type: 'storting', naam: 'Beek',   bedrag:  8 },
    { minuut: 55, type: 'storting', naam: 'Maaike', bedrag:  6 },
    { minuut: 55, type: 'storting', naam: 'Nix',    bedrag:  9 },
    { minuut: 55, type: 'storting', naam: 'Alex',   bedrag:  8 },
    { minuut: 55, type: 'storting', naam: 'Ingrid', bedrag:  7 },
    { minuut: 55, type: 'storting', naam: 'Kwak',   bedrag:  5 },
    // T+80 — Betaling 2: Alex €45 (≤€48 ✓) → pot €3
    { minuut: 80, type: 'betaling', naam: 'Alex',   bedrag: 45 },
    // T+82 — Ronde 4: 6 personen → pot €45
    { minuut: 82, type: 'storting', naam: 'Beek',   bedrag:  8 },
    { minuut: 82, type: 'storting', naam: 'Maaike', bedrag:  6 },
    { minuut: 82, type: 'storting', naam: 'Nix',    bedrag:  9 },
    { minuut: 82, type: 'storting', naam: 'Alex',   bedrag:  8 },
    { minuut: 82, type: 'storting', naam: 'Ingrid', bedrag:  6 },
    { minuut: 82, type: 'storting', naam: 'Kwak',   bedrag:  5 },
    // T+87 — Betaling 3: Beek €43 (≤€45 ✓) → pot €2
    { minuut: 87, type: 'betaling', naam: 'Beek',   bedrag: 43 },
    // T+90 — Sluiting
    { minuut: 90, type: 'sluiting' },
  ],
}, 'T9')
