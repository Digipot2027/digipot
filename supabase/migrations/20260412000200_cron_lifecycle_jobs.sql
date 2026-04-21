-- 20260412000200_cron_lifecycle_jobs.sql
-- Stap 23: pg_cron jobs voor lifecycle Edge Functions
-- Oorspronkelijk: supabase-migratie-stap23-cron-secret.sql
--
-- VEILIGHEID: Credentials NOOIT in dit bestand opslaan.
-- Stel in via Supabase Dashboard → Edge Functions → Manage Secrets:
--   CRON_SECRET = output van `openssl rand -hex 32`
--
-- De service role key en cron-secret worden hier als placeholders weergegeven.
-- Voer dit script uit vanuit de Supabase SQL Editor na het instellen van de secrets.
--
-- ATTENTIE: Als dit bestand ooit credentials bevatte in git-history,
-- roteer dan onmiddellijk de service role key via Supabase Dashboard → Settings → API.

SELECT cron.unschedule('digipot-lifecycle-sluiten')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'digipot-lifecycle-sluiten');

SELECT cron.schedule(
  'digipot-lifecycle-sluiten', '0 * * * *',
  $$SELECT net.http_post(
    url     := 'https://aqeuehfjgnpytfibncwy.supabase.co/functions/v1/lifecycle-sluiten',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );$$
);

SELECT cron.unschedule('digipot-lifecycle-verwijderen')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'digipot-lifecycle-verwijderen');

SELECT cron.schedule(
  'digipot-lifecycle-verwijderen', '0 3 * * *',
  $$SELECT net.http_post(
    url     := 'https://aqeuehfjgnpytfibncwy.supabase.co/functions/v1/lifecycle-verwijderen',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );$$
);

SELECT cron.unschedule('digipot-lifecycle-keepalive')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'digipot-lifecycle-keepalive');

SELECT cron.schedule(
  'digipot-lifecycle-keepalive', '0 0 */5 * *',
  $$SELECT net.http_post(
    url     := 'https://aqeuehfjgnpytfibncwy.supabase.co/functions/v1/lifecycle-keepalive',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );$$
);
