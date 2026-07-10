/**
 * اتصال LiveKit مع بديل ترحيل تلقائي (#17 — مشكلة الاتصال في سوريا)
 *
 * بعض مزودي الإنترنت (خصوصاً بيانات الجوال) يحجبون/يخنقون UDP فتفشل وسائط
 * WebRTC رغم نجاح إشارات WebSocket. LiveKit Cloud يوفّر خوادم TURN عبر
 * TCP/TLS على المنفذ 443 (تبدو كحركة HTTPS عادية وتعبر أغلب الحجب).
 *
 * الأسلوب: محاولة اتصال مباشر أولاً (أفضل جودة/زمن وصول) بمهلة قصيرة،
 * وعند الفشل إعادة المحاولة بوضع `iceTransportPolicy: 'relay'` الذي يجبر
 * الوسائط على المرور عبر ترحيل TURN.
 *
 * تحسينات ضد بطء الشبكات المحجوبة (كان الصوت يتأخر 20-40 ثانية):
 * - مهلة المحاولة المباشرة 7 ثوانٍ بدل 15 — الفشل يُكتشف أسرع بالنصف
 * - تفضيل الترحيل يُحفظ على الجهاز — بعد أول نجاح بالترحيل تبدأ كل الجلسات
 *   اللاحقة به مباشرة بلا انتظار محاولة فاشلة إطلاقاً
 * - مفتاح تشغيل قسري من الداشبورد: config/settings.audioForceRelay = true
 *
 * لا يتضمن أي إخفاء لموقع المستخدم أو تحايل — مجرد اختيار مسار نقل مدعوم رسمياً.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

type LkRoom = import('livekit-client').Room;
type ConnectOptions = import('livekit-client').RoomConnectOptions;

const RELAY_PREF_KEY = 'livekit:preferRelay:v1';

/** نجح الترحيل سابقاً على هذه الشبكة — ابدأ به مباشرة */
let preferRelay = false;
/** فرض الترحيل من إعداد الداشبورد (config/settings.audioForceRelay) */
let forceRelayConfig: boolean | null = null;
let bootstrapped = false;

/** تحميل التفضيل المحفوظ + إعداد الداشبورد — مرة واحدة في بداية الجلسة */
async function bootstrapRelayPreference(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;
  try {
    const stored = await AsyncStorage.getItem(RELAY_PREF_KEY);
    if (stored === '1') preferRelay = true;
  } catch { /* ignore */ }
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const { firestore } = await import('@/services/firebase/index');
    const snap = await getDoc(doc(firestore, 'config', 'settings'));
    const v = snap.exists() ? (snap.data() as Record<string, unknown>).audioForceRelay : undefined;
    if (typeof v === 'boolean') forceRelayConfig = v;
  } catch { /* ignore */ }
}

function rememberRelayWorks(): void {
  preferRelay = true;
  void AsyncStorage.setItem(RELAY_PREF_KEY, '1').catch(() => {});
}

export function livekitPrefersRelay(): boolean {
  return preferRelay || forceRelayConfig === true;
}

/** لإعادة المحاولة المباشرة بعد تغيّر الشبكة (اختياري) */
export function resetLivekitRelayPreference(): void {
  preferRelay = false;
  void AsyncStorage.removeItem(RELAY_PREF_KEY).catch(() => {});
}

const RELAY_OPTIONS: ConnectOptions = {
  rtcConfig: { iceTransportPolicy: 'relay' },
};

/** مهلة قصيرة للمحاولة المباشرة — اكتشاف حجب UDP أسرع بكثير من الافتراضي 15 ثانية */
const DIRECT_OPTIONS: ConnectOptions = {
  peerConnectionTimeout: 7_000,
};

export async function connectLiveKitWithRelayFallback(
  room: LkRoom,
  wsUrl: string,
  token: string,
  waitConnected: (room: LkRoom) => Promise<void>,
): Promise<void> {
  await bootstrapRelayPreference();

  if (livekitPrefersRelay()) {
    await room.connect(wsUrl, token, RELAY_OPTIONS);
    await waitConnected(room);
    return;
  }

  try {
    await room.connect(wsUrl, token, DIRECT_OPTIONS);
    await waitConnected(room);
  } catch (directErr) {
    // فشل المسار المباشر (غالباً حجب UDP) — جرّب الترحيل عبر TURN/TLS:443
    try {
      await room.disconnect();
    } catch {
      // ignore
    }
    console.log(
      '[LiveKit] direct connect failed — retrying via TURN relay (443/TLS):',
      (directErr as Error)?.message,
    );
    await room.connect(wsUrl, token, RELAY_OPTIONS);
    await waitConnected(room);
    rememberRelayWorks();
    console.log('[LiveKit] connected via TURN relay — relay preferred from now on');
  }
}
