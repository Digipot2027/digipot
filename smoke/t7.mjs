/**
 * smoke/t7.mjs — T7: Chantal+Tesser vertrekken samen, As+Henri koppel, 4 uur, 13 personen
 *
 * Koppels:
 *   Beek+Maaike T+0, Maaike afgemeld T+44
 *   Chantal+Tesser T+0, beiden afgemeld T+29 (verlies <3%)
 *   As T+30, Henri T+60 — samen weg op einde
 *
 * Saldo-simulatie:
 *   T+2:  9 vroegen (incl. Maaike+Chantal+Tesser): €78               pot  €78
 *   T+29: Chantal+Tesser afgemeld (elk 0.5u = Chantal €7, Tesser €10)
 *   T+30: As aankomst+storting                                        pot  €83
 *   T+31: Ronde 2: 7 actieven (excl. Maaike/Chantal/Tesser al gestort; Maaike nog actief)
 *         Beek+Maaike+Beer+Poiesz+Dijl+Cynthia+Vianen = €62          pot €145
 *   T+44: Maaike afgemeld
 *   T+50: Betaling 1: Beer €135 (≤€145 ✓)                            pot  €10
 *   T+60: Henri aankomst+storting €10                                 pot  €20
 *   T+61: Ronde 3: 8 actieven (Beek+Beer+Poiesz+Dijl+Cynthia+Vianen+As+Henri) = €66   pot  €86
 *   T+90: Betaling 2: Vianen €80 (≤€86 ✓)                            pot   €6
 *   T+91: Ronde 4: 8 actieven = €66                                   pot  €72
 *   T+100: Cynthia+Nix aankomst                                       pot  €87
 *   T+120: Betaling 3: Dijl €82 (≤€87 ✓)                             pot   €5
 *   T+122: Ronde 5: 10 actieven = €83                                 pot  €88
 *   T+160: Betaling 4: @ €85... wacht, @ komt pas T+120
 *          Nix+Cynthia T+100, @ aankomst T+120
 *   T+121: @ aankomst+storting                                        al meegeteld
 *   T+160: Betaling 4: Henri €82 (≤€88 ✓)                            pot   €6
 *   T+165: Ronde 6: 10 actieven = €78                                 pot  €84
 *   T+220: Betaling 5: Nix €82 (≤€84 ✓)                              pot   €2
 *   T+240: sluiting
 *
 * Totaal gestort: 78+5+62+10+66+15+66+83+78 = €463  (Maaike€6×2=€12, Ch€7,Te€10 meegeteld in R1)
 * Betalingen: 135+80+82+82+82 = €461 = 99.6% ✓
 */

import { runScenario } from './runner.mjs'

