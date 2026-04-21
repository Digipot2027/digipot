# supabase/migrations

Alle databasemigraties voor Digipot, geordend op tijdstempel (Supabase CLI-conventie).

## Volgorde

| Bestand | Inhoud |
|---|---|
| `20260401000000_afmelden.sql` | Kolommen `actief` + `afgemeld_op` op `deelnemers` |
| `20260401000100_transacties_rls_actief.sql` | RLS: INSERT alleen voor actieve deelnemers (vervangen door stap22) |
| `20260401000200_transacties_undo.sql` | RLS: DELETE-policy voor undo (vervangen door stap22) |
| `20260401000300_saldotrigger.sql` | DB-trigger: blokkeer betalingen boven potsaldo |
| `20260407000000_rls_volledig.sql` | RLS volledig op alle tabellen |
| `20260407000100_lifecycle.sql` | CASCADE-constraints + lifecycle-functies |
| `20260412000000_valuta.sql` | Kolom `valuta` + whitelist-constraint op `potjes` |
| `20260412000100_rls_herstel.sql` | Herstel policy-conflicten stap15/16 vs stap18 |
| `20260412000200_cron_lifecycle_jobs.sql` | pg_cron jobs voor lifecycle Edge Functions (credentials zijn placeholders) |
| `20260413000000_idempotency_key.sql` | `idempotency_key` op `transacties` (second-line defense dubbelstorten) |
| `20260414000000_rls_device_id.sql` | RLS INSERT met device-ID verificatie |

## Uitvoering

Alle migraties zijn reeds uitgevoerd in productie via de Supabase SQL Editor of Supabase MCP.
Deze map dient als versiebeheer en documentatie.

Bij toekomstige migraties: voeg een nieuw bestand toe met timestamp-prefix
`YYYYMMDDHHMMSS_beschrijving.sql` en voer uit via Supabase MCP `apply_migration`.

## Veiligheid

`20260412000200_cron_lifecycle_jobs.sql` bevat `<SUPABASE_SERVICE_ROLE_KEY>` en
`<CRON_SECRET>` als placeholders. Nooit echte credentials in migratiebestanden opslaan.
Stel secrets in via Supabase Dashboard → Edge Functions → Manage Secrets.
