-- 20260407000000_rls_volledig.sql
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  OBSOLETE — VERVANGEN DOOR 20260427000100_rls_fase4_consolidatie.sql    ║
-- ║                                                                          ║
-- ║  Dit bestand bevat de initiële RLS-policies zonder eigenaarschapscheck. ║
-- ║  De policies zijn volledig overschreven door latere migraties en         ║
-- ║  uiteindelijk geconsolideerd in de Fase 4-migratie (2026-04-27).        ║
-- ║                                                                          ║
-- ║  NIET uitvoeren op een fresh DB — gebruik 20260427000100 als referentie. ║
-- ║  Dit bestand is bewaard voor historische traceerbaarheid.               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Originele beschrijving:
-- Stap 18: Row Level Security — volledige policy-set op alle tabellen
-- Oorspronkelijk: supabase-migratie-stap18-rls.sql
-- Uitgevoerd in productie: 2026-04-07
--
-- Waarom obsolete:
-- - policies gebruikten USING (true) / WITH CHECK (true) — geen eigenaarschap
-- - deelnemers_insert had geen user_id-check (SEC-A2, 2026-04-26)
-- - transacties_insert had geen identiteitsverificatie
-- - verouderd door 20260412000100, 20260414000000, 20260421000100, 20260426000100
--   en uiteindelijk geconsolideerd in 20260427000100
--
-- Originele SQL (inactief — niet uitvoeren):
/*

ALTER TABLE potjes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE deelnemers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "potjes_select"         ON potjes;
DROP POLICY IF EXISTS "potjes_insert"         ON potjes;
DROP POLICY IF EXISTS "potjes_update_sluiten" ON potjes;
DROP POLICY IF EXISTS "deelnemers_select"     ON deelnemers;
DROP POLICY IF EXISTS "deelnemers_insert"     ON deelnemers;
DROP POLICY IF EXISTS "deelnemers_update"     ON deelnemers;
DROP POLICY IF EXISTS "transacties_select"    ON transacties;
DROP POLICY IF EXISTS "transacties_insert"    ON transacties;
DROP POLICY IF EXISTS "transacties_delete"    ON transacties;

CREATE POLICY "potjes_select"
  ON potjes FOR SELECT TO anon USING (true);

CREATE POLICY "potjes_insert"
  ON potjes FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "potjes_update_sluiten"
  ON potjes FOR UPDATE TO anon
  USING (status = 'open')
  WITH CHECK (status = 'gesloten');

CREATE POLICY "deelnemers_select"
  ON deelnemers FOR SELECT TO anon USING (true);

CREATE POLICY "deelnemers_insert"
  ON deelnemers FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "deelnemers_update"
  ON deelnemers FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

CREATE POLICY "transacties_select"
  ON transacties FOR SELECT TO anon USING (true);

CREATE POLICY "transacties_insert"
  ON transacties FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "transacties_delete"
  ON transacties FOR DELETE TO anon
  USING (
    EXISTS (
      SELECT 1 FROM deelnemers d
      WHERE d.id = transacties.deelnemer_id
        AND d.potje_id = transacties.potje_id
    )
  );

*/
