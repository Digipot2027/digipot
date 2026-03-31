-- Stap 20: Multi-currency voorbereiding — valuta-kolom op potjes
-- Voer dit uit in de Supabase SQL Editor (https://supabase.com → jouw project → SQL Editor)
--
-- ACHTERGROND:
--   Digipot ondersteunt straks meerdere valuta's. Per potje wordt één valuta
--   gekozen bij aanmaken. Alle transacties binnen een potje zijn in dezelfde valuta.
--   Er is geen wisselkoers-conversie voorzien.
--
-- DEZE STAP:
--   Voegt een 'valuta' kolom toe aan de potjes-tabel.
--   - Bestaande potjes krijgen automatisch 'EUR' als waarde (DEFAULT).
--   - Nieuwe potjes krijgen 'EUR' als standaard tenzij anders opgegeven.
--   - De kolom accepteert elke geldige ISO 4217 valutacode (3 hoofdletters).
--
-- BACKWARD COMPATIBILITY:
--   De app-code gebruikt STANDAARD_VALUTA = 'EUR' als fallback wanneer
--   potje.valuta nog niet aanwezig is. Bestaande potjes werken ongewijzigd.
--
-- VEILIGHEID:
--   - Idempotent: meerdere keren uitvoeren geeft geen fout (IF NOT EXISTS).
--   - Geen destructieve operaties.
--   - Bestaande RLS-policies blijven ongewijzigd van toepassing.

-- ─── 1. Voeg valuta-kolom toe aan potjes ─────────────────────────────────────

ALTER TABLE potjes
  ADD COLUMN IF NOT EXISTS valuta VARCHAR(3) NOT NULL DEFAULT 'EUR';

-- ─── 2. CHECK constraint: alleen geldige ISO 4217 codes (3 hoofdletters) ──────
-- Voorkomt dat ongeldige valutacodes worden opgeslagen.
-- De constraint geldt voor nieuwe rijen EN updates.

ALTER TABLE potjes
  DROP CONSTRAINT IF EXISTS potjes_valuta_formaat,
  ADD CONSTRAINT potjes_valuta_formaat
    CHECK (valuta ~ '^[A-Z]{3}$');

-- ─── 3. Ondersteunde valuta's (informatief commentaar) ───────────────────────
-- De DB accepteert elke geldige 3-letter code. De app-laag beperkt
-- de keuze tot onderstaande valuta's via een keuzelijst bij aanmaken.
-- Uitbreiden = alleen de keuzelijst in de UI aanpassen, geen DB-migratie nodig.
--
-- Initieel ondersteund:
--   EUR  Euro               (standaard)
--   USD  US Dollar
--   GBP  Brits Pond
--   CHF  Zwitserse Frank
--   DKK  Deense Kroon
--   NOK  Noorse Kroon
--   SEK  Zweedse Kroon

-- ─── 4. Verificatie ──────────────────────────────────────────────────────────
-- Controleer na uitvoeren:
--
--   -- Kolom aanwezig?
--   SELECT column_name, data_type, column_default, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'potjes' AND column_name = 'valuta';
--
--   -- Bestaande rijen hebben EUR?
--   SELECT valuta, COUNT(*) FROM potjes GROUP BY valuta;
--
--   -- Constraint aanwezig?
--   SELECT conname, consrc FROM pg_constraint
--   WHERE conrelid = 'potjes'::regclass AND conname = 'potjes_valuta_formaat';
--
-- Verwacht:
--   - kolom valuta aanwezig, type varchar(3), default 'EUR', not null
--   - alle bestaande rijen: valuta = 'EUR'
--   - constraint potjes_valuta_formaat aanwezig

-- ─── 5. Rollback-instructies ─────────────────────────────────────────────────
-- Om deze wijziging terug te draaien:
--
--   ALTER TABLE potjes
--     DROP CONSTRAINT IF EXISTS potjes_valuta_formaat,
--     DROP COLUMN IF EXISTS valuta;
--
-- Let op: bestaande potjes verliezen hun valuta-instelling bij rollback.
-- Alleen uitvoeren als nog geen productiedata aanwezig is.
