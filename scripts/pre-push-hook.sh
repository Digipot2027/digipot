#!/bin/sh
#
# .git/hooks/pre-push
#
# Blokkeert een push naar main als de e2e-tests niet succesvol en recent zijn gedraaid.
#
# Vereisten:
#   - npm run e2e moet zijn gedraaid (alle 5 browsers)
#   - Alle tests moeten geslaagd zijn (0 mislukt)
#   - Het resultaat mag niet ouder zijn dan 24 uur
#
# Installatie (eenmalig per developer):
#   cp scripts/pre-push-hook.sh .git/hooks/pre-push
#   chmod +x .git/hooks/pre-push
#
# Overslaan (noodgeval):
#   git push --no-verify
#   (gebruik dit alleen bij hotfixes — documenteer waarom in de commit)

RESULTAAT="test-results/e2e-resultaat.json"
MAX_OUD_SECONDEN=86400  # 24 uur

# Controleer alleen bij pushes naar main
while read lokaal_ref lokaal_sha remote_ref remote_sha; do
  if echo "$remote_ref" | grep -qE "refs/heads/main$"; then
    PUSH_NAAR_MAIN=1
  fi
done

if [ -z "$PUSH_NAAR_MAIN" ]; then
  exit 0
fi

echo ""
echo "🔍 E2e-testcontrole vóór push naar main..."
echo ""

# ── 1. Bestand aanwezig? ──────────────────────────────────────────────────────

if [ ! -f "$RESULTAAT" ]; then
  echo "❌ Geen e2e-testresultaat gevonden."
  echo ""
  echo "   Draai eerst alle e2e-tests:"
  echo "   npm run e2e"
  echo ""
  exit 1
fi

# ── 2. Niet ouder dan 24 uur? ─────────────────────────────────────────────────

BESTAND_TIJD=$(stat -f "%m" "$RESULTAAT" 2>/dev/null || stat -c "%Y" "$RESULTAAT" 2>/dev/null)
NU=$(date +%s)
OUD=$(( NU - BESTAND_TIJD ))

if [ "$OUD" -gt "$MAX_OUD_SECONDEN" ]; then
  UREN=$(( OUD / 3600 ))
  echo "❌ E2e-testresultaat is $UREN uur oud (maximum: 24 uur)."
  echo ""
  echo "   Draai de tests opnieuw:"
  echo "   npm run e2e"
  echo ""
  exit 1
fi

# ── 3. Geen mislukte tests? ───────────────────────────────────────────────────

# Lees het JSON-rapport met node (altijd beschikbaar in een Node.js project)
CONTROLE=$(node -e "
const fs = require('fs');
try {
  const data = JSON.parse(fs.readFileSync('$RESULTAAT', 'utf8'));
  const mislukt = data.stats?.unexpected ?? 0;
  const geslaagd = data.stats?.expected ?? 0;
  const overgeslagen = data.stats?.skipped ?? 0;
  const totaal = (data.stats?.tests ?? 0) || (mislukt + geslaagd + overgeslagen);
  console.log(mislukt + ' ' + geslaagd + ' ' + overgeslagen + ' ' + totaal);
} catch (e) {
  console.log('FOUT');
}
")

if [ "$CONTROLE" = "FOUT" ]; then
  echo "❌ Kon het e2e-testresultaat niet lezen."
  echo ""
  echo "   Controleer: $RESULTAAT"
  echo "   Draai opnieuw: npm run e2e"
  echo ""
  exit 1
fi

MISLUKT=$(echo "$CONTROLE" | awk '{print $1}')
GESLAAGD=$(echo "$CONTROLE" | awk '{print $2}')
OVERGESLAGEN=$(echo "$CONTROLE" | awk '{print $3}')
TOTAAL=$(echo "$CONTROLE" | awk '{print $4}')
MINUTEN=$(( OUD / 60 ))

if [ "$MISLUKT" -gt 0 ]; then
  echo "❌ $MISLUKT van de $TOTAAL e2e-tests zijn mislukt."
  echo ""
  echo "   Los de mislukte tests op en draai opnieuw:"
  echo "   npm run e2e"
  echo "   npm run e2e:report   # voor details"
  echo ""
  exit 1
fi

# ── Alles in orde ─────────────────────────────────────────────────────────────

echo "✅ E2e-tests geslaagd: $GESLAAGD geslaagd, $OVERGESLAGEN overgeslagen ($MINUTEN minuten geleden)"
echo ""
exit 0
