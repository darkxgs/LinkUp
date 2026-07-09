/**
 * اتصال LiveKit مع بديل ترحيل تلقائي (#17 — مشكلة الاتصال في سوريا)
 *
 * بعض مزودي الإنترنت (خصوصاً بيانات الجوال) يحجبون/يخنقون UDP فتفشل وسائط
 * WebRTC رغم نجاح إشارات WebSocket. LiveKit Cloud يوفّر خوادم TURN عبر
 * TCP/TLS على المنفذ 443 (تبدو كحركة HTTPS عادية وتعبر أغلب الحجب).
 *
 * الأسلوب: محاولة اتصال مباشر أولاً (أفضل جودة/زمن وصول)، وعند الفشل إعادة
 * المحاولة بوضع `iceTransportPolicy: 'relay'` الذي يجبر الوسائط على المرور
 * عبر ترحيل TURN. عند نجاح الترحيل نفضّله لبقية الجلسة (يوفّر محاولة فاشلة).
 *
 * لا يتضمن أي إخفاء لموقع المستخدم أو تحايل — مجرد اختيار مسار نقل مدعوم رسمياً.
 */

type LkRoom = import('livekit-client').Room;
type ConnectOptions = import('livekit-client').RoomConnectOptions;

/** نجح الترحيل سابقاً على هذه الشبكة — ابدأ به مباشرة */
let preferRelay = false;

export function livekitPrefersRelay(): boolean {
  return preferRelay;
}

/** لإعادة المحاولة المباشرة بعد تغيّر الشبكة (اختياري) */
export function resetLivekitRelayPreference(): void {
  preferRelay = false;
}

const RELAY_OPTIONS: ConnectOptions = {
  rtcConfig: { iceTransportPolicy: 'relay' },
};

export async function connectLiveKitWithRelayFallback(
  room: LkRoom,
  wsUrl: string,
  token: string,
  waitConnected: (room: LkRoom) => Promise<void>,
): Promise<void> {
  if (preferRelay) {
    await room.connect(wsUrl, token, RELAY_OPTIONS);
    await waitConnected(room);
    return;
  }

  try {
    await room.connect(wsUrl, token);
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
    preferRelay = true;
    console.log('[LiveKit] connected via TURN relay — will prefer relay this session');
  }
}
