-- 20260427000100_rls_fase4_consolidatie.sql
--
-- SEC-A3 (2026-04-27): consoliderende migratie — definitieve RLS-policy-set
--
-- CONTEXT
-- -------
-- Fase 4 (2026-04-25) migreerde de identiteitsverificatie van x-device-id header
-- naar auth.uid(). De live DB-policies weerspiegelden dit al, maar de repository-
-- bestanden bevatten nog drie migraties met de verouderde x-device-id logica:
--
--   20260407000000_rls_volledig.sql        -- begin-state policies (USING (true))
--   20260412000100_rls_herstel.sql         -- tussenstap deelnemer/actief-check
--   20260414000000_rls_device_id.sql       -- device-id header check (OBSOLETE)
--   20260421000100_transacties_rate_limit.sql -- rate-limit via device-id (OBSOLETE)
--
-- Bij een fresh rebuild (`supabase db reset` of dev-branch) zouden de bovenstaande
-- migraties worden uitgevoerd in volgorde — de eindstaat zou dan NIET overeenkomen
-- met productie: device-id header-checks zouden actief zijn terwijl de frontend
-- (Fase 4) geen x-device-id header meer stuurt. Alle UPDATE/INSERT-operaties op
-- deelnemers en transacties zouden falen met 42501.
--
-- DIT BESTAND
-- -----------
-- Reproduceert de volledige live policy-set zoals geverifieerd op 2026-04-27.
-- Is idempotent (DROP IF EXISTS + CREATE). Kan veilig opnieuw worden uitgevoerd.
-- Markeert alle voorgaande policy-migraties als superseded.
--
-- NIET uitgevoerd in productie (productie is al correct) — alleen relevant
-- voor fresh rebuilds.
--
-- GEVERIFIEERDE LIVE STATE (pg_policies, 2026-04-27)
-- ---------------------------------------------------
-- Zie inline WITH CHECK / USING clausules hieronder.

-- ── Zorg dat RLS actief is op alle tabellen ─────────────────────────────────
ALTER TABLE public.potjes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deelnemers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacties       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacties_log   ENABLE ROW LEVEL SECURITY;

-- ── potjes ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "potjes_select"         ON public.potjes;
DROP POLICY IF EXISTS "potjes_insert"         ON public.potjes;
DROP POLICY IF EXISTS "potjes_update_sluiten" ON public.potjes;

-- Iedereen mag potjes lezen (open sharemodel via UUID-link)
CREATE POLICY "potjes_select"
  ON public.potjes FOR SELECT TO anon, authenticated
  USING (true);

-- Iedereen mag een nieuw open potje aanmaken
-- E6 (open): geen rate-limit hier — staat als schuld E6 genoteerd
CREATE POLICY "potjes_insert"
  ON public.potjes FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'open');

-- Sluiten: potje moet open zijn, aanvrager moet een actieve deelnemer zijn
-- is_mijn_deelnemer() vereist auth.uid() = deelnemers.user_id (Fase 4)
CREATE POLICY "potjes_update_sluiten"
  ON public.potjes FOR UPDATE TO anon, authenticated
  USING (
    status = 'open'
    AND EXISTS (
      SELECT 1 FROM public.deelnemers d
      WHERE d.potje_id = potjes.id
        AND d.actief = true
        AND is_mijn_deelnemer(d.user_id, d.device_id)
    )
  )
  WITH CHECK (status = 'gesloten');

-- ── deelnemers ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "deelnemers_select" ON public.deelnemers;
DROP POLICY IF EXISTS "deelnemers_insert" ON public.deelnemers;
DROP POLICY IF EXISTS "deelnemers_update" ON public.deelnemers;

-- Iedereen mag deelnemers lezen (open sharemodel)
CREATE POLICY "deelnemers_select"
  ON public.deelnemers FOR SELECT TO anon, authenticated
  USING (true);

-- SEC-A2 (2026-04-26): INSERT vereist user_id = auth.uid()
-- Voorkomt impersonation (user_id van iemand anders) en weesdeelnemers (user_id NULL)
CREATE POLICY "deelnemers_insert"
  ON public.deelnemers FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.potjes
      WHERE potjes.id = deelnemers.potje_id
        AND potjes.status = 'open'
    )
    AND auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  );

-- UPDATE: alleen eigen deelnemer-record
-- Gebruikt is_mijn_deelnemer() voor auth.uid()-verificatie
CREATE POLICY "deelnemers_update"
  ON public.deelnemers FOR UPDATE TO anon, authenticated
  USING  (is_mijn_deelnemer(user_id, device_id))
  WITH CHECK (is_mijn_deelnemer(user_id, device_id));

