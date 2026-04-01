/**
 * smoke/t8.mjs — T8: Marathon 5,5 uur, 14 personen, 2 bijstortrondes
 *
 * Koppels: Beek+Maaike T+0 (Maaike weg T+59), As T+30+Henri T+90 samen weg einde,
 *          Marlene+Laird T+60 samen
 * Afgemeld: Maaike T+59
 */

import { runScenario } from './runner.mjs'

await runScenario({
  naam:        '[SMOKE-T8] Marathon zaterdag',
  duurMinuten: 330,

  deelnemers: [
    { naam: 'Beek',    isBeek: true,  aankomstMinuut: 0   },
    { naam: 'Maaike',  isBeek: false, aankomstMinuut: 0   }, // koppel Beek, weg T+59
    { naam: 'Beer',    isBeek: false, aankomstMinuut: 0   },
    { naam: 'Cynthia', isBeek: false, aankomstMinuut: 0   },
    { naam: 'Poiesz',  isBeek: false, aankomstMinuut: 0   },
    { naam: 'As',      isBeek: false, aankomstMinuut: 30  }, // koppel Henri
    { naam: 'Marlene', isBeek: false, aankomstMinuut: 60  }, // koppel Laird
    { naam: 'Laird',   isBeek: false, aankomstMinuut: 60  }, // koppel Marlene
    { naam: 'Dijl',    isBeek: false, aankomstMinuut: 90  },
    { naam: 'Henri',   isBeek: false, aankomstMinuut: 90  }, // koppel As
    { naam: '@',       isBeek: false, aankomstMinuut: 120 },
    { naam: 'Vianen',  isBeek: false, aankomstMinuut: 150 },
    { naam: 'Nix',     isBeek: false, aankomstMinuut: 180 },
    { naam: 'Raaf',    isBeek: false, aankomstMinuut: 210 },
  ],

  events: [
    // T+2 — Ronde 1: 5 vroegen (incl. Maaike) → pot €44
    { minuut:   2, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut:   2, type: 'storting', naam: 'Maaike',  bedrag:  6 },
    { minuut:   2, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut:   2, type: 'storting', naam: 'Cynthia', bedrag:  9 },
    { minuut:   2, type: 'storting', naam: 'Poiesz',  bedrag:  6 },
    // T+30 — As aankomst
    { minuut:  30, type: 'aankomst', naam: 'As' },
    { minuut:  31, type: 'storting', naam: 'As',      bedrag:  5 },
    // T+32 — Ronde 2: 5 vroegen+As=6 → pot €93
    { minuut:  32, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut:  32, type: 'storting', naam: 'Maaike',  bedrag:  6 },
    { minuut:  32, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut:  32, type: 'storting', naam: 'Cynthia', bedrag:  9 },
    { minuut:  32, type: 'storting', naam: 'Poiesz',  bedrag:  6 },
    // T+55 — Betaling 1: Beer €79 (≤€81 ✓) → pot €2
    { minuut:  55, type: 'betaling', naam: 'Beer',    bedrag: 79 },
    // T+59 — Maaike afgemeld
    { minuut:  59, type: 'afmelden', naam: 'Maaike' },
    // T+60 — Marlene+Laird aankomst (koppel)
    { minuut:  60, type: 'aankomst', naam: 'Marlene' },
    { minuut:  60, type: 'aankomst', naam: 'Laird' },
    { minuut:  61, type: 'storting', naam: 'Marlene', bedrag:  8 },
    { minuut:  61, type: 'storting', naam: 'Laird',   bedrag:  9 },
    // T+62 — Ronde 3: 7 actieven (excl. Maaike) → pot €67
    { minuut:  62, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut:  62, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut:  62, type: 'storting', naam: 'Cynthia', bedrag:  9 },
    { minuut:  62, type: 'storting', naam: 'Poiesz',  bedrag:  6 },
    { minuut:  62, type: 'storting', naam: 'As',      bedrag:  5 },
    // T+90 — Dijl+Henri aankomst
    { minuut:  90, type: 'aankomst', naam: 'Dijl' },
    { minuut:  90, type: 'aankomst', naam: 'Henri' },
    { minuut:  91, type: 'storting', naam: 'Dijl',    bedrag:  8 },
    { minuut:  91, type: 'storting', naam: 'Henri',   bedrag: 10 },
    // T+92 — Ronde 4: 9 actieven → pot €142
    { minuut:  92, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut:  92, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut:  92, type: 'storting', naam: 'Cynthia', bedrag:  9 },
    { minuut:  92, type: 'storting', naam: 'Poiesz',  bedrag:  6 },
    { minuut:  92, type: 'storting', naam: 'As',      bedrag:  5 },
    { minuut:  92, type: 'storting', naam: 'Marlene', bedrag:  8 },
    { minuut:  92, type: 'storting', naam: 'Laird',   bedrag:  9 },
    // T+115 — Betaling 2: Cynthia €126 (≤€128 ✓) → pot €2
    { minuut: 115, type: 'betaling', naam: 'Cynthia', bedrag: 126 },
    // T+120 — @ aankomst
    { minuut: 120, type: 'aankomst', naam: '@' },
    { minuut: 121, type: 'storting', naam: '@',       bedrag: 10 },
    // T+122 — Ronde 5: 10 actieven → pot €99
    { minuut: 122, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut: 122, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut: 122, type: 'storting', naam: 'Cynthia', bedrag:  9 },
    { minuut: 122, type: 'storting', naam: 'Poiesz',  bedrag:  6 },
    { minuut: 122, type: 'storting', naam: 'As',      bedrag:  5 },
    { minuut: 122, type: 'storting', naam: 'Marlene', bedrag:  8 },
    { minuut: 122, type: 'storting', naam: 'Laird',   bedrag:  9 },
    { minuut: 122, type: 'storting', naam: 'Dijl',    bedrag:  8 },
    { minuut: 122, type: 'storting', naam: 'Henri',   bedrag: 10 },
    // T+150 — Vianen aankomst
    { minuut: 150, type: 'aankomst', naam: 'Vianen' },
    { minuut: 151, type: 'storting', naam: 'Vianen',  bedrag: 10 },
    // T+155 — Betaling 3: Laird €92 (≤€94 ✓) → pot €2
    { minuut: 155, type: 'betaling', naam: 'Laird',   bedrag: 92 },
    // T+156 — Ronde 6: 11 actieven → pot €95
    { minuut: 156, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut: 156, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut: 156, type: 'storting', naam: 'Cynthia', bedrag:  9 },
    { minuut: 156, type: 'storting', naam: 'Poiesz',  bedrag:  6 },
    { minuut: 156, type: 'storting', naam: 'As',      bedrag:  5 },
    { minuut: 156, type: 'storting', naam: 'Marlene', bedrag:  8 },
    { minuut: 156, type: 'storting', naam: 'Laird',   bedrag:  9 },
    { minuut: 156, type: 'storting', naam: 'Dijl',    bedrag:  8 },
    { minuut: 156, type: 'storting', naam: 'Henri',   bedrag: 10 },
    { minuut: 156, type: 'storting', naam: '@',       bedrag: 10 },
    // T+180 — Nix aankomst
    { minuut: 180, type: 'aankomst', naam: 'Nix' },
    { minuut: 181, type: 'storting', naam: 'Nix',     bedrag: 10 },
    // T+185 — Betaling 4: @ €92 (≤€94 ✓) → pot €2
    { minuut: 185, type: 'betaling', naam: '@',       bedrag: 92 },
    // T+186 — Ronde 7: 12 actieven → pot €104
    { minuut: 186, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut: 186, type: 'storting', naam: 'Beer',    bedrag:  9 },
    { minuut: 186, type: 'storting', naam: 'Cynthia', bedrag:  9 },
    { minuut: 186, type: 'storting', naam: 'Poiesz',  bedrag:  6 },
    { minuut: 186, type: 'storting', naam: 'As',      bedrag:  5 },
    { minuut: 186, type: 'storting', naam: 'Marlene', bedrag:  8 },
    { minuut: 186, type: 'storting', naam: 'Laird',   bedrag:  9 },
    { minuut: 186, type: 'storting', naam: 'Dijl',    bedrag:  8 },
    { minuut: 186, type: 'storting', naam: 'Henri',   bedrag: 10 },
    { minuut: 186, type: 'storting', naam: 'Vianen',  bedrag: 10 },
    // T+210 — Raaf aankomst
    { minuut: 210, type: 'aankomst', naam: 'Raaf' },
    { minuut: 211, type: 'storting', naam: 'Raaf',    bedrag:  7 },
    // T+215 — Betaling 5: Henri €89 (≤€91 ✓) → pot €2
    { minuut: 215, type: 'betaling', naam: 'Henri',   bedrag: 89 },
    // T+216 — Bijstortronde 1: 13 actieven → pot €107
    { minuut: 216, type: 'storting', naam: 'Beek',    bedrag:  8 },
    { minuut: 216, type: 'storting', naam: 'Beer',    bedrag:  8 },
    { minuut: 216, type: 'storting', naam: 'Cynthia', bedrag:  8 },
    { minuut: 216, type: 'storting', naam: 'Poiesz',  bedrag:  6 },
    { minuut: 216, type: 'storting', naam: 'As',      bedrag:  5 },
    { minuut: 216, type: 'storting', naam: 'Marlene', bedrag:  7 },
    { minuut: 216, type: 'storting', naam: 'Laird',   bedrag:  8 },
    { minuut: 216, type: 'storting', naam: 'Dijl',    bedrag:  7 },
    { minuut: 216, type: 'storting', naam: 'Henri',   bedrag:  8 },
    { minuut: 216, type: 'storting', naam: 'Vianen',  bedrag:  8 },
    { minuut: 216, type: 'storting', naam: 'Nix',     bedrag:  8 },
    { minuut: 216, type: 'storting', naam: '@',       bedrag:  7 },
    { minuut: 216, type: 'storting', naam: 'Raaf',    bedrag:  6 },
    // T+220 — Betaling 6: Vianen €94 (≤€96 ✓) → pot €2
    { minuut: 220, type: 'betaling', naam: 'Vianen',  bedrag: 94 },
    // T+260 — Ronde 8: 13 actieven → pot €97
    { minuut: 260, type: 'storting', naam: 'Beek',    bedrag:  7 },
    { minuut: 260, type: 'storting', naam: 'Beer',    bedrag:  8 },
    { minuut: 260, type: 'storting', naam: 'Cynthia', bedrag:  8 },
    { minuut: 260, type: 'storting', naam: 'Poiesz',  bedrag:  5 },
    { minuut: 260, type: 'storting', naam: 'As',      bedrag:  4 },
    { minuut: 260, type: 'storting', naam: 'Marlene', bedrag:  7 },
    { minuut: 260, type: 'storting', naam: 'Laird',   bedrag:  8 },
    { minuut: 260, type: 'storting', naam: 'Dijl',    bedrag:  7 },
    { minuut: 260, type: 'storting', naam: 'Henri',   bedrag:  8 },
    { minuut: 260, type: 'storting', naam: 'Vianen',  bedrag:  9 },
    { minuut: 260, type: 'storting', naam: 'Nix',     bedrag:  8 },
    { minuut: 260, type: 'storting', naam: '@',       bedrag:  7 },
    { minuut: 260, type: 'storting', naam: 'Raaf',    bedrag:  6 },
    // T+310 — Betaling 7: Nix €92 (≤€94 ✓) → pot €2
    { minuut: 310, type: 'betaling', naam: 'Nix',     bedrag: 92 },
    // T+330 — Sluiting
    { minuut: 330, type: 'sluiting' },
  ],
}, 'T8')
