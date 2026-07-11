/**
 * خدمات امتيازات SVIP الوظيفية الموسّعة
 * (أيدي مميز، إخفاء Online، إعلان الترقية، رسائل التطبيق...)
 */
import { doc, getDoc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestore, auth, functions } from './index';
import {
  checkUserHasVipFeature,
  userHasVipFeature,
  getVipSystemCached,
  resolveVipPrivilegeAsset,
  readVipUserState,
  type VipSystemConfig,
} from './vipSystem';
import {
  normalizePublicId,
  lookupUidByPublicIndex,
  syncPublicAccountIndex,
} from '@/services/publicAccountIndex';

// ─────────────────────────────────────────────────────────────
// أيدي مميز (specialId) — معرّف حساب مخصّص لأعضاء SVIP
// ─────────────────────────────────────────────────────────────

export interface SetAccountIdResult {
  ok: boolean;
  accountId?: string;
  error?: string;
}

/**
 * تعيين معرّف حساب عام مخصّص (5–9 أرقام) — يتطلب امتياز «أيدي مميز».
 * يتحقق من التوفّر ويحدّث users.publicAccountId + الفهرس العام.
 */
export async function setCustomAccountId(rawId: string): Promise<SetAccountIdResult> {
  const user = auth.currentUser;
  if (!user) return { ok: false, error: 'يجب تسجيل الدخول' };

  const id = normalizePublicId(rawId);
  if (!/^\d{5,9}$/.test(id)) {
    return { ok: false, error: 'المعرّف يجب أن يكون من 5 إلى 9 أرقام' };
  }

  if (!(await checkUserHasVipFeature(user.uid, 'specialId'))) {
    return { ok: false, error: 'هذا الامتياز حصري لأعضاء SVIP المؤهّلين' };
  }

  const takenBy = await lookupUidByPublicIndex(id);
  if (takenBy && takenBy !== user.uid) {
    return { ok: false, error: 'هذا المعرّف محجوز — جرّب رقماً آخر' };
  }

  await updateDoc(doc(firestore, 'users', user.uid), {
    publicAccountId: id,
    updatedAt: Date.now(),
  });
  await syncPublicAccountIndex(id, user.uid).catch(() => {});

  return { ok: true, accountId: id };
}

// ─────────────────────────────────────────────────────────────
// إخفاء حالة Online — يُحترم عند عرض الاتصال
// ─────────────────────────────────────────────────────────────

/**
 * هل يُخفي هذا المستخدم حالة الاتصال؟ (تفعيل من الخصوصية + امتياز SVIP «إخفاء Online»).
 * تمرّر `vipSystem` من ConfigContext في المكوّنات.
 */
export function isOnlineHidden(
  userData: Record<string, unknown> | null | undefined,
  _vipSystem: Pick<VipSystemConfig, 'privileges'> | null | undefined,
): boolean {
  if (!userData) return false;
  const nested = userData.privacySettings as Record<string, unknown> | undefined;
  // المفعّل للإعداد يُحترم دائماً — الأهلية (SVIP) تُفرض عند التفعيل في شاشة
  // الخصوصية نفسها. فحص الامتياز هنا أيضاً كان يجعل الإعداد «لا يعمل» عند أي
  // اختلاف بين إعدادات VIP الحية والافتراضية رغم أن المستخدم فعّله بنجاح.
  return userData.privacyHideOnline === true || nested?.hideOnline === true;
}

/** فحص دقيق (async) لإخفاء Online — التفعيل وحده كافٍ (الأهلية تُفرض عند التفعيل) */
export async function isOnlineHiddenStrict(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(firestore, 'users', uid));
    if (!snap.exists()) return false;
    const data = snap.data() as Record<string, unknown>;
    const nested = data.privacySettings as Record<string, unknown> | undefined;
    return data.privacyHideOnline === true || nested?.hideOnline === true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// تأثير صوتي مميز (specialSoundEffect) — صوت دخول الغرفة
// ─────────────────────────────────────────────────────────────

/** يُرجع رابط صوت الدخول إن كان المستخدم يملك امتياز «تأثير صوتي مميز» */
export async function resolveEntrySoundUrl(uid: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(firestore, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, unknown>;
    const cfg = await getVipSystemCached();
    if (!userHasVipFeature(data, 'specialSoundEffect', cfg)) return null;
    const { vipLevel } = readVipUserState(data);
    const priv = resolveVipPrivilegeAsset(vipLevel, 'specialSoundEffect', cfg);
    return priv?.soundUrl || null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// خدمة عملاء حصرية (exclusiveSupport) — وسم أولوية الدعم
// ─────────────────────────────────────────────────────────────

/** يعلّم حساب المستخدم كأولوية دعم إن كان يملك امتياز «خدمة عملاء حصرية» */
export async function markSupportPriority(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  if (!(await checkUserHasVipFeature(user.uid, 'exclusiveSupport'))) return false;
  try {
    await updateDoc(doc(firestore, 'users', user.uid), {
      supportPriority: true,
      supportPriorityAt: Date.now(),
    });
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// إعلان الترقية + رسائل التطبيق — عبر دوال سحابية (تتجاوز قواعد broadcasts)
// ─────────────────────────────────────────────────────────────

/**
 * إنشاء إعلان ترقية SVIP — يُستدعى بعد رفع المستوى بنجاح.
 * يكتب إشعاراً للمستخدم نفسه (مسموح بقواعد notifications)؛
 * البثّ العام لكل المستخدمين يتطلب دالة سحابية (svipBroadcast).
 */
/** إرسال رسالة على مستوى التطبيق (امتياز «رسائل على مستوى التطبيق») — عبر دالة سحابية */
export async function sendAppWideMessage(text: string): Promise<{ ok: boolean; error?: string }> {
  const clean = text.trim();
  if (!clean) return { ok: false, error: 'النص مطلوب' };
  // رقابة برمجية — البثّ العام أخطر قناة دعاية: ألفاظ مسيئة + تطبيقات منافسة
  try {
    const { assertCleanText } = await import('@/utils/textModeration');
    assertCleanText(clean);
    const { assertNoBannedTerms } = await import('@/utils/moderation');
    assertNoBannedTerms(clean);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'هذه الرسالة تخالف إرشادات المجتمع' };
  }
  try {
    const fn = httpsCallable<{ text: string }, { ok?: boolean }>(functions, 'svipSendAppMessage');
    await fn({ text: clean.slice(0, 200) });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'تعذّر الإرسال';
    return { ok: false, error: msg };
  }
}

export async function announceVipUpgrade(label: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  if (!(await checkUserHasVipFeature(user.uid, 'upgradeAnnouncement'))) return;
  try {
    await addDoc(collection(firestore, 'notifications'), {
      uid: user.uid,
      type: 'system',
      title: 'تهانينا! 🎉',
      message: `لقد وصلت إلى ${label} — استمتع بكل امتيازاتك الجديدة!`,
      data: { kind: 'vipUpgrade', label },
      isRead: false,
      createdAt: Date.now(),
    });
  } catch {
    /* non-blocking */
  }
}
