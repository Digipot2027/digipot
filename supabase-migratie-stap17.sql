-- Stap 17: V2 — Blokkeer betalingen die het potsaldo overschrijden
-- Voer dit uit in de Supabase SQL Editor (https://supabase.com → jouw project → SQL Editor)
--
-- Achtergrond:
--   De UI blokkeert al betalingen bij leeg saldo. Deze trigger is de primaire
--   beveiliging op databaseniveau: ook directe API-aanroepen worden geblokkeerd.
--   Regel: SUM(betalingen) mag nooit hoger zijn dan SUM(stortingen) per potje.

-- 1. Verwijder bestaande trigger en functie indien aanwezig (herstartbaar)
DROP TRIGGER IF EXISTS check_potsaldo_voor_betaling ON transacties;
DROP FUNCTION IF EXISTS controleer_potsaldo();

-- 2. Maak de triggerfunctie aan
CREATE OR REPLACE FUNCTION controleer_potsaldo()
RETURNS TRIGGER AS $$
DECLARE
  totaal_gestort NUMERIC;
  totaal_betaald NUMERIC;
BEGIN
  -- Alleen relevant bij betalingen, niet bij stortingen
  IF NEW.type != 'betaling' THEN
    RETURN NEW;
  END IF;

  -- Bereken huidig totaal gestort voor dit potje
  SELECT COALESCE(SUM(bedrag), 0)
    INTO totaal_gestort
    FROM transacties
   WHERE potje_id = NEW.potje_id
     AND type = 'storting';

  -- Bereken huidig totaal betaald voor dit potje (inclusief deze nieuwe betaling)
  SELECT COALESCE(SUM(bedrag), 0) + NEW.bedrag
    INTO totaal_betaald
    FROM transacties
   WHERE potje_id = NEW.potje_id
     AND type = 'betaling';

  -- Blokkeer als betaald het gestorte bedrag zou overschrijden
  IF totaal_betaald > totaal_gestort THEN
    RAISE EXCEPTION 'SALDO_TE_LAAG: betaling van % overschrijdt beschikbaar saldo van %',
      NEW.bedrag,
      (totaal_gestort - (totaal_betaald - NEW.bedrag));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Koppel de trigger aan de transacties-tabel (vóór INSERT)
CREATE TRIGGER check_potsaldo_voor_betaling
  BEFORE INSERT ON transacties
  FOR EACH ROW
  EXECUTE FUNCTION controleer_potsaldo();
