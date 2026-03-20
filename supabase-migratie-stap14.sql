-- Stap 14: Afmelden functionaliteit
-- Voer dit uit in de Supabase SQL Editor (https://supabase.com → jouw project → SQL Editor)

-- 1. Voeg actief kolom toe (true = actief, false = afgemeld)
ALTER TABLE deelnemers ADD COLUMN IF NOT EXISTS actief boolean DEFAULT true;

-- 2. Voeg afgemeld_op tijdstempel toe (voor tijdgebaseerde berekeningen)
ALTER TABLE deelnemers ADD COLUMN IF NOT EXISTS afgemeld_op timestamptz DEFAULT null;

-- 3. Bestaande deelnemers zijn allemaal actief
UPDATE deelnemers SET actief = true WHERE actief IS NULL;
