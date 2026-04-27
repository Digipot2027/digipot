-- 20260414000000_rls_device_id.sql
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  OBSOLETE — VERVANGEN DOOR 20260427000100_rls_fase4_consolidatie.sql    ║
-- ║                                                                          ║
-- ║  Dit bestand voegde device-id verificatie toe via de x-device-id HTTP-  ║
-- ║  header. Deze aanpak is in Fase 4 (2026-04-25) volledig vervangen door  ║
-- ║  auth.uid() verificatie via is_mijn_deelnemer().                        ║
-- ║                                                                          ║
-- ║  De x-device-id header wordt door de frontend niet meer verstuurd.      ║
-- ║  Uitvoeren van dit bestand op een fresh DB zou alle UPDATE/INSERT op     ║
-- ║  deelnemers en transacties breken (42501) omdat de header altijd NULL   ║
-- ║  is in Fase 4.                                                           ║
-- ║                                                                          ║
-- ║  NIET uitvoeren op een fresh DB — gebruik 20260427000100 als referentie. ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Originele beschrijving:
-- Stap 25: transacties_insert RLS — device-ID verificatie toevoegen
-- Oorspronkelijk: supabase-migratie-stap25-rls-transacties-device-id.sql
-- Uitgevoerd in productie: 2026-04-14
--
-- Waarom obsolete:
-- - Gebruikt current_setting('request.headers')::json ->> 'x-device-id'
-- - Frontend stuurt deze header niet meer na Fase 4 (2026-04-25)
-- - Vervangen door is_mijn_deelnemer() met auth.uid() in 20260421000100
--   en definitief geconsolideerd in 20260427000100
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
  );

*/
