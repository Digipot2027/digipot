-- 20260401000300_saldotrigger.sql
-- Stap 17: DB-trigger — blokkeer betalingen die potsaldo overschrijden
-- Oorspronkelijk: supabase-migratie-stap17.sql

DROP TRIGGER IF EXISTS check_potsaldo_voor_betaling ON transacties;
DROP FUNCTION IF EXISTS controleer_potsaldo();

CREATE OR REPLACE FUNCTION controleer_potsaldo()
RETURNS TRIGGER AS $$
DECLARE
  totaal_gestort NUMERIC;
  totaal_betaald NUMERIC;
BEGIN
  IF NEW.type != 'betaling' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(bedrag), 0)
    INTO totaal_gestort
    FROM transacties
   WHERE potje_id = NEW.potje_id AND type = 'storting';

  SELECT COALESCE(SUM(bedrag), 0) + NEW.bedrag
    INTO totaal_betaald
    FROM transacties
   WHERE potje_id = NEW.potje_id AND type = 'betaling';

  IF totaal_betaald > totaal_gestort THEN
    RAISE EXCEPTION 'SALDO_TE_LAAG: betaling van % overschrijdt beschikbaar saldo van %',
      NEW.bedrag,
      (totaal_gestort - (totaal_betaald - NEW.bedrag));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_potsaldo_voor_betaling
  BEFORE INSERT ON transacties
  FOR EACH ROW
  EXECUTE FUNCTION controleer_potsaldo();
