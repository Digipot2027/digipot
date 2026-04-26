import posthog from 'posthog-js'

/**
 * Logt een gebruiksgebeurtenis naar PostHog.
 *
 * Gebruik:
 *   logMelding('storting_geslaagd', { component: 'PaginaStorten' })
 *   logMelding('potje_aangemaakt', { component: 'PaginaNieuwPotje' })
 *
 * Regels:
 * - Nooit PII meesturen (geen namen, bedragen, device-IDs)
 * - Alleen in productie actief (PostHog-init heeft enabled: PROD)
 * - context.component is verplicht voor traceerbaarheid
 *
 * Eventcategorieën:
 *   succes_*         — gebruiker heeft een actie succesvol afgerond
 *   fout_gebruiker_* — bekende gebruikersfout getoond (geen bug)
 *   fout_technisch_* — onverwachte technische fout (ook naar Sentry)
 */
export function logMelding(eventNaam, context = {}) {
  if (!import.meta.env.PROD) return

  try {
    posthog.capture(eventNaam, {
      component: context.component || 'onbekend',
      ...(context.actie ? { actie: context.actie } : {}),
      // Geen namen, bedragen, device-IDs of andere PII
    })
  } catch {
    // PostHog mag nooit de applicatie breken
  }
}
