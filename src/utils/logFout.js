import * as Sentry from '@sentry/react'
import { vertaalFout } from './vertaalFout'
import { logMelding } from './logMelding'

/**
 * Centrale foutafhandeling voor Digipot.
 *
 * Gebruik: const bericht = logFout(error, { component: 'ModalDeelnemen', actie: 'deelnemen' })
 *
 * - Logt de fout naar Sentry (alleen in productie, via Sentry.init enabled: PROD)
 * - Logt alle fouten naar PostHog voor frequentie-rapportages
 * - Geeft een vertaalde Nederlandse gebruikerstekst terug
 * - Voegt context toe zonder persoonlijke data (geen namen, bedragen)
 *
 * PII-risico (B3, gedocumenteerd 2026-04-21):
 *   De `error.message` wordt als onderdeel van de Error-instantie naar Sentry
 *   gestuurd. In de huidige codebase bevatten messages alleen door de code
 *   gegenereerde strings (foutcodes, DB-foutmeldingen) — geen gebruikersinvoer.
 *   Risico: als Supabase ooit gebruikersinvoer in een foutmelding opneemt, of
 *   als een toekomstige foutmelding gebruikersinput bevat, lekt die naar Sentry.
 *   Voor dit privéproject met voornamen als enige gebruikersinvoer is het risico
 *   momenteel verwaarloosbaar. Bewust geaccepteerd; geen sanitisatie geïmplementeerd.
 *   PostHog ontvangt alleen de foutcode (string), geen error.message.
 *
 * Regels:
 * - Altijd aanroepen voordat een fout getoond wordt aan de gebruiker
 * - vertaalFout() nooit rechtstreeks aanroepen in componenten
 * - context.component = naam van de component (verplicht)
 * - context.actie = wat de gebruiker probeerde te doen (verplicht)
 */

/**
 * Bepaalt een korte foutcode voor PostHog-rapportages op basis van het foutbericht.
 * Geeft altijd een string terug — nooit een foutbericht met mogelijke PII.
 */
function bepaalFoutCode(bericht) {
  if (bericht.includes('SALDO_TE_LAAG'))   return 'SALDO_TE_LAAG'
  if (bericht.includes('NIET_ACTIEF'))     return 'NIET_ACTIEF'
  if (bericht.includes('REQUEST_TIMEOUT')) return 'REQUEST_TIMEOUT'
  if (bericht.includes('duplicate key') && bericht.includes('deelnemers_potje_id_naam'))
                                           return 'DUPLICATE_NAAM'
  if (bericht.includes('duplicate key') && bericht.includes('deelnemers_potje_id_device'))
                                           return 'DUPLICATE_DEVICE'
  if (bericht.includes('duplicate key'))   return 'DUPLICATE_KEY'
  if (bericht.includes('PGRST116'))        return 'PGRST116'
  if (bericht.includes('JSON object requested, multiple (or no) rows returned'))
                                           return 'PGRST116'
  if (bericht.includes('Cannot coerce the result to a single JSON object'))
                                           return 'PGRST116'
  if (bericht.includes('row-level security')) return 'RLS'
  if (bericht.includes('fetch') || bericht.includes('NetworkError')) return 'NETWERK'
  if (bericht.includes('JWT'))             return 'JWT'
  if (bericht.includes('42501'))           return '42501'
  return 'ONBEKEND'
}

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
  const foutCode = bepaalFoutCode(bericht)

  // Bekende gebruikersfouten worden niet naar Sentry gestuurd —
  // dit zijn verwachte validatiefouten of verwachte gebruikerssituaties, geen bugs.
  //
  // PGRST116: .single() vond nul of meer dan één rij — treedt op bij verouderde/
  // ongeldige potje-links na lifecycle-verwijdering. Verwacht gedrag, geen bug.
  //
  // row-level security: treedt op bij verouderde sessies — verwacht gedrag.
  // Let op: '42501' is bewust verwijderd als uitsluiting (A18 fix, 2026-04-20):
  //   de bootstrapDeviceId()-fix (2026-04-15, TO v4.6) is stabiel gebleken.
  //   42501-fouten zijn nu bugs die Sentry moet ontvangen voor monitoring.
  //
  // REQUEST_TIMEOUT: netwerkprobleem aan gebruikerskant — geen bug.
  const isGebruikersFout =
    bericht.includes('SALDO_TE_LAAG') ||
    bericht.includes('NIET_ACTIEF') ||
    bericht.includes('REQUEST_TIMEOUT') ||
    bericht.includes('duplicate key') ||
    bericht.includes('PGRST116') ||
    bericht.includes('row-level security') ||
    bericht.includes('JSON object requested, multiple (or no) rows returned') ||
    bericht.includes('Cannot coerce the result to a single JSON object')

  if (!isGebruikersFout) {
    Sentry.captureException(errorInstantie, {
      extra: {
        component: context.component || 'onbekend',
        actie: context.actie || 'onbekend',
        supabaseCode: error.code,
        // Geen namen, bedragen of andere PII
      },
    })
    // Technische fouten ook naar PostHog voor frequentie-inzicht
    logMelding('fout_technisch', {
      component: context.component,
      actie: foutCode,
    })
  } else {
    // Bekende gebruiksfouten naar PostHog — voor rapportages op frequentie
    logMelding(`fout_gebruiker_${foutCode.toLowerCase()}`, {
      component: context.component,
      actie: context.actie,
    })
  }

  // Altijd naar console in development
  if (import.meta.env.DEV) {
    console.error(`[${context.component || '?'}/${context.actie || '?'}]`, error)
  }

  return vertaalFout(errorInstantie)
}
