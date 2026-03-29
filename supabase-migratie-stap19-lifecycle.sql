-- Stap 19: Potje-lifecycle — auto-sluiten na 24 uur, verwijderen na 7 dagen
-- Voer dit uit in de Supabase SQL Editor (https://supabase.com → jouw project → SQL Editor)
--
-- ACHTERGROND:
--   Twee geautomatiseerde levenscyclus-regels voor potjes:
--     1. AUTO-SLUITEN: een open potje dat langer dan 24 uur oud is, wordt automatisch gesloten.
--        Status wijzigt naar 'gesloten', gesloten_op wordt gezet, gesloten_door = NULL
--        (systeem, niet een specifieke deelnemer).
--     2. AUTO-VERWIJDEREN: een potje (gesloten of open) dat langer dan 7 dagen geleden
--        is aangemaakt, wordt volledig uit de database verwijderd inclusief alle
--        gekoppelde deelnemers en transacties.
--
-- UITVOERING:
--   De functies worden aangeroepen via pg_cron (Supabase Cron Jobs).
--   Frequentie: elke 15 minuten (auto-sluiten) en elke dag om 03:00 UTC (verwijderen).
--
-- VEREISTEN:
--   - pg_cron extensie moet actief zijn in het Supabase-project.
--     Activeer via: Supabase Dashboard → Database → Extensions → pg_cron
--   - CASCADE DELETE op deelnemers.potje_id en transacties.potje_id.
--     Dit wordt hieronder gecontroleerd en zo nodig bijgewerkt.
--
-- VEILIGHEID:
--   - Alle DELETE-operaties zijn onomkeerbaar. Er is geen soft-delete voorzien.
--   - gesloten_door = NULL bij automatisch sluiten is bewuste keuze:
--     de eindafrekening toont 'Automatisch gesloten' in plaats van een deelnemersnaam.
--   - Beide functies zijn idempotent (meerdere keren uitvoeren = zelfde resultaat).

-- ─── 0. Verwijder oude versies indien aanwezig (herstartbaar) ────────────────

DROP FUNCTION IF EXISTS lifecycle_sluit_verlopen_potjes();
DROP FUNCTION IF EXISTS lifecycle_verwijder_oude_potjes();

-- ─── 1. Zorg voor CASCADE DELETE op foreign keys ─────────────────────────────
-- Supabase maakt FK's standaard zonder CASCADE. De verwijderfunctie verwijdert
-- potjes inclusief alle gerelateerde rijen. Zonder CASCADE zou de DELETE falen
-- met een foreign-key-constraint-error.
--
-- Aanpak: hermaak de FK-constraints met ON DELETE CASCADE.
-- Bestaande rijen worden hierdoor niet geraakt.

-- deelnemers.potje_id → potjes.id
ALTER TABLE deelnemers
  DROP CONSTRAINT IF EXISTS deelnemers_potje_id_fkey,
  ADD CONSTRAINT deelnemers_potje_id_fkey
    FOREIGN KEY (potje_id) REFERENCES potjes(id) ON DELETE CASCADE;

-- transacties.potje_id → potjes.id
ALTER TABLE transacties
  DROP CONSTRAINT IF EXISTS transacties_potje_id_fkey,
  ADD CONSTRAINT transacties_potje_id_fkey
    FOREIGN KEY (potje_id) REFERENCES potjes(id) ON DELETE CASCADE;

-- transacties.deelnemer_id → deelnemers.id
ALTER TABLE transacties
  DROP CONSTRAINT IF EXISTS transacties_deelnemer_id_fkey,
  ADD CONSTRAINT transacties_deelnemer_id_fkey
    FOREIGN KEY (deelnemer_id) REFERENCES deelnemers(id) ON DELETE CASCADE;

-- ─── 2a. Functie: auto-sluiten na 24 uur ────────────────────────────────────
-- Sluit alle open potjes waarvan aangemaakt_op meer dan 24 uur geleden is.
-- gesloten_door = NULL → "systeem" (eindafrekening toont geen deelnemersnaam).
-- Retourneert het aantal gesloten potjes (voor zichtbaarheid in Supabase cron-log).

CREATE OR REPLACE FUNCTION lifecycle_sluit_verlopen_potjes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  aantal INTEGER;
BEGIN
  WITH gesloten AS (
    UPDATE potjes
    SET
      status        = 'gesloten',
      gesloten_op   = NOW(),
      gesloten_door = NULL
    WHERE
      status        = 'open'
      AND aangemaakt_op < NOW() - INTERVAL '24 hours'
    RETURNING id
  )
  SELECT COUNT(*) INTO aantal FROM gesloten;

  IF aantal > 0 THEN
    RAISE NOTICE '[lifecycle] % potje(s) automatisch gesloten na 24 uur', aantal;
  END IF;

  RETURN aantal;
END;
$$;

-- ─── 2b. Functie: verwijderen na 7 dagen ────────────────────────────────────
-- Verwijdert alle potjes (gesloten of open) die meer dan 7 dagen geleden zijn
-- aangemaakt. Deelnemers en transacties worden via CASCADE meeverwijderd.
--
-- ONTWERPKEUZE — 7 dagen op aangemaakt_op, niet op gesloten_op:
--   Harde maximale levensduur van 7 dagen ongeacht wanneer gesloten.
--   Een potje dat op dag 6 wordt gesloten, verdwijnt op dag 7 al.
--   Dit is bewust: data minimalisatie en voorspelbaarheid voor gebruikers.
--
-- Retourneert het aantal verwijderde potjes.

CREATE OR REPLACE FUNCTION lifecycle_verwijder_oude_potjes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  aantal INTEGER;
BEGIN
  WITH verwijderd AS (
    DELETE FROM potjes
    WHERE aangemaakt_op < NOW() - INTERVAL '7 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO aantal FROM verwijderd;

  IF aantal > 0 THEN
    RAISE NOTICE '[lifecycle] % potje(s) verwijderd na 7 dagen (incl. deelnemers + transacties)', aantal;
  END IF;

  RETURN aantal;
END;
$$;

-- ─── 3. Cron-jobs via pg_cron ─────────────────────────────────────────────────
-- VEREISTE: pg_cron extensie moet actief zijn.
-- Activeer via: Supabase Dashboard → Database → Extensions → pg_cron
--
-- Als pg_cron NIET actief is, geeft het aanmaken van de jobs een fout.
-- In dat geval: activeer de extensie en voer dit blok daarna opnieuw uit.

-- Verwijder bestaande jobs indien aanwezig (herstartbaar)
SELECT cron.unschedule('digipot-sluit-verlopen-potjes')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'digipot-sluit-verlopen-potjes');

SELECT cron.unschedule('digipot-verwijder-oude-potjes')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'digipot-verwijder-oude-potjes');