await runScenario({
  naam:        '[SMOKE-T7] Zaterdagavond koppels',
  duurMinuten: 240,

  deelnemers: [
    { naam: 'Beek',    isBeek: true,  aankomstMinuut: 0   },
    { naam: 'Maaike',  isBeek: false, aankomstMinuut: 0   }, // koppel Beek, weg T+44
    { naam: 'Chantal', isBeek: false, aankomstMinuut: 0   }, // koppel Tesser, weg T+29
    { naam: 'Tesser',  isBeek: false, aankomstMinuut: 0   }, // koppel Chantal, weg T+29
    { naam: 'Beer',    isBeek: false, aankomstMinuut: 0   },
    { naam: 'Poiesz',  isBeek: false, aankomstMinuut: 0   },
    { naam: 'Dijl',    isBeek: false, aankomstMinuut: 0   },
    { naam: 'Cynthia', isBeek: false, aankomstMinuut: 0   },
    { naam: 'Vianen',  isBeek: false, aankomstMinuut: 0   },
    { naam: 'As',      isBeek: false, aankomstMinuut: 30  }, // koppel Henri
    { naam: 'Henri',   isBeek: false, aankomstMinuut: 60  }, // koppel As
    { naam: 'Nix',     isBeek: false, aankomstMinuut: 100 },
    { naam: '@',       isBeek: false, aankomstMinuut: 120 },
  ],

  events: [
    // T+2 — Ronde 1: 9 vroegen → pot €78
    { minuut:   2, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut:   2, type: 'storting', naam: 'Maaike',  bedrag:  6 },
    { minuut:   2, type: 'storting', naam: 'Chantal', bedrag:  7 },
    { minuut:   2, type: 'storting', naam: 'Tesser',  bedrag: 10 },
    { minuut:   2, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut:   2, type: 'storting', naam: 'Poiesz',  bedrag:  6 },
    { minuut:   2, type: 'storting', naam: 'Dijl',    bedrag:  8 },
    { minuut:   2, type: 'storting', naam: 'Cynthia', bedrag:  9 },
    { minuut:   2, type: 'storting', naam: 'Vianen',  bedrag: 10 },
    // T+29 — Chantal+Tesser afgemeld (koppel, samen weg)
    { minuut:  29, type: 'afmelden', naam: 'Chantal' },
    { minuut:  29, type: 'afmelden', naam: 'Tesser' },
    // T+30 — As aankomst
    { minuut:  30, type: 'aankomst', naam: 'As' },
    { minuut:  31, type: 'storting', naam: 'As',      bedrag:  5 },
    // T+31 — Ronde 2: 7 actieven → pot €145
    { minuut:  32, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut:  32, type: 'storting', naam: 'Maaike',  bedrag:  6 },
    { minuut:  32, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut:  32, type: 'storting', naam: 'Poiesz',  bedrag:  6 },
    { minuut:  32, type: 'storting', naam: 'Dijl',    bedrag:  8 },
    { minuut:  32, type: 'storting', naam: 'Cynthia', bedrag:  9 },
    { minuut:  32, type: 'storting', naam: 'Vianen',  bedrag: 10 },
    // T+44 — Maaike afgemeld
    { minuut:  44, type: 'afmelden', naam: 'Maaike' },
    // T+50 — Betaling 1: Beer €133 (≤€134 ✓) → pot €1
    { minuut:  50, type: 'betaling', naam: 'Beer',    bedrag: 133 },
    // T+60 — Henri aankomst
    { minuut:  60, type: 'aankomst', naam: 'Henri' },
    { minuut:  61, type: 'storting', naam: 'Henri',   bedrag: 10 },
    // T+62 — Ronde 3: 8 actieven → pot €86
    { minuut:  62, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut:  62, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut:  62, type: 'storting', naam: 'Poiesz',  bedrag:  6 },
    { minuut:  62, type: 'storting', naam: 'Dijl',    bedrag:  8 },
    { minuut:  62, type: 'storting', naam: 'Cynthia', bedrag:  9 },
    { minuut:  62, type: 'storting', naam: 'Vianen',  bedrag: 10 },
    { minuut:  62, type: 'storting', naam: 'As',      bedrag:  5 },
    // T+90 — Betaling 2: Vianen €63 (≤€65 ✓) → pot €2
    { minuut:  90, type: 'betaling', naam: 'Vianen',  bedrag: 63 },
    // T+91 — Ronde 4: 8 actieven → pot €72
    { minuut:  91, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut:  91, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut:  91, type: 'storting', naam: 'Poiesz',  bedrag:  6 },
    { minuut:  91, type: 'storting', naam: 'Dijl',    bedrag:  8 },
    { minuut:  91, type: 'storting', naam: 'Cynthia', bedrag:  9 },
    { minuut:  91, type: 'storting', naam: 'Vianen',  bedrag: 10 },
    { minuut:  91, type: 'storting', naam: 'As',      bedrag:  5 },
    { minuut:  91, type: 'storting', naam: 'Henri',   bedrag: 10 },
    // T+100 — Nix aankomst
    { minuut: 100, type: 'aankomst', naam: 'Nix' },
    { minuut: 101, type: 'storting', naam: 'Nix',     bedrag: 10 },
    // T+105 — Ronde 5 begin: nu 9 actieven → +€74 → pot €156
    { minuut: 105, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut: 105, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut: 105, type: 'storting', naam: 'Poiesz',  bedrag:  6 },
    { minuut: 105, type: 'storting', naam: 'Dijl',    bedrag:  8 },
    { minuut: 105, type: 'storting', naam: 'Cynthia', bedrag:  9 },
    { minuut: 105, type: 'storting', naam: 'Vianen',  bedrag: 10 },
    { minuut: 105, type: 'storting', naam: 'As',      bedrag:  5 },
    { minuut: 105, type: 'storting', naam: 'Henri',   bedrag: 10 },
    // T+120 — @ aankomst
    { minuut: 120, type: 'aankomst', naam: '@' },
    { minuut: 121, type: 'storting', naam: '@',       bedrag: 10 },
    // T+130 — Betaling 3: Dijl €148 (≤€152 ✓) → pot €4
    { minuut: 130, type: 'betaling', naam: 'Dijl',    bedrag: 148 },
    // T+135 — Ronde 6: 10 actieven → pot €93
    { minuut: 135, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut: 135, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut: 135, type: 'storting', naam: 'Poiesz',  bedrag:  6 },
    { minuut: 135, type: 'storting', naam: 'Dijl',    bedrag:  8 },
    { minuut: 135, type: 'storting', naam: 'Cynthia', bedrag:  9 },
    { minuut: 135, type: 'storting', naam: 'Vianen',  bedrag: 10 },
    { minuut: 135, type: 'storting', naam: 'As',      bedrag:  5 },
    { minuut: 135, type: 'storting', naam: 'Henri',   bedrag: 10 },
    { minuut: 135, type: 'storting', naam: 'Nix',     bedrag: 10 },
    { minuut: 135, type: 'storting', naam: '@',       bedrag:  9 },
    // T+180 — Betaling 4: Henri €82 (≤€84 ✓) → pot €2
    { minuut: 180, type: 'betaling', naam: 'Henri',   bedrag: 82 },
    // T+185 — Ronde 7: 10 actieven → pot €84
    { minuut: 185, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut: 185, type: 'storting', naam: 'Beer',    bedrag:  8 },
    { minuut: 185, type: 'storting', naam: 'Poiesz',  bedrag:  5 },
    { minuut: 185, type: 'storting', naam: 'Dijl',    bedrag:  7 },
    { minuut: 185, type: 'storting', naam: 'Cynthia', bedrag:  8 },
    { minuut: 185, type: 'storting', naam: 'Vianen',  bedrag:  9 },
    { minuut: 185, type: 'storting', naam: 'As',      bedrag:  4 },
    { minuut: 185, type: 'storting', naam: 'Henri',   bedrag:  9 },
    { minuut: 185, type: 'storting', naam: 'Nix',     bedrag:  9 },
    { minuut: 185, type: 'storting', naam: '@',       bedrag:  8 },
    // T+230 — Betaling 5: Cynthia €74 (≤€75 ✓) → pot €1
    { minuut: 230, type: 'betaling', naam: 'Cynthia', bedrag: 74 },
    // T+240 — Sluiting
    { minuut: 240, type: 'sluiting' },
  ],
}, 'T7')
