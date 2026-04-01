/**
 * smoke/t5.mjs — T5: As+Henri koppel, Grote Strik vroeg weg, 3,5 uur, 11 personen
 *
 * Koppels: As T+30, Henri T+60 (As komt eerder), samen weg op einde
 *          Marlene+Laird T+45 samen
 * Afgemeld: Grote Strik T+60 (<3% verlies)
 *
 * Saldo-simulatie:
 *   T+2:  5 vroegen: Beek8+Poiesz6+Cynthia9+Dijl8+Miek6+Grote Strik4=€41  pot  €41
 *   T+31: As aankomst+storting €5                                            pot  €46
 *   T+45: Marlene+Laird aankomst+storting €8+€9=€17                         pot  €63
 *   T+60: Grote Strik afgemeld; Henri aankomst+storting €10                 pot  €73
 *   T+62: Ronde 2: 9 actieven (excl. Grote Strik) = €73                    pot €146
 *   T+80: Betaling 1: Cynthia €135 (≤€146 ✓)                               pot  €11
 *   T+90: Ronde 3: 9 actieven = €73                                         pot  €84
 *   T+120: Betaling 2: Laird €80 (≤€84 ✓)                                  pot   €4
 *   T+125: Ronde 4: 9 actieven = €73                                        pot  €77
 *   T+160: Betaling 3: Henri €74 (≤€77 ✓)                                  pot   €3
 *   T+165: Ronde 5: 9 actieven = €63                                        pot  €66
 *   T+195: Betaling 4: Dijl €64 (≤€66 ✓)                                   pot   €2
 *   T+210: sluiting
 *
 * Totaal gestort: 41+5+17+10+73+73+73+63 = €355  (Grote Strik €4)
 * Betalingen: 135+80+74+64 = €353 = 99.4% van €355 ✓
 */

import { runScenario } from './runner.mjs'

