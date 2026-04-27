-- 20260412000100_rls_herstel.sql
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  OBSOLETE — VERVANGEN DOOR 20260427000100_rls_fase4_consolidatie.sql    ║
-- ║                                                                          ║
-- ║  Dit bestand herstel policy-conflicten en voegde een actief-deelnemer-  ║
-- ║  check toe aan transacties_insert. De policies zijn volledig             ║
-- ║  overschreven door latere migraties en geconsolideerd in Fase 4.        ║
-- ║                                                                          ║
-- ║  NIET uitvoeren op een fresh DB — gebruik 20260427000100 als referentie. ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Originele beschrijving:
-- Stap 22: Herstel RLS-policy conflicten (stap15/16 vs stap18)
-- Oorspronkelijk: supabase-migratie-stap22-rls-herstel.sql
-- Uitgevoerd in productie: 2026-04-12
--
-- Waarom obsolete:
-- - transacties_insert had nog geen identiteitsverificatie (alleen actief-check)
-- - transacties_delete had geen potje-open-check en geen eigenaarschapscheck
-- - verouderd door 20260414000000, 20260421000100, en geconsolideerd in 20260427000100
--
-- Originele SQL (inactief — niet uitvoeren):
/*

DROP POLICY IF EXISTS "Alleen actieve deelnemers mogen transacties invoeren" ON transacties;
DROP POLICY IF EXISTS "Deelnemers mogen transacties invoeren"                ON transacties;
DROP POLICY IF EXISTS "Iedereen mag transacties lezen"                       ON transacties;
DROP POLICY IF EXISTS "Deelnemers mogen transacties verwijderen"             ON transacties;

DROP POLICY IF EXISTS "transacties_select" ON transacties;
CREATE POLICY "transacties_select"
  ON transacties FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "transacties_insert" ON transacties;
CREATE POLICY "transacties_insert"
  ON transacties FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deelnemers d
      WHERE d.id = transacties.deelnemer_id
        AND d.potje_id = transacties.potje_id
        AND d.actief = true
    )
  );

DROP POLICY IF EXISTS "transacties_delete" ON transacties;
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
