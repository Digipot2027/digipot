/**
 * Centrale applicatieconstanten voor Digipot.
 *
 * Gebruik altijd deze exports — nooit literals herhalen in componenten.
 * Wijzigingen hier worden automatisch doorgevoerd in de hele codebase.
 *
 * @module constants
 */

// ── localStorage-sleutels ────────────────────────────────────────────────────

/** Uniek device-identificatienummer (UUID). Aangemaakt bij eerste bezoek. */
export const DEVICE_ID_KEY = 'digipot_device_id'

/** Naam uit het Profielscherm — optioneel, vooraf invullen bij Deelneemscherm. */
export const PROFIEL_NAAM_KEY = 'digipot_profiel_naam'

/** Gekozen tekstgrootte: 'normaal' | 'groot' | 'extra-groot'. */
export const TEKSTGROOTTE_KEY = 'digipot_tekstgrootte'

// ── Invoerlimieten ───────────────────────────────────────────────────────────

/** Maximale lengte van een deelnemer- of potjenaam (overeenkomstig DB-constraint). */
export const MAX_NAAM = 30

/** Maximaal aantal deelnemers per potje (overeenkomstig DB-constraint). */
export const MAX_DEELNEMERS = 20

/** Maximaal bedrag per transactie in EUR (overeenkomstig DB CHECK-constraint). */
export const MAX_BEDRAG = 999.99

// ── Valuta ───────────────────────────────────────────────────────────────────

/**
 * Standaard valuta voor nieuwe potjes (ISO 4217).
 * Overeenkomstig DB DEFAULT 'EUR' op kolom potjes.valuta.
 */
export const STANDAARD_VALUTA = 'EUR'

// ── Valuta-opties voor potje aanmaken ────────────────────────────────────────

/**
 * Beschikbare valuta's voor nieuwe potjes.
 * Waarde = ISO 4217-code, label = weergavenaam.
 */
export const VALUTA_OPTIES = [
  { waarde: 'EUR', label: 'EUR — Euro (€)' },
  { waarde: 'USD', label: 'USD — US Dollar ($)' },
  { waarde: 'GBP', label: 'GBP — Brits Pond (£)' },
  { waarde: 'CHF', label: 'CHF — Zwitserse Frank (Fr.)' },
  { waarde: 'DKK', label: 'DKK — Deense Kroon (kr.)' },
  { waarde: 'NOK', label: 'NOK — Noorse Kroon (kr.)' },
  { waarde: 'SEK', label: 'SEK — Zweedse Kroon (kr.)' },
]