await runScenario({
  naam:        '[SMOKE-T5] Dinsdagavond',
  duurMinuten: 210,

  deelnemers: [
    { naam: 'Beek',        isBeek: true,  aankomstMinuut: 0  },
    { naam: 'Poiesz',      isBeek: false, aankomstMinuut: 0  },
    { naam: 'Cynthia',     isBeek: false, aankomstMinuut: 0  },
    { naam: 'Dijl',        isBeek: false, aankomstMinuut: 0  },
    { naam: 'Miek',        isBeek: false, aankomstMinuut: 0  },
    { naam: 'Grote Strik', isBeek: false, aankomstMinuut: 0  },
    { naam: 'As',          isBeek: false, aankomstMinuut: 30 }, // koppel Henri, komt eerder
    { naam: 'Marlene',     isBeek: false, aankomstMinuut: 45 }, // koppel Laird
    { naam: 'Laird',       isBeek: false, aankomstMinuut: 45 }, // koppel Marlene
    { naam: 'Henri',       isBeek: false, aankomstMinuut: 60 }, // koppel As
    { naam: 'Nadia',       isBeek: false, aankomstMinuut: 90 },
  ],

  events: [
    // T+2 — Ronde 1: 6 vroegen (incl. Grote Strik) → pot €41
    { minuut:   2, type: 'storting', naam: 'Beek',        bedrag:  8 },
    { minuut:   2, type: 'storting', naam: 'Poiesz',      bedrag:  6 },
    { minuut:   2, type: 'storting', naam: 'Cynthia',     bedrag:  9 },
    { minuut:   2, type: 'storting', naam: 'Dijl',        bedrag:  8 },
    { minuut:   2, type: 'storting', naam: 'Miek',        bedrag:  6 },
    { minuut:   2, type: 'storting', naam: 'Grote Strik', bedrag:  4 },
    // T+30 — As aankomst
    { minuut:  30, type: 'aankomst', naam: 'As' },
    { minuut:  31, type: 'storting', naam: 'As',          bedrag:  5 },
    // T+45 — Marlene+Laird aankomst (koppel)
    { minuut:  45, type: 'aankomst', naam: 'Marlene' },
    { minuut:  45, type: 'aankomst', naam: 'Laird' },
    { minuut:  46, type: 'storting', naam: 'Marlene',     bedrag:  8 },
    { minuut:  46, type: 'storting', naam: 'Laird',       bedrag:  9 },
    // T+59 — Grote Strik afgemeld
    { minuut:  59, type: 'afmelden', naam: 'Grote Strik' },
    // T+60 — Henri aankomst (koppel As)
    { minuut:  60, type: 'aankomst', naam: 'Henri' },
    { minuut:  61, type: 'storting', naam: 'Henri',       bedrag: 10 },
    // T+62 — Ronde 2: 9 actieven → pot €146
    { minuut:  62, type: 'storting', naam: 'Beek',        bedrag:  8 },
    { minuut:  62, type: 'storting', naam: 'Poiesz',      bedrag:  6 },
    { minuut:  62, type: 'storting', naam: 'Cynthia',     bedrag:  9 },
    { minuut:  62, type: 'storting', naam: 'Dijl',        bedrag:  8 },
    { minuut:  62, type: 'storting', naam: 'Miek',        bedrag:  6 },
    { minuut:  62, type: 'storting', naam: 'As',          bedrag:  5 },
    { minuut:  62, type: 'storting', naam: 'Marlene',     bedrag:  8 },
    { minuut:  62, type: 'storting', naam: 'Laird',       bedrag:  9 },
    { minuut:  62, type: 'storting', naam: 'Henri',       bedrag: 10 },
    // T+80 — Betaling 1: Cynthia €135 (≤€146 ✓) → pot €11
    { minuut:  80, type: 'betaling', naam: 'Cynthia',     bedrag: 135 },
    // T+90 — Nadia aankomst
    { minuut:  90, type: 'aankomst', naam: 'Nadia' },
    { minuut:  91, type: 'storting', naam: 'Nadia',       bedrag:  7 },
    // T+92 — Ronde 3: 10 actieven (Nadia T+90 aanwezig) → pot €95
    { minuut:  92, type: 'storting', naam: 'Beek',        bedrag:  8 },
    { minuut:  92, type: 'storting', naam: 'Poiesz',      bedrag:  6 },
    { minuut:  92, type: 'storting', naam: 'Cynthia',     bedrag:  9 },
    { minuut:  92, type: 'storting', naam: 'Dijl',        bedrag:  8 },
    { minuut:  92, type: 'storting', naam: 'Miek',        bedrag:  6 },
    { minuut:  92, type: 'storting', naam: 'As',          bedrag:  5 },
    { minuut:  92, type: 'storting', naam: 'Marlene',     bedrag:  8 },
    { minuut:  92, type: 'storting', naam: 'Laird',       bedrag:  9 },
    { minuut:  92, type: 'storting', naam: 'Henri',       bedrag: 10 },
    { minuut:  92, type: 'storting', naam: 'Nadia',       bedrag:  7 },
    // T+120 — Betaling 2: Laird €82 (≤€94 ✓) → pot €12
    { minuut: 120, type: 'betaling', naam: 'Laird',       bedrag: 82 },
    // T+125 — Ronde 4: 10 actieven → pot €88
    { minuut: 125, type: 'storting', naam: 'Beek',        bedrag:  8 },
    { minuut: 125, type: 'storting', naam: 'Poiesz',      bedrag:  6 },
    { minuut: 125, type: 'storting', naam: 'Cynthia',     bedrag:  9 },
    { minuut: 125, type: 'storting', naam: 'Dijl',        bedrag:  8 },
    { minuut: 125, type: 'storting', naam: 'Miek',        bedrag:  6 },
    { minuut: 125, type: 'storting', naam: 'As',          bedrag:  5 },
    { minuut: 125, type: 'storting', naam: 'Marlene',     bedrag:  8 },
    { minuut: 125, type: 'storting', naam: 'Laird',       bedrag:  9 },
    { minuut: 125, type: 'storting', naam: 'Henri',       bedrag: 10 },
    { minuut: 125, type: 'storting', naam: 'Nadia',       bedrag:  7 },
    // T+160 — Betaling 3: Henri €74 (≤€88 ✓) → pot €14
    { minuut: 160, type: 'betaling', naam: 'Henri',       bedrag: 74 },
    // T+165 — Ronde 5: 10 actieven (incl. Nadia) → pot €69
    { minuut: 165, type: 'storting', naam: 'Beek',        bedrag:  7 },
    { minuut: 165, type: 'storting', naam: 'Poiesz',      bedrag:  5 },
    { minuut: 165, type: 'storting', naam: 'Cynthia',     bedrag:  8 },
    { minuut: 165, type: 'storting', naam: 'Dijl',        bedrag:  7 },
    { minuut: 165, type: 'storting', naam: 'Miek',        bedrag:  5 },
    { minuut: 165, type: 'storting', naam: 'As',          bedrag:  4 },
    { minuut: 165, type: 'storting', naam: 'Marlene',     bedrag:  7 },
    { minuut: 165, type: 'storting', naam: 'Laird',       bedrag:  8 },
    { minuut: 165, type: 'storting', naam: 'Henri',       bedrag:  8 },
    { minuut: 165, type: 'storting', naam: 'Nadia',       bedrag:  6 },
    // T+195 — Betaling 4: Dijl €72 (≤€75 ✓) → pot €3
    { minuut: 195, type: 'betaling', naam: 'Dijl',        bedrag: 72 },
    // T+210 — Sluiting
    { minuut: 210, type: 'sluiting' },
  ],
}, 'T5')