-- Job 1: Elke 15 minuten open potjes sluiten die ouder zijn dan 24 uur
SELECT cron.schedule(
  'digipot-sluit-verlopen-potjes',
  '*/15 * * * *',
  'SELECT lifecycle_sluit_verlopen_potjes()'
);

-- Job 2: Elke dag om 03:00 UTC potjes ouder dan 7 dagen verwijderen
SELECT cron.schedule(
  'digipot-verwijder-oude-potjes',
  '0 3 * * *',
  'SELECT lifecycle_verwijder_oude_potjes()'
);

-- ─── 4. Verificatie ──────────────────────────────────────────────────────────
-- Controleer na uitvoeren of de functies en jobs bestaan:
--
--   -- Functies:
--   SELECT routine_name FROM information_schema.routines
--   WHERE routine_schema = 'public'
--     AND routine_name LIKE 'lifecycle_%';
--
--   -- Cron-jobs:
--   SELECT jobname, schedule, command, active
--   FROM cron.job
--   WHERE jobname LIKE 'digipot-%';
--
--   -- Handmatig testen (veilig, idempotent):
--   SELECT lifecycle_sluit_verlopen_potjes();
--   SELECT lifecycle_verwijder_oude_potjes();
--
-- Verwacht: beide functies aanwezig, beide jobs actief (active = true).

-- ─── 5. Rollback-instructies ─────────────────────────────────────────────────
-- Om de lifecycle-automatisering volledig uit te schakelen:
--
--   SELECT cron.unschedule('digipot-sluit-verlopen-potjes');
--   SELECT cron.unschedule('digipot-verwijder-oude-potjes');
--   DROP FUNCTION IF EXISTS lifecycle_sluit_verlopen_potjes();
--   DROP FUNCTION IF EXISTS lifecycle_verwijder_oude_potjes();
--
-- Let op: de CASCADE-constraints blijven actief na rollback.
-- Dit is veilig — ze beschermen ook zonder de cron-jobs tegen wees-rijen.
