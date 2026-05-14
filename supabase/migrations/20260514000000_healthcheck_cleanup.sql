-- 20260514000000_healthcheck_cleanup.sql
--
-- pg_cron job die __healthcheck__ testpotjes dagelijks opruimt.
--
-- CONTEXT
-- -------
-- De dagelijkse health check (health.yml) maakt bij elke run een potje aan
-- met naam '__healthcheck__'. Potjes worden nooit verwijderd via de Data API
-- (geen DELETE-grant voor anon/authenticated — zie 20260530000000_data_api_grants.sql).
-- Deze migratie installeert een SECURITY DEFINER functie + pg_cron job die de
-- testpotjes periodiek opruimt zonder dat de Data API DELETE-rechten nodig heeft.
--
-- ONTWERPKEUZES
-- -------------
-- 1. SECURITY DEFINER: de functie draait als de definiërende rol (postgres),
--    waardoor ze DELETE kan uitvoeren zonder dat anon/authenticated die rechten
--    nodig heeft. Dit is hetzelfde patroon als de lifecycle-functies.
-- 2. CASCADE: potjes hebben gerelateerde deelnemers/transacties. De FK is
--    al ON DELETE CASCADE — een potje verwijderen ruimt de rest automatisch op.
-- 3. Drempelwaarde 2 uur: geeft de health check ruimte om de SELECT na de
--    INSERT uit te voeren, ook als de cron job toevallig tegelijk draait.
-- 4. Cron-schema: dagelijks om 03:30 UTC — na de lifecycle-verwijderen job
--    (03:00 UTC) zodat de jobs niet concurreren.
-- 5. Idempotent: unschedule-guard voorkomt duplicaten bij re-run van migraties.
-- 6. internal schema: functies die niet via de Data API aanroepbaar mogen zijn
--    worden in het 'internal' schema geplaatst (PostgREST exposeert alleen 'public').

-- ── internal schema ───────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS internal;

-- Zorg dat anon en authenticated het schema niet kunnen zien of gebruiken
REVOKE ALL ON SCHEMA internal FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA internal TO postgres;

-- ── SECURITY DEFINER cleanup-functie ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION internal.verwijder_healthcheck_potjes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.potjes
  WHERE naam = '__healthcheck__'
    AND aangemaakt_op < NOW() - INTERVAL '2 hours';
END;
$$;

-- Eigenaarschap en rechten: alleen postgres mag de functie aanroepen via cron.
-- anon en authenticated krijgen geen EXECUTE — ze hoeven de functie nooit direct aan te roepen.
REVOKE ALL ON FUNCTION internal.verwijder_healthcheck_potjes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION internal.verwijder_healthcheck_potjes() TO postgres;

-- ── pg_cron job ───────────────────────────────────────────────────────────────

SELECT cron.unschedule('digipot-healthcheck-cleanup')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'digipot-healthcheck-cleanup'
);

SELECT cron.schedule(
  'digipot-healthcheck-cleanup',
  '30 3 * * *',
  $$ SELECT internal.verwijder_healthcheck_potjes(); $$
);

COMMENT ON SCHEMA internal IS
  'Interne hulpfuncties die niet via de Data API (PostgREST) aanroepbaar mogen zijn. '
  'PostgREST exposeert alleen het public schema.';

COMMENT ON FUNCTION internal.verwijder_healthcheck_potjes() IS
  'Ruimt __healthcheck__ testpotjes op die ouder zijn dan 2 uur. '
  'Aangeroepen via pg_cron (dagelijks 03:30 UTC). SECURITY DEFINER: '
  'vereist geen DELETE-grant voor anon/authenticated.';
