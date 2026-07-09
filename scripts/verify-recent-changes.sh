#!/usr/bin/env bash
# فحص التعديلات الأخيرة — وكالات، تتبع الغرف، تخصيص الخلفيات، اللوجو، الإطارات
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ROOM_ID_FILE="app/room/[id].tsx"
CHAT_USER_FILE="app/chat/[userId].tsx"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

pass() { echo -e "${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }
warn() { echo -e "${YELLOW}!${NC} $1"; WARN=$((WARN + 1)); }

must_contain() {
  local file="$1" pattern="$2" label="$3"
  if [[ ! -f "$file" ]]; then
    fail "$label — الملف غير موجود: $file"
    return
  fi
  if grep -qE "$pattern" "$file" 2>/dev/null; then
    pass "$label"
  else
    fail "$label — لم يُعثر على: $pattern في $file"
  fi
}

must_not_contain() {
  local file="$1" pattern="$2" label="$3"
  if [[ ! -f "$file" ]]; then
    fail "$label — الملف غير موجود: $file"
    return
  fi
  if grep -qE "$pattern" "$file" 2>/dev/null; then
    fail "$label — ما زال موجوداً (غير متوقع): $pattern في $file"
  else
    pass "$label"
  fi
}

section() {
  echo ""
  echo "── $1 ──"
}

echo "=========================================="
echo "  فحص التعديلات الأخيرة — LinkUp"
echo "  $(date '+%Y-%m-%d %H:%M')"
echo "=========================================="

section "1) إطار بطاقة الوكالة داخل الكارد"
must_contain "src/components/agency/FramedAgencyCover.tsx" "contentFit=\"cover\"" "FramedAgencyCover: الإطار فوق الصورة (cover)"
must_not_contain "src/components/agency/FramedAgencyCover.tsx" "innerW / FRAMED_COVER_INNER_RATIO" "FramedAgencyCover: لا توسيع حاوية خارج الكارد"
must_contain "src/components/agency/AgencyRoomCard.tsx" "width={coverW}" "AgencyRoomCard: عرض كامل للكارد"

section "2) هيدر الغرفة — إطار الوكالة وليس المدير"
must_contain "$ROOM_ID_FILE" "agencyCardFrameUrl" "room: حالة إطار بطاقة الوكالة"
must_contain "$ROOM_ID_FILE" "subscribeToAgencyById" "room: اشتراك بيانات الوكالة"
must_contain "$ROOM_ID_FILE" "headerFrameStyle=.*agencyCard" "room: نمط إطار agencyCard في الهيدر"
must_contain "src/components/room/RoomLiveHeader.tsx" "FramedAgencyCover" "RoomLiveHeader: FramedAgencyCover للوكالة"

section "3) تتبع حضور الغرف (presence)"
must_contain "src/services/roomFeatures.ts" "isTrackableAgencyPresence" "roomFeatures: دالة فحص حضور الوكالة"
must_contain "src/services/roomFeatures.ts" "isAgencyRoom" "roomFeatures: حقل isAgencyRoom في presence"
must_contain "$ROOM_ID_FILE" "clearUserFromRoom" "room: مسح presence عند الخروج"
must_contain "$ROOM_ID_FILE" "setUserInRoom\(roomId, room\.name" "room: تعيين presence عند الدخول"

section "4) تتبع المحادثات — بدون اشتراط المتابعة"
must_contain "src/hooks/useAgencyRoomTracking.ts" "extraPeerUids" "tracking: دعم أطراف المحادثة"
must_contain "app/(tabs)/chat.tsx" "conversationPeerUids" "chat: جمع UIDs من المحادثات"
must_contain "app/(tabs)/chat.tsx" "useAgencyRoomTracking\(conversationPeerUids\)" "chat: تمرير المحادثات للتتبع"
must_contain "$CHAT_USER_FILE" "subscribeToUserPresence\(userId" "شات فردي: اشتراك مباشر بالحضور"
must_not_contain "app/(tabs)/chat.tsx" "showAgencyMusic=\{isAgencyMember" "chat: لا يعتمد على عضوية وكالة فقط للمؤشر"

section "5) تخصيص الخلفيات — مالك الوكالة"
must_contain "app/room/customize.tsx" "bgUsable" "customize: متغير bgUsable"
must_contain "app/room/customize.tsx" "applyAgencyRoomBackground" "customize: تفعيل خلفية الوكالة"
must_contain "src/components/room/RoomSettingsSheet.tsx" "agencyId" "settings: تمرير agencyId لشاشة التخصيص"

section "6) توحيد لوجو LinkUp (شاشة المطابقة)"
must_contain "app/(tabs)/index.tsx" "TabScreenHeader" "discover: TabScreenHeader"
must_contain "app/(tabs)/index.tsx" "rooms\.homeSubtitle" "discover: نفس subtitle الهوم"
must_not_contain "app/(tabs)/index.tsx" "logoTile" "discover: إزالة logoTile القديم"

section "7) ترجمات التتبع"
must_contain "src/localization/locales/ar.json" '"agencyInRoom".*يلعب' "ar: نص شريط الانضمام"
must_contain "src/localization/locales/ar.json" '"joinRoom".*انضم' "ar: زر انضم"

section "8) TypeScript (اختياري)"
if command -v npx >/dev/null 2>&1 && [[ -f package.json ]]; then
  if npx tsc --noEmit 2>/tmp/linkup-tsc-verify.log; then
    pass "tsc --noEmit: بدون أخطاء"
  else
    ERR_COUNT=$(grep -c "error TS" /tmp/linkup-tsc-verify.log 2>/dev/null || true)
    warn "tsc --noEmit: ${ERR_COUNT:-?} خطأ — راجع /tmp/linkup-tsc-verify.log"
    head -5 /tmp/linkup-tsc-verify.log | sed 's/^/       /'
  fi
else
  warn "تخطّي tsc — npx غير متوفر"
fi

section "النتيجة"
echo ""
echo "  نجح: $PASS"
echo "  فشل: $FAIL"
echo "  تحذير: $WARN"
echo ""

if [[ "$FAIL" -gt 0 ]]; then
  echo -e "${RED}فشل الفحص — راجع الأخطاء أعلاه${NC}"
  exit 1
fi

echo -e "${GREEN}كل الفحوصات الأساسية نجحت ✓${NC}"
exit 0
