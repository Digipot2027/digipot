-- 20260421000000_transacties_audit_log.sql
-- B2: Audit trail voor verwijderde transacties
--
-- Probleem: wanneer een deelnemer een transactie ongedaan maakt (undo) of
-- de lifecycle-cron een potje verwijdert (CASCADE), verdwijnt de data
-- definitief. Bij een bug of misbruik is reconstructie van de staat onmogelijk.
--
-- Oplossing: een aparte 'transacties_log'-tabel die via een SECURITY DEFINER
-- trigger elke DELETE op 'transacties' vastlegt, inclusief wie de verwijdering
-- initieerde (device_id uit de request-header) en wanneer.
--
-- Scope:
--   - Logt alleen DELETEs op 'transacties' — niet op 'potjes' of 'deelnemers'
--     (lifecycle-verwijdering van hele potjes is al herleidbaar via de
--     gesloten_op/gesloten_door-kolommen en de cron-log).
--   - De log is append-only: geen UPDATE- of DELETE-policy op transacties_log
--     voor de anon-rol. Alleen via een servicerol (bijv. Supabase dashboard)
--     zijn records te verwijderen.
--   - SECURITY DEFINER: de triggerfunctie schrijft naar transacties_log zonder
--     de RLS-policies van de aanroepende sessie te erven. Dit is noodzakelijk
--     omdat de anon-rol geen INSERT-recht heeft op transacties_log.
--   - search_path=public: expliciete instelling om schema-injection te voorkomen.

-- ── Tabel ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transacties_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transactie_id  UUID        NOT NULL,
  potje_id       UUID        NOT NULL,
  deelnemer_id   UUID        NOT NULL,
  type           TEXT        NOT NULL CHECK (type IN ('storting', 'betaling')),
  bedrag         NUMERIC(8,2) NOT NULL,
  aangemaakt_op  TIMESTAMPTZ NOT NULL,
  verwijderd_op  TIMESTAMPTZ NOT NULL DEFAULT now(),
  verwijderd_door TEXT        -- device_id uit request-header, null bij lifecycle-cron
);

-- Geen RLS nodig: de tabel is niet toegankelijk via de anon-rol.
-- De trigger (SECURITY DEFINER) schrijft er rechtstreeks in.
-- Leesrechten zijn voorbehouden aan de Supabase service-rol.

COMMENT ON TABLE transacties_log IS
  'Audit trail: elke verwijderde transactie wordt hier vastgelegd. '
  'Append-only voor de anon-rol. Beheer via service-rol of Supabase dashboard.';

COMMENT ON COLUMN transacties_log.verwijderd_door IS
  'device_id uit de x-device-id request-header op het moment van verwijdering. '
  'NULL wanneer de verwijdering plaatsvond via een server-side job (lifecycle-cron, CASCADE).';

-- ── Index ────────────────────────────────────────────────────────────────────

-- Meest voorkomende opzoeking: alle verwijderingen voor een specifiek potje.
CREATE INDEX IF NOT EXISTS idx_transacties_log_potje_id
  ON transacties_log (potje_id);

-- ── Triggerfunctie ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION log_verwijderde_transactie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device_id TEXT;
BEGIN
  -- Lees de device_id van de initiator uit de request-header.
  -- current_setting() retourneert '' (lege string) als de header ontbreekt
  -- (bijv. bij een server-side job), niet NULL. Normaliseer naar NULL.
  BEGIN
    v_device_id := current_setting('request.headers', true)::json ->> 'x-device-id';
  EXCEPTION WHEN OTHERS THEN
    v_device_id := NULL;
  END;

  IF v_device_id = '' THEN
    v_device_id := NULL;
  END IF;

  INSERT INTO transacties_log (
    transactie_id,
    potje_id,
    deelnemer_id,
    type,
    bedrag,
    aangemaakt_op,
    verwijderd_door
  ) VALUES (
    OLD.id,
    OLD.potje_id,
    OLD.deelnemer_id,
    OLD.type,
    OLD.bedrag,
    OLD.aangemaakt_op,
    v_device_id
  );

  RETURN OLD;
END;
$$;

-- ── Trigger ──────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_log_verwijderde_transactie ON transacties;

CREATE TRIGGER trg_log_verwijderde_transactie
  AFTER DELETE ON transacties
  FOR EACH ROW
  EXECUTE FUNCTION log_verwijderde_transactie();
