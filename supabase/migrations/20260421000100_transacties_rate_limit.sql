-- 20260421000100_transacties_rate_limit.sql
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  OBSOLETE — VERVANGEN DOOR 20260427000100_rls_fase4_consolidatie.sql    ║
-- ║                                                                          ║
-- ║  Dit bestand voegde een rate-limit toe op transacties_insert via        ║
-- ║  device-id (x-device-id header). In Fase 4 (2026-04-25) is de          ║
-- ║  rate-limit herschreven naar auth.uid(). De x-device-id header wordt   ║
-- ║  door de frontend niet meer verstuurd.                                  ║
-- ║                                                                          ║
-- ║  Uitvoeren van dit bestand op een fresh DB zou de rate-limit-clausule   ║
-- ║  resetten naar de verouderde device-id logica, waarna alle transactie-  ║
-- ║  inserts zouden falen (COUNT altijd 0 want device_id altijd NULL).      ║
-- ║                                                                          ║
-- ║  NIET uitvoeren op een fresh DB — gebruik 20260427000100 als referentie. ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Originele beschrijving:
-- B4: Frontend rate limiting op device-niveau via RLS WITH CHECK
-- Uitgevoerd in productie: 2026-04-21
--
-- Waarom obsolete:
-- - Rate-limit gebruikte current_setting('request.headers')::json ->> 'x-device-id'
-- - Fase 4 (2026-04-25) verving dit door auth.uid() in alle policies
-- - De live policy (geverifieerd 2026-04-27) gebruikt d.user_id = auth.uid()
-- - Geconsolideerd in 20260427000100
--
-- Originele SQL (inactief — niet uitvoeren):
/*

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
    AND (
      SELECT COUNT(*)
      FROM transacties t
      JOIN deelnemers d ON d.id = t.deelnemer_id
      WHERE d.device_id = (
          SELECT (current_setting('request.headers', true)::json ->> 'x-device-id')
        )
        AND t.aangemaakt_op > now() - interval '1 minute'
    ) < 10
  );

*/
