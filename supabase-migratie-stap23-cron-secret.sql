-- Stap 23: Voeg x-cron-secret header toe aan pg_cron jobs
-- VEREISTE: stel eerst CRON_SECRET in via:
--   Supabase Dashboard → Edge Functions → Manage Secrets
--   Naam: CRON_SECRET, Waarde: output van `openssl rand -hex 32`
--
-- Vervang BEIDE voorkomens van VERVANG_DIT hieronder met die waarde.

SELECT cron.unschedule('digipot-lifecycle-sluiten')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'digipot-lifecycle-sluiten');

SELECT cron.schedule(
  'digipot-lifecycle-sluiten', '0 * * * *',
  $$SELECT net.http_post(
    url     := 'https://aqeuehfjgnpytfibncwy.supabase.co/functions/v1/lifecycle-sluiten',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxZXVlaGZqZ25weXRmaWJuY3d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzc1NTkxNCwiZXhwIjoyMDg5MzMxOTE0fQ.My2PgsbdGNi45pXY0Brrq3kllw9aAJ3wnHmNcXyAwQ8',
      'x-cron-secret', '0567cc55a208d1ea3f289303b1e3f959a95e9cf0f46234d15486a3b964fdf324'
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
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxZXVlaGZqZ25weXRmaWJuY3d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzc1NTkxNCwiZXhwIjoyMDg5MzMxOTE0fQ.My2PgsbdGNi45pXY0Brrq3kllw9aAJ3wnHmNcXyAwQ8',
      'x-cron-secret', '0567cc55a208d1ea3f289303b1e3f959a95e9cf0f46234d15486a3b964fdf324'
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
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxZXVlaGZqZ25weXRmaWJuY3d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzc1NTkxNCwiZXhwIjoyMDg5MzMxOTE0fQ.My2PgsbdGNi45pXY0Brrq3kllw9aAJ3wnHmNcXyAwQ8',
      'x-cron-secret', 'VERVANG_DIT'
    ),
    body := '{}'::jsonb
  );$$
);
