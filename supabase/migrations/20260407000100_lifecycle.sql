-- 20260407000100_lifecycle.sql
-- Stap 19: Lifecycle-functies en CASCADE-constraints
-- Oorspronkelijk: supabase-migratie-stap19-lifecycle.sql

ALTER TABLE deelnemers
  DROP CONSTRAINT IF EXISTS deelnemers_potje_id_fkey,
  ADD CONSTRAINT deelnemers_potje_id_fkey
    FOREIGN KEY (potje_id) REFERENCES potjes(id) ON DELETE CASCADE;

ALTER TABLE transacties
  DROP CONSTRAINT IF EXISTS transacties_potje_id_fkey,
  ADD CONSTRAINT transacties_potje_id_fkey
    FOREIGN KEY (potje_id) REFERENCES potjes(id) ON DELETE CASCADE;

ALTER TABLE transacties
  DROP CONSTRAINT IF EXISTS transacties_deelnemer_id_fkey,
  ADD CONSTRAINT transacties_deelnemer_id_fkey
    FOREIGN KEY (deelnemer_id) REFERENCES deelnemers(id) ON DELETE CASCADE;

DROP FUNCTION IF EXISTS lifecycle_sluit_verlopen_potjes();
DROP FUNCTION IF EXISTS lifecycle_verwijder_oude_potjes();

CREATE OR REPLACE FUNCTION lifecycle_sluit_verlopen_potjes()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE aantal INTEGER;
BEGIN
  WITH gesloten AS (
    UPDATE potjes
    SET status = 'gesloten', gesloten_op = NOW(), gesloten_door = NULL
    WHERE status = 'open' AND aangemaakt_op < NOW() - INTERVAL '24 hours'
    RETURNING id
  )
  SELECT COUNT(*) INTO aantal FROM gesloten;
  IF aantal > 0 THEN
    RAISE NOTICE '[lifecycle] % potje(s) automatisch gesloten na 24 uur', aantal;
  END IF;
  RETURN aantal;
END;
$$;

CREATE OR REPLACE FUNCTION lifecycle_verwijder_oude_potjes()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE aantal INTEGER;
BEGIN
  WITH verwijderd AS (
    DELETE FROM potjes WHERE aangemaakt_op < NOW() - INTERVAL '7 days' RETURNING id
  )
  SELECT COUNT(*) INTO aantal FROM verwijderd;
  IF aantal > 0 THEN
    RAISE NOTICE '[lifecycle] % potje(s) verwijderd na 7 dagen', aantal;
  END IF;
  RETURN aantal;
END;
$$;
