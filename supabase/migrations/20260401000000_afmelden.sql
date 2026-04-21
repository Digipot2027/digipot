-- 20260401000000_afmelden.sql
-- Stap 14: Afmelden functionaliteit
-- Oorspronkelijk: supabase-migratie-stap14.sql
-- Uitgevoerd in productie: 2026-04-01

ALTER TABLE deelnemers ADD COLUMN IF NOT EXISTS actief boolean DEFAULT true;
ALTER TABLE deelnemers ADD COLUMN IF NOT EXISTS afgemeld_op timestamptz DEFAULT null;
UPDATE deelnemers SET actief = true WHERE actief IS NULL;
