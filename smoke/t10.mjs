/**
 * smoke/t10.mjs — T10: Maximale complexiteit, 24 personen, 5 uur
 *
 * Alle 24 namen. Koppels, afmeldingen, bijstortrondes.
 * Koppels:
 *   Beek+Maaike T+0 (Maaike weg T+44)
 *   Chantal+Tesser T+30 (samen weg T+104)
 *   As T+0, Henri T+60 — samen weg op einde
 *   Marlene+Laird T+45 samen
 *
 * Afgemeld: Maaike T+44, Spoeling T+29, Chantal T+104, Tesser T+104, Grote Strik T+149
 */

import { runScenario } from './runner.mjs'

await runScenario({
  naam:        '[SMOKE-T10] Maximale complexiteit',
  duurMinuten: 300,

  deelnemers: [
    { naam: 'Beek',        isBeek: true,  aankomstMinuut: 0   },
    { naam: 'Maaike',      isBeek: false, aankomstMinuut: 0   }, // koppel Beek, weg T+44
    { naam: 'As',          isBeek: false, aankomstMinuut: 0   }, // koppel Henri
    { naam: 'Beer',        isBeek: false, aankomstMinuut: 0   },
    { naam: 'Poiesz',      isBeek: false, aankomstMinuut: 0   },
    { naam: 'Spoeling',    isBeek: false, aankomstMinuut: 0   }, // weg T+29
    { naam: 'Chantal',     isBeek: false, aankomstMinuut: 30  }, // koppel Tesser
    { naam: 'Tesser',      isBeek: false, aankomstMinuut: 30  }, // koppel Chantal
    { naam: 'Marlene',     isBeek: false, aankomstMinuut: 45  }, // koppel Laird
    { naam: 'Laird',       isBeek: false, aankomstMinuut: 45  }, // koppel Marlene
    { naam: 'Henri',       isBeek: false, aankomstMinuut: 60  }, // koppel As
    { naam: 'Cynthia',     isBeek: false, aankomstMinuut: 60  },
    { naam: 'Dijl',        isBeek: false, aankomstMinuut: 60  },
    { naam: '@',           isBeek: false, aankomstMinuut: 90  },
    { naam: 'Vianen',      isBeek: false, aankomstMinuut: 90  },
    { naam: 'Raaf',        isBeek: false, aankomstMinuut: 90  },
    { naam: 'Grote Strik', isBeek: false, aankomstMinuut: 120 }, // weg T+149
    { naam: 'Alex',        isBeek: false, aankomstMinuut: 120 },
    { naam: 'Nix',         isBeek: false, aankomstMinuut: 150 },
    { naam: 'Margreet',    isBeek: false, aankomstMinuut: 150 },
    { naam: 'Nadia',       isBeek: false, aankomstMinuut: 180 },
    { naam: 'Kwak',        isBeek: false, aankomstMinuut: 180 },
    { naam: 'Ingrid',      isBeek: false, aankomstMinuut: 210 },
    { naam: 'Miek',        isBeek: false, aankomstMinuut: 240 },
  ],

  events: [
    // T+2 — Ronde 1: 6 vroegen (incl. Maaike+As+Spoeling) → pot €44
    { minuut:   2, type: 'storting', naam: 'Beek',     bedrag:  8 },
    { minuut:   2, type: 'storting', naam: 'Maaike',   bedrag:  6 },
    { minuut:   2, type: 'storting', naam: 'As',       bedrag:  5 },
    { minuut:   2, type: 'storting', naam: 'Beer',     bedrag:  9 },
    { minuut:   2, type: 'storting', naam: 'Poiesz',   bedrag:  6 },
    { minuut:   2, type: 'storting', naam: 'Spoeling', bedrag:  4 },
    // T+29 — Spoeling afgemeld
    { minuut:  29, type: 'afmelden', naam: 'Spoeling' },
    // T+30 — Chantal+Tesser aankomst (koppel)
    { minuut:  30, type: 'aankomst', naam: 'Chantal' },
    { minuut:  30, type: 'aankomst', naam: 'Tesser' },
    { minuut:  31, type: 'storting', naam: 'Chantal',  bedrag:  7 },
    { minuut:  31, type: 'storting', naam: 'Tesser',   bedrag: 10 },
    // T+32 — Ronde 2: 6 actieven (excl. Spoeling) → pot €101
    { minuut:  32, type: 'storting', naam: 'Beek',     bedrag:  8 },
    { minuut:  32, type: 'storting', naam: 'Maaike',   bedrag:  6 },
    { minuut:  32, type: 'storting', naam: 'As',       bedrag:  5 },
    { minuut:  32, type: 'storting', naam: 'Beer',     bedrag:  9 },
    { minuut:  32, type: 'storting', naam: 'Poiesz',   bedrag:  6 },
    // T+44 — Maaike afgemeld
    { minuut:  44, type: 'afmelden', naam: 'Maaike' },
    // T+45 — Marlene+Laird aankomst (koppel)
    { minuut:  45, type: 'aankomst', naam: 'Marlene' },
    { minuut:  45, type: 'aankomst', naam: 'Laird' },
    { minuut:  46, type: 'storting', naam: 'Marlene',  bedrag:  8 },
    { minuut:  46, type: 'storting', naam: 'Laird',    bedrag:  9 },
    // T+55 — Betaling 1: Beer €104 (≤€106 ✓) → pot €2
    { minuut:  55, type: 'betaling', naam: 'Beer',     bedrag: 104 },
    // T+60 — Henri+Cynthia+Dijl aankomst
    { minuut:  60, type: 'aankomst', naam: 'Henri' },
    { minuut:  60, type: 'aankomst', naam: 'Cynthia' },
    { minuut:  60, type: 'aankomst', naam: 'Dijl' },
    { minuut:  61, type: 'storting', naam: 'Henri',    bedrag: 10 },
    { minuut:  61, type: 'storting', naam: 'Cynthia',  bedrag:  9 },
    { minuut:  61, type: 'storting', naam: 'Dijl',     bedrag:  8 },
    // T+62 — Ronde 3: 11 actieven → pot €102
    { minuut:  62, type: 'storting', naam: 'Beek',     bedrag:  8 },
    { minuut:  62, type: 'storting', naam: 'As',       bedrag:  5 },
    { minuut:  62, type: 'storting', naam: 'Beer',     bedrag:  9 },
    { minuut:  62, type: 'storting', naam: 'Poiesz',   bedrag:  6 },
    { minuut:  62, type: 'storting', naam: 'Chantal',  bedrag:  7 },
    { minuut:  62, type: 'storting', naam: 'Tesser',   bedrag: 10 },
    { minuut:  62, type: 'storting', naam: 'Marlene',  bedrag:  8 },
    { minuut:  62, type: 'storting', naam: 'Laird',    bedrag:  9 },
    // T+90 — @+Vianen+Raaf aankomst
    { minuut:  90, type: 'aankomst', naam: '@' },
    { minuut:  90, type: 'aankomst', naam: 'Vianen' },
    { minuut:  90, type: 'aankomst', naam: 'Raaf' },
    { minuut:  91, type: 'storting', naam: '@',        bedrag: 10 },
    { minuut:  91, type: 'storting', naam: 'Vianen',   bedrag: 10 },
    { minuut:  91, type: 'storting', naam: 'Raaf',     bedrag:  7 },
    // T+92 — Ronde 4: 14 actieven → pot €183
    { minuut:  92, type: 'storting', naam: 'Beek',     bedrag:  8 },
    { minuut:  92, type: 'storting', naam: 'As',       bedrag:  5 },
    { minuut:  92, type: 'storting', naam: 'Beer',     bedrag:  9 },
    { minuut:  92, type: 'storting', naam: 'Poiesz',   bedrag:  6 },
    { minuut:  92, type: 'storting', naam: 'Chantal',  bedrag:  7 },
    { minuut:  92, type: 'storting', naam: 'Tesser',   bedrag: 10 },
    { minuut:  92, type: 'storting', naam: 'Marlene',  bedrag:  8 },
    { minuut:  92, type: 'storting', naam: 'Laird',    bedrag:  9 },
    { minuut:  92, type: 'storting', naam: 'Henri',    bedrag: 10 },
    { minuut:  92, type: 'storting', naam: 'Cynthia',  bedrag:  9 },
    { minuut:  92, type: 'storting', naam: 'Dijl',     bedrag:  8 },
    // T+104 — Chantal+Tesser afgemeld (koppel, samen weg)
    { minuut: 104, type: 'afmelden', naam: 'Chantal' },
    { minuut: 104, type: 'afmelden', naam: 'Tesser' },
    // T+110 — Betaling 2: Vianen €203 (≤€207 ✓) → pot €4
    { minuut: 110, type: 'betaling', naam: 'Vianen',   bedrag: 203 },
    // T+120 — Grote Strik+Alex aankomst
    { minuut: 120, type: 'aankomst', naam: 'Grote Strik' },
    { minuut: 120, type: 'aankomst', naam: 'Alex' },
    { minuut: 121, type: 'storting', naam: 'Grote Strik', bedrag: 5 },
    { minuut: 121, type: 'storting', naam: 'Alex',     bedrag:  9 },
    // T+122 — Ronde 5: 13 actieven (excl. afgemelden) → pot €113
    { minuut: 122, type: 'storting', naam: 'Beek',     bedrag:  8 },
    { minuut: 122, type: 'storting', naam: 'As',       bedrag:  5 },
    { minuut: 122, type: 'storting', naam: 'Beer',     bedrag:  9 },
    { minuut: 122, type: 'storting', naam: 'Poiesz',   bedrag:  6 },
    { minuut: 122, type: 'storting', naam: 'Marlene',  bedrag:  8 },
    { minuut: 122, type: 'storting', naam: 'Laird',    bedrag:  9 },
    { minuut: 122, type: 'storting', naam: 'Henri',    bedrag: 10 },
    { minuut: 122, type: 'storting', naam: 'Cynthia',  bedrag:  9 },
    { minuut: 122, type: 'storting', naam: 'Dijl',     bedrag:  8 },
    { minuut: 122, type: 'storting', naam: '@',        bedrag: 10 },
    { minuut: 122, type: 'storting', naam: 'Vianen',   bedrag: 10 },
    { minuut: 122, type: 'storting', naam: 'Raaf',     bedrag:  7 },
    // T+149 — Grote Strik afgemeld
    { minuut: 149, type: 'afmelden', naam: 'Grote Strik' },
    // T+150 — Nix+Margreet aankomst
    { minuut: 150, type: 'aankomst', naam: 'Nix' },
    { minuut: 150, type: 'aankomst', naam: 'Margreet' },
    { minuut: 151, type: 'storting', naam: 'Nix',      bedrag: 10 },
    { minuut: 151, type: 'storting', naam: 'Margreet', bedrag:  8 },
    // T+155 — Betaling 3: @ €129 (≤€135 ✓) → pot €6
    { minuut: 155, type: 'betaling', naam: '@',        bedrag: 129 },
    // T+156 — Ronde 6: 14 actieven → pot €116
    { minuut: 156, type: 'storting', naam: 'Beek',     bedrag:  8 },
    { minuut: 156, type: 'storting', naam: 'As',       bedrag:  5 },
    { minuut: 156, type: 'storting', naam: 'Beer',     bedrag:  9 },
    { minuut: 156, type: 'storting', naam: 'Poiesz',   bedrag:  6 },
    { minuut: 156, type: 'storting', naam: 'Marlene',  bedrag:  8 },
    { minuut: 156, type: 'storting', naam: 'Laird',    bedrag:  9 },
    { minuut: 156, type: 'storting', naam: 'Henri',    bedrag: 10 },
    { minuut: 156, type: 'storting', naam: 'Cynthia',  bedrag:  9 },
    { minuut: 156, type: 'storting', naam: 'Dijl',     bedrag:  8 },
    { minuut: 156, type: 'storting', naam: '@',        bedrag: 10 },
    { minuut: 156, type: 'storting', naam: 'Vianen',   bedrag: 10 },
    { minuut: 156, type: 'storting', naam: 'Raaf',     bedrag:  7 },
    { minuut: 156, type: 'storting', naam: 'Alex',     bedrag:  9 },
    // T+180 — Nadia+Kwak aankomst
    { minuut: 180, type: 'aankomst', naam: 'Nadia' },
    { minuut: 180, type: 'aankomst', naam: 'Kwak' },
    { minuut: 181, type: 'storting', naam: 'Nadia',    bedrag:  7 },
    { minuut: 181, type: 'storting', naam: 'Kwak',     bedrag:  5 },
    // T+185 — Betaling 4: Laird €118 (≤€126 ✓) → pot €8
    { minuut: 185, type: 'betaling', naam: 'Laird',    bedrag: 118 },
    // T+186 — Ronde 7: 16 actieven → pot €128
    { minuut: 186, type: 'storting', naam: 'Beek',     bedrag:  8 },
    { minuut: 186, type: 'storting', naam: 'As',       bedrag:  5 },
    { minuut: 186, type: 'storting', naam: 'Beer',     bedrag:  9 },
    { minuut: 186, type: 'storting', naam: 'Poiesz',   bedrag:  6 },
    { minuut: 186, type: 'storting', naam: 'Marlene',  bedrag:  8 },
    { minuut: 186, type: 'storting', naam: 'Laird',    bedrag:  9 },
    { minuut: 186, type: 'storting', naam: 'Henri',    bedrag: 10 },
    { minuut: 186, type: 'storting', naam: 'Cynthia',  bedrag:  9 },
    { minuut: 186, type: 'storting', naam: 'Dijl',     bedrag:  8 },
    { minuut: 186, type: 'storting', naam: '@',        bedrag: 10 },
    { minuut: 186, type: 'storting', naam: 'Vianen',   bedrag: 10 },
    { minuut: 186, type: 'storting', naam: 'Raaf',     bedrag:  7 },
    { minuut: 186, type: 'storting', naam: 'Alex',     bedrag:  9 },
    { minuut: 186, type: 'storting', naam: 'Nix',      bedrag:  9 },
    { minuut: 186, type: 'storting', naam: 'Margreet', bedrag:  7 },
    // T+210 — Ingrid aankomst
    { minuut: 210, type: 'aankomst', naam: 'Ingrid' },
    { minuut: 211, type: 'storting', naam: 'Ingrid',   bedrag:  7 },
    // T+215 — Betaling 5: Henri €129 (≤€139 ✓) → pot €10
    { minuut: 215, type: 'betaling', naam: 'Henri',    bedrag: 129 },
    // T+216 — Bijstortronde: 17 actieven → pot €136
    { minuut: 216, type: 'storting', naam: 'Beek',     bedrag:  8 },
    { minuut: 216, type: 'storting', naam: 'As',       bedrag:  5 },
    { minuut: 216, type: 'storting', naam: 'Beer',     bedrag:  8 },
    { minuut: 216, type: 'storting', naam: 'Poiesz',   bedrag:  5 },
    { minuut: 216, type: 'storting', naam: 'Marlene',  bedrag:  7 },
    { minuut: 216, type: 'storting', naam: 'Laird',    bedrag:  8 },
    { minuut: 216, type: 'storting', naam: 'Henri',    bedrag:  8 },
    { minuut: 216, type: 'storting', naam: 'Cynthia',  bedrag:  8 },
    { minuut: 216, type: 'storting', naam: 'Dijl',     bedrag:  7 },
    { minuut: 216, type: 'storting', naam: '@',        bedrag:  8 },
    { minuut: 216, type: 'storting', naam: 'Vianen',   bedrag:  8 },
    { minuut: 216, type: 'storting', naam: 'Raaf',     bedrag:  6 },
    { minuut: 216, type: 'storting', naam: 'Alex',     bedrag:  8 },
    { minuut: 216, type: 'storting', naam: 'Nix',      bedrag:  8 },
    { minuut: 216, type: 'storting', naam: 'Margreet', bedrag:  7 },
    { minuut: 216, type: 'storting', naam: 'Nadia',    bedrag:  6 },
    { minuut: 216, type: 'storting', naam: 'Kwak',     bedrag:  4 },
    // T+220 — Betaling 6: Cynthia €117 (≤€129 ✓) → pot €12
    { minuut: 220, type: 'betaling', naam: 'Cynthia',  bedrag: 117 },
    // T+240 — Miek aankomst
    { minuut: 240, type: 'aankomst', naam: 'Miek' },
    { minuut: 241, type: 'storting', naam: 'Miek',     bedrag:  6 },
    // T+242 — Ronde 8: 18 actieven → pot €143
    { minuut: 242, type: 'storting', naam: 'Beek',     bedrag:  7 },
    { minuut: 242, type: 'storting', naam: 'As',       bedrag:  4 },
    { minuut: 242, type: 'storting', naam: 'Beer',     bedrag:  8 },
    { minuut: 242, type: 'storting', naam: 'Poiesz',   bedrag:  5 },
    { minuut: 242, type: 'storting', naam: 'Marlene',  bedrag:  7 },
    { minuut: 242, type: 'storting', naam: 'Laird',    bedrag:  8 },
    { minuut: 242, type: 'storting', naam: 'Henri',    bedrag:  8 },
    { minuut: 242, type: 'storting', naam: 'Cynthia',  bedrag:  8 },
    { minuut: 242, type: 'storting', naam: 'Dijl',     bedrag:  7 },
    { minuut: 242, type: 'storting', naam: '@',        bedrag:  8 },
    { minuut: 242, type: 'storting', naam: 'Vianen',   bedrag:  8 },
    { minuut: 242, type: 'storting', naam: 'Raaf',     bedrag:  6 },
    { minuut: 242, type: 'storting', naam: 'Alex',     bedrag:  8 },
    { minuut: 242, type: 'storting', naam: 'Nix',      bedrag:  8 },
    { minuut: 242, type: 'storting', naam: 'Margreet', bedrag:  7 },
    { minuut: 242, type: 'storting', naam: 'Nadia',    bedrag:  6 },
    { minuut: 242, type: 'storting', naam: 'Kwak',     bedrag:  4 },
    { minuut: 242, type: 'storting', naam: 'Ingrid',   bedrag:  6 },
    // T+280 — Betaling 7: Dijl €127 (≤€141 ✓) → pot €14
    { minuut: 280, type: 'betaling', naam: 'Dijl',     bedrag: 127 },
    // T+285 — Bijstortronde 2: 18 actieven → pot €116
    { minuut: 285, type: 'storting', naam: 'Beek',     bedrag:  6 },
    { minuut: 285, type: 'storting', naam: 'As',       bedrag:  4 },
    { minuut: 285, type: 'storting', naam: 'Beer',     bedrag:  7 },
    { minuut: 285, type: 'storting', naam: 'Poiesz',   bedrag:  5 },
    { minuut: 285, type: 'storting', naam: 'Marlene',  bedrag:  6 },
    { minuut: 285, type: 'storting', naam: 'Laird',    bedrag:  7 },
    { minuut: 285, type: 'storting', naam: 'Henri',    bedrag:  7 },
    { minuut: 285, type: 'storting', naam: 'Cynthia',  bedrag:  7 },
    { minuut: 285, type: 'storting', naam: 'Dijl',     bedrag:  6 },
    { minuut: 285, type: 'storting', naam: '@',        bedrag:  7 },
    { minuut: 285, type: 'storting', naam: 'Vianen',   bedrag:  7 },
    { minuut: 285, type: 'storting', naam: 'Raaf',     bedrag:  5 },
    { minuut: 285, type: 'storting', naam: 'Alex',     bedrag:  7 },
    { minuut: 285, type: 'storting', naam: 'Nix',      bedrag:  7 },
    { minuut: 285, type: 'storting', naam: 'Margreet', bedrag:  6 },
    { minuut: 285, type: 'storting', naam: 'Nadia',    bedrag:  5 },
    { minuut: 285, type: 'storting', naam: 'Kwak',     bedrag:  4 },
    { minuut: 285, type: 'storting', naam: 'Ingrid',   bedrag:  5 },
    { minuut: 285, type: 'storting', naam: 'Miek',     bedrag:  5 },
    // T+295 — Betaling 8: Raaf €111 (≤€127 ✓) → pot €16
    { minuut: 295, type: 'betaling', naam: 'Raaf',     bedrag: 111 },
    // T+300 — Sluiting
    { minuut: 300, type: 'sluiting' },
  ],
}, 'T10')
