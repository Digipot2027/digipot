-- 20260413000000_idempotency_key.sql
-- Stap 24: idempotency_key op transacties (second-line defense dubbelstorten)
-- Oorspronkelijk: supabase-migratie-stap24-idempotency.sql
-- Uitgevoerd in productie: 2026-04-13

ALTER TABLE public.transacties
  ADD COLUMN IF NOT EXISTS idempotency_key uuid DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS transacties_idempotency_key_unique
  ON public.transacties (deelnemer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
