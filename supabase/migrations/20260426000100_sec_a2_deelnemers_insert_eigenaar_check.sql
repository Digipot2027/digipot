-- 20260426000100_sec_a2_deelnemers_insert_eigenaar_check.sql
--
-- SEC-A2 (Critical IDOR): deelnemers_insert policy aanscherpen.
--
-- Probleem: de oude policy controleerde alleen dat het potje open is.
-- Een geauthenticeerde anon-gebruiker kon een deelnemer invoegen met:
--   - user_id = NULL (kapt eigenaarschap af — niemand kan deze deelnemer beheren)
--   - user_id = <UUID van een andere gebruiker> (impersonation)
-- Combinatie met de transacties_insert policy (die alleen is_mijn_deelnemer
-- vereist op de deelnemer-rij) maakte het mogelijk om namens een gespoofde
-- identiteit transacties te plaatsen op willekeurige open potjes.
--
-- Oplossing: dwing af dat NEW.user_id = auth.uid() én niet NULL.
-- Een aanvaller kan nog steeds zelf deelnemen aan een gedeelde potje-link
-- (dat is het sharemodel), maar kan zich niet meer voordoen als iemand anders
-- en kan geen "wees-deelnemer" zonder eigenaar achterlaten.
--
-- Compatibiliteit:
--   - bestaande deelnemers met user_id = NULL (legacy) blijven leesbaar via
--     deelnemers_select. Ze kunnen niet meer beheerd worden via UPDATE
--     (is_mijn_deelnemer gaf al false bij user_id IS NULL — geen wijziging).
--   - frontend (usePotjeActies.handleDeelnemen) zet user_id al via
--     supabase.auth.getUser() — geen frontend-wijziging nodig.

DROP POLICY IF EXISTS "deelnemers_insert" ON public.deelnemers;

CREATE POLICY "deelnemers_insert"
  ON public.deelnemers FOR INSERT TO anon, authenticated
  WITH CHECK (
    -- Potje moet open zijn
    EXISTS (
      SELECT 1 FROM public.potjes
      WHERE potjes.id = deelnemers.potje_id
        AND potjes.status = 'open'
    )
    -- Eigenaarschap: nieuwe deelnemer moet aan de aanmakende sessie gekoppeld zijn
    AND auth.uid() IS NOT NULL
    AND deelnemers.user_id = auth.uid()
  );

COMMENT ON POLICY "deelnemers_insert" ON public.deelnemers IS
  'SEC-A2 (2026-04-26): vereist user_id = auth.uid() bij INSERT om '
  'impersonation en wees-deelnemers (user_id NULL) te voorkomen.';
