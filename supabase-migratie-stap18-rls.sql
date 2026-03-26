-- Stap 18: Row Level Security (RLS) — VERPLICHT uitvoeren
-- Voer dit uit in de Supabase SQL Editor (https://supabase.com → jouw project → SQL Editor)
--
-- ACHTERGROND (Security audit — Critical):
--   De Supabase anon key staat in de client. Zonder RLS kan iedereen die de
--   anon key kent alle data van alle gebruikers opvragen of muteren via directe
--   REST-calls. RLS beperkt toegang op rijniveau.
--
-- ONTWERPKEUZE (no-auth architectuur):
--   Digipot gebruikt geen gebruikersauthenticatie. Identificatie verloopt via
--   device_id (UUID in localStorage). RLS kan device_id niet verifiëren op
--   server-niveau zonder auth.jwt(). De policies hieronder gebruiken daarom
--   een "open lees, beperkt schrijf"-model:
--     - Lezen:  iedereen met de anon key kan potjes/deelnemers/transacties lezen
--               (vereist voor realtime en deellink-flow)
--     - Schrijven: beperkt tot logisch correcte operaties
--
-- STERKERE BEVEILIGING vereist migratie naar Supabase Auth (toekomstige stap).
-- BELANGRIJK: Test na uitvoeren of de app nog correct werkt (alle flows).

-- ─── 1. RLS aanzetten op alle tabellen ──────────────────────────────────────

ALTER TABLE potjes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE deelnemers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacties ENABLE ROW LEVEL SECURITY;

-- ─── 2. Verwijder eventuele bestaande policies ───────────────────────────────

DROP POLICY IF EXISTS "potjes_select"           ON potjes;
DROP POLICY IF EXISTS "potjes_insert"           ON potjes;
DROP POLICY IF EXISTS "potjes_update_sluiten"   ON potjes;
DROP POLICY IF EXISTS "deelnemers_select"       ON deelnemers;
DROP POLICY IF EXISTS "deelnemers_insert"       ON deelnemers;
DROP POLICY IF EXISTS "deelnemers_update"       ON deelnemers;
DROP POLICY IF EXISTS "transacties_select"      ON transacties;
DROP POLICY IF EXISTS "transacties_insert"      ON transacties;
DROP POLICY IF EXISTS "transacties_delete"      ON transacties;

-- ─── 3. POTJES policies ──────────────────────────────────────────────────────

-- Iedereen met de anon key kan een potje lezen (vereist voor deellink-flow)
CREATE POLICY "potjes_select"
  ON potjes FOR SELECT TO anon
  USING (true);

-- Iedereen mag een nieuw potje aanmaken
CREATE POLICY "potjes_insert"
  ON potjes FOR INSERT TO anon
  WITH CHECK (true);

-- Sluiten: alleen UPDATE van open→gesloten toegestaan
CREATE POLICY "potjes_update_sluiten"
  ON potjes FOR UPDATE TO anon
  USING (status = 'open')
  WITH CHECK (status = 'gesloten');

-- ─── 4. DEELNEMERS policies ──────────────────────────────────────────────────

-- Lezen: iedereen (vereist voor realtime en overzicht)
CREATE POLICY "deelnemers_select"
  ON deelnemers FOR SELECT TO anon
  USING (true);

-- Aanmaken: iedereen mag deelnemer aanmaken
CREATE POLICY "deelnemers_insert"
  ON deelnemers FOR INSERT TO anon
  WITH CHECK (true);

-- Afmelden: UPDATE toegestaan (actief→false, afgemeld_op)
CREATE POLICY "deelnemers_update"
  ON deelnemers FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- ─── 5. TRANSACTIES policies ─────────────────────────────────────────────────

-- Lezen: iedereen (vereist voor saldo-berekening en overzicht)
CREATE POLICY "transacties_select"
  ON transacties FOR SELECT TO anon
  USING (true);

-- Aanmaken: toegestaan
CREATE POLICY "transacties_insert"
  ON transacties FOR INSERT TO anon
  WITH CHECK (true);

-- Verwijderen (undo): alleen als de deelnemer_id verwijst naar een bestaande
-- deelnemer in hetzelfde potje. Sterkste server-side beperking zonder auth.
-- De client voegt ook .eq('deelnemer_id', deelnemer.id) toe (defence in depth).
CREATE POLICY "transacties_delete"
  ON transacties FOR DELETE TO anon
  USING (
    EXISTS (
      SELECT 1 FROM deelnemers d
      WHERE d.id = transacties.deelnemer_id
        AND d.potje_id = transacties.potje_id
    )
  );

-- ─── 6. Verificatie ──────────────────────────────────────────────────────────
-- Controleer of RLS actief is na uitvoeren:
--
--   SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public'
--   AND tablename IN ('potjes', 'deelnemers', 'transacties');
--
-- Verwacht: rowsecurity = true voor alle drie tabellen.
--
-- NOOT: Zonder Supabase Auth kan device_id niet server-side geverifieerd worden.
-- Voor volledige schrijfbeveiliging: migreer naar Supabase Auth (toekomstige stap).