-- ── transacties ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "transacties_select" ON public.transacties;
DROP POLICY IF EXISTS "transacties_insert" ON public.transacties;
DROP POLICY IF EXISTS "transacties_delete" ON public.transacties;

-- Iedereen mag transacties lezen
CREATE POLICY "transacties_select"
  ON public.transacties FOR SELECT TO anon, authenticated
  USING (true);

-- INSERT: deelnemer actief + potje open + eigen sessie + rate-limit 10/min
-- Rate-limit gebruikt auth.uid() (Fase 4 — niet meer device-id)
CREATE POLICY "transacties_insert"
  ON public.transacties FOR INSERT TO anon, authenticated
  WITH CHECK (
    -- Deelnemer bestaat, is actief en hoort bij dit potje
    EXISTS (
      SELECT 1 FROM public.deelnemers d
      WHERE d.id = transacties.deelnemer_id
        AND d.potje_id = transacties.potje_id
        AND d.actief = true
    )
    -- Potje is open
    AND EXISTS (
      SELECT 1 FROM public.potjes p
      WHERE p.id = transacties.potje_id
        AND p.status = 'open'
    )
    -- Eigenaarschap: deelnemer hoort bij deze auth-sessie
    AND EXISTS (
      SELECT 1 FROM public.deelnemers d
      WHERE d.id = transacties.deelnemer_id
        AND is_mijn_deelnemer(d.user_id, d.device_id)
    )
    -- Rate-limit: max 10 transacties per auth.uid() per minuut
    AND (
      SELECT COUNT(*)
      FROM public.transacties t
      JOIN public.deelnemers d ON d.id = t.deelnemer_id
      WHERE d.user_id = auth.uid()
        AND t.aangemaakt_op > now() - interval '1 minute'
    ) < 10
  );

-- DELETE: undo — eigen transactie op open potje
CREATE POLICY "transacties_delete"
  ON public.transacties FOR DELETE TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deelnemers d
      WHERE d.id = transacties.deelnemer_id
        AND d.potje_id = transacties.potje_id
        AND is_mijn_deelnemer(d.user_id, d.device_id)
    )
    AND EXISTS (
      SELECT 1 FROM public.potjes p
      WHERE p.id = transacties.potje_id
        AND p.status = 'open'
    )
  );

-- ── push_subscriptions ───────────────────────────────────────────────────────
-- E4 (open): tabel bestaat maar feature is niet geïmplementeerd.
-- Policies worden hier gedefinieerd zodat een rebuild consistent is met
-- de live state. Zie SCHULD.md E4 voor het DROP TABLE-voorstel.

DROP POLICY IF EXISTS "push_subscriptions_select" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_insert" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_update" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_delete" ON public.push_subscriptions;

CREATE POLICY "push_subscriptions_select"
  ON public.push_subscriptions FOR SELECT TO anon, authenticated
  USING (
    deelnemer_id IN (
      SELECT id FROM public.deelnemers
      WHERE is_mijn_deelnemer(user_id, device_id)
    )
  );

CREATE POLICY "push_subscriptions_insert"
  ON public.push_subscriptions FOR INSERT TO anon, authenticated
  WITH CHECK (
    deelnemer_id IN (
      SELECT id FROM public.deelnemers
      WHERE is_mijn_deelnemer(user_id, device_id)
    )
  );

CREATE POLICY "push_subscriptions_update"
  ON public.push_subscriptions FOR UPDATE TO anon, authenticated
  USING (
    deelnemer_id IN (
      SELECT id FROM public.deelnemers
      WHERE is_mijn_deelnemer(user_id, device_id)
    )
  )
  WITH CHECK (
    deelnemer_id IN (
      SELECT id FROM public.deelnemers
      WHERE is_mijn_deelnemer(user_id, device_id)
    )
  );

CREATE POLICY "push_subscriptions_delete"
  ON public.push_subscriptions FOR DELETE TO anon, authenticated
  USING (
    deelnemer_id IN (
      SELECT id FROM public.deelnemers
      WHERE is_mijn_deelnemer(user_id, device_id)
    )
  );

-- ── transacties_log ──────────────────────────────────────────────────────────
-- Append-only audit trail. Geen policies = RLS blokkeert alles voor anon.
-- Alleen SECURITY DEFINER trigger en service_role hebben schrijftoegang.
-- Dit is bewuste keuze — zie TO §10 (audit trail) en SCHULD.md B2.
-- Geen policies aanmaken hier: RLS aan + geen policies = implicit deny.
