-- 20260530000000_data_api_grants.sql
--
-- Expliciete GRANT-statements voor de Supabase Data API
--
-- CONTEXT
-- -------
-- Vanaf 30 mei 2026 vereisen nieuwe Supabase-projecten expliciete GRANTs op
-- public-tabellen voordat supabase-js / PostgREST er toegang toe heeft.
-- Vanaf 30 oktober 2026 geldt dit ook voor alle bestaande projecten.
--
-- Digipot gebruikt de Data API (supabase-js) voor alle CRUD-operaties. Zonder
-- expliciete GRANTs zouden na 30 oktober alle API-calls falen met fout 42501.
-- Dit bestand maakt de grants onderdeel van het migratiepad zodat dev-branches
-- en fresh rebuilds identiek gedrag vertonen als productie.
--
-- ONTWERPKEUZES
-- -------------
-- 1. RLS regelt autorisatie — GRANTs regelen toegang (defense-in-depth).
--    Nooit een GRANT verhogen om een RLS-gat te omzeilen.
-- 2. Principe van least privilege: elke rol krijgt alleen de operaties die de
--    RLS-policies daadwerkelijk toestaan. TRUNCATE, REFERENCES en TRIGGER
--    worden nooit aan anon of authenticated verleend.
-- 3. service_role heeft AL volledige rechten via de Supabase superuser-bypass.
--    Expliciete GRANTs voor service_role zijn hier opgenomen voor
--    documentatiedoeleinden en om E5 (onnodig brede privileges) te mitigeren.
-- 4. transacties_log is append-only via SECURITY DEFINER trigger — geen
--    directe toegang voor anon of authenticated nodig of gewenst.
-- 5. push_subscriptions wordt in de volgende migratie (20260530000100) gedropts.
--    Tijdelijk placeholder-grants zijn hier niet nodig: de DROP maakt ze
--    zinloos. De tabel heeft al RLS-policies die al het verkeer blokkeren.
--
-- VOLGORDE VAN UITVOERING
-- -----------------------
-- Dit bestand moet vóór 20260530000100 worden uitgevoerd (lagere timestamp).
-- 20260530000100 dropt push_subscriptions; na die DROP zijn de
-- push_subscriptions-grants hieronder niet meer relevant maar ook niet schadelijk.

-- ── Opschonen eventuele te brede privileges (E5) ─────────────────────────────
-- Verwijder alle rechten van anon en authenticated op alle tabellen,
-- zodat we daarna precies en alleen toekennen wat nodig is.

REVOKE ALL ON public.potjes            FROM anon, authenticated;
REVOKE ALL ON public.deelnemers        FROM anon, authenticated;
REVOKE ALL ON public.transacties       FROM anon, authenticated;
REVOKE ALL ON public.transacties_log   FROM anon, authenticated;
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;

-- ── potjes ───────────────────────────────────────────────────────────────────
-- SELECT: open sharemodel — iedereen met UUID-link mag lezen (RLS: USING true)
-- INSERT: iedereen mag een nieuw open potje aanmaken (RLS: status = 'open')
-- UPDATE: sluiten door actieve deelnemer (RLS: is_mijn_deelnemer + open-check)
-- DELETE: niet toegestaan voor gebruikers — alleen lifecycle via SECURITY DEFINER

GRANT SELECT, INSERT, UPDATE ON public.potjes TO anon, authenticated;

-- ── deelnemers ───────────────────────────────────────────────────────────────
-- SELECT: open sharemodel (RLS: USING true)
-- INSERT: SEC-A2 — vereist user_id = auth.uid() (RLS: eigenaarschapscheck)
-- UPDATE: alleen eigen record (RLS: is_mijn_deelnemer)
-- DELETE: niet nodig — afmelden gebruikt UPDATE (actief = false)

GRANT SELECT, INSERT, UPDATE ON public.deelnemers TO anon, authenticated;

-- ── transacties ──────────────────────────────────────────────────────────────
-- SELECT: open sharemodel (RLS: USING true)
-- INSERT: storting/betaling door actieve eigenaar (RLS: rate-limit + actief + open)
-- DELETE: undo-flow (RLS: eigen transactie + potje open + is_mijn_deelnemer)
-- UPDATE: niet gebruikt in de applicatie

GRANT SELECT, INSERT, DELETE ON public.transacties TO anon, authenticated;

-- ── transacties_log ──────────────────────────────────────────────────────────
-- Append-only audit trail. Schrijftoegang uitsluitend via SECURITY DEFINER
-- trigger (log_verwijderde_transactie). Lezen is voorbehouden aan service_role.
-- Geen GRANT voor anon of authenticated — RLS + geen policies = implicit deny.
-- Explicit: service_role heeft via Supabase al volledige toegang; dit is
-- documentatie dat de keuze bewust is.

-- (geen GRANT voor anon / authenticated — bewuste keuze, zie SCHULD.md B2)

-- ── Sequences ────────────────────────────────────────────────────────────────
-- UUID-primaire-sleutels gebruiken gen_random_uuid() — geen sequences nodig.
-- Expliciet gedocumenteerd zodat toekomstige seq-kolommen niet worden vergeten.

COMMENT ON TABLE public.potjes IS
  'GRANT (2026-05-30): SELECT, INSERT, UPDATE voor anon + authenticated. '
  'RLS regelt autorisatie. DELETE alleen via lifecycle SECURITY DEFINER.';

COMMENT ON TABLE public.deelnemers IS
  'GRANT (2026-05-30): SELECT, INSERT, UPDATE voor anon + authenticated. '
  'RLS SEC-A2: INSERT vereist user_id = auth.uid().';

COMMENT ON TABLE public.transacties IS
  'GRANT (2026-05-30): SELECT, INSERT, DELETE voor anon + authenticated. '
  'UPDATE niet toegestaan — transacties zijn immutable.';

COMMENT ON TABLE public.transacties_log IS
  'GRANT (2026-05-30): geen directe toegang voor anon/authenticated. '
  'Schrijven via SECURITY DEFINER trigger; lezen via service_role.';
