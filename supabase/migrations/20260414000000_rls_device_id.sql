-- 20260414000000_rls_device_id.sql
-- Stap 25: transacties_insert RLS — device-ID verificatie toevoegen
-- Oorspronkelijk: supabase-migratie-stap25-rls-transacties-device-id.sql
-- Uitgevoerd in productie: 2026-04-14

DROP POLICY IF EXISTS transacties_insert ON public.transacties;

CREATE POLICY transacties_insert ON public.transacties
  FOR INSERT TO anon
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
