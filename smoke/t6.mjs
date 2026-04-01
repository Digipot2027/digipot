/**
 * smoke/t6.mjs — T6: 14 personen, 3 uur, geen afmeldingen, bijstortronde
 *
 * Saldo-simulatie:
 *   T+2:  5 vroegen = €50                                           pot  €50
 *   T+21: Alex+Nix komen: +storting €9+€10=€19                     pot  €69
 *   T+22: Ronde 2 vroegen: 5×~€8=€40                               pot €109
 *   T+41: Ingrid+Marlene komen: +storting €7+€8=€15                pot €124
 *   T+42: Ronde 3 vroegen+Alex+Nix: 7×~€8=€57                      pot €181
 *   T+60: Betaling 1: Vianen €170 (≤€181 ✓)                        pot  €11
 *   T+61: Kwak+Miek komen: +storting €5+€6=€11                     pot  €22
 *   T+62: Ronde 4: 11 actieven = €87                               pot €109
 *   T+80: Betaling 2: @ €100 (≤€109 ✓)                             pot   €9
 *   T+81: Spoeling+Nadia+Margreet komen: +storting €6+€7+€8=€21    pot  €30
 *   T+82: Ronde 5: 14 actieven = €108                              pot €138
 *   T+110: Betaling 3: Beer €130 (≤€138 ✓)                         pot   €8
 *   T+111: Bijstortronde: 14×€7=€98                                pot €106
 *   T+115: Betaling 4: Nix €100 (≤€106 ✓)                          pot   €6
 *   T+145: Ronde 6: 14 actieven = €98                              pot €104
 *   T+175: Betaling 5: Beek €102 (≤€104 ✓)                         pot   €2
 *   T+180: sluiting
 *
 * Totaal gestort: 50+19+40+15+57+11+87+21+108+98+98=€604
 * Betalingen: 170+100+130+100+102=€602=99.7% ✓
 */

import { runScenario } from './runner.mjs'

