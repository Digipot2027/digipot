-- 20260401000200_transacties_undo.sql
-- Stap 16: Undo-functionaliteit — DELETE-policy op transacties
-- Oorspronkelijk: supabase-migratie-stap16.sql
-- NOOT: Vervangen door stap22 (rls-herstel). Bewaard voor migratiehistorie.

DROP POLICY IF EXISTS "Deelnemers mogen transacties verwijderen" ON transacties;

CREATE POLICY "Deelnemers mogen transacties verwijderen"
ON transacties FOR DELETE TO anon
USING (true);
