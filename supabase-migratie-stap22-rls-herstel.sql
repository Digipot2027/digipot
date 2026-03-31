-- Stap 22: Herstel RLS-policy conflicten tussen stap 15/16 en stap 18
-- Voer dit uit in de Supabase SQL Editor (https://supabase.com → jouw project → SQL Editor)
--
-- ACHTERGROND:
--   Stap 15 maakte policies aan met namen als "Alleen actieve deelnemers mogen transacties invoeren".
--   Stap 18 maakte nieuwe policies aan met namen als "transacties_insert".
--   Als beide stappen zijn uitgevoerd, bestaan er dubbele en conflicterende policies
--   op de transacties-tabel. Dit veroorzaakt onvoorspelbaar gedrag bij geneste queries
--   en kan leiden tot 400/406 errors bij .select('*, transacties(*)').
--
--   Stap 16 maakte "Deelnemers mogen transacties verwijderen" aan (USING true).
--   Stap 18 maakte "transacties_delete" aan met een EXISTS-check.
--   De stap-16-policy (USING true) overschrijft de strengere stap-18-policy.
--
-- OPLOSSING:
--   Verwijder alle verouderde policies (stap 15/16-namen) en behoud uitsluitend
--   de stap-18-policies. Dit garandeert een consistente, bekende policy-set.
--
-- VEILIG:
--   - Idempotent: DROP POLICY IF EXISTS geeft geen fout als de policy niet bestaat.
--   - De stap-18-policies blijven intact als ze al bestaan.
--   - Geen productiedata wordt geraakt.

-- ─── 1. Verwijder verouderde policies (stap 15/16 namen) ─────────────────────

DROP POLICY IF EXISTS "Alleen actieve deelnemers mogen transacties invoeren" ON transacties;
DROP POLICY IF EXISTS "Deelnemers mogen transacties invoeren"                ON transacties;
DROP POLICY IF EXISTS "Iedereen mag transacties lezen"                       ON transacties;
DROP POLICY IF EXISTS "Deelnemers mogen transacties verwijderen"             ON transacties;

-- ─── 2. Zorg dat de stap-18-policies aanwezig zijn (idempotent) ──────────────
-- Als stap 18 al is uitgevoerd, zijn deze al aanwezig. DROP IF EXISTS + CREATE
-- garandeert dat altijd de correcte versie actief is.

-- SELECT: iedereen mag lezen (vereist voor realtime en overzicht)
DROP POLICY IF EXISTS "transacties_select" ON transacties;
CREATE POLICY "transacties_select"
  ON transacties FOR SELECT TO anon
  USING (true);

-- INSERT: beperkt tot actieve deelnemers
-- (strengere variant van stap 15 — gebruikt dezelfde logica)
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

-- DELETE: ownership-check via deelnemer_id (strengere variant van stap 16)
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

-- ─── 3. Verificatie ──────────────────────────────────────────────────────────
-- Controleer na uitvoeren:
--
--   SELECT policyname, cmd, qual, with_check
--   FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'transacties'
--   ORDER BY policyname;
--
-- Verwacht: precies 3 policies:
--   transacties_delete  (DELETE)
--   transacties_insert  (INSERT)
--   transacties_select  (SELECT)
--
-- Geen van de stap-15/16-namen mag nog voorkomen.
