-- ══════════════════════════════════════════════════════════════════════════════
-- Migratie stap 25: transacties_insert RLS — device-ID check toevoegen
-- Fix S3 — audit Q2 2026 — 2026-04-14
-- REEDS UITGEVOERD IN PRODUCTIE via Supabase MCP.
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS transacties_insert ON public.transacties;

CREATE POLICY transacties_insert ON public.transacties
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deelnemers d
      WHERE d.id = transacties.deelnemer_id
        AND d.potje_id = transacties.potje_id
        AND d.actief = true
    )
    AND EXISTS (
      SELECT 1 FROM potjes p
      WHERE p.id = transacties.potje_id
        AND p.status = 'open'
    )
    AND EXISTS (
      SELECT 1 FROM deelnemers d
      WHERE d.id = transacties.deelnemer_id
        AND d.device_id = (
          SELECT (current_setting('request.headers', true)::json ->> 'x-device-id')
        )
    )
  );
