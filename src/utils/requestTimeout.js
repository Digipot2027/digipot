/**
 * requestTimeout.js — timeout-wrapper voor Supabase-queries
 *
 * Supabase heeft geen ingebouwde query-timeout voor de REST-laag.
 * Bij een trage of weggevallen verbinding hangt een Promise.all() onbeperkt,
 * waardoor de UI in laad-staat blijft zonder feedback of herstel.
 *
 * GEBRUIK
 *   const { data, error } = await metTimeout(supabase.from('potjes').select('*'))
 *   const { data, error } = await metTimeout(supabase.from('potjes').select('*'), 5000)
 *
 * GEDRAG
 *   - Bij overschrijding van de timeout gooit metTimeout() een Error met
 *     message 'REQUEST_TIMEOUT'. De aanroepende code vangt dit op en kan
 *     een gebruiksvriendelijke melding tonen via logFout() / vertaalFout().
 *   - De Supabase-call zelf wordt niet geannuleerd (PostgREST ondersteunt
 *     geen AbortController via de JS-client zonder eigen fetch-override).
 *     De call loopt op de achtergrond af maar het resultaat wordt genegeerd.
 *   - 'REQUEST_TIMEOUT' is opgenomen in de uitzonderingslijst van logFout.js
 *     als gebruikersfout — geen Sentry-ruis.
 *   - vertaalFout.js vertaalt REQUEST_TIMEOUT naar een Nederlandse melding.
 *
 * STANDAARD TIMEOUT
 *   QUERY_TIMEOUT_MS = 10 000 ms (10 seconden).
 *   Supabase free-tier heeft een cold-start van ±2-4 seconden. 10 seconden
 *   geeft voldoende buffer voor slechte verbindingen zonder onnodig lang te
 *   wachten. Schrijfoperaties (INSERT/UPDATE/DELETE) gebruiken dezelfde waarde.
 *
 * @module requestTimeout
 */

export const QUERY_TIMEOUT_MS = 10_000

/**
 * Wraps een Supabase-query-promise met een vaste timeout.
 *
 * @param {Promise} queryPromise - De Supabase-querychain (.select(), .insert(), enz.)
 * @param {number}  [ms=QUERY_TIMEOUT_MS] - Timeout in milliseconden
 * @returns {Promise<{data: any, error: any}>}
 * @throws {Error} Met message 'REQUEST_TIMEOUT' bij overschrijding
 */
export function metTimeout(queryPromise, ms = QUERY_TIMEOUT_MS) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), ms)
  )
  return Promise.race([queryPromise, timeout])
}
