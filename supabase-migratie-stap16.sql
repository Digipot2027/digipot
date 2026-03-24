-- Stap 16: Undo-functionaliteit voor transacties
-- Voer dit uit in de Supabase SQL Editor (https://supabase.com → jouw project → SQL Editor)

-- Sta toe dat anonieme gebruikers transacties kunnen verwijderen.
-- Dit is nodig voor de 10-seconden undo-knop na het registreren van een transactie.
--
-- Noot: zonder authenticatie kunnen we eigenaarschap niet op DB-niveau afdwingen.
-- De undo-knop is de enige route naar DELETE in de app; UUID's zijn niet raadbaar.
-- Bij een toekomstige auth-implementatie deze policy vervangen door:
--   USING (deelnemer_id = auth.uid())

DROP POLICY IF EXISTS "Deelnemers mogen transacties verwijderen" ON transacties;

CREATE POLICY "Deelnemers mogen transacties verwijderen"
ON transacties
FOR DELETE
TO anon
USING (true);
