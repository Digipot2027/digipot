-- 20260427000000_is_mijn_deelnemer_function.sql
--
-- SEC-A3 (2026-04-27): consoliderende migratie — helper-functie
--
-- Probleem: de live `is_mijn_deelnemer()` functie bestond niet in de
-- migratiebestanden in de repo. De functie was via apply_migration aangemaakt
-- maar nooit als lokaal migratiebestand opgeslagen. Bij een DB-rebuild
-- (`supabase db reset` of dev-branch) ontbrak de functie waarop alle
-- RLS-policies vertrouwen, waardoor elke UPDATE op deelnemers en transacties
-- een "function does not exist"-fout zou gooien.
--
-- Dit bestand is een CONSOLIDERENDE migratie — het repareerde niets in
-- productie (de functie bestaat al), maar maakt een fresh rebuild correct.
--
-- Vervangt de impliciete functiondefinitie die in:
--   20260414000000_rls_device_id.sql   (functie bestond nog niet)
--   20260421000100_transacties_rate_limit.sql  (gebruikt functie via device-id)
-- ontbrak en in Fase 4 (2026-04-25) is bijgewerkt naar auth.uid()-logica.
--
-- Definitie exact zoals in productie per 2026-04-27 (geverifieerd via
-- pg_get_functiondef):
--
--   SELECT d_user_id IS NOT NULL AND d_user_id = auth.uid()
--
-- De parameter d_device_id is aanwezig voor signature-compatibiliteit met
-- alle policies die is_mijn_deelnemer(user_id, device_id) aanroepen.
-- De waarde wordt niet gebruikt — alleen auth.uid() telt.

CREATE OR REPLACE FUNCTION public.is_mijn_deelnemer(
  d_user_id  uuid,
  d_device_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT d_user_id IS NOT NULL AND d_user_id = auth.uid()
$$;

COMMENT ON FUNCTION public.is_mijn_deelnemer(uuid, text) IS
  'Fase 4 (2026-04-25): controleert uitsluitend auth.uid(). '
  'd_device_id-parameter aanwezig voor signature-compatibiliteit maar ongebruikt. '
  'SECURITY DEFINER zodat de functie door RLS-policies als superuser kan worden '
  'aangeroepen zonder zelf auth-context te verliezen.';
