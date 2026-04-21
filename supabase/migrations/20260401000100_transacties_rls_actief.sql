-- 20260401000100_transacties_rls_actief.sql
-- Stap 15: Blokkeer transacties van niet-actieve deelnemers via RLS
-- Oorspronkelijk: supabase-migratie-stap15.sql
-- Uitgevoerd in productie: 2026-04-01
-- NOOT: Vervangen door stap22 (rls-herstel). Bewaard voor migratiehistorie.

ALTER TABLE transacties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deelnemers mogen transacties invoeren" ON transacties;
DROP POLICY IF EXISTS "Alleen actieve deelnemers mogen transacties invoeren" ON transacties;

CREATE POLICY "Alleen actieve deelnemers mogen transacties invoeren"
ON transacties FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM deelnemers
    WHERE deelnemers.id = transacties.deelnemer_id
      AND deelnemers.actief = true
  )
);

DROP POLICY IF EXISTS "Iedereen mag transacties lezen" ON transacties;
CREATE POLICY "Iedereen mag transacties lezen"
ON transacties FOR SELECT TO anon
USING (true);
