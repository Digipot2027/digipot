#!/bin/sh
#
# .git/hooks/pre-commit
#
# Toont alle gewijzigde bestanden vóór elke commit zodat je niets vergeet te stagen.
# Blokkeert de commit NIET — puur informatief.
#
# Installatie (eenmalig per developer):
#   cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit

echo ""
echo "📋 Gewijzigde bestanden in deze commit:"
echo ""
git diff --cached --stat
echo ""

NIET_GESTAGED=$(git diff --name-only)
if [ -n "$NIET_GESTAGED" ]; then
  echo "⚠️  Gewijzigd maar NIET gestaged (vergeten?):"
  echo ""
  echo "$NIET_GESTAGED" | sed 's/^/   /'
  echo ""
  echo "   Stagen: git add <bestand>  of  git add ."
  echo "   Doorgaan zonder: commit wordt nu uitgevoerd"
  echo ""
fi

exit 0
