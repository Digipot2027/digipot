-- 20260412000100_rls_herstel.sql
-- Stap 22: Herstel RLS-policy conflicten (stap15/16 vs stap18)
-- Oorspronkelijk: supabase-migratie-stap22-rls-herstel.sql

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
