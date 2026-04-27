# supabase/migrations

Alle databasemigraties voor Digipot, geordend op tijdstempel (Supabase CLI-conventie).

## Volgorde

| Bestand | Status | Inhoud |
|---|---|---|
| `20260401000000_afmelden.sql` | ✅ Actief | Kolommen `actief` + `afgemeld_op` op `deelnemers` |
| `20260401000100_transacties_rls_actief.sql` | ✅ Actief | RLS: INSERT alleen voor actieve deelnemers (vervangen door stap22) |
| `20260401000200_transacties_undo.sql` | ✅ Actief | RLS: DELETE-policy voor undo (vervangen door stap22) |
| `20260401000300_saldotrigger.sql` | ✅ Actief | DB-trigger: blokkeer betalingen boven potsaldo |
| `20260407000000_rls_volledig.sql` | ⚠️ Obsolete | Initiële RLS-policies zonder eigenaarschapscheck — vervangen door `20260427000100` |
| `20260407000100_lifecycle.sql` | ✅ Actief | CASCADE-constraints + lifecycle-functies |
| `20260412000000_valuta.sql` | ✅ Actief | Kolom `valuta` + whitelist-constraint op `potjes` |
| `20260412000100_rls_herstel.sql` | ⚠️ Obsolete | Tussenstap policy-conflicten — vervangen door `20260427000100` |
| `20260412000200_cron_lifecycle_jobs.sql` | ✅ Actief | pg_cron jobs voor lifecycle Edge Functions (credentials zijn placeholders) |
| `20260413000000_idempotency_key.sql` | ✅ Actief | `idempotency_key` op `transacties` (second-line defense dubbelstorten) |
| `20260414000000_rls_device_id.sql` | ⚠️ Obsolete | Device-id header check (Fase 3) — vervangen door auth.uid() in `20260427000100` |
| `20260421000000_transacties_audit_log.sql` | ✅ Actief | Audit trail: `transacties_log` tabel + trigger |
| `20260421000100_transacties_rate_limit.sql` | ⚠️ Obsolete | Rate-limit via device-id header (Fase 3) — vervangen door auth.uid() in `20260427000100` |
| `20260426000000_device_id_nullable.sql` | ✅ Actief | `device_id` kolom nullable (D21 — Fase 4) |
| `20260426000100_sec_a2_deelnemers_insert_eigenaar_check.sql` | ✅ Actief | SEC-A2: `deelnemers_insert` met `user_id = auth.uid()` eigenaarcheck |
| `20260427000000_is_mijn_deelnemer_function.sql` | ✅ Actief | SEC-A3: helper-functie `is_mijn_deelnemer()` — Fase 4 definitief |
| `20260427000100_rls_fase4_consolidatie.sql` | ✅ Actief | SEC-A3: volledige RLS-policy-set Fase 4 — vervangt alle obsolete migraties |

## Obsolete migraties

Vier bestanden zijn gemarkeerd als **obsolete** (⚠️). Ze bevatten de originele SQL
uitgecommentarieerd als historische documentatie maar zijn **niet uitvoerbaar** op een
fresh DB. De definitieve RLS-state staat in `20260427000100_rls_fase4_consolidatie.sql`.

**Waarom bewaard en niet verwijderd:**
- Git-history blijft leesbaar: refactoring is zichtbaar per commit.
- Audit trail: per bestand is te reconstrueren wanneer welke policy actief was.
- Supabase CLI-conventie: bestanden worden niet verwijderd na uitvoering in productie.

**Rebuild-instructie voor fresh DB:**
Voer alle `✅ Actief`-bestanden uit in volgorde. Sla de `⚠️ Obsolete`-bestanden over.
De twee consoliderende migraties (`20260427000000` + `20260427000100`) reproduceren
de complete live state.

## Uitvoering

Alle migraties zijn reeds uitgevoerd in productie via Supabase MCP `apply_migration`.
Deze map dient als versiebeheer en documentatie.

Bij toekomstige migraties: voeg een nieuw bestand toe met timestamp-prefix
`YYYYMMDD000000_beschrijving.sql` en voer uit via Supabase MCP `apply_migration`.

## Veiligheid

`20260412000200_cron_lifecycle_jobs.sql` bevat `<SUPABASE_SERVICE_ROLE_KEY>` en
`<CRON_SECRET>` als placeholders. Nooit echte credentials in migratiebestanden opslaan.
Stel secrets in via Supabase Dashboard → Edge Functions → Manage Secrets.
