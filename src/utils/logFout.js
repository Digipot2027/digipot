import * as Sentry from '@sentry/react'
import { vertaalFout } from './vertaalFout'

/**
 * Centrale foutafhandeling voor Digipot.
 *
 * Gebruik: const bericht = logFout(error, { component: 'ModalDeelnemen', actie: 'deelnemen' })
 *
 * - Logt de fout naar Sentry (alleen in productie, via Sentry.init enabled: PROD)
 * - Geeft een vertaalde Nederlandse gebruikerstekst terug
 * - Voegt context toe zonder persoonlijke data (geen namen, bedragen)
 *
 * Regels:
 * - Altijd aanroepen voordat een fout getoond wordt aan de gebruiker
 * - vertaalFout() nooit rechtstreeks aanroepen in componenten
 * - context.component = naam van de component (verplicht)
 * - context.actie = wat de gebruiker probeerde te doen (verplicht)
 */
export function logFout(error, context = {}) {
  if (!error) return 'Er is iets misgegaan. Probeer het opnieuw.'

  // Supabase geeft soms een plain object terug: { code, details, hint, message }
  // Sentry kan alleen echte Error-instanties correct rapporteren.
  // Converteer plain objects naar een Error zodat de stack trace en het bericht
  // leesbaar zijn in Sentry in plaats van "Object captured as exception with keys: ..."
  const errorInstantie = error instanceof Error
    ? error
    : Object.assign(
        new Error(error.message || error.code || JSON.stringify(error)),
        { supabaseCode: error.code, supabaseHint: error.hint, supabaseDetails: error.details }
      )

  const bericht = errorInstantie.message || ''

  // Bekende gebruikersfouten worden niet naar Sentry gestuurd —
  // dit zijn verwachte validatiefouten, geen bugs
  const isGebruikersFout =
    bericht.includes('SALDO_TE_LAAG') ||
    bericht.includes('NIET_ACTIEF') ||
    bericht.includes('duplicate key')

  if (!isGebruikersFout) {
    Sentry.captureException(errorInstantie, {
      extra: {
        component: context.component || 'onbekend',
        actie: context.actie || 'onbekend',
        supabaseCode: error.code,
        // Geen namen, bedragen of andere PII
      },
    })
  }

  // Altijd naar console in development
  if (import.meta.env.DEV) {
    console.error(`[${context.component || '?'}/${context.actie || '?'}]`, error)
  }

  return vertaalFout(errorInstantie)
}
