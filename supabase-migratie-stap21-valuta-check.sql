-- Stap 21: Valuta whitelist — beperkt potjes.valuta tot ondersteunde codes
-- Voer dit uit in de Supabase SQL Editor (https://supabase.com → jouw project → SQL Editor)
--
-- ACHTERGROND:
--   Stap 20 voegde CHECK (valuta ~ '^[A-Z]{3}$') toe — dat blokkeert ongeldige
--   formaten maar accepteert elke 3-letter code, incl. niet-bestaande zoals 'XYZ'.
--   Intl.NumberFormat gooit een RangeError bij een onbekende valutacode, wat
--   een applicatiecrash veroorzaakt.
--
--   Deze stap voegt een IN-constraint toe die alleen de 7 door de app
--   ondersteunde valuta's toestaat. Uitbreiden = migratie bijwerken + VALUTA_OPTIES.
--
-- VEILIGHEID:
--   - Idempotent: DROP CONSTRAINT IF EXISTS gevolgd door ADD CONSTRAINT.
--   - Bestaande rijen worden gevalideerd bij toevoegen constraint:
--     alle bestaande potjes hebben 'EUR' (DEFAULT uit stap 20) → geen conflict.
--   - Bestaande RLS-policies blijven ongewijzigd.

-- ─── 1. Vervang de formaat-constraint door een whitelist-constraint ────────────

ALTER TABLE potjes
  DROP CONSTRAINT IF EXISTS potjes_valuta_formaat,
  DROP CONSTRAINT IF EXISTS potjes_valuta_whitelist,
  ADD CONSTRAINT potjes_valuta_whitelist
    CHECK (valuta IN ('EUR', 'USD', 'GBP', 'CHF', 'DKK', 'NOK', 'SEK'));

-- ─── 2. Verificatie ──────────────────────────────────────────────────────────
-- Controleer na uitvoeren:
--
--   -- Constraint aanwezig en correct?
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'potjes'::regclass
--     AND conname = 'potjes_valuta_whitelist';
--
--   -- Ongeldige code proberen (moet fout geven):
--   INSERT INTO potjes (naam, valuta) VALUES ('test', 'XYZ');
--   -- Verwacht: ERROR: new row violates check constraint "potjes_valuta_whitelist"
--
-- Verwacht resultaat constraint-definitie:
--   CHECK ((valuta = ANY (ARRAY['EUR','USD','GBP','CHF','DKK','NOK','SEK'])))

-- ─── 3. Rollback-instructies ─────────────────────────────────────────────────
-- Om terug te gaan naar de ruimere formaat-check uit stap 20:
--
--   ALTER TABLE potjes
--     DROP CONSTRAINT IF EXISTS potjes_valuta_whitelist,
--     ADD CONSTRAINT potjes_valuta_formaat
--       CHECK (valuta ~ '^[A-Z]{3}$');
