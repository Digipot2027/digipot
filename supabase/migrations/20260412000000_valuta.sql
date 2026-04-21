-- 20260412000000_valuta.sql
-- Stap 20+21: Valuta-kolom + whitelist-constraint op potjes
-- Oorspronkelijk: supabase-migratie-stap20-valuta.sql + stap21-valuta-check.sql

ALTER TABLE potjes
  ADD COLUMN IF NOT EXISTS valuta VARCHAR(3) NOT NULL DEFAULT 'EUR';

ALTER TABLE potjes
  DROP CONSTRAINT IF EXISTS potjes_valuta_formaat,
  DROP CONSTRAINT IF EXISTS potjes_valuta_whitelist,
  ADD CONSTRAINT potjes_valuta_whitelist
    CHECK (valuta IN ('EUR', 'USD', 'GBP', 'CHF', 'DKK', 'NOK', 'SEK'));
