-- 20260421000100_transacties_rate_limit.sql
-- B4: Frontend rate limiting op device-niveau via RLS WITH CHECK
--
-- Probleem: een kwaadwillende of kapotte client kan in theorie honderden
-- stortingen of betalingen per seconde aanmaken. De bezigRef-guard (A17)
-- blokkeert dubbele UI-submits maar niet geautomatiseerde requests.
--
-- Oplossing: uitbreiding van de bestaande transacties_insert RLS-policy
-- met een frequentiecheck op DB-niveau:
--   max 10 transacties per device_id per minuut
--
-- Keuze voor RLS boven Cloudflare Rate Limiting:
--   - Cloudflare MCP heeft onvoldoende schrijftoegang voor Workers/rules
--   - RLS-check is atomair en server-side — niet te omzeilen via de client
--   - Supabase free-tier heeft geen pgbouncer connection pooling die
--     een COUNT-subquery significant vertraagt bij dit volume
--
-- Drempel: 10/minuut per device_id
--   - Ruim boven normaal gebruik (1-5 transacties per sessie)
--   - Laag genoeg om geautomatiseerd misbruik te blokkeren
--   - Bij overschrijding krijgt de gebruiker een RLS 42501-fout die
--     vertaalFout.js vertaalt naar "Je sessie is niet herkend. Ververs de pagina."
--     (bestaande 42501-matcher — geen nieuwe UI-tekst nodig)

DROP POLICY IF EXISTS transacties_insert ON public.transacties;

CREATE POLICY transacties_insert ON public.transacties
  FOR INSERT TO anon
  WITH CHECK (
    -- Deelnemer bestaat, is actief en hoort bij dit potje
    EXISTS (
      SELECT 1 FROM deelnemers d
      WHERE d.id = transacties.deelnemer_id
        AND d.potje_id = transacties.potje_id
        AND d.actief = true
    )
    -- Potje is open
    AND EXISTS (
      SELECT 1 FROM potjes p
      WHERE p.id = transacties.potje_id
        AND p.status = 'open'
    )
    -- Device-ID komt overeen met de deelnemer (identiteitsverificatie)
    AND EXISTS (
      SELECT 1 FROM deelnemers d
      WHERE d.id = transacties.deelnemer_id
        AND d.device_id = (
          SELECT (current_setting('request.headers', true)::json ->> 'x-device-id')
        )
    )
    -- B4: Rate limit — max 10 transacties per device_id per minuut
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
