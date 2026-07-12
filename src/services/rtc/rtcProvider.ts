/**
 * قرار مزوّد الصوت — أثر تاريخي بعد إزالة LiveKit نهائياً (أمر المالك
 * 2026-07-12): Agora هو المسار الوحيد، وفرملة الطوارئ السيرفرية
 * (settings.rtcProvider) لم يعد لها معنى فحُذف منطق القراءة والكاش كلياً.
 *
 * الملف والتوقيعات باقية فقط كي لا تنكسر أي استيرادات قديمة —
 * يُحذف بالكامل في تنظيف لاحق بعد التأكد من خلو المستهلكين.
 */

export type RtcProvider = 'agora';

/** قراءة متزامنة — Agora دائماً (لا كاش ولا شبكة بعد إزالة LiveKit) */
export function peekCachedProvider(): RtcProvider {
  return 'agora';
}

/** حسم المزوّد — Agora دائماً؛ المعامل uid باقٍ لتوافق التوقيع القديم فقط */
export async function resolveRtcProvider(_uid?: string): Promise<RtcProvider> {
  return 'agora';
}
