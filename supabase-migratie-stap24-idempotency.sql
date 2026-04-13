-- ══════════════════════════════════════════════════════════════════════════════
-- Migratie stap 24: idempotency_key op transacties
-- Fix dubbelstorten — audit Q2 2026 — 2026-04-13
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Root cause: PaginaStorten had geen synchrone submit-guard. setBezig(true) is
-- asynchroon — een tweede klik kon de INSERT twee keer versturen vóórdat React
-- de knop had uitgeschakeld. De DB accepteerde beide INSERTs zonder bezwaar.
--
-- Fix laag 1 (frontend): bezigRef in PaginaStorten.jsx — synchroon, geen render.
-- Fix laag 2 (database): deze migratie — second-line defense.
--
-- REEDS UITGEVOERD IN PRODUCTIE op 2026-04-13 via Supabase MCP.

ALTER TABLE public.transacties
  ADD COLUMN IF NOT EXISTS idempotency_key uuid DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS transacties_idempotency_key_unique
  ON public.transacties (deelnemer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