await runScenario({
  naam:        '[SMOKE-T6] Vrijdagavond groot',
  duurMinuten: 180,

  deelnemers: [
    { naam: 'Beek',     isBeek: true,  aankomstMinuut: 0  },
    { naam: 'Beer',     isBeek: false, aankomstMinuut: 0  },
    { naam: 'Vianen',   isBeek: false, aankomstMinuut: 0  },
    { naam: '@',        isBeek: false, aankomstMinuut: 0  },
    { naam: 'Raaf',     isBeek: false, aankomstMinuut: 0  },
    { naam: 'Alex',     isBeek: false, aankomstMinuut: 20 },
    { naam: 'Nix',      isBeek: false, aankomstMinuut: 20 },
    { naam: 'Ingrid',   isBeek: false, aankomstMinuut: 40 },
    { naam: 'Marlene',  isBeek: false, aankomstMinuut: 40 },
    { naam: 'Kwak',     isBeek: false, aankomstMinuut: 60 },
    { naam: 'Miek',     isBeek: false, aankomstMinuut: 60 },
    { naam: 'Spoeling', isBeek: false, aankomstMinuut: 80 },
    { naam: 'Nadia',    isBeek: false, aankomstMinuut: 80 },
    { naam: 'Margreet', isBeek: false, aankomstMinuut: 80 },
  ],

  events: [
    // T+2 — Ronde 1: 5 vroegen → pot €50
    { minuut:   2, type: 'storting', naam: 'Beek',    bedrag: 10 },
    { minuut:   2, type: 'storting', naam: 'Beer',    bedrag: 10 },
    { minuut:   2, type: 'storting', naam: 'Vianen',  bedrag: 10 },
    { minuut:   2, type: 'storting', naam: '@',       bedrag: 10 },
    { minuut:   2, type: 'storting', naam: 'Raaf',    bedrag: 10 },
    // T+20 — Alex+Nix aankomst
    { minuut:  20, type: 'aankomst', naam: 'Alex' },
    { minuut:  20, type: 'aankomst', naam: 'Nix' },
    { minuut:  21, type: 'storting', naam: 'Alex',    bedrag:  9 },
    { minuut:  21, type: 'storting', naam: 'Nix',     bedrag: 10 },
    // T+22 — Ronde 2: 5 vroegen → pot €109
    { minuut:  22, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut:  22, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut:  22, type: 'storting', naam: 'Vianen',  bedrag: 10 },
    { minuut:  22, type: 'storting', naam: '@',       bedrag: 10 },
    { minuut:  22, type: 'storting', naam: 'Raaf',    bedrag:  8 },
    // T+40 — Ingrid+Marlene aankomst
    { minuut:  40, type: 'aankomst', naam: 'Ingrid' },
    { minuut:  40, type: 'aankomst', naam: 'Marlene' },
    { minuut:  41, type: 'storting', naam: 'Ingrid',  bedrag:  7 },
    { minuut:  41, type: 'storting', naam: 'Marlene', bedrag:  8 },
    // T+42 — Ronde 3: 7 personen → pot €181
    { minuut:  42, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut:  42, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut:  42, type: 'storting', naam: 'Vianen',  bedrag: 10 },
    { minuut:  42, type: 'storting', naam: '@',       bedrag: 10 },
    { minuut:  42, type: 'storting', naam: 'Raaf',    bedrag:  8 },
    { minuut:  42, type: 'storting', naam: 'Alex',    bedrag:  9 },
    { minuut:  42, type: 'storting', naam: 'Nix',     bedrag: 10 },
    // T+60 — Betaling 1: Vianen €170 (≤€181 ✓) → pot €11
    { minuut:  60, type: 'betaling', naam: 'Vianen',  bedrag: 170 },
    // T+60 — Kwak+Miek aankomst
    { minuut:  60, type: 'aankomst', naam: 'Kwak' },
    { minuut:  60, type: 'aankomst', naam: 'Miek' },
    { minuut:  61, type: 'storting', naam: 'Kwak',    bedrag:  5 },
    { minuut:  61, type: 'storting', naam: 'Miek',    bedrag:  6 },
    // T+62 — Ronde 4: 11 actieven → pot €109
    { minuut:  62, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut:  62, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut:  62, type: 'storting', naam: 'Vianen',  bedrag: 10 },
    { minuut:  62, type: 'storting', naam: '@',       bedrag: 10 },
    { minuut:  62, type: 'storting', naam: 'Raaf',    bedrag:  8 },
    { minuut:  62, type: 'storting', naam: 'Alex',    bedrag:  9 },
    { minuut:  62, type: 'storting', naam: 'Nix',     bedrag: 10 },
    { minuut:  62, type: 'storting', naam: 'Ingrid',  bedrag:  7 },
    { minuut:  62, type: 'storting', naam: 'Marlene', bedrag:  8 },
    // T+80 — Betaling 2: @ €100 (≤€109 ✓) → pot €9
    { minuut:  80, type: 'betaling', naam: '@',       bedrag: 100 },
    // T+80 — Spoeling+Nadia+Margreet aankomst
    { minuut:  80, type: 'aankomst', naam: 'Spoeling' },
    { minuut:  80, type: 'aankomst', naam: 'Nadia' },
    { minuut:  80, type: 'aankomst', naam: 'Margreet' },
    { minuut:  81, type: 'storting', naam: 'Spoeling', bedrag:  6 },
    { minuut:  81, type: 'storting', naam: 'Nadia',    bedrag:  7 },
    { minuut:  81, type: 'storting', naam: 'Margreet', bedrag:  8 },
    // T+82 — Ronde 5: 14 actieven → pot €138
    { minuut:  82, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut:  82, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut:  82, type: 'storting', naam: 'Vianen',  bedrag: 10 },
    { minuut:  82, type: 'storting', naam: '@',       bedrag: 10 },
    { minuut:  82, type: 'storting', naam: 'Raaf',    bedrag:  8 },
    { minuut:  82, type: 'storting', naam: 'Alex',    bedrag:  9 },
    { minuut:  82, type: 'storting', naam: 'Nix',     bedrag: 10 },
    { minuut:  82, type: 'storting', naam: 'Ingrid',  bedrag:  7 },
    { minuut:  82, type: 'storting', naam: 'Marlene', bedrag:  8 },
    { minuut:  82, type: 'storting', naam: 'Kwak',    bedrag:  5 },
    { minuut:  82, type: 'storting', naam: 'Miek',    bedrag:  6 },
    // T+110 — Betaling 3: Beer €122 (≤€124 ✓) → pot €2
    { minuut: 110, type: 'betaling', naam: 'Beer',    bedrag: 122 },
    // T+111 — Bijstortronde: 14 actieven → pot €95
    { minuut: 111, type: 'storting', naam: 'Beek',    bedrag:  7 },
    { minuut: 111, type: 'storting', naam: 'Beer',    bedrag:  7 },
    { minuut: 111, type: 'storting', naam: 'Vianen',  bedrag:  8 },
    { minuut: 111, type: 'storting', naam: '@',       bedrag:  8 },
    { minuut: 111, type: 'storting', naam: 'Raaf',    bedrag:  7 },
    { minuut: 111, type: 'storting', naam: 'Alex',    bedrag:  7 },
    { minuut: 111, type: 'storting', naam: 'Nix',     bedrag:  7 },
    { minuut: 111, type: 'storting', naam: 'Ingrid',  bedrag:  6 },
    { minuut: 111, type: 'storting', naam: 'Marlene', bedrag:  7 },
    { minuut: 111, type: 'storting', naam: 'Kwak',    bedrag:  5 },
    { minuut: 111, type: 'storting', naam: 'Miek',    bedrag:  6 },
    { minuut: 111, type: 'storting', naam: 'Spoeling',bedrag:  5 },
    { minuut: 111, type: 'storting', naam: 'Nadia',   bedrag:  6 },
    { minuut: 111, type: 'storting', naam: 'Margreet',bedrag:  7 },
    // T+115 — Betaling 4: Nix €91 (≤€93 ✓) → pot €2
    { minuut: 115, type: 'betaling', naam: 'Nix',     bedrag: 91 },
    // T+145 — Ronde 6: 14 actieven → pot €104
    { minuut: 145, type: 'storting', naam: 'Beek',    bedrag:  7 },
    { minuut: 145, type: 'storting', naam: 'Beer',    bedrag:  8 },
    { minuut: 145, type: 'storting', naam: 'Vianen',  bedrag:  9 },
    { minuut: 145, type: 'storting', naam: '@',       bedrag:  8 },
    { minuut: 145, type: 'storting', naam: 'Raaf',    bedrag:  7 },
    { minuut: 145, type: 'storting', naam: 'Alex',    bedrag:  8 },
    { minuut: 145, type: 'storting', naam: 'Nix',     bedrag:  8 },
    { minuut: 145, type: 'storting', naam: 'Ingrid',  bedrag:  6 },
    { minuut: 145, type: 'storting', naam: 'Marlene', bedrag:  7 },
    { minuut: 145, type: 'storting', naam: 'Kwak',    bedrag:  5 },
    { minuut: 145, type: 'storting', naam: 'Miek',    bedrag:  6 },
    { minuut: 145, type: 'storting', naam: 'Spoeling',bedrag:  5 },
    { minuut: 145, type: 'storting', naam: 'Nadia',   bedrag:  6 },
    { minuut: 145, type: 'storting', naam: 'Margreet',bedrag:  8 },
    // T+175 — Betaling 5: Beek €96 (≤€98 ✓) → pot €2
    { minuut: 175, type: 'betaling', naam: 'Beek',    bedrag: 96 },
    // T+180 — Sluiting
    { minuut: 180, type: 'sluiting' },
  ],
}, 'T6')
