-- ============================================================
-- Digipot — Supabase verificatie
-- Plak deze query in de SQL Editor en klik Run.
-- Elke rij toont een check met status OK of ONTBREEKT.
-- ============================================================

SELECT checks.omschrijving, checks.status FROM (

  -- 1. Tabel: potjes bestaat
  SELECT 1 AS nr, 'Tabel: potjes' AS omschrijving,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'potjes'
    ) THEN '✅ OK' ELSE '❌ ONTBREEKT' END AS status

  UNION ALL

  -- 2. Tabel: deelnemers bestaat
  SELECT 2, 'Tabel: deelnemers',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'deelnemers'
    ) THEN '✅ OK' ELSE '❌ ONTBREEKT' END

  UNION ALL

  -- 3. Tabel: transacties bestaat
  SELECT 3, 'Tabel: transacties',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'transacties'
    ) THEN '✅ OK' ELSE '❌ ONTBREEKT' END

  UNION ALL

  -- 4. Kolom: deelnemers.actief bestaat (stap 14)
  SELECT 4, 'Kolom: deelnemers.actief',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'deelnemers' AND column_name = 'actief'
    ) THEN '✅ OK' ELSE '❌ ONTBREEKT (voer stap 14 uit)' END

  UNION ALL

  -- 5. Kolom: deelnemers.afgemeld_op bestaat (stap 14)
  SELECT 5, 'Kolom: deelnemers.afgemeld_op',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'deelnemers' AND column_name = 'afgemeld_op'
    ) THEN '✅ OK' ELSE '❌ ONTBREEKT (voer stap 14 uit)' END

  UNION ALL

  -- 6. RLS: ingeschakeld op transacties (stap 15)
  SELECT 6, 'RLS: ingeschakeld op transacties',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'transacties' AND rowsecurity = true
    ) THEN '✅ OK' ELSE '❌ ONTBREEKT (voer stap 15 uit)' END

  UNION ALL

  -- 7. RLS policy: alleen actieve deelnemers mogen INSERT (stap 15)
  SELECT 7, 'RLS policy: alleen actieve deelnemers mogen transacties invoeren',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'transacties'
        AND cmd = 'INSERT'
        AND policyname = 'Alleen actieve deelnemers mogen transacties invoeren'
    ) THEN '✅ OK' ELSE '❌ ONTBREEKT (voer stap 15 uit)' END

  UNION ALL

  -- 8. RLS policy: iedereen mag transacties lezen (stap 15)
  SELECT 8, 'RLS policy: iedereen mag transacties lezen',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'transacties'
        AND cmd = 'SELECT'
        AND policyname = 'Iedereen mag transacties lezen'
    ) THEN '✅ OK' ELSE '❌ ONTBREEKT (voer stap 15 uit)' END

  UNION ALL

  -- 9. RLS policy: deelnemers mogen transacties verwijderen (stap 16)
  SELECT 9, 'RLS policy: deelnemers mogen transacties verwijderen',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'transacties'
        AND cmd = 'DELETE'
        AND policyname = 'Deelnemers mogen transacties verwijderen'
    ) THEN '✅ OK' ELSE '❌ ONTBREEKT (voer stap 16 uit)' END

  UNION ALL

  -- 10. Trigger: saldocontrole vóór betaling (stap 17)
  SELECT 10, 'Trigger: check_potsaldo_voor_betaling (V2 saldocontrole)',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        AND trigger_name = 'check_potsaldo_voor_betaling'
        AND event_manipulation = 'INSERT'
        AND action_timing = 'BEFORE'
    ) THEN '✅ OK' ELSE '❌ ONTBREEKT (voer stap 17 uit)' END

  UNION ALL

  -- 11. Functie: controleer_potsaldo bestaat (stap 17)
  SELECT 11, 'Functie: controleer_potsaldo()',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'controleer_potsaldo'
    ) THEN '✅ OK' ELSE '❌ ONTBREEKT (voer stap 17 uit)' END

) AS checks
ORDER BY checks.nr;
