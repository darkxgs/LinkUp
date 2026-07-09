#!/usr/bin/env bash
# فحص تكامل ألعاب الذكاء الثلاث مع بروتوكول WebView
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOSTING="$ROOT/hosting/public/games"
APP="$(cd "$ROOT/../sada-app 14" 2>/dev/null && pwd || echo "")"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
PASS=0
FAIL=0

pass() { echo -e "${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }

must_contain() {
  local file="$1" pattern="$2" label="$3"
  if [[ ! -f "$file" ]]; then fail "$label — ملف مفقود: $file"; return; fi
  if grep -qE "$pattern" "$file"; then pass "$label"; else fail "$label — $pattern في $file"; fi
}

echo "=========================================="
echo "  فحص ألعاب الذكاء — LinkUp"
echo "=========================================="

GAMES=(flag-guess sequence-memory memory-match)

for g in "${GAMES[@]}"; do
  echo ""
  echo "── $g ──"
  IDX="$HOSTING/$g/index.html"
  must_contain "$IDX" 'intel-app-bridge\.js' "$g: تحميل intel-app-bridge"
  must_contain "$IDX" 'games-config-utils\.js' "$g: تحميل games-config-utils"
  must_contain "$IDX" 'games-intel-boot\.js' "$g: تحميل games-intel-boot"
  must_contain "$IDX" 'intel-i18n\.js' "$g: تحميل intel-i18n"
done

echo ""
echo "── Bridge مشترك ──"
must_contain "$HOSTING/intel-app-bridge.js" 'PLACE_BET' "bridge: PLACE_BET"
must_contain "$HOSTING/intel-app-bridge.js" 'GAME_RESULT' "bridge: GAME_RESULT"
must_contain "$HOSTING/intel-app-bridge.js" 'CANCEL_BET' "bridge: CANCEL_BET"
must_contain "$HOSTING/intel-app-bridge.js" 'assertEmbeddedStake' "bridge: تحقق فئات الدخولية"
must_contain "$HOSTING/intel-app-bridge.js" 'REWARD_MULTIPLIER|winMultiplier' "bridge: مضاعف الربح"

echo ""
echo "── تدفق الرهان في الألعاب ──"
must_contain "$HOSTING/flag-guess/js/state.js" 'AppBridge\.placeBet' "flag: placeBet عبر الجسر"
must_contain "$HOSTING/flag-guess/js/state.js" 'reportGameResult' "flag: reportGameResult"
must_contain "$HOSTING/flag-guess/js/state.js" 'cancelBet' "flag: إلغاء الرهان عند فشل التحميل"
must_contain "$HOSTING/flag-guess/js/render.js" 'ALLOW_CUSTOM_BET.*isEmbedded' "flag: إخفاء الرهان المخصص داخل التطبيق"

must_contain "$HOSTING/sequence-memory/js/state.js" 'AppBridge\.placeBet' "remember: placeBet"
must_contain "$HOSTING/sequence-memory/js/state.js" 'reportGameResult' "remember: reportGameResult"

must_contain "$HOSTING/memory-match/js/matchEngine.js" 'AppBridge\.placeBet' "shapes: placeBet"
must_contain "$HOSTING/memory-match/js/matchEngine.js" 'reportGameResult' "shapes: reportGameResult"
must_contain "$HOSTING/memory-match/js/matchEngine.js" 'isAllowedStake' "shapes: تحقق فئات الدخولية"
must_contain "$HOSTING/memory-match/js/main.js" 'custom-bet-container' "shapes: إخفاء الرهان المخصص"

echo ""
echo "── إعدادات السياسة ──"
for g in "${GAMES[@]}"; do
  case "$g" in
    flag-guess)
      must_contain "$HOSTING/$g/js/policyConfig.js" '5000, 10000, 25000, 50000' "$g: فئات الدخولية"
      must_contain "$HOSTING/$g/js/policyConfig.js" 'REWARD_MULTIPLIER: 5' "$g: مضاعف 5×"
      ;;
    sequence-memory)
      must_contain "$HOSTING/$g/js/policyConfig.js" '5000, 10000, 25000, 50000' "$g: فئات الدخولية"
      must_contain "$HOSTING/$g/js/policyConfig.js" 'REWARD_MULTIPLIER = 5' "$g: مضاعف 5×"
      ;;
    memory-match)
      must_contain "$HOSTING/$g/js/policyConfig.js" '5000, 10000, 25000, 50000' "$g: فئات الدخولية"
      must_contain "$HOSTING/$g/js/policyConfig.js" 'REWARD_MULTIPLIER: 5' "$g: مضاعف 5×"
      ;;
  esac
done

if [[ -n "$APP" && -d "$APP" ]]; then
  echo ""
  echo "── التطبيق (sada-app) ──"
  must_contain "$APP/src/services/firebase/gameTransactions.ts" "'flag-guess'" "app: flag-guess في INTELLIGENCE_GAME_IDS"
  must_contain "$APP/src/services/firebase/gameTransactions.ts" "'memory-match'" "app: memory-match"
  must_contain "$APP/src/services/firebase/gameTransactions.ts" "'sequence-memory'" "app: sequence-memory"
  must_contain "$APP/app/games/webview.tsx" 'CANCEL_BET' "app: معالجة CANCEL_BET"
  must_contain "$APP/app/games/webview.tsx" 'recordIntelligenceWin' "app: تسجيل فوز الذكاء"
  must_contain "$APP/app/games/webview.tsx" 'hasPlayedDailyGame' "app: حد يومي واحد"
  must_contain "$APP/app/games/intelligence.tsx" 'flag-guess' "app: شاشة الذكاء — flag"
  must_contain "$APP/app/games/intelligence.tsx" 'memory-match' "app: شاشة الذكاء — memory"
  must_contain "$APP/app/games/intelligence.tsx" 'sequence-memory' "app: شاشة الذكاء — sequence"
fi

echo ""
echo "  نجح: $PASS | فشل: $FAIL"
if [[ "$FAIL" -gt 0 ]]; then exit 1; fi
echo -e "${GREEN}كل فحوصات ألعاب الذكاء نجحت ✓${NC}"
