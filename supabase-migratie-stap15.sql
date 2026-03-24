-- Stap 15: Blokkeer transacties van niet-actieve deelnemers via RLS
-- Voer dit uit in de Supabase SQL Editor (https://supabase.com → jouw project → SQL Editor)

-- 1. Zorg dat RLS actief is op de transacties-tabel (is normaal al het geval)
ALTER TABLE transacties ENABLE ROW LEVEL SECURITY;

-- 2. Verwijder eventuele bestaande INSERT-policy op transacties (herstartbaar)
DROP POLICY IF EXISTS "Deelnemers mogen transacties invoeren" ON transacties;
DROP POLICY IF EXISTS "Alleen actieve deelnemers mogen transacties invoeren" ON transacties;

-- 3. Nieuwe policy: INSERT alleen toegestaan als de deelnemer actief is
--    Controleert of de deelnemer_id verwijst naar een actieve deelnemer
CREATE POLICY "Alleen actieve deelnemers mogen transacties invoeren"
ON transacties
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM deelnemers
    WHERE deelnemers.id = transacties.deelnemer_id
      AND deelnemers.actief = true
  )
);

-- 4. Lees-policy (als die nog niet bestaat): iedereen mag transacties lezen binnen een potje
DROP POLICY IF EXISTS "Iedereen mag transacties lezen" ON transacties;
CREATE POLICY "Iedereen mag transacties lezen"
ON transacties
FOR SELECT
TO anon
USING (true);
