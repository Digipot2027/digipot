/**
 * Vertaalt technische foutcodes naar Nederlandse gebruikersmeldingen
 */
export function vertaalFout(error) {
  if (!error) return 'Er is iets misgegaan. Probeer het opnieuw.'

  const bericht = error.message || error.toString()

  if (bericht.includes('SALDO_TE_LAAG'))
    return null // Wordt afgehandeld met het actuele saldo in de component

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

  if (bericht.includes('JWT') || bericht.includes('auth'))
    return 'Sessie verlopen. Ververs de pagina.'

  if (bericht.includes('fetch') || bericht.includes('network') || bericht.includes('NetworkError'))
    return 'Verbinding verbroken. Wijzigingen worden niet opgeslagen. Controleer je internet.'

  // PostgreSQL-foutcodes (van directe DB-errors via Supabase)
  if (bericht.includes('42703') || (bericht.includes('column') && bericht.includes('does not exist')))
    return 'Databasefout: een vereiste kolom ontbreekt. Voer de openstaande migraties uit.'

  if (bericht.includes('42P01') || (bericht.includes('relation') && bericht.includes('does not exist')))
    return 'Databasefout: een vereiste tabel ontbreekt. Voer de openstaande migraties uit.'

  if (bericht.includes('PGRST') || bericht.includes('406') || bericht.includes('400'))
    return 'De verbinding met de database is mislukt. Probeer de pagina te verversen.'

  return 'Er is iets misgegaan. Probeer het opnieuw.'
}
