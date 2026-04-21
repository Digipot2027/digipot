/**
 * Vertaalt technische foutcodes naar Nederlandse gebruikersmeldingen
 */
export function vertaalFout(error) {
  if (!error) return 'Er is iets misgegaan. Probeer het opnieuw.'

  const bericht = error.message || error.toString()

  if (bericht.includes('SALDO_TE_LAAG'))
    return null // Wordt afgehandeld met het actuele saldo in de component

  if (bericht.includes('MAX_DEELNEMERS'))
    return 'Dit potje heeft het maximum van 20 deelnemers bereikt.'

  if (bericht.includes('duplicate key') && bericht.includes('deelnemers_potje_id_naam'))
    return 'Deze naam is al bezet in dit potje. Kies een andere naam.'

  if (bericht.includes('duplicate key') && bericht.includes('deelnemers_potje_id_device'))
    return 'Je lijkt al mee te doen. Kies je naam om verder te gaan.'

  if (bericht.includes('potjes') && bericht.includes('gesloten'))
    return 'Dit potje is al gesloten en kan niet meer worden gewijzigd.'

  if (bericht.includes('check_violation') && bericht.includes('bedrag'))
    return 'Voer een bedrag in tussen €0,01 en €999,99.'

  if (bericht.includes('check_violation') && bericht.includes('naam'))
    return 'De naam is te lang. Maximaal 30 tekens toegestaan.'

  // SEC-A8: 'auth' was te breed — matcht ook op foutberichten die toevallig
  // het woord 'auth' bevatten (bijv. 'unauthorized action'). Specifiekere
  // checks voorkomen valse vertalingen.
  if (bericht.includes('JWT') || bericht.includes('Invalid JWT') ||
      bericht.includes('JWTExpired') || bericht.includes('not authenticated'))
    return 'Sessie verlopen. Ververs de pagina.'

  // A8 fix (2026-04-20): timeout-melding voor trage of weggevallen verbindingen.
  // REQUEST_TIMEOUT gooit metTimeout() als een Supabase-query langer duurt dan QUERY_TIMEOUT_MS.
  if (bericht.includes('REQUEST_TIMEOUT'))
    return 'Het verzoek duurde te lang. Controleer je verbinding en probeer het opnieuw.'

  if (bericht.includes('fetch') || bericht.includes('network') || bericht.includes('NetworkError'))
    return 'Verbinding verbroken. Wijzigingen worden niet opgeslagen. Controleer je internet.'

  // PostgreSQL-foutcodes (van directe DB-errors via Supabase)
  if (bericht.includes('42703') || (bericht.includes('column') && bericht.includes('does not exist')))
    return 'Databasefout: een vereiste kolom ontbreekt. Voer de openstaande migraties uit.'

  if (bericht.includes('42P01') || (bericht.includes('relation') && bericht.includes('does not exist')))
    return 'Databasefout: een vereiste tabel ontbreekt. Voer de openstaande migraties uit.'

  // PGRST116: PostgREST .single() vond nul of meer dan één rij.
  // Dit treedt op wanneer een potje-UUID niet (meer) bestaat in de database,
  // bijv. na lifecycle-verwijdering (7 dagen oud) of bij een getypte / verouderde link.
  // Behandeld als gebruikerssituatie — niet als bug, niet naar Sentry.
  if (
    bericht.includes('PGRST116') ||
    bericht.includes('JSON object requested, multiple (or no) rows returned') ||
    bericht.includes('Cannot coerce the result to a single JSON object')
  )
    return 'Dit potje bestaat niet of is verwijderd. Controleer de link.'

  if (bericht.includes('PGRST') || bericht.includes('406') || bericht.includes('400'))
    return 'De verbinding met de database is mislukt. Probeer de pagina te verversen.'

  // row-level security: treedt op bij verouderde sessies — verwachte gebruikerssituatie.
  // 42501 gaat na de A18-fix (2026-04-20) naar Sentry als bug, maar de gebruiker
  // ziet alsnog een begrijpelijke melding: vertaalFout() en logFout() zijn orthogonaal.
  if (bericht.includes('row-level security') || bericht.includes('42501'))
    return 'Je sessie is niet herkend. Ververs de pagina en probeer opnieuw.'

  return 'Er is iets misgegaan. Probeer het opnieuw.'
}
