-- 20260530000100_drop_push_subscriptions.sql
--
-- E4 (Hoog): DROP TABLE push_subscriptions
--
-- CONTEXT
-- -------
-- De tabel `push_subscriptions` bestaat in de database maar er is geen enkele
-- referentie in de codebase (geen import, geen supabase-query, geen Edge Function).
-- De feature (push-notificaties) staat niet op de roadmap. De tabel vormt
-- onnodig aanvalsoppervlak: vier RLS-policies zijn actief op een feature die
-- nooit wordt gebruikt. Elke nieuwe aanvaller die de tabelnaam ontdekt (bijv.
-- via PostgREST schema-introspectie) ziet een actieve tabel met bijbehorende
-- policies.
--
-- BESLISSING
-- ----------
-- Feature is definitief niet op de roadmap → DROP TABLE.
-- De vier push_subscriptions-policies uit 20260427000100_rls_fase4_consolidatie.sql
-- worden mee verwijderd door CASCADE.
--
-- IMPACT
-- ------
-- - Geen codewijziging nodig: de codebase bevat geen enkele referentie.
-- - Geen e2e-tests geraakt: geen test raakt push_subscriptions.
-- - SCHULD.md E4: afgelost.
-- - 20260427000100 rls_fase4_consolidatie: bevat push_subscriptions-policies
--   die nu een no-op worden bij fresh rebuild (DROP IF EXISTS beschermt).
--   De consolidatie-migratie hoeft niet te worden aangepast — de DROP hier
--   loopt later in de volgorde en ruimt het alsnog op.
--
-- VEILIGHEID
-- ----------
-- CASCADE verwijdert automatisch de vier RLS-policies. Geen data-verlies:
-- de tabel was leeg (feature nooit geïmplementeerd).

DROP TABLE IF EXISTS public.push_subscriptions CASCADE;

-- Verwijder eventuele sequences of overgebleven objecten (none verwacht,
-- maar defensief voor het geval een toekomstige fresh-DB-migration dit aanmaakt).
-- UUID-kolom gebruikte gen_random_uuid() — geen sequence.

COMMENT ON SCHEMA public IS
  'push_subscriptions verwijderd op 2026-05-30 (E4 afgelost). '
  'Feature push-notificaties is niet op de roadmap.';
