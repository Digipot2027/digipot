/**
 * Centrale applicatieconstanten voor Digipot.
 *
 * Gebruik altijd deze exports — nooit literals herhalen in componenten.
 * Wijzigingen hier worden automatisch doorgevoerd in de hele codebase.
 *
 * @module constants
 */

// ── UUID-validatie ───────────────────────────────────────────────────────────

/**
 * UUID v4 validatiepatroon.
 * Gebruikt door bootstrapDeviceId (supabaseClient.js) en useDeviceId (hook).
 * Eén definitie — wijzigingen worden automatisch doorgevoerd in beide.
 *
 * Formaat: 8-4-4-4-12 hexadecimale tekens.
 * Derde groep begint met 4 (versie), vierde groep begint met 8, 9, a of b (variant).
 * De /i flag maakt het patroon hoofdletterongevoelig.
 */
export const UUID_V4_PATROON = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
