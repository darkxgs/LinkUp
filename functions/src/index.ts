/**
 * LinkUp Cloud Functions
 *
 * يحتوي:
 *  - generateLiveKitToken    → توكن LiveKit للمكالمات والغرف الصوتية والمطابقات
 *  - createMatch             → مطابقة مستخدمين (voice/video) وإنشاء غرفة LiveKit
 *  - endCall                 → إنهاء مكالمة وتسجيلها
 *  - processPendingAccountDeletions → حذف حسابات بعد فترة السماح (15 يوم)
 *
 * المفاتيح السرية تُحفظ عبر:
 *   firebase functions:config:set livekit.api_key="..." livekit.api_secret="..." livekit.ws_url="wss://..."
 * أو عبر متغيرات البيئة (.env) في الجيل الثاني من Functions.
 */

import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import type { DocumentReference } from 'firebase-admin/firestore';
import { AccessToken, WebhookReceiver, RoomServiceClient } from 'livekit-server-sdk';
import { getDefaultProfileMedia } from './defaultAvatars';
import { applyFirstRechargeBonus } from './firstRechargeBonus';
import { logCasinoRechargeActivityServer } from './casinoLiveActivityLog';
import {
  deleteFirestoreWhere,
  deletePostCascade,
  purgeAgencyCascade,
  purgeAllAgencies,
  purgeUserCascade,
  USER_AGENCY_UNLINK_PATCH,
} from './cascadeDelete';
import { pickCoinsBalance, pickPearlsBalance } from './shared/userLookup';
import {
  computeLotterySchedule,
  executeWeeklyLotteryDraw,
  getCountdownParts,
} from './weeklyLottery';

admin.initializeApp();
const db = admin.firestore();
const rtdb = admin.database();

// السقف العام رُفع من 10 → 40 ليحتمل موجات الدخول (900 متصل). الدوال الساخنة
// أدناه لها سقوف أعلى خاصة بها. (السقف لا يكلّف شيئاً وقت الخمول.)
// us-central1 CPU quota (CpuAllocPerProjectRegion) allows max 20 vCPU per service.
// حصّة CpuAllocPerProjectRegion في us-central1 = 20000، وإجمالي الـCPU المطلوب يتناسب مع
// مجموع maxInstances عبر كل الدوال. السقف العام 10 هو المُثبَت أنه ينشُر؛ السقف 20 ضاعف
// الإجمالي إلى 40000 ففشل النشر. لرفع سقوف التزامن فعلياً (لـ900 متصل) اطلب رفع الحصّة
// من Google Cloud Console أولاً (Cloud Run → Quotas → us-central1)، ثم ارفع القيم.
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

// ============================================================================
// خيارات الدوال الساخنة (I/O-bound): توليد التوكن + المطابقة + فوترة المكالمات.
// السبب الجذري لاختناق السعة: الافتراضي 256MiB يمنح CPU < 1، وهذا يُجبِر Cloud Run
// على concurrency = 1 (طلب واحد لكل نسخة) → 10 نسخ = 10 طلبات متزامنة فقط لكامل المسار.
// الحل: 512MiB تمنح CPU كاملاً فيُسمح بـ concurrency 80 (النسخة الواحدة تخدم 80 طلباً
// متزامناً لأن العمل انتظار شبكة لا حرق CPU). maxInstances منخفض (2) يُبقي بصمة CPU صغيرة
// (2 vCPU/دالة) بينما ترتفع السعة إلى 160 طلباً متزامناً/دالة بدل الطلب الواحد.
// ⚠️ لا يغيّر أي منطق. maxInstances=1 مقصود: حصّة CpuAllocPerProjectRegion في us-central1
//    مثبّتة على 20,000 (mCPU) وغير قابلة للرفع، والمشروع قريب من السقف. كل دالة هنا تأخذ
//    1 vCPU (شرط concurrency>1)، فـ 7 دوال × 1 نسخة = 7,000 mCPU فقط، وتخدم كلٌّ 80 طلباً
//    متزامناً (بدل طلب واحد سابقاً). لرفع maxInstances لاحقاً تحتاج رفع الحصّة عبر مبيعات Google.
const HOT_CALL_OPTS = {
  memory: '512MiB' as const,
  concurrency: 80,
  maxInstances: 1,
};

/** معرّف حساب عام 8 أرقام — نفس خوارزمية التطبيق */
function generatePublicAccountId(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) {
    h = (Math.imul(31, h) + uid.charCodeAt(i)) >>> 0;
  }
  return String(h % 100_000_000).padStart(8, '0');
}

/** توحيد معرّف 8 أرقام — مطابق للتطبيق */
function normalizePublicAccountId(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.length >= 8 ? digits.slice(-8) : digits.padStart(8, '0');
}

function normalizeStoredPublicAccountId(value: unknown): string {
  if (value == null || String(value).trim() === '') return '';
  return normalizePublicAccountId(String(value));
}

async function syncPublicAccountIndexForUid(publicId: string, uid: string): Promise<void> {
  await db.collection('publicAccountIndex').doc(publicId).set({ uid, updatedAt: Date.now() }, { merge: true });
}

async function queryUidByPublicAccountIdField(publicId: string): Promise<string | null> {
  const candidates = new Set<string>([publicId, publicId.padStart(8, '0')]);
  const stripped = publicId.replace(/^0+/, '');
  if (stripped) {
    candidates.add(stripped);
    candidates.add(stripped.padStart(8, '0'));
  }

  for (const candidate of candidates) {
    const q = await db.collection('users').where('publicAccountId', '==', candidate).limit(1).get();
    if (!q.empty) return q.docs[0].id;
  }

  for (const candidate of candidates) {
    const num = Number(candidate);
    if (!Number.isFinite(num)) continue;
    const qNum = await db.collection('users').where('publicAccountId', '==', num).limit(1).get();
    if (!qNum.empty) return qNum.docs[0].id;
  }
  return null;
}

// ==================== المفاتيح ====================
// المفاتيح مدمجة مباشرة (تعمل على سيرفر Google فقط — ليست في التطبيق)
// ⚠️ لا ترفع هذا الملف على مستودع GitHub عام
const LIVEKIT_WS_PLACEHOLDER = 'wss://your-project.livekit.cloud';

function readLiveKitEnv(name: 'LIVEKIT_API_KEY' | 'LIVEKIT_API_SECRET' | 'LIVEKIT_WS_URL', fallback: string): string {
  const raw = (process.env[name] ?? '').trim();
  if (!raw) return fallback;
  if (name === 'LIVEKIT_WS_URL' && raw === LIVEKIT_WS_PLACEHOLDER) return fallback;
  return raw;
}

const LIVEKIT_API_KEY = readLiveKitEnv('LIVEKIT_API_KEY', 'APITDAg6EYAzKY4');
const LIVEKIT_API_SECRET = readLiveKitEnv('LIVEKIT_API_SECRET', 'odl2kIdHY9cNnSEeRlx7hWCDTm25uazWe9wV0web2QJA');
const LIVEKIT_WS_URL = readLiveKitEnv('LIVEKIT_WS_URL', 'wss://linup-shk03qgl.livekit.cloud');

const TOKEN_EXPIRY_SECONDS = 3600; // ساعة

// ==================== تسعير المكالمات 1-to-1 ====================
const DEFAULT_CALL_PRICING = {
  match: { voicePerMinute: 260, videoFirstMinute: 175, videoAfterMinute: 350 },
  chat: { voicePerMinute: 260, videoFirstMinute: 175, videoAfterMinute: 350 },
  messages: { enabled: true, textMessage: 200, voiceMessage: 200, imageMessage: 200 },
};

type CallPricingRates = {
  voicePerMinute: number;
  videoFirstMinute: number;
  videoAfterMinute: number;
};

type ChatMessagePricing = {
  enabled: boolean;
  textMessage: number;
  voiceMessage: number;
  imageMessage: number;
};

type CallPricingConfig = {
  match: CallPricingRates;
  chat: CallPricingRates;
  messages: ChatMessagePricing;
};

let callPricingCache: { data: CallPricingConfig; at: number } | null = null;
const CALL_PRICING_CACHE_MS = 5_000;

const clampPrice = (n: unknown, fallback: number): number => {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : fallback;
  return Math.max(0, Math.min(500_000, v));
};

async function getCallPricingConfig(): Promise<CallPricingConfig> {
  if (callPricingCache && Date.now() - callPricingCache.at < CALL_PRICING_CACHE_MS) {
    return callPricingCache.data;
  }
  try {
    const snap = await db.collection('config').doc('callPricing').get();
    if (snap.exists) {
      const raw = snap.data() ?? {};
      const match = (raw.match ?? {}) as Record<string, unknown>;
      const chat = (raw.chat ?? {}) as Record<string, unknown>;
      const messages = (raw.messages ?? {}) as Record<string, unknown>;
      const cfg: CallPricingConfig = {
        match: {
          voicePerMinute: clampPrice(match.voicePerMinute, DEFAULT_CALL_PRICING.match.voicePerMinute),
          videoFirstMinute: clampPrice(match.videoFirstMinute, DEFAULT_CALL_PRICING.match.videoFirstMinute),
          videoAfterMinute: clampPrice(match.videoAfterMinute, DEFAULT_CALL_PRICING.match.videoAfterMinute),
        },
        chat: {
          voicePerMinute: clampPrice(chat.voicePerMinute, DEFAULT_CALL_PRICING.chat.voicePerMinute),
          videoFirstMinute: clampPrice(chat.videoFirstMinute, DEFAULT_CALL_PRICING.chat.videoFirstMinute),
          videoAfterMinute: clampPrice(chat.videoAfterMinute, DEFAULT_CALL_PRICING.chat.videoAfterMinute),
        },
        messages: {
          enabled: messages.enabled !== false,
          textMessage: clampPrice(messages.textMessage, DEFAULT_CALL_PRICING.messages.textMessage),
          voiceMessage: clampPrice(messages.voiceMessage, DEFAULT_CALL_PRICING.messages.voiceMessage),
          imageMessage: clampPrice(messages.imageMessage, DEFAULT_CALL_PRICING.messages.imageMessage),
        },
      };
      callPricingCache = { data: cfg, at: Date.now() };
      return cfg;
    }
  } catch {}
  return DEFAULT_CALL_PRICING;
}

/** سعر الدقيقة حسب النوع ورقم الدقيقة (0 = الدقيقة الأولى) */
function computeMinutePrice(
  type: 'voice' | 'video',
  minuteIndex: number,
  source: 'chat' | 'match',
  pricing: CallPricingConfig,
): number {
  const rates = source === 'match' ? pricing.match : pricing.chat;
  if (type === 'video') {
    return minuteIndex <= 0 ? rates.videoFirstMinute : rates.videoAfterMinute;
  }
  return rates.voicePerMinute;
}

/** نسبة حصّة المستلم من السعر (ماسة) — يتحكّم بها الأدمن عبر config/settings.giftCommission */
async function getHostShareRatio(): Promise<number> {
  try {
    const s = await db.collection('config').doc('settings').get();
    if (s.exists) {
      const commission = typeof s.data()?.giftCommission === 'number' ? s.data()!.giftCommission : 90;
      return Math.max(0, Math.min(1, (100 - commission) / 100));
    }
  } catch {}
  return 0.1;
}

/** إعدادات إحالة BD — النسبة ومدة الاستفادة (أشهر) من لوحة الإدارة */
async function getBdReferralConfig(): Promise<{ commissionPercent: number; benefitMonths: number }> {
  try {
    const s = await db.collection('config').doc('settings').get();
    if (s.exists) {
      const d = s.data() ?? {};
      return {
        commissionPercent: Math.min(100, Math.max(0, Number(d.bdReferralCommissionPercent) || 10)),
        benefitMonths: Math.min(60, Math.max(1, Number(d.bdReferralBenefitMonths) || 6)),
      };
    }
  } catch {}
  return { commissionPercent: 10, benefitMonths: 6 };
}

function addCalendarMonths(ts: number, months: number): number {
  const d = new Date(ts);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

/** أحدث دعوة BD معلّقة لمستخدم */
async function findPendingBdInviteForUser(invitedUid: string) {
  const snap = await db
    .collection('bdInvites')
    .where('invitedUid', '==', invitedUid)
    .limit(30)
    .get();
  const pending = snap.docs.filter((d) =>
    ['pending', 'applied'].includes(String(d.data().status ?? '')),
  );
  if (pending.length === 0) return null;
  return pending.sort(
    (a, b) => (Number(b.data().createdAt) || 0) - (Number(a.data().createdAt) || 0),
  )[0];
}

/** عند تفعيل وكالة مُحالة — يبدأ عدّ مدة الاستفادة ويُحدّث دعوة BD */
async function finalizeBdReferralOnActivation(
  agencyId: string,
  agency: FirebaseFirestore.DocumentData,
  app: FirebaseFirestore.DocumentData,
): Promise<void> {
  const referredByUid = String(agency.referredByUid ?? app.referredByUid ?? '');
  if (!referredByUid) return;

  const benefitMonths = Number(agency.bdBenefitMonths) || Number(app.bdBenefitMonths) || 0;
  const now = Date.now();
  const agencyRef = db.collection('agencies').doc(agencyId);

  if (benefitMonths > 0 && !Number(agency.bdBenefitStartsAt)) {
    await agencyRef.update({
      bdBenefitStartsAt: now,
      bdBenefitEndsAt: addCalendarMonths(now, benefitMonths),
      updatedAt: now,
    });
  }

  const inviteId = String(agency.bdInviteId ?? app.bdInviteId ?? '');
  if (inviteId) {
    await db.collection('bdInvites').doc(inviteId).update({
      status: 'accepted',
      agencyId,
      activatedAt: now,
      updatedAt: now,
    }).catch(() => {});
  }

  const commissionPercent = Number(agency.bdCommissionPercent) || Number(app.bdCommissionPercent) || 0;
  await notifyUser(
    referredByUid,
    `تم تفعيل وكالة "${app.agencyName ?? agency.name}" التي دعوتها — تستفيد من ${commissionPercent}% لمدة ${benefitMonths} شهر`,
    { agencyId, type: 'bd_agency_activated' },
  );
}

/** عمولة BD للوكالة المُحيلة عند دخل مضيفة في وكالة مُحالة */
async function creditBdReferralCommission(agencyId: string, pearls: number): Promise<void> {
  if (pearls <= 0) return;
  const agencySnap = await db.collection('agencies').doc(agencyId).get();
  if (!agencySnap.exists) return;
  const agency = agencySnap.data()!;
  const referredByAgencyId = String(agency.referredByAgencyId ?? '');
  const benefitEndsAt = Number(agency.bdBenefitEndsAt) || 0;
  const commissionPercent = Number(agency.bdCommissionPercent) || 0;
  if (!referredByAgencyId || commissionPercent <= 0) return;
  if (benefitEndsAt > 0 && Date.now() > benefitEndsAt) return;

  const commission = Math.floor((pearls * commissionPercent) / 100);
  if (commission <= 0) return;

  await db.collection('agencies').doc(referredByAgencyId).update({
    bdReferralPearlsTotal: admin.firestore.FieldValue.increment(commission),
    updatedAt: Date.now(),
  });
}

/** 15 يوم عمل ≈ 15 يوم تقويم — حذف نهائي للحسابات المعلّقة */
const ACCOUNT_DELETION_GRACE_MS = 15 * 24 * 60 * 60 * 1000;

// ==================== PRIVILEGE HELPER ====================
/** مضيفة أنثى موثّقة — مطابقات/مكالمات/شات مجاني لها */
function isVerifiedFemaleHost(data: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!data) return false;
  return data.agencyRole === 'host' && data.isFemaleHost === true && data.isVerified === true;
}

function readUserGender(data: FirebaseFirestore.DocumentData | undefined): 'male' | 'female' {
  if (!data) return 'male';
  const profile = data.profile as { gender?: string } | undefined;
  const g = profile?.gender ?? data.gender;
  return g === 'female' ? 'female' : 'male';
}

const CHAT_CALL_MIN_BOND_VOICE = 5;
const CHAT_CALL_MIN_BOND_VIDEO = 10;

function getRelationshipId(uid1: string, uid2: string): string {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

function getRequiredBondLevelForChatCall(type: 'voice' | 'video'): number {
  return type === 'video' ? CHAT_CALL_MIN_BOND_VIDEO : CHAT_CALL_MIN_BOND_VOICE;
}

const AGENCY_FULL_VERIFY_MSG =
  'يجب إكمال توثيق الحساب بالكامل قبل الانضمام للوكالة — اذهب إلى المحفظة ← التحقق من الهوية';

/** حساب موثّق بالكامل (KYC معتمد) */
function isUserFullyVerified(data: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!data) return false;
  if (data.isVerified === false) return false;
  return data.isVerified === true || data.verificationStatus === 'approved';
}

function assertUserFullyVerifiedFromData(data: FirebaseFirestore.DocumentData | undefined): void {
  if (!isUserFullyVerified(data)) {
    throw new HttpsError('failed-precondition', AGENCY_FULL_VERIFY_MSG);
  }
}

/** حقول العضوية عند الانضمام — التوثيق اختياري؛ المضيفة الموثّقة فقط تُحتسب في femaleHostCount */
function agencyMemberFieldsOnJoin(
  uid: string,
  userData: FirebaseFirestore.DocumentData,
  agencyId: string,
  agencyName: string,
  now: number,
) {
  const gender = readUserGender(userData);
  const isFemaleVerifiedHost = gender === 'female' && isUserFullyVerified(userData);
  const displayName = userData.profile?.displayName ?? userData.displayName ?? 'مضيف';
  const avatar = userData.profile?.avatar ?? userData.avatar ?? '';
  return {
    member: {
      uid,
      uidName: displayName,
      uidAvatar: avatar,
      agencyId,
      agencyName,
      role: isFemaleVerifiedHost ? 'host' : 'member',
      hostVerified: isFemaleVerifiedHost,
      isFemaleHost: gender === 'female',
      verifiedAt: isFemaleVerifiedHost ? now : null,
      pearlsEarned: 0,
      pearlsTransferredToAgent: 0,
      joinedAt: now,
    },
    userPatch: {
      agencyId,
      agencyName,
      agencyRole: isFemaleVerifiedHost ? 'host' : 'member',
      isFemaleHost: gender === 'female',
      accountKind: isFemaleVerifiedHost ? 'host' : 'member',
    },
    isFemaleVerifiedHost,
  };
}

/** @deprecated — استخدم agencyMemberFieldsOnJoin */
function agencyMemberFieldsOnVerifiedJoin(
  uid: string,
  userData: FirebaseFirestore.DocumentData,
  agencyId: string,
  agencyName: string,
  now: number,
) {
  return agencyMemberFieldsOnJoin(uid, userData, agencyId, agencyName, now);
}

function agencyInviteNeedsHostVerification(userData: FirebaseFirestore.DocumentData): boolean {
  return readUserGender(userData) === 'female' && !isUserFullyVerified(userData);
}

/** أنثى في المطابقة — جانب مجاني (ذكر ↔ أنثى) */
function isMatchFreeSide(data: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!data) return false;
  return readUserGender(data) === 'female';
}

/** @deprecated — استخدم isMatchFreeSide */
function isMatchHostUser(data: FirebaseFirestore.DocumentData | undefined): boolean {
  return isMatchFreeSide(data);
}

function readQueueGender(data: FirebaseFirestore.DocumentData): 'male' | 'female' {
  const g = data.gender ?? (data.profile as { gender?: string } | undefined)?.gender;
  return g === 'female' ? 'female' : 'male';
}

function isOppositeGenderMatch(
  myGender: 'male' | 'female',
  theirGender: 'male' | 'female',
): boolean {
  return myGender !== theirGender;
}

/**
 * يتحقق من امتياز المكالمة المجانية:
 * - المضيفة الأنثى → مجانية دائماً
 * - الوكيل يتصل بمضيفته (أو العكس) في نفس الوكالة → مجانية
 */
async function resolveCallPrivilege(uid: string, peerUid?: string): Promise<boolean> {
  try {
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) return false;
    const me = userSnap.data()!;

    if (isVerifiedFemaleHost(me)) return true;

    const myAgencyId = me.agencyId as string | undefined;
    if (peerUid && myAgencyId) {
      const peerSnap = await db.collection('users').doc(peerUid).get();
      if (peerSnap.exists) {
        const peer = peerSnap.data()!;
        if (peer.agencyId === myAgencyId) {
          const myRole = me.agencyRole as string | null;
          const callerIsAgent = me.isAgent === true || myRole === 'owner';
          const callerIsHost = isVerifiedFemaleHost(me);
          const peerIsAgent = peer.isAgent === true || peer.agencyRole === 'owner';
          const peerIsHost = isVerifiedFemaleHost(peer);
          if ((callerIsAgent && peerIsHost) || (callerIsHost && peerIsAgent)) return true;
        }
      }
    }
  } catch {}
  return false;
}

// ==================== 1) LIVEKIT TOKEN ====================
/**
 * يولّد توكن LiveKit للانضمام لغرفة أو مكالمة
 * يتطلب: roomName
 * اختياري: canPublish (هل يمكنه التحدث؟ المستمع false)
 * يُرجع: { token, wsUrl, identity, roomName }
 */
// ⚡ يُستدعى عند كل دخول روم وكل مكالمة → الأحقّ بسقف أعلى متى سُمح بزيادة الحصّة.
export const generateLiveKitToken = onCall(HOT_CALL_OPTS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { roomName, canPublish = true, peerUid } = request.data as {
    roomName?: string;
    canPublish?: boolean;
    peerUid?: string;
  };
  if (!roomName) throw new HttpsError('invalid-argument', 'roomName مطلوب');

  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_WS_URL) {
    throw new HttpsError('failed-precondition', 'مفاتيح LiveKit غير مُعدّة على السيرفر');
  }

  const [freeCall, userSnap] = await Promise.all([
    resolveCallPrivilege(uid, peerUid),
    db.collection('users').doc(uid).get().catch(() => null),
  ]);

  const displayName = userSnap?.data()?.displayName ?? 'مستخدم';

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: uid,
    name: displayName,
    ttl: TOKEN_EXPIRY_SECONDS,
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();

  return {
    token,
    wsUrl: LIVEKIT_WS_URL,
    identity: uid,
    roomName,
    freeCall,
  };
});

// ==================== 1b) كتم فعلي من الخادم (LiveKit Server API) ====================
// علامة isMuted على المقعد وحدها لا توقف البث — هذا يكتم مسارات الصوت المنشورة
// على مستوى خادم LiveKit نفسه، فلا يُسمع المكتوم حتى لو تجاهل جهازه العلامة.
const LIVEKIT_HTTP_URL = LIVEKIT_WS_URL.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
let roomServiceClient: RoomServiceClient | null = null;
function getRoomServiceClient(): RoomServiceClient {
  if (!roomServiceClient) {
    roomServiceClient = new RoomServiceClient(LIVEKIT_HTTP_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
  }
  return roomServiceClient;
}

/**
 * كتم/فك كتم مشارك في غرفة صوتية — تحقق صلاحيات + رُتب على الخادم:
 *  - كتم النفس مسموح دائماً.
 *  - الوكيل (hostUid) يكتم الجميع عدا نفسه بهذه الدالة.
 *  - المشرف (coHosts) يكتم الأعضاء فقط إن ملك moderatorsCanManageMic —
 *    لا يكتم الوكيل ولا مشرفاً آخر (نفس الرتبة/أعلى).
 * يكتب isMuted + mutedBy على المقعد ثم يكتم مسارات LiveKit المنشورة فعلياً.
 */
export const setRoomParticipantMuted = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { roomId, targetUid, muted } = request.data as {
    roomId?: string;
    targetUid?: string;
    muted?: boolean;
  };
  if (!roomId || !targetUid || typeof muted !== 'boolean') {
    throw new HttpsError('invalid-argument', 'roomId و targetUid و muted مطلوبة');
  }

  const roomSnap = await rtdb.ref(`rooms/${roomId}`).once('value');
  if (!roomSnap.exists()) throw new HttpsError('not-found', 'الغرفة غير موجودة');
  const room = roomSnap.val() as Record<string, unknown>;

  const hostUid = String(room.hostUid ?? '');
  const rawCoHosts = room.coHosts;
  const coHosts: string[] = Array.isArray(rawCoHosts)
    ? rawCoHosts.map(String)
    : rawCoHosts && typeof rawCoHosts === 'object'
      ? Object.values(rawCoHosts as Record<string, unknown>).map(String)
      : [];
  const isSelf = uid === targetUid;

  if (!isSelf) {
    const isHost = uid === hostUid;
    const isSupervisor = coHosts.includes(uid);
    const perms = (room.permissions ?? {}) as Record<string, unknown>;
    const supervisorCanManageMic = perms.moderatorsCanManageMic !== false;
    if (!isHost && !(isSupervisor && supervisorCanManageMic)) {
      throw new HttpsError('permission-denied', 'ليس لديك صلاحية إدارة المايكات');
    }
    if (targetUid === hostUid) {
      throw new HttpsError('permission-denied', 'لا يمكن كتم الوكيل');
    }
    if (!isHost && coHosts.includes(targetUid)) {
      throw new HttpsError('permission-denied', 'لا يمكن كتم مشرف بنفس رتبتك — فقط الوكيل');
    }
  } else if (muted === false) {
    // فك كتم النفس ممنوع إن كان الكتم من مشرف/وكيل — يفكّه من كتمه أو أعلى
    const seatsForSelf = (room.seats ?? {}) as Record<string, { uid?: string; mutedBy?: string }>;
    for (const seat of Object.values(seatsForSelf)) {
      if (seat?.uid === uid && seat.mutedBy && seat.mutedBy !== uid) {
        throw new HttpsError('permission-denied', 'كتمك أحد المشرفين — لا يمكنك فتح المايك بنفسك');
      }
    }
  }

  // علامة المقعد + من كتم (لمنع فك الكتم الذاتي)
  const seats = (room.seats ?? {}) as Record<string, { uid?: string }>;
  let seatKey: string | null = null;
  for (const [key, seat] of Object.entries(seats)) {
    if (seat?.uid === targetUid) {
      seatKey = key;
      break;
    }
  }
  if (seatKey) {
    await rtdb.ref(`rooms/${roomId}/seats/${seatKey}`).update({
      isMuted: muted,
      mutedBy: muted && !isSelf ? uid : null,
      ...(muted ? { isSpeaking: false } : {}),
    });
  }

  // الكتم الفعلي على LiveKit — الغرف الصوتية تنشر مسارات مايك فقط
  let livekitMuted = false;
  try {
    const svc = getRoomServiceClient();
    const participant = await svc.getParticipant(`room_${roomId}`, targetUid);
    for (const track of participant.tracks ?? []) {
      if (!track.sid) continue;
      await svc.mutePublishedTrack(`room_${roomId}`, targetUid, track.sid, muted);
      livekitMuted = true;
    }
  } catch (e) {
    // المشارك غير متصل بـ LiveKit حالياً — علامة المقعد كافية وسيُطبَّق الكتم عند اتصاله
    console.log('setRoomParticipantMuted: livekit skip', roomId, targetUid, (e as Error)?.message);
  }

  return { ok: true, seatUpdated: Boolean(seatKey), livekitMuted };
});

// ==================== GOOGLE SIGN-IN ====================

const GOOGLE_WEB_CLIENT_ID = (process.env.GOOGLE_WEB_CLIENT_ID ?? '').trim();
const GOOGLE_ANDROID_CLIENT_ID = (process.env.GOOGLE_ANDROID_CLIENT_ID ?? GOOGLE_WEB_CLIENT_ID).trim();
const GOOGLE_IOS_CLIENT_ID = (process.env.GOOGLE_IOS_CLIENT_ID ?? GOOGLE_WEB_CLIENT_ID).trim();

/** إعدادات Google OAuth العامة — للتطبيق (بدون Auth) */
export const getGoogleAuthConfig = onCall(async () => {
  const enabled = Boolean(GOOGLE_WEB_CLIENT_ID);
  if (!enabled) {
    return {
      enabled: false,
      webClientId: '',
      androidClientId: '',
      iosClientId: '',
    };
  }
  return {
    enabled: true,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID,
  };
});

type GoogleTokenInfo = {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  error?: string;
  error_description?: string;
};

async function verifyGoogleIdToken(idToken: string): Promise<GoogleTokenInfo> {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  const info = (await res.json()) as GoogleTokenInfo;
  if (!res.ok || info.error) {
    throw new HttpsError('invalid-argument', info.error_description ?? info.error ?? 'google-token-invalid');
  }
  const allowedAudiences = new Set(
    [GOOGLE_WEB_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID, GOOGLE_IOS_CLIENT_ID].filter(Boolean),
  );
  if (allowedAudiences.size > 0 && info.aud && !allowedAudiences.has(info.aud)) {
    throw new HttpsError('permission-denied', 'google-audience-mismatch');
  }
  if (info.email_verified === false || info.email_verified === 'false') {
    throw new HttpsError('failed-precondition', 'google-email-not-verified');
  }
  if (!info.sub) {
    throw new HttpsError('invalid-argument', 'google-token-invalid');
  }
  return info;
}

async function ensureGoogleUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string;
  googleSub: string;
}): Promise<{ isNewUser: boolean }> {
  const { uid, email, displayName, photoUrl, googleSub } = params;
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  const now = Date.now();
  const defaults = getDefaultProfileMedia('female');

  if (!snap.exists) {
    await ref.set({
      uid,
      email,
      displayName,
      avatar: photoUrl || defaults.avatar,
      provider: 'google.com',
      googleSub,
      publicAccountId: generatePublicAccountId(uid),
      createdAt: now,
      lastSeen: now,
      isVerified: false,
      isVIP: false,
      isBanned: false,
      stats: {
        coins: 0,
        pearls: 0,
        casinoCoins: 0,
        level: 1,
        xp: 0,
        followers: 0,
        following: 0,
        visitors: 0,
      },
    });
    await syncPublicAccountIndexForUid(generatePublicAccountId(uid), uid);
    return { isNewUser: true };
  }

  const data = snap.data()!;
  if (data.isBanned === true) {
    throw new HttpsError('permission-denied', 'user-disabled');
  }

  await ref.set(
    {
      email: email || data.email,
      displayName: displayName || data.displayName,
      avatar: photoUrl || data.avatar || defaults.avatar,
      googleSub,
      provider: 'google.com',
      lastSeen: now,
      updatedAt: now,
    },
    { merge: true },
  );
  return { isNewUser: false };
}

/**
 * يتحقق من توكن Google ويُنشئ/يحدّث المستخدم في Firebase Auth + Firestore.
 * التطبيق يُكمل الجلسة محلياً عبر signInWithCredential(GoogleAuthProvider.credential(idToken)).
 */
export const verifyGoogleSignIn = onCall(async (request) => {
  const { idToken } = request.data as { idToken?: string };
  if (!idToken || idToken.length < 20) {
    throw new HttpsError('invalid-argument', 'google-id-token-required');
  }
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new HttpsError('failed-precondition', 'google-auth-not-configured');
  }

  const info = await verifyGoogleIdToken(idToken);
  const email = String(info.email ?? '').trim().toLowerCase();
  if (!email) {
    throw new HttpsError('failed-precondition', 'google-email-missing');
  }

  let uid: string;
  let isNewUser = false;
  try {
    const existing = await admin.auth().getUserByEmail(email);
    uid = existing.uid;
    if (existing.disabled) {
      throw new HttpsError('permission-denied', 'user-disabled');
    }
  } catch (e: unknown) {
    if (e instanceof HttpsError) throw e;
    const code = (e as { code?: string })?.code;
    if (code !== 'auth/user-not-found') {
      throw new HttpsError('internal', 'google-auth-lookup-failed');
    }
    const created = await admin.auth().createUser({
      email,
      emailVerified: true,
      displayName: info.name ?? undefined,
      photoURL: info.picture ?? undefined,
    });
    uid = created.uid;
    isNewUser = true;
  }

  const profile = await ensureGoogleUserProfile({
    uid,
    email,
    displayName: info.name ?? email.split('@')[0] ?? 'مستخدم',
    photoUrl: info.picture ?? '',
    googleSub: info.sub!,
  });
  isNewUser = isNewUser || profile.isNewUser;

  return {
    uid,
    email,
    displayName: info.name ?? '',
    photoUrl: info.picture ?? '',
    isNewUser,
  };
});

// ==================== 3) CREATE MATCH (مطابقة) ====================
/**
 * مطابقة المستخدم مع شخص آخر في الانتظار (voice/video)
 * منطق بسيط: ابحث عن مستخدم منتظر بنفس النوع، اربطهما بغرفة LiveKit واحدة.
 * إن لم يوجد، أضف المستخدم لقائمة الانتظار.
 */
export const createMatch = onCall(HOT_CALL_OPTS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { type = 'voice', ageRanges } = request.data as {
    type?: 'voice' | 'video';
    ageRanges?: string[];
  };

  // قراءة بيانات المستخدم مرة واحدة لتحديد الدور والامتيازات
  let freeMatch = false;
  let hostSide = false;
  let myGender: string | undefined;
  let myDisplayName: string | null = null;
  let myAvatar: string | null = null;
  let myUserData: FirebaseFirestore.DocumentData | null = null;
  try {
    const meSnap = await db.collection('users').doc(uid).get();
    if (meSnap.exists) {
      const me = meSnap.data()!;
      myUserData = me;
      freeMatch = isMatchFreeSide(me);
      hostSide = isMatchFreeSide(me);
      myGender = readUserGender(me);
      myDisplayName = (me.displayName ?? (me.profile as { displayName?: string } | undefined)?.displayName) ?? null;
      myAvatar = (me.avatar ?? (me.profile as { avatar?: string } | undefined)?.avatar) ?? null;
    }
  } catch {}

  // الطرف الدافع يحتاج رصيداً كافياً قبل الدخول للانتظار
  if (!hostSide && myUserData) {
    const pricing = await getCallPricingConfig();
    const minCoins =
      type === 'video'
        ? pricing.match.videoFirstMinute
        : pricing.match.voicePerMinute;
    const balance = pickCoinsBalance(myUserData);
    if (Number(balance) < minCoins) {
      throw new HttpsError(
        'failed-precondition',
        `رصيد غير كافٍ — تحتاج ${minCoins} عملة على الأقل للمطابقة`,
      );
    }
  }

  const queueRef = db.collection('matchQueue');

  const isRealUid = (id: unknown) =>
    typeof id === 'string' &&
    id.length > 4 &&
    !id.startsWith('fake_') &&
    !id.startsWith('demo_');

  const myAgeRanges = Array.isArray(ageRanges)
    ? ageRanges.filter((r) => typeof r === 'string')
    : [];

  const ageOverlap = (a: string[] | undefined, b: string[] | undefined) => {
    if (!myAgeRanges.length) return true;
    const theirs = Array.isArray(b) ? b : [];
    if (!theirs.length) return true;
    return myAgeRanges.some((r) => theirs.includes(r));
  };

  // مطابقة ذكر ↔ أنثى فقط
  const matchesGender = (theirGender: unknown) => {
    const theirs = theirGender === 'female' ? 'female' : 'male';
    const mine = myGender === 'female' ? 'female' : 'male';
    return isOppositeGenderMatch(mine, theirs);
  };

  // ابحث عن مرشحين منتظرين بنفس النوع (مستخدمون حقيقيون فقط)
  const waiting = await queueRef
    .where('type', '==', type)
    .where('status', '==', 'waiting')
    .limit(30)
    .get();

  const candidates = waiting.docs
    .filter((d) => {
      const data = d.data();
      return (
        isRealUid(data.uid) &&
        data.uid !== uid &&
        ageOverlap(data.ageRanges, myAgeRanges) &&
        matchesGender(data.gender)
      );
    })
    .sort((a, b) => (a.data().createdAt ?? 0) - (b.data().createdAt ?? 0));

  // نحاول حجز أول مرشح متاح عبر transaction ذرّي
  // هذا يمنع أن يحجز شخصان نفس الشريك (race condition مع 1000 مستخدم)
  for (const candidate of candidates) {
    const channelName = `match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      const reserved = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(candidate.ref);
        // لو حُجز بالفعل من شخص آخر بين القراءة والآن → تخطّاه
        if (!fresh.exists || fresh.data()?.status !== 'waiting') {
          return false;
        }
        tx.update(candidate.ref, {
          status: 'matched',
          channelName,
          matchedWith: uid,
          matchedAt: Date.now(),
        });
        return true;
      });

      if (reserved) {
        const partnerUid = candidate.data().uid as string;
        const partnerGender = readQueueGender(candidate.data());
        const mySideGender = myGender === 'female' ? 'female' : 'male';
        if (!isRealUid(partnerUid) || partnerUid === uid) {
          await candidate.ref.delete().catch(() => {});
          continue;
        }
        if (!isOppositeGenderMatch(mySideGender, partnerGender)) {
          await candidate.ref.update({ status: 'waiting', channelName: null, matchedWith: null }).catch(() => {});
          continue;
        }
        // احذف انتظار قديم للمطابق فقط (لا نلمس وثيقة الشريك المحدَّثة إلى matched)
        const myWaiting = await queueRef
          .where('uid', '==', uid)
          .where('status', '==', 'waiting')
          .get();
        if (!myWaiting.empty) {
          const batch = db.batch();
          myWaiting.docs.forEach((d) => {
            if (d.data().type === type) batch.delete(d.ref);
          });
          await batch.commit();
        }

        await db.collection('matches').add({
          type,
          channelName,
          participants: [uid, partnerUid],
          status: 'active',
          createdAt: Date.now(),
        });

        // وثيقة للمطابق الجديد — يصل لها poll إن فتح من جهاز آخر
        await queueRef.add({
          uid,
          type,
          status: 'matched',
          channelName,
          matchedWith: partnerUid,
          matchedAt: Date.now(),
          createdAt: Date.now(),
        });

        return {
          matched: true,
          channelName,
          partnerUid,
          freeMatch,
        };
      }
    } catch {
      // فشل الحجز (تعارض) → جرّب المرشح التالي
    }
  }

  // لا يوجد شريك متاح → أضِف للانتظار (بعد حذف انتظار سابق لنفس النوع)
  const stale = await queueRef.where('uid', '==', uid).where('status', '==', 'waiting').get();
  if (!stale.empty) {
    const batch = db.batch();
    stale.docs.forEach((d) => {
      if (d.data().type === type) batch.delete(d.ref);
    });
    await batch.commit();
  }

  await queueRef.add({
    uid,
    type,
    status: 'waiting',
    ageRanges: myAgeRanges,
    gender: myGender ?? null,
    isFemaleHost: hostSide,
    displayName: myDisplayName,
    avatar: myAvatar,
    createdAt: Date.now(),
  });

  return { matched: false, waiting: true, freeMatch };
});

/** عدد المنتظرين الحقيقيين في قائمة المطابقة (للعرض في التطبيق) */
// كاش قصير (3ث) لعدّ طابور المطابقة. المشكلة: كثير من العملاء يستطلعون العدد كل ثوانٍ،
// وكل نداء كان يقرأ حتى 200 وثيقة → آلاف القراءات/ث تحت الحِمل. نخزّن قائمة الـuids
// الصالحة (بلا fake/demo) لكل نوع، ونحسب العدد لكل طلب باستثناء صاحب الطلب — فيبقى الناتج
// مطابقاً للسلوك السابق تماماً، فقط أحدث بثوانٍ. الكاش لكل نسخة (آمن مع التزامن: قراءة فقط).
const matchQueueCountCache: Record<string, { uids: string[]; at: number }> = {};
const MATCH_QUEUE_COUNT_CACHE_MS = 3000;

export const getMatchQueueCount = onCall(HOT_CALL_OPTS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { type = 'voice' } = request.data as { type?: 'voice' | 'video' };

  const now = Date.now();
  let cached = matchQueueCountCache[type];
  if (!cached || now - cached.at >= MATCH_QUEUE_COUNT_CACHE_MS) {
    const snap = await db
      .collection('matchQueue')
      .where('type', '==', type)
      .where('status', '==', 'waiting')
      .limit(200)
      .get();
    const uids = snap.docs
      .map((d) => d.data().uid)
      .filter(
        (id): id is string =>
          typeof id === 'string' &&
          !id.startsWith('fake_') &&
          !id.startsWith('demo_'),
      );
    cached = { uids, at: now };
    matchQueueCountCache[type] = cached;
  }

  const count = cached.uids.filter((id) => id !== uid).length;
  return { count, type };
});

// ==================== 4) CANCEL MATCH ====================
export const cancelMatch = onCall(HOT_CALL_OPTS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { type } = (request.data ?? {}) as { type?: 'voice' | 'video' };

  const snap = await db.collection('matchQueue').where('uid', '==', uid).get();
  const batch = db.batch();
  snap.forEach((d) => {
    if (!type || d.data().type === type) {
      batch.delete(d.ref);
    }
  });
  await batch.commit();

  return { cancelled: true };
});

// ==================== 5) END CALL ====================
export const endCall = onCall(HOT_CALL_OPTS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { channelName, durationSeconds = 0, sessionId } = request.data as {
    channelName?: string;
    durationSeconds?: number;
    sessionId?: string;
  };
  if (!channelName) throw new HttpsError('invalid-argument', 'channelName مطلوب');

  // حدّث سجل المطابقة
  const matches = await db
    .collection('matches')
    .where('channelName', '==', channelName)
    .limit(1)
    .get();

  if (!matches.empty) {
    await matches.docs[0].ref.update({
      status: 'ended',
      durationSeconds,
      endedAt: Date.now(),
    });
  }

  // أنهِ جلسة المكالمة المفوترة إن وُجدت
  if (sessionId) {
    await db
      .collection('callSessions')
      .doc(sessionId)
      .set(
        { status: 'ended', endedAt: Date.now(), durationSeconds },
        { merge: true },
      )
      .catch(() => {});
  }

  return { ended: true };
});

// ==================== فتح رسالة مقفلة (صورة/صوت) ====================
const MIN_LOCKED_MESSAGE_PRICE = 10;
const MAX_LOCKED_MESSAGE_PRICE = 500_000;
const DEFAULT_LOCKED_MESSAGE_PRICE = 200;

function resolveLockedMessagePrice(raw: unknown): number {
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) {
    return Math.min(MAX_LOCKED_MESSAGE_PRICE, Math.max(MIN_LOCKED_MESSAGE_PRICE, Math.floor(n)));
  }
  return DEFAULT_LOCKED_MESSAGE_PRICE;
}

/**
 * المستلم يدفع كوينز لفتح صورة/صوت مقفل — يُخصم منه ويُضاف كامل المبلغ للمرسل
 */
export const unlockChatMessage = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { messageId } = request.data as { messageId?: string };
  if (!messageId?.trim()) {
    throw new HttpsError('invalid-argument', 'messageId مطلوب');
  }

  const msgRef = db.collection('messages').doc(messageId.trim());

  let txResult: {
    alreadyUnlocked: boolean;
    price: number;
    toSender: number;
    commission: number;
    fromUid: string;
    mediaUrl?: string;
  } = {
    alreadyUnlocked: false,
    price: 0,
    toSender: 0,
    commission: 0,
    fromUid: '',
  };

  await db.runTransaction(async (tx) => {
    const msgSnap = await tx.get(msgRef);
    if (!msgSnap.exists) throw new HttpsError('not-found', 'الرسالة غير موجودة');
    const msg = msgSnap.data()!;

    if (!msg.isLocked) {
      throw new HttpsError('failed-precondition', 'الرسالة غير مقفلة');
    }
    if (String(msg.toUid) !== uid) {
      throw new HttpsError('permission-denied', 'هذه الرسالة ليست لك');
    }

    const unlockedBy: string[] = Array.isArray(msg.unlockedBy) ? msg.unlockedBy : [];
    const mediaUrl = String(msg.imageUrl ?? msg.voiceUrl ?? msg.videoUrl ?? '');
    if (unlockedBy.includes(uid)) {
      txResult = {
        alreadyUnlocked: true,
        price: 0,
        toSender: 0,
        commission: 0,
        fromUid: String(msg.fromUid ?? ''),
        mediaUrl: mediaUrl || undefined,
      };
      return;
    }

    const price = resolveLockedMessagePrice(msg.unlockPrice);
    const commission = 0;
    const toSender = price;
    const fromUid = String(msg.fromUid ?? '');
    if (!fromUid) throw new HttpsError('failed-precondition', 'مرسل الرسالة غير معروف');

    const openerRef = db.collection('users').doc(uid);
    const senderRef = db.collection('users').doc(fromUid);
    const [openerSnap, senderSnap] = await Promise.all([tx.get(openerRef), tx.get(senderRef)]);
    if (!openerSnap.exists) throw new HttpsError('not-found', 'حسابك غير موجود');
    if (!senderSnap.exists) throw new HttpsError('not-found', 'حساب المرسل غير موجود');

    const balance = pickCoinsBalance(openerSnap.data()!);
    if (balance < price) {
      throw new HttpsError(
        'failed-precondition',
        `رصيدك غير كافٍ. تحتاج ${price.toLocaleString('en-US')} كوين`,
      );
    }

    tx.update(openerRef, {
      'stats.coins': admin.firestore.FieldValue.increment(-price),
      coins: admin.firestore.FieldValue.increment(-price),
    });
    tx.update(senderRef, {
      'stats.coins': admin.firestore.FieldValue.increment(toSender),
      coins: admin.firestore.FieldValue.increment(toSender),
    });
    tx.update(msgRef, {
      unlockedBy: admin.firestore.FieldValue.arrayUnion(uid),
    });

    txResult = {
      alreadyUnlocked: false,
      price,
      toSender,
      commission,
      fromUid,
      mediaUrl: mediaUrl || undefined,
    };
  });

  if (txResult.alreadyUnlocked) {
    return {
      ok: true,
      alreadyUnlocked: true,
      mediaUrl: txResult.mediaUrl,
    };
  }

  const now = Date.now();
  const { price, toSender, fromUid } = txResult;

  await Promise.all([
    db.collection('transactions').add({
      uid,
      type: 'unlock_message',
      amount: -price,
      currency: 'coins',
      messageId: messageId.trim(),
      toUid: fromUid,
      status: 'completed',
      createdAt: now,
    }),
    db.collection('transactions').add({
      uid: fromUid,
      type: 'locked_media_earn',
      amount: toSender,
      currency: 'coins',
      messageId: messageId.trim(),
      fromUid: uid,
      status: 'completed',
      createdAt: now,
    }),
    db.collection('notifications').add({
      uid: fromUid,
      type: 'system',
      message: `حصلت على ${toSender.toLocaleString('en-US')} كوين من فتح رسالتك المقفلة`,
      data: {
        title: 'أرباح رسالة مقفلة',
        body: `+${toSender.toLocaleString('en-US')} كوين`,
        type: 'locked_media_earn',
        messageId: messageId.trim(),
      },
      fromUid: uid,
      isRead: false,
      createdAt: now,
    }).catch(() => {}),
  ]);

  return {
    ok: true,
    price,
    senderEarned: toSender,
    mediaUrl: txResult.mediaUrl,
  };
});

const STORE_FRAME_MS_PER_DAY = 86_400_000;

function getFrameInventoryFromUserDoc(data: FirebaseFirestore.DocumentData): Record<string, number> {
  const raw = data.frameInventory;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, number>) };
  }
  const owned = Array.isArray(data.ownedFrames) ? data.ownedFrames : [];
  const migrated: Record<string, number> = {};
  for (const id of owned) migrated[String(id)] = 0;
  return migrated;
}

function pruneFrameInventoryServer(inv: Record<string, number>, now = Date.now()): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [id, expiresAt] of Object.entries(inv)) {
    if (expiresAt === 0 || expiresAt > now) next[id] = expiresAt;
  }
  return next;
}

type StoreSendItemPayload = {
  id?: string;
  name?: string;
  type?: string;
  price?: number;
  currency?: 'coins' | 'pearls';
  validityDays?: number;
  durationDays?: number;
  iconName?: string;
  iconColor?: string;
  isRoomFrame?: boolean;
};

/**
 * شراء عنصر متجر (إطار/فقاعة/دخولية…) وإرساله لمستخدم آخر — عبر السيرفر
 * لتجاوز قيود Firestore التي تمنع الكتابة على ownedFrames/frameInventory للغير.
 */
export const purchaseAndSendStoreItem = onCall(async (request) => {
  const buyerUid = request.auth?.uid;
  if (!buyerUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { toUid, toName, item } = request.data as {
    toUid?: string;
    toName?: string;
    item?: StoreSendItemPayload;
  };

  if (!toUid?.trim()) throw new HttpsError('invalid-argument', 'المستلم مطلوب');
  if (buyerUid === toUid.trim()) {
    throw new HttpsError('failed-precondition', 'لا يمكنك الإرسال لنفسك');
  }

  const itemId = String(item?.id ?? '').trim();
  const itemName = String(item?.name ?? 'عنصر').trim() || 'عنصر';
  const itemType = String(item?.type ?? 'frame').trim() || 'frame';
  const price = Math.floor(Number(item?.price) || 0);
  const currency = item?.currency === 'pearls' ? 'pearls' : 'coins';
  const isRoomFrame = item?.isRoomFrame === true || itemType === 'frame';

  if (!itemId) throw new HttpsError('invalid-argument', 'معرّف العنصر مطلوب');
  if (price <= 0) throw new HttpsError('invalid-argument', 'سعر غير صالح');

  const recipientUid = toUid.trim();
  const now = Date.now();
  let balanceAfter = 0;
  let buyerName = 'مستخدم';
  let buyerAvatar = '';

  await db.runTransaction(async (tx) => {
    const buyerRef = db.collection('users').doc(buyerUid);
    const recipientRef = db.collection('users').doc(recipientUid);
    const [buyerSnap, recipientSnap] = await Promise.all([
      tx.get(buyerRef),
      tx.get(recipientRef),
    ]);

    if (!buyerSnap.exists) throw new HttpsError('not-found', 'حسابك غير موجود');
    if (!recipientSnap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');

    const buyerData = buyerSnap.data()!;
    buyerName = String(
      buyerData.displayName ?? buyerData.profile?.displayName ?? buyerData.name ?? 'مستخدم',
    );
    buyerAvatar = String(buyerData.avatar ?? buyerData.photoURL ?? '');

    const balance =
      currency === 'pearls'
        ? pickPearlsBalance(buyerData)
        : pickCoinsBalance(buyerData);

    if (balance < price) {
      throw new HttpsError(
        'failed-precondition',
        `رصيد غير كافٍ. تحتاج ${price.toLocaleString('en-US')} ${currency === 'coins' ? 'عملة' : 'ماسة'}`,
      );
    }

    if (currency === 'pearls') {
      tx.update(buyerRef, {
        'stats.pearls': admin.firestore.FieldValue.increment(-price),
        pearls: admin.firestore.FieldValue.increment(-price),
      });
    } else {
      tx.update(buyerRef, {
        'stats.coins': admin.firestore.FieldValue.increment(-price),
        coins: admin.firestore.FieldValue.increment(-price),
      });
    }
    balanceAfter = balance - price;

    if (isRoomFrame) {
      const recipientData = recipientSnap.data()!;
      const inv = pruneFrameInventoryServer(getFrameInventoryFromUserDoc(recipientData), now);
      const durationDays = Math.max(0, Number(item?.durationDays ?? item?.validityDays ?? 0) || 0);
      const expiresAt = durationDays > 0 ? now + durationDays * STORE_FRAME_MS_PER_DAY : 0;
      tx.update(recipientRef, {
        ownedFrames: admin.firestore.FieldValue.arrayUnion(itemId),
        frameInventory: { ...inv, [itemId]: expiresAt },
      });
    }
  });

  if (!isRoomFrame) {
    const validityDays = Math.max(0, Number(item?.validityDays ?? 0) || 0);
    await db.collection('inventory').add({
      uid: recipientUid,
      itemId,
      itemType,
      itemName,
      iconName: String(item?.iconName ?? 'Gift'),
      iconColor: String(item?.iconColor ?? '#E11414'),
      quantity: 1,
      isEquipped: false,
      acquiredAt: now,
      expiresAt: validityDays > 0 ? now + validityDays * STORE_FRAME_MS_PER_DAY : null,
      fromUid: buyerUid,
      fromName: buyerName,
    });

    if (itemType === 'frame') {
      await db.collection('users').doc(recipientUid).update({
        ownedFrames: admin.firestore.FieldValue.arrayUnion(itemId),
      });
    }
  }

  await db.collection('transactions').add({
    uid: buyerUid,
    type: 'store_gift',
    amount: -price,
    currency,
    itemId,
    itemName,
    toUid: recipientUid,
    toName: String(toName ?? 'مستخدم'),
    status: 'completed',
    createdAt: now,
  });

  const recipientLabel = String(toName ?? 'مستخدم').trim() || 'مستخدم';
  const notifBody = `${buyerName} أرسل لك «${itemName}»`;
  await db.collection('notifications').add({
    uid: recipientUid,
    type: 'gift',
    fromUid: buyerUid,
    fromName: buyerName,
    fromAvatar: buyerAvatar || undefined,
    message: notifBody,
    data: {
      title: 'هدية من المتجر',
      body: notifBody,
      type: 'gift',
      fromUid: buyerUid,
      fromName: buyerName,
      itemId,
      itemName,
      itemType,
      route: isRoomFrame || itemType === 'frame' ? '/store' : '/store/inventory',
    },
    isRead: false,
    createdAt: now,
  }).catch(() => {});

  return {
    ok: true,
    balance: balanceAfter,
    currency,
    toUid: recipientUid,
    toName: recipientLabel,
    itemId,
    itemName,
  };
});

// ==================== LIVEKIT WEBHOOK (تتبّع دقائق الغرف) ====================
/**
 * يستقبل أحداث LiveKit Cloud لقياس دقائق استهلاك المزوّد فعلياً.
 * عند خروج مشارك (participant_left) نسجّل مدّة جلسته في providerSessions.
 * إعداد الرابط: LiveKit Cloud → Project Settings → Webhooks →
 *   https://us-central1-linkup-dc45f.cloudfunctions.net/livekitWebhook
 */
const livekitReceiver = new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

export const livekitWebhook = onRequest(async (req, res) => {
  try {
    const body =
      typeof (req as any).rawBody !== 'undefined'
        ? (req as any).rawBody.toString()
        : JSON.stringify(req.body);
    const event = await livekitReceiver.receive(body, req.headers.authorization);

    if (event.event === 'participant_left' && event.participant) {
      const p = event.participant;
      const joinedAtSec = Number(p.joinedAt) || 0;
      const leftAtSec = Number(event.createdAt) || Math.floor(Date.now() / 1000);
      const durationSec = joinedAtSec > 0 ? Math.max(0, leftAtSec - joinedAtSec) : 0;

      if (durationSec > 0) {
        await db.collection('providerSessions').add({
          provider: 'livekit',
          kind: 'room',
          room: event.room?.name ?? '',
          roomSid: event.room?.sid ?? '',
          identity: p.identity ?? '',
          joinedAt: joinedAtSec * 1000,
          leftAt: leftAtSec * 1000,
          durationSec,
          minutes: durationSec / 60,
          createdAt: Date.now(),
        });
      }
    }

    res.status(200).send('ok');
  } catch (e) {
    console.error('livekitWebhook:', e);
    // نرجّع 200 لتفادي إعادة الإرسال المتكرّر من LiveKit عند خطأ غير قابل للإصلاح
    res.status(200).send('error-logged');
  }
});

// ==================== START CALL (جلسة مكالمة مفوترة) ====================
/**
 * يبدأ المتصل (الدافع) جلسة مكالمة 1-to-1.
 * يحدّد إن كانت المكالمة مفوترة (المتلقّي مضيفة أنثى والمتصل غير مُعفى)
 * ويتحقق من قدرة المتصل على دفع الدقيقة الأولى قبل البدء.
 *
 * المفوترة فقط عندما: المتلقّي مضيفة أنثى موثّقة AND المتصل ليس مُعفى (مضيفة/وكيل نفس الوكالة).
 */
export const startCall = onCall(HOT_CALL_OPTS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { calleeUid, type = 'voice', channelName, source = 'chat' } = request.data as {
    calleeUid?: string;
    type?: 'voice' | 'video';
    channelName?: string;
    source?: 'chat' | 'match';
  };
  if (!calleeUid || !channelName) {
    throw new HttpsError('invalid-argument', 'calleeUid و channelName مطلوبان');
  }
  if (calleeUid === uid) {
    throw new HttpsError('invalid-argument', 'لا يمكن الاتصال بنفسك');
  }

  const callType: 'voice' | 'video' = type === 'video' ? 'video' : 'voice';
  const callSource: 'chat' | 'match' = source === 'match' ? 'match' : 'chat';
  const pricing = await getCallPricingConfig();

  const [freeCall, calleeSnap, callerSnap] = await Promise.all([
    resolveCallPrivilege(uid, calleeUid),
    db.collection('users').doc(calleeUid).get(),
    db.collection('users').doc(uid).get(),
  ]);

  const callee = calleeSnap.data() ?? {};
  const callerData = callerSnap.data() ?? {};

  // شات خاص: الذكور فقط يحتاجون مستوى علاقة (LV5 صوت، LV10 فيديو) — الإناث بدون تقييد
  if (callSource === 'chat' && readUserGender(callerData) === 'male') {
    const relId = getRelationshipId(uid, calleeUid);
    const relSnap = await db.collection('relationships').doc(relId).get();
    const bondLevel = relSnap.exists ? Number(relSnap.data()?.level) || 1 : 1;
    const required = getRequiredBondLevelForChatCall(callType);
    if (bondLevel < required) {
      const typeLabel = callType === 'video' ? 'فيديو' : 'صوت';
      throw new HttpsError(
        'failed-precondition',
        `مكالمات ${typeLabel} متاحة من مستوى العلاقة ${required}`,
      );
    }
  }

  const calleeIsAgencyHost = isVerifiedFemaleHost(callee);
  const callerIsMatchHost = isMatchFreeSide(callerData);
  // المفوترة: في المطابقة يدفع غير الأنثى الموثّقة؛ في الشات يدفع المتصل للمضيفة بالوكالة
  const billed =
    callSource === 'match'
      ? !callerIsMatchHost
      : calleeIsAgencyHost && !freeCall;

  if (billed) {
    const caller = callerSnap.data() ?? {};
    const balance = pickCoinsBalance(caller);
    const firstPrice = computeMinutePrice(callType, 0, callSource, pricing);
    if (balance < firstPrice) {
      throw new HttpsError(
        'failed-precondition',
        `رصيد غير كافٍ — تحتاج ${firstPrice} عملة لبدء المكالمة`,
      );
    }
  }

  const hostShareRatio = billed ? await getHostShareRatio() : 0;

  const ref = await db.collection('callSessions').add({
    callerUid: uid,
    calleeUid,
    type: callType,
    source: callSource,
    channelName,
    billed,
    hostShareRatio,
    status: 'ringing',
    minutesCharged: 0,
    totalCoinsSpent: 0,
    totalPearlsEarned: 0,
    createdAt: Date.now(),
  });

  return { sessionId: ref.id, billed, freeCall };
});

// ==================== CHARGE CALL MINUTE ====================
/**
 * يُحتسب على المتصل (الدافع) دقيقة مكالمة واحدة.
 * يستدعيه عميل المتصل عند بدء الاتصال الفعلي ثم كل 60 ثانية.
 * السيرفر مرجعيّ: يخصم من المتصل فقط (callerUid) ويضيف ماسةً للمتلقّي بشكل ذرّي.
 * إن لم يكن المستدعي هو الدافع أو الجلسة غير مفوترة → لا شيء (آمن).
 */
export const chargeCallMinute = onCall(HOT_CALL_OPTS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { sessionId } = request.data as { sessionId?: string };
  if (!sessionId) throw new HttpsError('invalid-argument', 'sessionId مطلوب');

  const sessionRef = db.collection('callSessions').doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new HttpsError('not-found', 'الجلسة غير موجودة');
  const session = sessionSnap.data()!;

  // فقط الدافع يُحتسب عليه؛ غير ذلك (المتلقّي/جلسة مجانية) → بدون أي خصم
  if (session.callerUid !== uid || session.billed !== true) {
    return { ok: true, billed: false };
  }
  if (session.status === 'ended') {
    return { ok: false, reason: 'ended' as const };
  }

  const callType: 'voice' | 'video' = session.type === 'video' ? 'video' : 'voice';
  const callSource: 'chat' | 'match' = session.source === 'match' ? 'match' : 'chat';
  const pricing = await getCallPricingConfig();
  const callerRef = db.collection('users').doc(uid);
  const calleeRef = db.collection('users').doc(String(session.calleeUid));

  let outcome: {
    ok: boolean;
    reason?: 'insufficient' | 'ended';
    balance?: number;
    minutesCharged?: number;
    price?: number;
    hostPearls?: number;
  } = { ok: false };

  // كل القراءات/الكتابات داخل transaction ذرّي لتفادي القراءات القديمة
  await db.runTransaction(async (tx) => {
    const freshSession = await tx.get(sessionRef);
    const sData = freshSession.data();
    if (!sData || sData.status === 'ended') {
      outcome = { ok: false, reason: 'ended' };
      return;
    }

    const minuteIndex = Number(sData.minutesCharged) || 0;
    const price = computeMinutePrice(callType, minuteIndex, callSource, pricing);
    const ratio = Number(sData.hostShareRatio) || 0;
    const hostPearls = Math.floor(price * ratio);

    const callerDoc = await tx.get(callerRef);
    const data = callerDoc.data() ?? {};
    const balance = pickCoinsBalance(data);

    if (balance < price) {
      tx.update(sessionRef, {
        status: 'ended',
        endReason: 'insufficient',
        endedAt: Date.now(),
      });
      outcome = { ok: false, reason: 'insufficient', balance };
      return;
    }

    tx.update(callerRef, {
      'stats.coins': admin.firestore.FieldValue.increment(-price),
      coins: admin.firestore.FieldValue.increment(-price),
    });
    tx.update(calleeRef, {
      'stats.pearls': admin.firestore.FieldValue.increment(hostPearls),
      pearls: admin.firestore.FieldValue.increment(hostPearls),
    });
    tx.update(sessionRef, {
      status: 'active',
      minutesCharged: minuteIndex + 1,
      totalCoinsSpent: (Number(sData.totalCoinsSpent) || 0) + price,
      totalPearlsEarned: (Number(sData.totalPearlsEarned) || 0) + hostPearls,
      lastChargedAt: Date.now(),
    });
    outcome = {
      ok: true,
      balance: balance - price,
      minutesCharged: minuteIndex + 1,
      price,
      hostPearls,
    };
  });

  // سجلّ المعاملات بعد نجاح الخصم — معاملة call_earning تُفعّل trigger راتب الوكالة
  if (outcome.ok) {
    const price = outcome.price ?? 0;
    const hostPearls = outcome.hostPearls ?? 0;
    const batch = db.batch();
    batch.set(db.collection('transactions').doc(), {
      uid,
      type: 'call_spent',
      amount: -price,
      currency: 'coins',
      callType,
      peerUid: session.calleeUid,
      sessionId,
      status: 'completed',
      createdAt: Date.now(),
    });
    if (hostPearls > 0) {
      batch.set(db.collection('transactions').doc(), {
        uid: session.calleeUid,
        type: 'call_earning',
        amount: hostPearls,
        currency: 'pearls',
        callType,
        fromUid: uid,
        sessionId,
        status: 'completed',
        createdAt: Date.now(),
      });
    }
    await batch.commit().catch((e) => console.error('chargeCallMinute tx log:', e));
  }

  // لا نُرجع الحقول الداخلية (price/hostPearls) للعميل
  return {
    ok: outcome.ok,
    ...(outcome.reason ? { reason: outcome.reason } : {}),
    ...(outcome.balance !== undefined ? { balance: outcome.balance } : {}),
    ...(outcome.minutesCharged !== undefined ? { minutesCharged: outcome.minutesCharged } : {}),
  };
});

// ==================== 6) ACCOUNT DELETION (مجدول) ====================
/**
 * يحذف الحسابات التي مضى على طلب حذفها 15+ يوماً
 * يشغّل يومياً — لا يحتاجه التطبيق مباشرة
 */
export const processPendingAccountDeletions = onSchedule(
  {
    schedule: 'every 24 hours',
    timeZone: 'Asia/Riyadh',
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async () => {
    const cutoff = Date.now() - ACCOUNT_DELETION_GRACE_MS;
    const pendingSnap = await db
      .collection('accountDeletionRequests')
      .where('status', '==', 'pending')
      .limit(100)
      .get();

    let processed = 0;
    for (const reqDoc of pendingSnap.docs) {
      const uid = reqDoc.id;
      const userRef = db.collection('users').doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        await reqDoc.ref.set(
          { status: 'completed', completedAt: Date.now(), note: 'user_missing' },
          { merge: true },
        );
        continue;
      }
      const userData = userSnap.data()!;
      if (userData.accountStatus !== 'pending_deletion') {
        continue;
      }
      const requestedAt = userData.deletionRequestedAt ?? 0;
      if (requestedAt > cutoff) {
        continue;
      }

      try {
        await purgeUserCascade(uid);
        await reqDoc.ref.set(
          {
            status: 'completed',
            completedAt: Date.now(),
          },
          { merge: true },
        );
        processed += 1;
      } catch (e) {
        console.error('processPendingAccountDeletions', uid, e);
        await reqDoc.ref.set(
          { status: 'error', lastErrorAt: Date.now() },
          { merge: true },
        );
      }
    }
    console.log(`processPendingAccountDeletions: processed ${processed}`);
  },
);

// ==================== 7) BACKFILL POST STATUSES ====================
/**
 * يضيف status: 'active' للمنشورات القديمة — أدمن فقط (من collection admins)
 */
export const backfillPostStatuses = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const adminSnap = await db.collection('admins').doc(uid).get();
  if (!adminSnap.exists) {
    throw new HttpsError('permission-denied', 'صلاحية أدمن مطلوبة');
  }

  const snap = await db.collection('posts').limit(500).get();
  let updated = 0;
  let batch = db.batch();
  let ops = 0;

  for (const d of snap.docs) {
    if (!d.data().status) {
      batch.update(d.ref, { status: 'active' });
      updated += 1;
      ops += 1;
      if (ops >= 400) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
  }
  if (ops > 0) await batch.commit();

  return { updated, total: snap.size };
});

/**
 * مزامنة معرّفات الحساب العامة (publicAccountId) لكل المستخدمين القدامى
 * - يكتب publicAccountId في users إن كان ناقصاً (يحسبه من uid مثل التطبيق)
 * - يكتب فهرس publicAccountIndex/{id} = { uid } ليصبح البحث فورياً
 * - idempotent: يمكن تشغيله مرات متعددة بأمان، ويكمل من cursor
 * أدمن فقط.
 */
export const backfillPublicAccountIds = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const adminSnap = await db.collection('admins').doc(adminUid).get();
  if (!adminSnap.exists) {
    throw new HttpsError('permission-denied', 'صلاحية أدمن مطلوبة');
  }

  const { startAfter, pageSize } = request.data as {
    startAfter?: string;
    pageSize?: number;
  };
  const limitSize = Math.min(Math.max(Number(pageSize) || 500, 50), 1000);

  let q = db
    .collection('users')
    .orderBy(admin.firestore.FieldPath.documentId())
    .limit(limitSize);
  if (startAfter) q = q.startAfter(startAfter);

  const snap = await q.get();
  if (snap.empty) {
    return { done: true, processed: 0, stored: 0, indexed: 0, nextCursor: null };
  }

  let userBatch = db.batch();
  let indexBatch = db.batch();
  let userOps = 0;
  let indexOps = 0;
  let stored = 0;
  let indexed = 0;

  const commitIfNeeded = async () => {
    if (userOps >= 450) {
      await userBatch.commit();
      userBatch = db.batch();
      userOps = 0;
    }
    if (indexOps >= 450) {
      await indexBatch.commit();
      indexBatch = db.batch();
      indexOps = 0;
    }
  };

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const hasStored =
      data.publicAccountId != null && String(data.publicAccountId).trim() !== '';
    const publicId = hasStored
      ? String(data.publicAccountId).replace(/\D/g, '').padStart(8, '0').slice(-8)
      : generatePublicAccountId(docSnap.id);

    if (!hasStored) {
      userBatch.update(docSnap.ref, {
        publicAccountId: publicId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      userOps += 1;
      stored += 1;
    }

    indexBatch.set(
      db.collection('publicAccountIndex').doc(publicId),
      { uid: docSnap.id, updatedAt: Date.now() },
      { merge: true },
    );
    indexOps += 1;
    indexed += 1;

    await commitIfNeeded();
  }

  if (userOps > 0) await userBatch.commit();
  if (indexOps > 0) await indexBatch.commit();

  const lastId = snap.docs[snap.docs.length - 1]?.id ?? null;
  const done = snap.size < limitSize;

  return {
    done,
    processed: snap.size,
    stored,
    indexed,
    nextCursor: done ? null : lastId,
  };
});

// ==================== AGENCY APPLICATIONS ====================

async function assertAdmin(uid: string): Promise<FirebaseFirestore.DocumentData> {
  const adminSnap = await db.collection('admins').doc(uid).get();
  if (!adminSnap.exists) {
    throw new HttpsError('permission-denied', 'صلاحية أدمن مطلوبة');
  }
  return adminSnap.data()!;
}

/** مشرف الدولة: يرى/يدير فقط محتوى دوله */
async function assertAdminCountryScope(
  adminUid: string,
  countryCode?: string | null,
): Promise<FirebaseFirestore.DocumentData> {
  const adminData = await assertAdmin(adminUid);
  if (adminData.role === 'super') return adminData;
  const countries = ((adminData.countries as string[]) ?? []).map((c) =>
    String(c).trim().toUpperCase(),
  );
  if (countries.length === 0) {
    throw new HttpsError('permission-denied', 'لم تُحدَّد دول لهذا المشرف');
  }
  const cc = String(countryCode ?? '').trim().toUpperCase();
  if (cc && !countries.includes(cc)) {
    throw new HttpsError('permission-denied', 'هذا المحتوى خارج نطاق دولك');
  }
  return adminData;
}

/** يتطلب مدير نظام (super) — أو أدمن قديم بلا حقل role (توافق خلفي) */
async function assertSuperAdmin(uid: string) {
  const adminSnap = await db.collection('admins').doc(uid).get();
  if (!adminSnap.exists) {
    throw new HttpsError('permission-denied', 'صلاحية أدمن مطلوبة');
  }
  const role = adminSnap.data()?.role;
  if (role && role !== 'super') {
    throw new HttpsError('permission-denied', 'هذه العملية لمدير النظام فقط');
  }
}

/**
 * يتطلب صلاحية صفحة محددة (key == routePath في navConfig.ts في لوحة التحكم).
 * مدير النظام يمر دائماً. تُستخدم إضافة لـ assertAdmin/assertAdminCountryScope وليس بديلاً عنها.
 */
async function assertHasPermission(uid: string, key: string): Promise<void> {
  const data = await assertAdmin(uid);
  if (data.role === 'super') return;
  if ((data.permissions as Record<string, boolean> | undefined)?.[key] !== true) {
    throw new HttpsError('permission-denied', `صلاحية "${key}" مطلوبة`);
  }
}

// ==================== ADMIN USER MANAGEMENT (مشرفون + صلاحيات دول) ====================

/** مدير النظام ينشئ حساب مشرف جديد بصلاحيات دول محددة */
/**
 * مفاتيح الصلاحيات الصالحة — يجب أن تطابق routePath في navConfig.ts (لوحة التحكم) تماماً.
 * أي مفتاح خارج هذه القائمة يُرفض هنا حتى لو استُدعيت الدالة مباشرة (تجاوز الواجهة).
 */
const VALID_PERMISSION_KEYS = new Set([
  'analytics', 'call-usage',
  'users', 'staff', 'kyc-requests',
  'rooms', 'room-decor', 'room-reactions',
  'agencies', 'agency-levels', 'agency-prince', 'agency-applications',
  'wallet', 'withdrawals', 'bot',
  'packages', 'gifts', 'store', 'lucky-bag', 'room-throne', 'vip', 'aristocracy',
  'rewards-center', 'host-tasks', 'titles', 'gift-privileges', 'privacy', 'call-pricing',
  'posts', 'games', 'stickers', 'relationships', 'chat-backgrounds', 'notifications',
  'about-pages', 'support', 'reports',
  'settings', 'app-release',
]);

function sanitizePermissions(raw: Record<string, boolean>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (VALID_PERMISSION_KEYS.has(key) && value === true) out[key] = true;
  }
  return out;
}

export const createAdminUser = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  await assertSuperAdmin(uid);

  const { email, password, name, role = 'country', countries = [], permissions = {} } =
    request.data as {
      email?: string; password?: string; name?: string;
      role?: 'super' | 'country';
      countries?: string[];
      permissions?: Record<string, boolean>;
    };

  if (!email?.trim() || !password || password.length < 6) {
    throw new HttpsError('invalid-argument', 'بريد صالح وكلمة مرور (6+ أحرف) مطلوبان');
  }

  // أنشئ حساب Auth (أو استخدم الموجود)
  let newUid: string;
  try {
    const u = await admin.auth().createUser({
      email: email.trim(), password, displayName: name ?? email.trim(),
    });
    newUid = u.uid;
  } catch (e: any) {
    if (e?.code === 'auth/email-already-exists') {
      const existing = await admin.auth().getUserByEmail(email.trim());
      newUid = existing.uid;
    } else {
      throw new HttpsError('invalid-argument', e?.message ?? 'تعذّر إنشاء الحساب');
    }
  }

  await db.collection('admins').doc(newUid).set({
    email: email.trim(),
    name: name ?? email.trim(),
    role: role === 'super' ? 'super' : 'country',
    countries: Array.isArray(countries) ? countries : [],
    permissions: sanitizePermissions(permissions ?? {}),
    disabled: false,
    createdAt: Date.now(),
    createdBy: uid,
  });

  return { ok: true, uid: newUid };
});

/** تعديل صلاحيات/دول مشرف */
export const updateAdminUser = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  await assertSuperAdmin(uid);

  const { targetUid, name, role, countries, permissions, disabled } = request.data as {
    targetUid?: string; name?: string; role?: 'super' | 'country';
    countries?: string[]; permissions?: Record<string, boolean>; disabled?: boolean;
  };
  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid مطلوب');
  if (targetUid === uid && (role === 'country' || disabled === true)) {
    throw new HttpsError('failed-precondition', 'لا يمكنك تخفيض/تعطيل حسابك بنفسك');
  }

  const payload: Record<string, unknown> = { updatedAt: Date.now() };
  if (typeof name === 'string') payload.name = name;
  if (role === 'super' || role === 'country') payload.role = role;
  if (Array.isArray(countries)) payload.countries = countries;
  if (permissions && typeof permissions === 'object') payload.permissions = sanitizePermissions(permissions);
  if (typeof disabled === 'boolean') {
    payload.disabled = disabled;
    await admin.auth().updateUser(targetUid, { disabled }).catch(() => {});
  }

  await db.collection('admins').doc(targetUid).set(payload, { merge: true });
  return { ok: true };
});

/** حذف مشرف (وثيقة admins + تعطيل حساب Auth) */
export const deleteAdminUser = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  await assertSuperAdmin(uid);

  const { targetUid } = request.data as { targetUid?: string };
  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid مطلوب');
  if (targetUid === uid) throw new HttpsError('failed-precondition', 'لا يمكنك حذف حسابك');

  await db.collection('admins').doc(targetUid).delete();
  await admin.auth().updateUser(targetUid, { disabled: true }).catch(() => {});
  return { ok: true };
});

// ==================== APP USER MANAGEMENT (مستخدمون التطبيق) ====================

const USER_ACTIVE_MS = 7 * 24 * 60 * 60 * 1000;
const BULK_DELETE_MAX = 500;

function userCountryFromDoc(data: FirebaseFirestore.DocumentData): string {
  const p = data.profile as { country?: string } | undefined;
  return String(p?.country ?? data.country ?? 'PS').trim().toUpperCase();
}

async function assertCanManageAppUsers(
  adminUid: string,
  targetCountry?: string,
): Promise<FirebaseFirestore.DocumentData> {
  const adminSnap = await db.collection('admins').doc(adminUid).get();
  if (!adminSnap.exists) {
    throw new HttpsError('permission-denied', 'صلاحية أدمن مطلوبة');
  }
  const adminData = adminSnap.data()!;
  if (adminData.role === 'super') return adminData;
  if (adminData.permissions?.users !== true) {
    throw new HttpsError('permission-denied', 'صلاحية إدارة المستخدمين مطلوبة');
  }
  if (targetCountry) {
    const countries = (adminData.countries as string[]) ?? [];
    if (countries.length > 0 && !countries.map((c) => c.toUpperCase()).includes(targetCountry.toUpperCase())) {
      throw new HttpsError('permission-denied', 'المستخدم خارج نطاق دولك');
    }
  }
  return adminData;
}

async function purgeAppUserData(uid: string): Promise<void> {
  await purgeUserCascade(uid);
}

/** إنشاء مستخدم تطبيق (Auth + Firestore) */
export const adminCreateAppUser = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const {
    email,
    password,
    displayName,
    gender = 'female',
    country = 'PS',
    coins = 0,
    pearls = 0,
    casinoCoins = 0,
    isVIP = false,
    isVerified = false,
    isBanned = false,
    phoneNumber,
    bio,
  } = request.data as {
    email?: string;
    password?: string;
    displayName?: string;
    gender?: 'male' | 'female';
    country?: string;
    coins?: number;
    pearls?: number;
    casinoCoins?: number;
    isVIP?: boolean;
    isVerified?: boolean;
    isBanned?: boolean;
    phoneNumber?: string;
    bio?: string;
  };

  if (!email?.trim() || !password || password.length < 6) {
    throw new HttpsError('invalid-argument', 'بريد وكلمة مرور (6+ أحرف) مطلوبان');
  }
  if (!displayName?.trim()) {
    throw new HttpsError('invalid-argument', 'الاسم مطلوب');
  }

  const countryCode = String(country).trim().toUpperCase();
  await assertCanManageAppUsers(adminUid, countryCode);

  let newUid: string;
  try {
    const u = await admin.auth().createUser({
      email: email.trim().toLowerCase(),
      password,
      displayName: displayName.trim(),
    });
    newUid = u.uid;
  } catch (e: any) {
    throw new HttpsError('invalid-argument', e?.message ?? 'تعذّر إنشاء حساب Auth');
  }

  const publicAccountId = generatePublicAccountId(newUid);
  const safeCoins = Math.max(0, Math.floor(Number(coins) || 0));
  const safePearls = Math.max(0, Math.floor(Number(pearls) || 0));
  const safeCasino = Math.max(0, Math.floor(Number(casinoCoins) || 0));
  const stats = {
    coins: safeCoins,
    pearls: safePearls,
    casinoCoins: safeCasino,
    level: 1,
    xp: 0,
    followers: 0,
    following: 0,
    visitors: 0,
    totalRoomsCreated: 0,
  };

  const { avatar, photos: defaultPhotos } = getDefaultProfileMedia(gender);
  const defaultBirthYear = 1995;

  await db.collection('users').doc(newUid).set({
    uid: newUid,
    publicAccountId,
    email: email.trim().toLowerCase(),
    displayName: displayName.trim(),
    avatar,
    bio: bio?.trim() || 'مرحباً بكم في LinkUp 👋',
    gender,
    birthYear: defaultBirthYear,
    birthDay: null,
    birthMonth: null,
    age: new Date().getFullYear() - defaultBirthYear,
    country: countryCode,
    phoneNumber: phoneNumber?.trim() || null,
    photos: defaultPhotos,
    stats,
    ...stats,
    isVerified: !!isVerified,
    isVIP: !!isVIP,
    isBanned: !!isBanned,
    vipLevel: isVIP ? 1 : 0,
    vipPoints: 0,
    vipPointsMonth: 0,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    createdByAdmin: adminUid,
  });

  await syncPublicAccountIndexForUid(publicAccountId, newUid);

  await db.collection('adminUserCredentials').doc(newUid).set({
    password,
    updatedAt: Date.now(),
    updatedBy: adminUid,
  });

  return {
    ok: true,
    uid: newUid,
    publicAccountId,
    displayName: displayName.trim(),
  };
});

/** تحديث مستخدم تطبيق — حقول شاملة */
export const adminUpdateAppUser = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { uid, patch } = request.data as {
    uid?: string;
    patch?: Record<string, unknown>;
  };
  if (!uid?.trim() || !patch || typeof patch !== 'object') {
    throw new HttpsError('invalid-argument', 'uid و patch مطلوبان');
  }

  const userRef = db.collection('users').doc(uid.trim());
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');

  const userData = userSnap.data()!;
  await assertCanManageAppUsers(adminUid, userCountryFromDoc(userData));

  const allowed = new Set([
    'displayName',
    'avatar',
    'bio',
    'gender',
    'country',
    'birthYear',
    'phoneNumber',
    'email',
    'isVIP',
    'isVerified',
    'isBanned',
    'withdrawalBlocked',
    'banReason',
    'vipLevel',
    'coins',
    'pearls',
    'casinoCoins',
    'level',
    'followers',
    'following',
  ]);

  const update: Record<string, unknown> = { updatedAt: Date.now() };
  const statsPatch: Record<string, number> = {};

  for (const [key, value] of Object.entries(patch)) {
    if (!allowed.has(key)) continue;
    if (['coins', 'pearls', 'casinoCoins', 'level', 'followers', 'following'].includes(key)) {
      statsPatch[key] = Math.max(0, Math.floor(Number(value) || 0));
      continue;
    }
    if (key === 'email' && typeof value === 'string') {
      update.email = value.trim().toLowerCase();
      try {
        await admin.auth().updateUser(uid.trim(), { email: update.email as string });
      } catch (e: any) {
        throw new HttpsError('invalid-argument', e?.message ?? 'تعذّر تحديث البريد');
      }
      continue;
    }
    update[key] = value;
  }

  if (Object.keys(statsPatch).length > 0) {
    update.stats = { ...(userData.stats as object), ...statsPatch };
    Object.assign(update, statsPatch);
  }

  // مزامنة profile.* — التطبيق يقرأ الجنس من profile.gender أو gender
  const profileSyncKeys = ['displayName', 'avatar', 'bio', 'gender', 'country', 'birthYear'] as const;
  const profilePatch: Record<string, unknown> = {};
  for (const k of profileSyncKeys) {
    if (k in update) profilePatch[k] = update[k];
  }
  if (Object.keys(profilePatch).length > 0) {
    update.profile = { ...((userData.profile as object) ?? {}), ...profilePatch };
  }

  if (typeof patch.gender === 'string') {
    const g = patch.gender === 'female' ? 'female' : 'male';
    update.gender = g;
    update.isFemaleHost = g === 'female';
    update.profile = {
      ...((update.profile as object) ?? (userData.profile as object) ?? {}),
      gender: g,
    };
  }

  if (typeof patch.birthYear === 'number' && Number.isFinite(patch.birthYear)) {
    const year = Math.max(1950, Math.min(new Date().getFullYear(), Math.floor(patch.birthYear)));
    update.birthYear = year;
    update.profile = {
      ...((update.profile as object) ?? (userData.profile as object) ?? {}),
      birthYear: year,
    };
  }

  const targetUid = uid.trim();

  if (patch.isVerified === false) {
    update.isVerified = false;
    update.verificationStatus = 'rejected';
    update.verifiedAt = admin.firestore.FieldValue.delete();
    const kycRef = db.collection('kycRequests').doc(targetUid);
    const kycSnap = await kycRef.get();
    if (kycSnap.exists) {
      await kycRef.set(
        {
          status: 'rejected',
          rejectionReason: 'تم إلغاء التوثيق من الإدارة',
          revokedAt: Date.now(),
          updatedAt: Date.now(),
        },
        { merge: true },
      );
    }
  } else if (patch.isVerified === true) {
    update.isVerified = true;
    update.verificationStatus = 'approved';
    update.verifiedAt = Date.now();
  }

  if (Object.keys(update).length <= 1) {
    throw new HttpsError('invalid-argument', 'لا توجد حقول صالحة للتحديث');
  }

  await userRef.set(update, { merge: true });
  return { ok: true, uid: targetUid };
});

/** تعيين كلمة مرور مستخدم — Firebase Auth + حفظ للعرض في لوحة التحكم */
export const adminSetAppUserPassword = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { uid, password } = request.data as { uid?: string; password?: string };
  if (!uid?.trim()) throw new HttpsError('invalid-argument', 'uid مطلوب');
  if (!password || password.length < 6) {
    throw new HttpsError('invalid-argument', 'كلمة المرور 6 أحرف على الأقل');
  }

  const userRef = db.collection('users').doc(uid.trim());
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');

  await assertCanManageAppUsers(adminUid, userCountryFromDoc(userSnap.data()!));

  try {
    await admin.auth().updateUser(uid.trim(), { password });
  } catch (e: any) {
    throw new HttpsError('invalid-argument', e?.message ?? 'تعذّر تحديث كلمة المرور');
  }

  await db.collection('adminUserCredentials').doc(uid.trim()).set({
    password,
    updatedAt: Date.now(),
    updatedBy: adminUid,
  });

  return { ok: true, uid: uid.trim() };
});

/** حذف مستخدمين — محددين / متفاعلين / غير متفاعلين / الكل (مدير نظام) */
export const adminDeleteAppUsers = onCall({ memory: '512MiB', timeoutSeconds: 540 }, async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { mode, uids, confirmPhrase } = request.data as {
    mode?: 'selected' | 'active' | 'inactive' | 'all';
    uids?: string[];
    confirmPhrase?: string;
  };

  if (!mode) throw new HttpsError('invalid-argument', 'mode مطلوب');

  const adminData = await assertCanManageAppUsers(adminUid);
  const adminCountries = ((adminData.countries as string[]) ?? []).map((c) => c.toUpperCase());
  const isSuper = adminData.role === 'super';

  if (mode === 'all') {
    if (!isSuper) {
      throw new HttpsError('permission-denied', 'حذف الكل لمدير النظام فقط');
    }
    if (confirmPhrase !== 'DELETE_ALL_USERS') {
      throw new HttpsError('failed-precondition', 'اكتب DELETE_ALL_USERS للتأكيد');
    }
  }

  const now = Date.now();
  let targetUids: string[] = [];

  if (mode === 'selected') {
    if (!Array.isArray(uids) || uids.length === 0) {
      throw new HttpsError('invalid-argument', 'حدّد مستخدمين للحذف');
    }
    targetUids = uids.map((u) => String(u).trim()).filter(Boolean);
  } else {
    const [snap, adminsSnap] = await Promise.all([
      db.collection('users').orderBy('createdAt', 'desc').limit(2500).get(),
      db.collection('admins').get(),
    ]);
    const adminIds = new Set(adminsSnap.docs.map((d) => d.id));
    for (const docSnap of snap.docs) {
      if (docSnap.id === adminUid) continue;
      if (adminIds.has(docSnap.id)) continue;

      const data = docSnap.data();
      const country = userCountryFromDoc(data);
      if (!isSuper && adminCountries.length > 0 && !adminCountries.includes(country)) {
        continue;
      }

      const lastSeen = Number(data.lastSeen ?? 0);
      const isActive = lastSeen >= now - USER_ACTIVE_MS;

      if (mode === 'active' && !isActive) continue;
      if (mode === 'inactive' && isActive) continue;

      targetUids.push(docSnap.id);
      if (targetUids.length >= BULK_DELETE_MAX) break;
    }
  }

  if (targetUids.length === 0) {
    return { ok: true, deleted: 0, failed: 0 };
  }

  let deleted = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const targetUid of targetUids.slice(0, BULK_DELETE_MAX)) {
    try {
      const userSnap = await db.collection('users').doc(targetUid).get();
      if (!userSnap.exists) continue;
      await assertCanManageAppUsers(adminUid, userCountryFromDoc(userSnap.data()!));
      await purgeAppUserData(targetUid);
      deleted += 1;
    } catch (e: any) {
      failed += 1;
      if (errors.length < 5) errors.push(`${targetUid}: ${e?.message ?? 'خطأ'}`);
    }
  }

  return { ok: true, deleted, failed, errors };
});

async function notifyUser(
  targetUid: string,
  message: string,
  data?: Record<string, unknown>,
) {
  const notifType =
    typeof data?.type === 'string' && data.type.length > 0 ? data.type : 'system';

  const notif: Record<string, unknown> = {
    uid: targetUid,
    type:
      notifType === 'report_update' ||
      notifType === 'withdrawal_status' ||
      String(notifType).startsWith('agency_')
        ? 'system'
        : notifType,
    message,
    data: { ...(data ?? {}), type: notifType },
    isRead: false,
    createdAt: Date.now(),
  };
  if (typeof data?.fromUid === 'string' && data.fromUid.length > 0) {
    notif.fromUid = data.fromUid;
  }
  await db.collection('notifications').add(notif);
  // Push يُرسل عبر pushOnNotificationCreated
}

type NotificationPrefs = {
  pushEnabled?: boolean;
  enabled?: boolean;
  messages?: boolean;
  calls?: boolean;
  gifts?: boolean;
  visitors?: boolean;
  promotions?: boolean;
  social?: boolean;
};

function resolveNotificationPrefKey(
  type: string,
  data: Record<string, unknown>,
): keyof NotificationPrefs {
  const dataType = typeof data.type === 'string' ? data.type : '';
  if (dataType === 'report_update' || dataType === 'admin_recharge') return 'enabled';
  if (type === 'message') return 'messages';
  if (type === 'gift') return 'gifts';
  if (type === 'visit') return 'visitors';
  if (type === 'incoming_call' || type === 'call') return 'calls';
  if (type === 'moderation') return 'enabled';
  if (dataType === 'broadcast') return 'promotions';
  if (type === 'system' && data.broadcastId) return 'promotions';
  if (['follow', 'like', 'comment', 'mention', 'room_invite', 'game_challenge'].includes(type)) {
    return 'social';
  }
  if (['follow', 'like', 'comment', 'mention', 'room_invite', 'game_challenge'].includes(dataType)) {
    return 'social';
  }
  if (type === 'system') return 'promotions';
  return 'promotions';
}

function shouldDeliverPushBanner(type: string, data: Record<string, unknown>): boolean {
  const dataType = typeof data.type === 'string' && data.type.length > 0 ? data.type : type;
  if (dataType === 'vip_status') return false;
  if (type === 'incoming_call' || dataType === 'incoming_call') return true;
  if (type === 'moderation' || dataType === 'moderation') return true;
  if (type === 'system' || dataType === 'system') return true;
  return false;
}

function shouldSendPushForNotification(
  type: string,
  prefs: NotificationPrefs | undefined,
  data: Record<string, unknown>,
): boolean {
  if (prefs?.pushEnabled === false) return false;

  const dataType = typeof data.type === 'string' ? data.type : '';
  if (
    type === 'moderation' ||
    dataType === 'report_update' ||
    dataType === 'admin_recharge' ||
    dataType === 'vip_status' ||
    dataType === 'withdrawal_status'
  ) {
    return prefs?.enabled !== false;
  }
  if (prefs?.enabled === false) return false;
  const key = resolveNotificationPrefKey(type, data);
  if (key === 'enabled') return true;
  return prefs?.[key] !== false;
}

function mentionsIdentityVerification(
  data: Record<string, unknown>,
  message?: string,
): boolean {
  const scenario = typeof data.scenario === 'string' ? data.scenario : '';
  if (scenario === 'verification_required') return true;
  const title = String(data.title ?? '');
  const body = String(data.body ?? '');
  const text = `${title} ${body} ${message ?? ''}`;
  return (
    text.includes('التحقق من الهوية') ||
    text.includes('التحقق مطلوب') ||
    text.includes('إكمال التحقق') ||
    text.includes('إكمال توثيق') ||
    text.includes('توثيق الحساب') ||
    text.includes('مركز التحقق')
  );
}

function computePushRoute(
  type: string,
  data: Record<string, unknown>,
  fromUid?: string,
  message?: string,
): string {
  if (typeof data.route === 'string' && data.route.startsWith('/')) {
    return data.route;
  }
  const dataType = typeof data.type === 'string' && data.type.length > 0 ? data.type : type;
  const scenario = typeof data.scenario === 'string' ? data.scenario : '';
  const postId = typeof data.postId === 'string' ? data.postId : '';
  const roomId = typeof data.roomId === 'string' ? data.roomId : '';
  const uid = fromUid ?? (typeof data.fromUid === 'string' ? data.fromUid : '');

  if (
    dataType === 'kyc_pending' ||
    dataType === 'kyc_rejected' ||
    dataType === 'kyc_approved' ||
    dataType === 'agency_needs_verification' ||
    mentionsIdentityVerification(data, message)
  ) {
    return '/wallet/kyc';
  }

  if (dataType === 'agency_application_approved' || dataType === 'agency_application_ready') {
    return '/agency/center';
  }
  if (dataType === 'agency_host_invite') return '/agency/my-invites';
  if (dataType === 'agency_host_joined') return '/agency/members';
  if (dataType === 'agency_needs_verification') return '/agency/confirm-host';
  if (dataType === 'agency_application_expired' || dataType === 'agency_application_rejected') {
    return '/agency/center';
  }
  if (scenario === 'verification_required') return '/wallet/kyc';
  if (dataType === 'withdrawal_status') return '/wallet/pearl-log';
  if (scenario === 'withdrawal_blocked' || scenario === 'withdrawal_unblocked') {
    return '/wallet/pearl-wallet';
  }
  if (type === 'moderation' || dataType === 'moderation') {
    return scenario === 'account_banned' ? '/support' : '/notifications';
  }
  if (dataType === 'vip_status') {
    if (scenario === 'recharge_success') return '/vip';
    return '/wallet/recharge';
  }
  if (dataType === 'admin_recharge') return '/wallet';
  if (dataType === 'report_update') {
    const reportId = typeof data.reportId === 'string' ? data.reportId : '';
    if (reportId) return `/report/${reportId}`;
    return '/report/my';
  }
  if (dataType === 'broadcast' || data.broadcastId) return '/notifications';
  if (dataType === 'message' && uid) return `/chat/${uid}`;
  if ((dataType === 'like' || dataType === 'comment' || dataType === 'mention') && postId) {
    return `/post/${postId}`;
  }
  if (dataType === 'follow' && uid) return `/profile/${uid}`;
  if (dataType === 'gift' && uid) return `/chat/${uid}`;
  if (dataType === 'visit' && uid) return `/profile/${uid}`;
  if (dataType === 'room_invite' && roomId) return `/room/${roomId}`;
  const challengeId = typeof data.challengeId === 'string' ? data.challengeId : '';
  if (dataType === 'game_challenge' && challengeId) {
    if (uid) return `/chat/${uid}`;
    return `/games/challenges?incoming=${challengeId}`;
  }
  return '/notifications';
}

async function sendPushForNotificationDoc(
  notif: FirebaseFirestore.DocumentData,
  notifId: string,
): Promise<void> {
  const targetUid = notif.uid as string | undefined;
  if (!targetUid) return;

    const type = (notif.type as string) ?? 'system';
    const data = (notif.data as Record<string, unknown>) ?? {};
    const dataType =
      typeof data.type === 'string' && data.type.length > 0 ? data.type : type;

    try {
    if (!shouldDeliverPushBanner(type, data)) return;

    const userSnap = await db.collection('users').doc(targetUid).get();
    const userData = userSnap.data() ?? {};
    const prefs = userData.notificationSettings as NotificationPrefs | undefined;

    if (!shouldSendPushForNotification(type, prefs, data)) return;

    const fcmToken = userData.fcmToken as string | undefined;
    if (!fcmToken) return;

    const title =
      typeof data.title === 'string' && data.title.length > 0
        ? data.title
        : typeof notif.fromName === 'string' && notif.fromName.length > 0
          ? notif.fromName
          : 'LinkUp';
    const body =
      typeof data.body === 'string' && data.body.length > 0
        ? data.body
        : (notif.message as string) ?? '';

    const fromUid =
      typeof notif.fromUid === 'string'
        ? notif.fromUid
        : typeof data.fromUid === 'string'
          ? data.fromUid
          : undefined;

    const stringData: Record<string, string> = {
      notifId,
      type,
      notifType: dataType,
      route: computePushRoute(type, data, fromUid, (notif.message as string) ?? ''),
    };
    if (fromUid) stringData.fromUid = fromUid;
    if (typeof data.postId === 'string') stringData.postId = data.postId;
    if (typeof data.conversationId === 'string') {
      stringData.conversationId = data.conversationId;
    }
    if (typeof data.giftId === 'string') stringData.giftId = data.giftId;
    if (typeof data.scenario === 'string') stringData.scenario = data.scenario;
    if (typeof data.broadcastId === 'string') stringData.broadcastId = data.broadcastId;
    if (typeof data.reportId === 'string') stringData.reportId = data.reportId;
    if (typeof data.roomId === 'string') stringData.roomId = data.roomId;
    if (typeof data.challengeId === 'string') stringData.challengeId = data.challengeId;
    if (typeof data.title === 'string') stringData.title = data.title;
    if (typeof data.body === 'string') stringData.body = data.body;
    if (typeof data.withdrawalId === 'string') stringData.withdrawalId = data.withdrawalId;

    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: stringData,
      apns: { payload: { aps: { sound: 'default' } } },
      android: { priority: 'high' },
    });
  } catch {
    // FCM token منتهٍ أو غير صالح
  }
}

export const pushOnNotificationCreated = onDocumentCreated(
  { document: 'notifications/{notifId}', maxInstances: 10 },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    await sendPushForNotificationDoc(snap.data(), event.params.notifId);
  },
);

/** إشعار + Push للعضو عند قبول/رفض طلب سحب (وكيل / أدمن) */
export const notifyOnWithdrawalStatusChange = onDocumentUpdated(
  'withdrawals/{withdrawalId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const prevStatus = String(before.status ?? '');
    const newStatus = String(after.status ?? '');
    if (prevStatus === newStatus || prevStatus !== 'pending') return;
    if (newStatus !== 'completed' && newStatus !== 'rejected') return;

    const uid = String(after.uid ?? '').trim();
    if (!uid) return;

    const amount = Math.floor(Number(after.amount) || 0);
    const netAmount = Math.floor(Number(after.netAmount) || amount);
    const agentName = String(after.agentName ?? '').trim();
    const withdrawalType = String(after.type ?? '');
    const rejectionReason = String(after.rejectionReason ?? '').trim();
    const processedBy = String(after.processedBy ?? after.agentUid ?? '').trim();
    const withdrawalId = event.params.withdrawalId;

    let title: string;
    let body: string;

    if (newStatus === 'completed') {
      title = 'تم قبول طلب السحب';
      body =
        withdrawalType === 'via_agent' && agentName
          ? `وافق الوكيل ${agentName} على طلب سحبك بمبلغ ${netAmount.toLocaleString('ar-SA')} ماسة.`
          : `تمت الموافقة على طلب سحبك بمبلغ ${netAmount.toLocaleString('ar-SA')} ماسة.`;
    } else {
      title = 'تم رفض طلب السحب';
      const refundNote = `تم إرجاع ${amount.toLocaleString('ar-SA')} ماسة لرصيدك.`;
      if (withdrawalType === 'via_agent' && agentName) {
        body = rejectionReason
          ? `رفض الوكيل ${agentName} طلب سحبك. السبب: ${rejectionReason}\n${refundNote}`
          : `رفض الوكيل ${agentName} طلب سحبك.\n${refundNote}`;
      } else {
        body = rejectionReason
          ? `تم رفض طلب السحب. السبب: ${rejectionReason}\n${refundNote}`
          : `تم رفض طلب السحب.\n${refundNote}`;
      }
    }

    await notifyUser(uid, `${title}\n${body}`, {
      type: 'withdrawal_status',
      title,
      body,
      status: newStatus,
      withdrawalId,
      route: '/wallet/pearl-log',
      fromUid: processedBy || undefined,
      scenario: newStatus === 'completed' ? 'withdrawal_approved' : 'withdrawal_rejected',
    });
  },
);

/** تسجيل زيارة ملف شخصي — بدون إشعار (الزوار يُعرضون في صفحة الزوار فقط) */
export const recordProfileVisit = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  }

  const profileUid = String(request.data?.profileUid ?? '').trim();
  const visitorUid = request.auth.uid;
  if (!profileUid) {
    throw new HttpsError('invalid-argument', 'profileUid مطلوب');
  }
  if (profileUid === visitorUid) {
    return { ok: true, skipped: 'self' };
  }

  const ownerRef = db.collection('users').doc(profileUid);
  const ownerSnap = await ownerRef.get();
  if (!ownerSnap.exists) {
    return { ok: false, error: 'not_found' };
  }
  const ownerData = ownerSnap.data() ?? {};
  if (ownerData.privacyHideVisitors === true) {
    return { ok: true, hidden: true };
  }

  const [visitorSnap, vipSnap] = await Promise.all([
    db.collection('users').doc(visitorUid).get(),
    db.collection('config').doc('vipSystem').get(),
  ]);
  const visitorData = visitorSnap.data() ?? {};
  const privacy = (visitorData.privacySettings as Record<string, unknown> | undefined) ?? {};
  const wantsAnonymousVisit =
    visitorData.visitAnonymously === true || privacy.visitAnonymously === true;
  if (wantsAnonymousVisit) {
    const vipLevel = Number(visitorData.vipLevel ?? 0);
    const isVIP = visitorData.isVIP === true || vipLevel >= 1;
    const expiresAt =
      visitorData.vipExpiresAt != null ? Number(visitorData.vipExpiresAt) : null;
    const active = isVIP && (expiresAt === null || expiresAt > Date.now());
    const privileges =
      (vipSnap.exists
        ? (vipSnap.data()?.privileges as Array<Record<string, unknown>>)
        : []) ?? [];
    const priv = privileges.find(
      (p) => p?.assetKey === 'invisibleVisitor' && p?.enabled !== false,
    );
    const unlockLevel = priv ? Number(priv.unlockLevel ?? 9) : 9;
    if (active && vipLevel >= unlockLevel) {
      return { ok: true, hidden: true, by: 'invisibleVisitor' };
    }
  }
  const visitorName =
    (visitorData.displayName as string | undefined)?.trim() || 'مستخدم';

  const visitRef = db
    .collection('profileVisitors')
    .doc(profileUid)
    .collection('visits')
    .doc(visitorUid);
  const now = Date.now();

  await visitRef.set(
    {
      visitorUid,
      visitedAt: now,
      displayName: visitorName,
      avatar: (visitorData.avatar as string) ?? '',
      country: (visitorData.country as string) ?? '',
      level: (visitorData.level as number) ?? 1,
      isVIP: visitorData.isVIP === true,
    },
    { merge: true },
  );

  const visitsCol = db
    .collection('profileVisitors')
    .doc(profileUid)
    .collection('visits');
  const countSnap = await visitsCol.count().get();
  const total = countSnap.data().count;
  await ownerRef.update({
    visitors: total,
    'stats.visitors': total,
  });

  return { ok: true };
});

/**
 * تصحيح عدّاد زوار الملف — نسخ قديمة كانت تكتب وثيقة زيارة بمعرّف عشوائي
 * لكل زيارة (بدل وثيقة واحدة لكل زائر)، فتضخّم «إجمالي الزوار» بزيارات مكررة
 * لنفس الأشخاص. تدمج هذه الدالة الوثائق العشوائية في وثيقة الزائر القانونية
 * (id = visitorUid وبأحدث وقت زيارة)، تحذف المكرر والزيارات الذاتية،
 * ثم تعيد العدد الفريد الصحيح وتزامنه على وثيقة المستخدم.
 */
export const reconcileProfileVisitors = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const col = db.collection('profileVisitors').doc(uid).collection('visits');
  const snap = await col.get();

  const canonicalAt = new Map<string, number>();
  const strays: Array<{ id: string; data: FirebaseFirestore.DocumentData }> = [];
  snap.forEach((d) => {
    const data = d.data();
    const visitorUid = String(data.visitorUid ?? '');
    if (d.id === visitorUid && visitorUid) {
      canonicalAt.set(visitorUid, Number(data.visitedAt) || 0);
    } else {
      strays.push({ id: d.id, data });
    }
  });

  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (ops > 0) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  };

  for (const stray of strays) {
    const visitorUid = String(stray.data.visitorUid ?? '');
    const visitedAt = Number(stray.data.visitedAt) || 0;
    if (visitorUid && visitorUid !== uid) {
      const currentAt = canonicalAt.get(visitorUid) ?? 0;
      if (visitedAt > currentAt) {
        batch.set(
          col.doc(visitorUid),
          { ...stray.data, visitorUid, visitedAt },
          { merge: true },
        );
        ops += 1;
      }
      canonicalAt.set(visitorUid, Math.max(currentAt, visitedAt));
    }
    batch.delete(col.doc(stray.id));
    ops += 1;
    if (ops >= 400) await flush();
  }

  // زيارة ذاتية من نسخ قديمة — تُحذف ولا تُحسب
  if (canonicalAt.has(uid)) {
    batch.delete(col.doc(uid));
    ops += 1;
    canonicalAt.delete(uid);
  }
  await flush();

  const total = canonicalAt.size;
  await db
    .collection('users')
    .doc(uid)
    .update({ visitors: total, 'stats.visitors': total })
    .catch(() => {});

  return { ok: true, total };
});

/** Push + رنين عند مكالمة واردة (التطبيق مغلق/خلفية) */
export const pushOnIncomingCallCreated = onDocumentCreated(
  'incomingCalls/{targetUid}/calls/{callId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const call = snap.data();
    if (call.status !== 'ringing') return;

    const targetUid = event.params.targetUid;
    const callId = event.params.callId;

    try {
      const userSnap = await db.collection('users').doc(targetUid).get();
      const userData = userSnap.data() ?? {};
      const prefs = userData.notificationSettings as NotificationPrefs | undefined;
      if (prefs?.pushEnabled === false || prefs?.enabled === false || prefs?.calls === false) return;

      const fcmToken = userData.fcmToken as string | undefined;
      if (!fcmToken) return;

      // اسم المتصل من بروفايل التطبيق لا من هوية Auth — وثيقة المكالمة تُكتب
      // أولاً باسم حساب جوجل الحقيقي (للسرعة) والإشعار ينطلق قبل إثرائها
      let fromName = (call.fromName as string) || 'مستخدم';
      try {
        const callerUid = String(call.from ?? '');
        if (callerUid) {
          const callerSnap = await db.collection('users').doc(callerUid).get();
          const callerData = callerSnap.data() ?? {};
          const profileName = String(
            (callerData.profile as Record<string, unknown> | undefined)?.displayName ??
              callerData.displayName ??
              '',
          ).trim();
          if (profileName) fromName = profileName;
        }
      } catch {
        // نكتفي بالاسم المكتوب في الوثيقة
      }
      const callType = call.type === 'video' ? 'video' : 'voice';
      const title = fromName;
      const body =
        callType === 'video' ? 'مكالمة فيديو واردة 📹' : 'مكالمة صوتية واردة 📞';

      await admin.messaging().send({
        token: fcmToken,
        notification: { title, body },
        data: {
          type: 'incoming_call',
          notifType: 'incoming_call',
          callId,
          fromUid: String(call.from ?? ''),
          fromName,
          fromAvatar: String(call.fromAvatar ?? ''),
          channelName: String(call.channelName ?? ''),
          callType,
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'incoming_calls',
            priority: 'max',
            sound: 'default',
            visibility: 'public',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              alert: { title, body },
              'content-available': 1,
            },
          },
        },
      });
    } catch {
      /* token expired */
    }
  },
);

function countVerifiedHosts(hosts: Array<{ genderVerified?: boolean }>): number {
  return hosts.filter((h) => h.genderVerified === true).length;
}

const REVIEW_SLA_MS = 12 * 60 * 60 * 1000;
const HOST_DEADLINE_MS = 7 * 24 * 60 * 60 * 1000;

/** دول الخليج → فريق محلي، وإلا الإدارة العامة */
const GCC_COUNTRIES = new Set(['SA', 'AE', 'KW', 'QA', 'BH', 'OM']);

function resolveAssignedTeam(countryCode?: string): 'gcc' | 'global' {
  const c = (countryCode ?? '').trim().toUpperCase();
  if (GCC_COUNTRIES.has(c)) return 'gcc';
  return 'global';
}

function normalizeWhatsApp(phone: string, countryCode: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (phone.trim().startsWith('+')) return `+${digits}`;
  const cc = countryCode.trim().toUpperCase();
  const dial: Record<string, string> = {
    PS: '970',
    SA: '966',
    AE: '971',
    EG: '20',
    JO: '962',
    KW: '965',
    QA: '974',
    BH: '973',
    OM: '968',
  };
  const prefix = dial[cc];
  if (prefix && !digits.startsWith(prefix)) return `+${prefix}${digits}`;
  return `+${digits}`;
}

function isValidWhatsApp(phone: string, countryCode: string): boolean {
  const normalized = normalizeWhatsApp(phone, countryCode);
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

async function syncApplicationFemaleCount(agencyId: string, femaleCount: number, appStatus?: string) {
  const appQuery = await db
    .collection('agencyApplications')
    .where('agencyId', '==', agencyId)
    .limit(1)
    .get();
  if (appQuery.empty) return;
  const patch: Record<string, unknown> = { femaleHostCount: femaleCount, updatedAt: Date.now() };
  if (appStatus) patch.status = appStatus;
  await appQuery.docs[0].ref.update(patch);
}

/** تقديم طلب وكالة — من التطبيق أو بوت الدعم (نفس التحقق) */
export const submitAgencyApplication = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const {
    agencyName,
    countryCode,
    phone,
    minHostsRequired,
    source = 'app',
  } = request.data as {
    agencyName?: string;
    countryCode?: string;
    phone?: string;
    minHostsRequired?: number;
    source?: 'app' | 'support_bot';
  };

  if (!agencyName?.trim()) throw new HttpsError('invalid-argument', 'اسم الوكالة مطلوب');
  if (!phone?.trim()) throw new HttpsError('invalid-argument', 'رقم واتساب مطلوب');

  const cc = (countryCode ?? 'PS').trim().toUpperCase();
  const whatsapp = normalizeWhatsApp(phone, cc);
  if (!isValidWhatsApp(phone, cc)) {
    throw new HttpsError('invalid-argument', 'رقم واتساب غير صالح — أدخل رمز الدولة مع الرقم');
  }

  const minRequired = Math.max(10, Number(minHostsRequired) || 10);
  const now = Date.now();
  const bdConfig = await getBdReferralConfig();
  const pendingBdInvite = await findPendingBdInviteForUser(uid);

  const openSnap = await db
    .collection('agencyApplications')
    .where('applicantUid', '==', uid)
    .limit(12)
    .get();
  const hasOpen = openSnap.docs.some((d) =>
    ['pending', 'awaiting_hosts', 'ready'].includes(String(d.data().status)),
  );
  if (hasOpen) {
    throw new HttpsError('already-exists', 'لديك طلب وكالة قيد المعالجة بالفعل');
  }

  const ownerAgency = await db
    .collection('agencies')
    .where('ownerUid', '==', uid)
    .limit(3)
    .get();
  const hasLiveAgency = ownerAgency.docs.some((d) => String(d.data().status ?? '') !== 'expired');
  if (hasLiveAgency) {
    throw new HttpsError('already-exists', 'لديك وكالة مفعّلة أو قيد التفعيل');
  }

  const meSnap = await db.collection('users').doc(uid).get();
  if (!meSnap.exists) throw new HttpsError('not-found', 'حسابك غير موجود');
  const me = meSnap.data()!;

  const bdInviteDoc = pendingBdInvite;
  const bdInviteData = bdInviteDoc?.data() ?? null;
  const referrerAgencySnap = bdInviteData
    ? await db
        .collection('agencies')
        .where('ownerUid', '==', String(bdInviteData.fromUid ?? ''))
        .limit(1)
        .get()
    : null;
  const referrerAgencyId = referrerAgencySnap && !referrerAgencySnap.empty
    ? referrerAgencySnap.docs[0].id
    : String(bdInviteData?.fromAgencyId ?? '');

  const ref = await db.collection('agencyApplications').add({
    applicantUid: uid,
    applicantName: me.profile?.displayName ?? me.displayName ?? 'مقدم الطلب',
    applicantPublicAccountId: String(me.publicAccountId ?? ''),
    applicantPhone: whatsapp,
    whatsappNumber: whatsapp,
    countryCode: cc,
    agencyName: agencyName.trim(),
    status: 'pending',
    proposedHosts: [],
    proposedHostUids: [],
    minHostsRequired: minRequired,
    femaleHostCount: 0,
    inviteCode: '',
    hostsDeadline: 0,
    agencyId: '',
    assignedTeam: resolveAssignedTeam(cc),
    reviewDeadline: now + REVIEW_SLA_MS,
    source,
    ...(bdInviteDoc
      ? {
          bdInviteId: bdInviteDoc.id,
          referredByUid: String(bdInviteData?.fromUid ?? ''),
          referredByAgencyId: referrerAgencyId,
          bdCommissionPercent: Number(bdInviteData?.commissionPercent) || bdConfig.commissionPercent,
          bdBenefitMonths: Number(bdInviteData?.benefitMonths) || bdConfig.benefitMonths,
        }
      : {}),
    createdAt: now,
    updatedAt: now,
  });

  if (bdInviteDoc) {
    await bdInviteDoc.ref.update({
      status: 'applied',
      applicationId: ref.id,
      updatedAt: now,
    });
    const referrerUid = String(bdInviteData?.fromUid ?? '');
    if (referrerUid) {
      await notifyUser(
        referrerUid,
        `قدّم ${me.profile?.displayName ?? me.displayName ?? 'المستخدم'} طلب فتح وكالة بعد دعوتك من مركز BD`,
        { applicationId: ref.id, type: 'bd_agency_application_submitted' },
      );
    }
  }

  return { ok: true, applicationId: ref.id, reviewDeadline: now + REVIEW_SLA_MS };
});

/**
 * عضو يؤكد جنسه بعد الانضمام للوكالة.
 * الإناث: يحصلن على مزايا المضيفات ويُحتسبن ضمن الحد الأدنى.
 * الذكور: ينضمون كأعضاء عاديين بدون مزايا المضيفات ولا يُحتسبون.
 */
export const confirmAgencyHostGender = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  // إيجاد عضوية الوكالة (وكالة واحدة فقط)
  const memberQuery = await db
    .collection('agencyMembers')
    .where('uid', '==', uid)
    .limit(5)
    .get();
  if (memberQuery.empty) {
    throw new HttpsError('not-found', 'أنت لست عضواً في وكالة');
  }
  if (memberQuery.size > 1) {
    throw new HttpsError('failed-precondition', SINGLE_AGENCY_MSG);
  }
  const memberDoc = memberQuery.docs[0];
  const memberData = memberDoc.data();

  if (memberData.hostVerified === true) {
    return {
      ok: true,
      alreadyVerified: true,
      isFemaleHost: memberData.isFemaleHost === true,
    };
  }

  const { agencyId } = memberData as { agencyId: string };
  const agencyRef = db.collection('agencies').doc(agencyId);
  const agencySnap = await agencyRef.get();
  if (!agencySnap.exists) throw new HttpsError('not-found', 'الوكالة غير موجودة');
  const agency = agencySnap.data()!;

  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.data() ?? {};
  const userIsVerified = userData.isVerified === true;
  const gender: string =
    userData.profile?.gender ?? userData.gender ?? '';
  const isFemale = gender === 'female';
  const now = Date.now();

  const batch = db.batch();

  // تحديث سجل العضوية
  batch.update(memberDoc.ref, {
    hostVerified: isFemale && userIsVerified,
    isFemaleHost: isFemale,
    verifiedAt: (isFemale && userIsVerified) ? now : null,
    role: (isFemale && userIsVerified) ? 'host' : 'member',
  });

  // تحديث الملف الشخصي للمستخدم
  const userUpdate: Record<string, unknown> = {
    agencyRole: (isFemale && userIsVerified) ? 'host' : 'member',
    isFemaleHost: isFemale,
  };
  if (isFemale && userIsVerified) userUpdate.accountKind = 'host';
  else userUpdate.accountKind = 'member';
  batch.update(db.collection('users').doc(uid), userUpdate);

  let nextAppStatus: string | null = null;
  let appRef: FirebaseFirestore.DocumentReference | null = null;
  let newFemaleCount = Number(agency.femaleHostCount) || 0;

  if (isFemale && userIsVerified) {
    // زيادة عدد المضيفات الإناث الموثّقات على الوكالة
    newFemaleCount = (Number(agency.femaleHostCount) || 0) + 1;
    const minRequired = Number(agency.minHostsRequired) || 10;
    batch.update(agencyRef, { femaleHostCount: newFemaleCount, updatedAt: now });

    // تحديث طلب الوكالة المرتبط (إن وجد وكان في مرحلة awaiting_hosts)
    const appQuery = await db
      .collection('agencyApplications')
      .where('agencyId', '==', agencyId)
      .where('status', '==', 'awaiting_hosts')
      .limit(1)
      .get();
    if (!appQuery.empty) {
      appRef = appQuery.docs[0].ref;
      nextAppStatus = newFemaleCount >= minRequired ? 'ready' : 'awaiting_hosts';
      batch.update(appRef, {
        status: nextAppStatus,
        femaleHostCount: newFemaleCount,
        updatedAt: now,
      });
    }
  }

  await batch.commit();

  if (!appRef && isFemale) {
    await syncApplicationFemaleCount(agencyId, newFemaleCount, nextAppStatus ?? undefined);
  }

  // إشعار الوكيل عند الاكتمال
  if (nextAppStatus === 'ready' && agency.ownerUid) {
    await notifyUser(
      String(agency.ownerUid),
      `اكتمل عدد المضيفات لوكالة "${agency.name}" — في انتظار التفعيل من الإدارة`,
      { agencyId, type: 'agency_application_ready' },
    );
  }

  return { ok: true, isFemaleHost: isFemale, gender };
});

/**
 * أدمن: موافقة / رفض طلب وكالة
 */
export const reviewAgencyApplication = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  await assertAdmin(adminUid);

  const { applicationId, action, rejectionReason } = request.data as {
    applicationId?: string;
    action?: 'approve' | 'reject';
    rejectionReason?: string;
  };

  if (!applicationId || !action) {
    throw new HttpsError('invalid-argument', 'applicationId و action مطلوبان');
  }

  const appRef = db.collection('agencyApplications').doc(applicationId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) throw new HttpsError('not-found', 'الطلب غير موجود');
  const app = appSnap.data()!;
  await assertAdminCountryScope(adminUid, app.countryCode as string | undefined);
  await assertHasPermission(adminUid, 'agency-applications');

  if (action === 'reject') {
    await appRef.update({
      status: 'rejected',
      rejectionReason: rejectionReason?.trim() || 'تم رفض الطلب',
      approvedBy: adminUid,
      approvedAt: Date.now(),
      updatedAt: Date.now(),
    });
    if (app.applicantUid) {
      await notifyUser(
        app.applicantUid,
        `تم رفض طلب فتح الوكالة: ${rejectionReason || 'راجع الدعم'}`,
        { applicationId, type: 'agency_application_rejected' },
      );
    }
    return { ok: true, status: 'rejected' };
  }

  if (app.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'الطلب ليس قيد المراجعة');
  }

  const applicantUid = app.applicantUid as string;

  // التحقق من أنه لا توجد وكالة حالية للمستخدم
  const existingAgency = await db
    .collection('agencies')
    .where('ownerUid', '==', applicantUid)
    .limit(1)
    .get();
  if (!existingAgency.empty) {
    throw new HttpsError('already-exists', 'مقدم الطلب لديه وكالة بالفعل');
  }

  const inviteCode = Math.random().toString(36).slice(2, 8).toLowerCase();
  const hostsDeadline = Date.now() + HOST_DEADLINE_MS;
  const minHostsRequired = Number(app.minHostsRequired) || 10;
  const now = Date.now();

  // إنشاء وثيقة الوكالة في حالة pending (قبل التفعيل النهائي)
  const ownerSnap = await db.collection('users').doc(applicantUid).get();
  const ownerData = ownerSnap.data() ?? {};
  const agencyRef = db.collection('agencies').doc();

  const approvalBatch = db.batch();

  const bdReferralFields = app.referredByUid
    ? {
        referredByUid: String(app.referredByUid),
        referredByAgencyId: String(app.referredByAgencyId ?? ''),
        bdInviteId: String(app.bdInviteId ?? ''),
        bdCommissionPercent: Number(app.bdCommissionPercent) || 0,
        bdBenefitMonths: Number(app.bdBenefitMonths) || 0,
        bdBenefitStartsAt: 0,
        bdBenefitEndsAt: 0,
      }
    : {};

  approvalBatch.set(agencyRef, {
    name: app.agencyName,
    ownerUid: applicantUid,
    ownerName: app.applicantName ?? ownerData.profile?.displayName ?? ownerData.displayName ?? 'الوكيل',
    ownerAvatar: ownerData.profile?.avatar ?? ownerData.avatar ?? '',
    description: '',
    country: app.countryCode ?? '',
    inviteCode,
    memberCount: 0,
    members: 0,
    femaleHostCount: 0,
    minHostsRequired,
    totalEarnings: 0,
    earnings: 0,
    isVerified: false,
    status: 'pending', // لم تُفعَّل بعد
    hostsDeadline,
    ...bdReferralFields,
    createdAt: now,
    updatedAt: now,
  });

  approvalBatch.update(appRef, {
    status: 'awaiting_hosts',
    approvedBy: adminUid,
    approvedAt: now,
    hostsDeadline,
    agencyId: agencyRef.id,
    inviteCode,
    femaleHostCount: 0,
    updatedAt: now,
  });

  // منح الوكيل معرّف الوكالة مبكراً (ليرى مركز الوكالة في التطبيق)
  approvalBatch.update(db.collection('users').doc(applicantUid), {
    agencyId: agencyRef.id,
    agencyName: String(app.agencyName),
    agencyRole: 'owner',
    isAgent: true,
    accountKind: 'agent',
  });

  await approvalBatch.commit();

  if (app.applicantUid) {
    await notifyUser(
      app.applicantUid,
      `تمت الموافقة على طلب وكالتك "${app.agencyName}" — كود الدعوة: ${inviteCode} (لديك 7 أيام لاستكمال العدد)`,
      { applicationId, agencyId: agencyRef.id, inviteCode, type: 'agency_application_approved' },
    );
  }

  return { ok: true, status: 'awaiting_hosts', agencyId: agencyRef.id, inviteCode };
});

/**
 * أدمن: توثيق مضيفة يدوياً
 */
export const adminVerifyAgencyHost = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  await assertAdmin(adminUid);

  const { applicationId, hostUid } = request.data as {
    applicationId?: string;
    hostUid?: string;
  };
  if (!applicationId || !hostUid) {
    throw new HttpsError('invalid-argument', 'applicationId و hostUid مطلوبان');
  }

  const appRef = db.collection('agencyApplications').doc(applicationId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) throw new HttpsError('not-found', 'الطلب غير موجود');
  const app = appSnap.data()!;
  await assertAdminCountryScope(adminUid, app.countryCode as string | undefined);
  await assertHasPermission(adminUid, 'users');

  if (!['awaiting_hosts', 'ready'].includes(app.status)) {
    throw new HttpsError('failed-precondition', 'مرحلة الطلب لا تسمح بالتوثيق');
  }

  if (!app.agencyId) {
    throw new HttpsError('failed-precondition', 'لم يُنشأ سجل الوكالة بعد');
  }

  const now = Date.now();

  // البحث عن سجل العضو في agencyMembers
  const memberSnap = await db
    .collection('agencyMembers')
    .where('agencyId', '==', String(app.agencyId))
    .where('uid', '==', hostUid)
    .limit(1)
    .get();

  if (memberSnap.empty) {
    throw new HttpsError('not-found', 'المضيف غير موجود في أعضاء الوكالة');
  }

  const memberRef = memberSnap.docs[0].ref;
  const memberData = memberSnap.docs[0].data();

  if (memberData.hostVerified && memberData.isFemaleHost) {
    throw new HttpsError('already-exists', 'تم توثيق هذه المضيفة مسبقاً');
  }

  const hostUserSnap = await db.collection('users').doc(hostUid).get();
  const hostGender =
    hostUserSnap.data()?.profile?.gender ?? hostUserSnap.data()?.gender ?? '';
  if (hostGender !== 'female') {
    throw new HttpsError(
      'failed-precondition',
      'التوثيق اليدوي للمضيفات الإناث فقط — الذكور يوثّقون أنفسهم من التطبيق',
    );
  }

  const agencyRef = db.collection('agencies').doc(String(app.agencyId));
  const agencySnap = await agencyRef.get();
  if (!agencySnap.exists) throw new HttpsError('not-found', 'الوكالة غير موجودة');
  const agency = agencySnap.data()!;

  const newFemaleCount = (Number(agency.femaleHostCount) || 0) + 1;
  const minRequired = Number(app.minHostsRequired) || 10;
  const nextStatus = newFemaleCount >= minRequired ? 'ready' : app.status;

  const batch = db.batch();
  batch.update(memberRef, {
    hostVerified: true,
    isFemaleHost: true,
    role: 'host',
    verifiedAt: now,
    verifiedBy: 'admin',
  });
  batch.update(db.collection('users').doc(hostUid), {
    agencyRole: 'host',
    isFemaleHost: true,
    accountKind: 'host',
    isVerified: true,
  });
  batch.update(agencyRef, {
    femaleHostCount: newFemaleCount,
    updatedAt: now,
  });
  batch.update(appRef, {
    status: nextStatus,
    femaleHostCount: newFemaleCount,
    updatedAt: now,
  });
  await batch.commit();

  if (nextStatus === 'ready' && app.applicantUid) {
    await notifyUser(
      String(app.applicantUid),
      `اكتمل عدد المضيفات لوكالة "${app.agencyName}" — يمكنك تفعيلها من الإدارة`,
      { agencyId: String(app.agencyId), type: 'agency_application_ready' },
    );
  }

  return { ok: true, femaleHostCount: newFemaleCount, status: nextStatus };
});

/**
 * أدمن: تفعيل الوكالة (التي أُنشئت عند الموافقة بحالة pending)
 */
export const activateAgencyApplication = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  await assertAdmin(adminUid);

  const { applicationId } = request.data as { applicationId?: string };
  if (!applicationId) throw new HttpsError('invalid-argument', 'applicationId مطلوب');

  const appRef = db.collection('agencyApplications').doc(applicationId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) throw new HttpsError('not-found', 'الطلب غير موجود');
  const app = appSnap.data()!;
  await assertAdminCountryScope(adminUid, app.countryCode as string | undefined);
  await assertHasPermission(adminUid, 'agency-applications');

  if (!['awaiting_hosts', 'ready'].includes(app.status)) {
    throw new HttpsError('failed-precondition', 'الطلب غير جاهز للتفعيل');
  }

  if (!app.agencyId) {
    throw new HttpsError('failed-precondition', 'لم يتم إنشاء وثيقة الوكالة — راجع خطوة الموافقة');
  }

  const agencyRef = db.collection('agencies').doc(String(app.agencyId));
  const agencySnap = await agencyRef.get();
  if (!agencySnap.exists) {
    throw new HttpsError('not-found', 'وثيقة الوكالة غير موجودة');
  }
  const agency = agencySnap.data()!;

  // فحص عدد المضيفات الإناث الموثّقات
  const femaleCount = Number(agency.femaleHostCount) || 0;
  const minRequired = Number(agency.minHostsRequired) || 10;
  if (femaleCount < minRequired) {
    throw new HttpsError(
      'failed-precondition',
      `يلزم ${minRequired} مضيفات إناث موثّقات (الحالي: ${femaleCount})`,
    );
  }

  const now = Date.now();
  const applicantUid = String(app.applicantUid);
  const benefitMonths = Number(agency.bdBenefitMonths) || Number(app.bdBenefitMonths) || 0;
  const agencyPatch: Record<string, unknown> = {
    status: 'active',
    isVerified: true,
    updatedAt: now,
  };
  if (agency.referredByUid && benefitMonths > 0 && !Number(agency.bdBenefitStartsAt)) {
    agencyPatch.bdBenefitStartsAt = now;
    agencyPatch.bdBenefitEndsAt = addCalendarMonths(now, benefitMonths);
  }

  const batch = db.batch();
  batch.update(agencyRef, agencyPatch);
  batch.update(appRef, {
    status: 'active',
    updatedAt: now,
  });

  await batch.commit();

  await finalizeBdReferralOnActivation(String(app.agencyId), { ...agency, ...agencyPatch }, app);

  await ensureAgencyLiveRoom(String(app.agencyId));

  await notifyUser(
    applicantUid,
    `تم تفعيل وكالتك "${app.agencyName}" بنجاح 🎉`,
    { agencyId: String(app.agencyId), type: 'agency_activated' },
  );

  return {
    ok: true,
    agencyId: String(app.agencyId),
    inviteCode: String(agency.inviteCode ?? ''),
    members: femaleCount,
  };
});

type HostRow = {
  uid: string;
  displayName?: string;
  avatar?: string;
  genderVerified?: boolean;
};

/** حسابات قديمة بدون publicAccountId محفوظ */
async function resolveUidByLegacyPublicId(publicId: string): Promise<string | null> {
  const PAGE = 400;
  let lastId: string | undefined;
  for (let page = 0; page < 30; page++) {
    let q = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
    if (lastId) q = q.startAfter(lastId);
    const snap = await q.get();
    if (snap.empty) break;
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const stored =
        data.publicAccountId != null && String(data.publicAccountId).trim() !== ''
          ? normalizeStoredPublicAccountId(data.publicAccountId)
          : null;
      const effective = stored ?? generatePublicAccountId(docSnap.id);
      if (effective === publicId) {
        if (!stored) {
          await docSnap.ref.update({
            publicAccountId: publicId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        await db.collection('publicAccountIndex').doc(publicId).set(
          { uid: docSnap.id, updatedAt: Date.now() },
          { merge: true },
        );
        return docSnap.id;
      }
    }
    lastId = snap.docs[snap.docs.length - 1]?.id;
    if (snap.size < PAGE) break;
  }
  return null;
}

async function resolveUserUid(raw: string): Promise<string | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9]{20,}$/.test(trimmed)) {
    const snap = await db.collection('users').doc(trimmed).get();
    if (snap.exists) return snap.id;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  const publicId = normalizePublicAccountId(digits);

  const indexSnap = await db.collection('publicAccountIndex').doc(publicId).get();
  if (indexSnap.exists) {
    const indexedUid = String(indexSnap.data()?.uid ?? '');
    if (indexedUid) {
      const userExists = await db.collection('users').doc(indexedUid).get();
      if (userExists.exists) return indexedUid;
    }
  }

  const fromField = await queryUidByPublicAccountIdField(publicId);
  if (fromField) {
    await syncPublicAccountIndexForUid(publicId, fromField);
    return fromField;
  }

  const legacy = await resolveUidByLegacyPublicId(publicId);
  if (legacy) return legacy;

  return null;
}

/** غرفة صوت عامة للوكالة — يستمع الجميع (المصادقون) */
async function ensureAgencyLiveRoom(agencyId: string): Promise<string> {
  const agencySnap = await db.collection('agencies').doc(agencyId).get();
  if (!agencySnap.exists) {
    throw new HttpsError('not-found', 'الوكالة غير موجودة');
  }
  const agency = agencySnap.data()!;
  const ownerUid = String(agency.ownerUid ?? '');
  if (!ownerUid) {
    throw new HttpsError('failed-precondition', 'الوكالة بدون وكيل');
  }

  let roomId = agency.liveRoomId ? String(agency.liveRoomId) : '';
  if (roomId) {
    const existing = await rtdb.ref(`rooms/${roomId}`).once('value');
    if (existing.exists()) return roomId;
  }

  const ownerSnap = await db.collection('users').doc(ownerUid).get();
  const owner = ownerSnap.data() ?? {};
  const hostName = String(
    agency.ownerName ?? owner.profile?.displayName ?? owner.displayName ?? 'وكيل',
  );
  const hostAvatar = String(
    agency.ownerAvatar ?? owner.profile?.avatar ?? owner.avatar ?? '',
  );
  const banner = String(
    agency.banner ?? hostAvatar ?? `https://picsum.photos/seed/agency-${agencyId}/400/200`,
  );

  const newRef = rtdb.ref('rooms').push();
  roomId = newRef.key!;
  const seatsCount = Number(agency.maxSeatsCount) || 9;
  const seats: Record<string, unknown> = {};
  for (let i = 0; i < seatsCount; i++) {
    if (i === 0) {
      seats[`seat_${i}`] = {
        uid: ownerUid,
        displayName: hostName,
        avatar: hostAvatar || `https://picsum.photos/seed/${ownerUid}/200`,
        isMuted: false,
        joinedAt: Date.now(),
      };
    } else {
      seats[`seat_${i}`] = { uid: '' };
    }
  }

  await newRef.set({
    name: String(agency.name ?? 'وكالة'),
    hostUid: ownerUid,
    hostName,
    hostAvatar: hostAvatar || `https://picsum.photos/seed/${ownerUid}/200`,
    country: String(agency.country ?? 'PS'),
    category: 'arabic',
    banner,
    isPrivate: false,
    password: '',
    seatsCount,
    maxSeatsCount: seatsCount,
    seats,
    audienceCount: 0,
    totalGifts: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isActive: true,
    agencyId,
    isAgencyRoom: true,
  });

  await agencySnap.ref.update({
    liveRoomId: roomId,
    updatedAt: Date.now(),
  });

  return roomId;
}

async function provisionAgency(params: {
  ownerUid: string;
  ownerName: string;
  ownerAvatar?: string;
  agencyName: string;
  countryCode?: string;
  hosts: HostRow[];
  applicationRef?: DocumentReference;
}): Promise<{ agencyId: string; inviteCode: string; members: number }> {
  const existingAgency = await db
    .collection('agencies')
    .where('ownerUid', '==', params.ownerUid)
    .limit(1)
    .get();
  if (!existingAgency.empty) {
    const existing = existingAgency.docs[0];
    const status = String(existing.data()?.status ?? 'active');
    throw new HttpsError(
      'already-exists',
      `المستخدم لديه وكالة بالفعل (${existing.id} — الحالة: ${status}). استخدم «تفعيل فوري» إن كان من طلب سابق.`,
    );
  }
  await assertSingleAgencyMembership(params.ownerUid);

  const inviteCode = Math.random().toString(36).slice(2, 8).toLowerCase();
  const agencyRef = db.collection('agencies').doc();
  const now = Date.now();
  const hosts = params.hosts.filter((h) => h.uid && h.uid !== params.ownerUid);

  const batch = db.batch();

  const ownerAvatar = params.ownerAvatar ?? '';
  batch.set(agencyRef, {
    name: params.agencyName,
    ownerUid: params.ownerUid,
    ownerName: params.ownerName,
    ownerAvatar,
    description: '',
    country: params.countryCode ?? '',
    inviteCode,
    memberCount: hosts.length,
    members: hosts.length,
    totalEarnings: 0,
    earnings: 0,
    rank: now % 10000,
    banner: ownerAvatar || `https://picsum.photos/seed/${agencyRef.id}/400/200`,
    logo: ownerAvatar,
    rating: 5,
    isHiring: true,
    isVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  batch.update(db.collection('users').doc(params.ownerUid), {
    agencyId: agencyRef.id,
    agencyName: params.agencyName,
    agencyRole: 'owner',
    isAgent: true,
    accountKind: 'agent',
  });

  if (params.applicationRef) {
    batch.update(params.applicationRef, {
      status: 'active',
      agencyId: agencyRef.id,
      updatedAt: now,
    });
  }

  for (const h of hosts) {
    await assertSingleAgencyMembership(h.uid);
    const memberRef = db.collection('agencyMembers').doc();
    batch.set(memberRef, {
      uid: h.uid,
      uidName: h.displayName ?? 'مضيفة',
      uidAvatar: h.avatar ?? '',
      agencyId: agencyRef.id,
      agencyName: params.agencyName,
      role: 'host',
      pearlsEarned: 0,
      pearlsTransferredToAgent: 0,
      joinedAt: now,
    });
    batch.update(db.collection('users').doc(h.uid), {
      agencyId: agencyRef.id,
      agencyName: params.agencyName,
      agencyRole: 'member',
      accountKind: 'host',
    });
  }

  await batch.commit();

  try {
    await notifyUser(
      params.ownerUid,
      `تم فتح وكالتك "${params.agencyName}" — صلاحيات الوكيل مفعّلة`,
      { agencyId: agencyRef.id, type: 'agency_activated' },
    );

    for (const h of hosts) {
      await notifyUser(
        h.uid,
        `انضممتِ لوكالة "${params.agencyName}"`,
        { agencyId: agencyRef.id, type: 'agency_joined' },
      );
    }
  } catch (err) {
    console.error('provisionAgency: notifyUser failed', agencyRef.id, err);
  }

  try {
    await ensureAgencyLiveRoom(agencyRef.id);
  } catch (err) {
    console.error('provisionAgency: ensureAgencyLiveRoom failed', agencyRef.id, err);
  }

  return { agencyId: agencyRef.id, inviteCode, members: hosts.length };
}

/**
 * أدمن: إنشاء وكالة مباشرة لأي مستخدم (كل الصلاحيات — بدون اشتراط 10 مضيفات)
 */
export const adminCreateAgencyDirect = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  await assertAdmin(adminUid);

  const { ownerUid, agencyName, countryCode, hostUids, applicationId } = request.data as {
    ownerUid?: string;
    agencyName?: string;
    countryCode?: string;
    hostUids?: string[];
    applicationId?: string;
  };

  if (!ownerUid?.trim() || !agencyName?.trim()) {
    throw new HttpsError('invalid-argument', 'ownerUid و agencyName مطلوبان');
  }

  const resolvedOwner = (await resolveUserUid(ownerUid.trim())) ?? ownerUid.trim();
  const ownerSnap = await db.collection('users').doc(resolvedOwner).get();
  if (!ownerSnap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');
  const ownerData = ownerSnap.data()!;
  const agencyCountry = (
    countryCode?.trim().toUpperCase() || userCountryFromDoc(ownerData)
  );
  await assertAdminCountryScope(adminUid, agencyCountry);
  await assertHasPermission(adminUid, 'agencies');

  const hosts: HostRow[] = [];
  const rawHosts = [...new Set((hostUids ?? []).map((u) => u.trim()).filter(Boolean))];
  for (const raw of rawHosts) {
    const uid = (await resolveUserUid(raw)) ?? raw;
    if (uid === resolvedOwner) continue;
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) throw new HttpsError('not-found', `مضيفة غير موجودة: ${raw}`);
    const d = snap.data()!;
    hosts.push({
      uid,
      displayName: d.profile?.displayName ?? d.displayName ?? 'مضيفة',
      avatar: d.profile?.avatar ?? d.avatar ?? '',
      genderVerified: true,
    });
  }

  let applicationRef: DocumentReference | undefined;
  if (applicationId) {
    applicationRef = db.collection('agencyApplications').doc(applicationId);
    const appSnap = await applicationRef.get();
    if (!appSnap.exists) throw new HttpsError('not-found', 'طلب الوكالة غير موجود');
    await assertAdminCountryScope(
      adminUid,
      String(appSnap.data()?.countryCode ?? agencyCountry),
    );
  }

  const result = await provisionAgency({
    ownerUid: resolvedOwner,
    ownerName: ownerData.profile?.displayName ?? ownerData.displayName ?? 'الوكيل',
    ownerAvatar: ownerData.profile?.avatar ?? ownerData.avatar ?? '',
    agencyName: agencyName.trim(),
    countryCode: countryCode?.trim().toUpperCase(),
    hosts,
    applicationRef,
  });

  return { ok: true, ...result };
});

/**
 * أدمن: تفعيل فوري — يفعّل الوكالة مباشرة بصرف النظر عن عدد المضيفات
 */
export const adminExpressActivateApplication = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  await assertAdmin(adminUid);

  const { applicationId } = request.data as { applicationId?: string };
  if (!applicationId) throw new HttpsError('invalid-argument', 'applicationId مطلوب');

  const appRef = db.collection('agencyApplications').doc(applicationId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) throw new HttpsError('not-found', 'الطلب غير موجود');
  const app = appSnap.data()!;
  await assertAdminCountryScope(adminUid, app.countryCode as string | undefined);
  await assertHasPermission(adminUid, 'agency-applications');

  if (app.status === 'active') {
    throw new HttpsError('already-exists', 'الطلب مفعّل مسبقاً');
  }
  if (['rejected', 'expired'].includes(String(app.status))) {
    throw new HttpsError('failed-precondition', 'الطلب مرفوض أو منتهي الصلاحية');
  }

  const now = Date.now();

  // إذا كانت الوكالة موجودة (أُنشئت عند الموافقة) فقط فعّلها
  if (app.agencyId) {
    const agencyRef = db.collection('agencies').doc(String(app.agencyId));
    const agencySnap = await agencyRef.get();
    if (agencySnap.exists) {
      const agency = agencySnap.data()!;
      const benefitMonths = Number(agency.bdBenefitMonths) || Number(app.bdBenefitMonths) || 0;
      const agencyPatch: Record<string, unknown> = {
        status: 'active',
        isVerified: true,
        updatedAt: now,
      };
      if (agency.referredByUid && benefitMonths > 0 && !Number(agency.bdBenefitStartsAt)) {
        agencyPatch.bdBenefitStartsAt = now;
        agencyPatch.bdBenefitEndsAt = addCalendarMonths(now, benefitMonths);
      }
      const batch = db.batch();
      batch.update(agencyRef, agencyPatch);
      batch.update(appRef, { status: 'active', updatedAt: now });
      await batch.commit();
      await finalizeBdReferralOnActivation(
        String(app.agencyId),
        { ...agency, ...agencyPatch },
        app,
      );
      await ensureAgencyLiveRoom(String(app.agencyId));
      await notifyUser(
        String(app.applicantUid),
        `تم تفعيل وكالتك "${app.agencyName}" فورياً`,
        { agencyId: String(app.agencyId), type: 'agency_activated' },
      );
      return { ok: true, agencyId: String(app.agencyId), express: true };
    }
  }

  // الحالة الاحتياطية: إنشاء الوكالة الآن (إذا فاتت خطوة الموافقة)
  const applicantUid = String(app.applicantUid);
  const ownerSnap = await db.collection('users').doc(applicantUid).get();
  const ownerData = ownerSnap.data() ?? {};
  const result = await provisionAgency({
    ownerUid: applicantUid,
    ownerName: ownerData.profile?.displayName ?? ownerData.displayName ?? String(app.applicantName ?? 'الوكيل'),
    ownerAvatar: ownerData.profile?.avatar ?? ownerData.avatar ?? '',
    agencyName: String(app.agencyName),
    countryCode: String(app.countryCode ?? ''),
    hosts: [],
    applicationRef: appRef,
  });

  return { ok: true, ...result, express: true };
});

/**
 * عضو يقبل دعوة مباشرة من الوكيل (عبر الإشعار)
 */
export const acceptDirectAgencyInvite = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { inviteId } = request.data as { inviteId?: string };
  if (!inviteId?.trim()) throw new HttpsError('invalid-argument', 'inviteId مطلوب');

  const inviteRef = db.collection('agencyInvites').doc(inviteId.trim());
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) throw new HttpsError('not-found', 'الدعوة غير موجودة');
  const invite = inviteSnap.data()!;

  if (invite.invitedUid !== uid) {
    throw new HttpsError('permission-denied', 'هذه الدعوة ليست لك');
  }
  if (invite.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'الدعوة منتهية أو مقبولة مسبقاً');
  }

  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'حسابك غير موجود');
  const userData = userSnap.data()!;

  const agencyRef = db.collection('agencies').doc(String(invite.agencyId));
  const agencySnap = await agencyRef.get();
  if (!agencySnap.exists) throw new HttpsError('not-found', 'الوكالة غير موجودة');
  const agency = agencySnap.data()!;

  if (['expired', 'rejected'].includes(String(agency.status ?? ''))) {
    throw new HttpsError('failed-precondition', 'هذه الوكالة غير متاحة للانضمام');
  }
  await assertUserCanJoinAgency(uid, String(invite.agencyId));

  const now = Date.now();
  const memberRef = db.collection('agencyMembers').doc();
  const joinFields = agencyMemberFieldsOnVerifiedJoin(
    uid,
    userData,
    String(invite.agencyId),
    String(invite.agencyName ?? ''),
    now,
  );

  await db.runTransaction(async (tx) => {
    await assertUserCanJoinAgencyTx(tx, uid, String(invite.agencyId));
    tx.set(memberRef, joinFields.member);
    tx.update(userSnap.ref, joinFields.userPatch);
    const agencyPatch: Record<string, unknown> = {
      memberCount: (Number(agency.memberCount) || 0) + 1,
      updatedAt: now,
    };
    if (joinFields.isFemaleVerifiedHost) {
      agencyPatch.femaleHostCount = (Number(agency.femaleHostCount) || 0) + 1;
    }
    tx.update(agencyRef, agencyPatch);
    tx.update(inviteRef, { status: 'accepted', updatedAt: now });
  });

  const hostName = String(
    userData.profile?.displayName ?? userData.displayName ?? 'مضيف',
  );
  const agencyLabel = String(agency.name ?? invite.agencyName ?? 'الوكالة');
  const agentUid = String(invite.agentUid ?? agency.ownerUid ?? '');

  try {
    if (agentUid && agentUid !== uid) {
      await notifyUser(
        agentUid,
        `انضمت "${hostName}" لوكالتك "${agencyLabel}"`,
        {
          type: 'agency_host_joined',
          agencyId: String(invite.agencyId),
          agencyName: agencyLabel,
          title: 'عضو جديد في الوكالة',
          body: `قبلت "${hostName}" دعوتك وانضمت إلى "${agencyLabel}"`,
          route: '/agency/members',
          fromUid: uid,
          fromName: hostName,
          fromAvatar: userData.profile?.avatar ?? userData.avatar ?? '',
          // #10: وقت الموافقة — يظهر للوكيل مع اسم المضيفة
          acceptedAt: now,
        },
      );
    }
    await notifyUser(
      uid,
      joinFields.isFemaleVerifiedHost
        ? `انضممت إلى وكالة "${agencyLabel}" كمضيفة موثّقة`
        : `انضممت إلى وكالة "${agencyLabel}"`,
      { type: 'agency_joined', agencyId: String(invite.agencyId) },
    );
  } catch (err) {
    console.error('acceptDirectAgencyInvite: notifyUser failed', inviteId, err);
  }

  return {
    ok: true,
    agencyId: String(invite.agencyId),
    agencyName: String(invite.agencyName ?? ''),
    needsHostVerification: agencyInviteNeedsHostVerification(userData),
    needsGenderVerification: agencyInviteNeedsHostVerification(userData),
  };
});

/**
 * دالة مجدولة: إغلاق الوكالات التي انتهت مهلة 7 أيام دون استيفاء الحد الأدنى
 */
export const checkExpiredAgencyApplications = onSchedule(
  { schedule: 'every 24 hours', region: 'us-central1', timeoutSeconds: 300 },
  async () => {
    const now = Date.now();
    const snap = await db
      .collection('agencyApplications')
      .where('status', '==', 'awaiting_hosts')
      .limit(500)
      .get();

    for (const doc of snap.docs) {
      const app = doc.data();
      if (['ready', 'active'].includes(String(app.status))) continue;

      const deadline = Number(app.hostsDeadline) || 0;
      if (deadline <= 0 || now <= deadline) continue;

      // لا نُغلق إن اكتمل عدد المضيفات — نترك التفعيل اليدوي يتم
      if (app.agencyId) {
        const agencySnap = await db.collection('agencies').doc(String(app.agencyId)).get();
        if (agencySnap.exists) {
          const agencyData = agencySnap.data()!;
          const femaleCount = Number(agencyData.femaleHostCount) || 0;
          const minRequired = Number(agencyData.minHostsRequired) || Number(app.minHostsRequired) || 10;
          if (femaleCount >= minRequired) continue;
        }
      }

      const batch = db.batch();
      batch.update(doc.ref, { status: 'expired', updatedAt: now });

      // إغلاق الوكالة المرتبطة إن وُجدت
      if (app.agencyId) {
        const agencyRef = db.collection('agencies').doc(String(app.agencyId));
        batch.update(agencyRef, { status: 'expired', updatedAt: now });
        // إلغاء ربط الوكيل بالوكالة
        batch.update(db.collection('users').doc(String(app.applicantUid)), {
          agencyId: null,
          agencyName: null,
          agencyRole: null,
          isAgent: false,
          accountKind: 'user',
        });
      }

      await batch.commit();

      if (app.applicantUid) {
        await notifyUser(
          String(app.applicantUid),
          `انتهت مهلة 7 أيام دون استيفاء الحد الأدنى من المضيفات — تم إغلاق طلب وكالة "${app.agencyName}"`,
          { type: 'agency_application_expired' },
        );
      }
    }
  },
);

// ==================== VIP REMINDERS (مجدول) ====================

type VipLevelRow = {
  level: number;
  label: string;
  maintainPoints: number;
};

type VipSystemRow = {
  levels: VipLevelRow[];
  downgradeToLevel: number;
  expiryWarningDays: number;
};

const DEFAULT_VIP_LEVELS: VipLevelRow[] = [
  { level: 1, label: 'SVIP1', maintainPoints: 5_000 },
  { level: 2, label: 'SVIP2', maintainPoints: 20_000 },
  { level: 3, label: 'SVIP3', maintainPoints: 40_000 },
  { level: 4, label: 'SVIP4', maintainPoints: 80_000 },
  { level: 5, label: 'SVIP5', maintainPoints: 150_000 },
  { level: 6, label: 'SVIP6', maintainPoints: 300_000 },
  { level: 7, label: 'SVIP7', maintainPoints: 600_000 },
  { level: 8, label: 'SVIP8', maintainPoints: 1_500_000 },
  { level: 9, label: 'SVIP9', maintainPoints: 3_000_000 },
  { level: 10, label: 'SVIP10', maintainPoints: 6_000_000 },
  { level: 11, label: 'SVIP11', maintainPoints: 15_000_000 },
  { level: 12, label: 'SVIP12', maintainPoints: 30_000_000 },
];

function vipMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function vipTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadVipSystemConfig(): Promise<VipSystemRow> {
  const snap = await db.collection('config').doc('vipSystem').get();
  if (!snap.exists) {
    return { levels: DEFAULT_VIP_LEVELS, downgradeToLevel: 1, expiryWarningDays: 5 };
  }
  const raw = snap.data() ?? {};
  const levels = Array.isArray(raw.levels) && raw.levels.length
    ? (raw.levels as VipLevelRow[])
    : DEFAULT_VIP_LEVELS;
  return {
    levels,
    downgradeToLevel: Number(raw.downgradeToLevel) || 1,
    expiryWarningDays: Number(raw.expiryWarningDays) || 5,
  };
}

function vipLevelDef(level: number, levels: VipLevelRow[]): VipLevelRow | undefined {
  return levels.find((l) => l.level === level);
}

function vipEffectiveMonthPoints(monthPoints: number, monthKey?: string): number {
  return monthKey === vipMonthKey() ? monthPoints : 0;
}

function vipPointsToMaintain(
  level: number,
  monthPoints: number,
  levels: VipLevelRow[],
  monthKey?: string,
): { required: number; remaining: number; canMaintain: boolean } {
  const def = vipLevelDef(level, levels);
  if (!def) return { required: 0, remaining: 0, canMaintain: false };
  const effective = vipEffectiveMonthPoints(monthPoints, monthKey);
  const required = def.maintainPoints;
  const remaining = Math.max(0, required - effective);
  return { required, remaining, canMaintain: effective >= required };
}

async function sendVipReminderOnce(
  uid: string,
  dedupeKey: string,
  title: string,
  body: string,
  scenario: string,
  route: string,
  period: 'day' | 'month' = 'day',
): Promise<boolean> {
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return false;

  const log = (userSnap.data()?.vipNotifLog ?? {}) as Record<string, number>;
  const fullKey = period === 'month'
    ? `${dedupeKey}_${vipMonthKey()}`
    : `${dedupeKey}_${vipTodayKey()}`;
  if (log[fullKey]) return false;

  await db.collection('notifications').add({
    uid,
    type: 'system',
    message: `${title}\n${body}`,
    data: {
      type: 'vip_status',
      scenario,
      title,
      body,
      route,
    },
    isRead: false,
    createdAt: Date.now(),
  });

  await userRef.set(
    { [`vipNotifLog.${fullKey}`]: Date.now(), updatedAt: Date.now() },
    { merge: true },
  );
  return true;
}

async function processVipRemindersForUser(
  uid: string,
  data: FirebaseFirestore.DocumentData,
  config: VipSystemRow,
): Promise<void> {
  const level = Number(data.vipLevel ?? 0);
  if (level < 1) return;

  const def = vipLevelDef(level, config.levels);
  if (!def) return;

  const expires = data.vipExpiresAt != null ? Number(data.vipExpiresAt) : null;
  const now = Date.now();
  const warningDays = config.expiryWarningDays;
  const daysUntilExpiry = expires ? Math.ceil((expires - now) / 86400000) : null;

  const maintain = vipPointsToMaintain(
    level,
    Number(data.vipPointsMonth ?? 0),
    config.levels,
    data.vipMonthKey as string | undefined,
  );

  const downgradeLabel =
    vipLevelDef(config.downgradeToLevel, config.levels)?.label ?? 'SVIP1';

  if (
    daysUntilExpiry !== null
    && daysUntilExpiry > 0
    && daysUntilExpiry <= warningDays
    && !maintain.canMaintain
  ) {
    await sendVipReminderOnce(
      uid,
      'expiry_warning',
      'باقة SVIP على وشك الانتهاء',
      `تبقى ${daysUntilExpiry} يوم على انتهاء ${def.label}. اشحن الآن للحفاظ على مستواك.`,
      'expiry_warning',
      '/wallet/recharge',
    );
    return;
  }

  if (level >= 1 && !maintain.canMaintain && maintain.remaining > 0) {
    await sendVipReminderOnce(
      uid,
      'maintain_reminder',
      'حافظ على مستوى SVIP',
      `تحتاج ${maintain.remaining.toLocaleString('en-US')} نقطة شحن للحفاظ على ${def.label} وإلا سينخفض مستواك إلى ${downgradeLabel}.`,
      'maintain_reminder',
      '/wallet/recharge',
    );

    const d = new Date();
    const daysLeftInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate();
    if (daysLeftInMonth <= 3) {
      await sendVipReminderOnce(
        uid,
        'downgrade_warning',
        'تنبيه: انخفاض المستوى قريب',
        `لم تحقّق نقاط الحفاظ لـ ${def.label}. اشحن قبل نهاية الشهر وإلا ستنخفض إلى ${downgradeLabel}.`,
        'downgrade_warning',
        '/wallet/recharge',
        'month',
      );
    }
  }
}

/** تذكيرات SVIP اليومية — Push حتى لو التطبيق مغلق */
export const vipDailyReminders = onSchedule(
  { schedule: 'every 24 hours', timeZone: 'Asia/Riyadh', region: 'us-central1' },
  async () => {
    const config = await loadVipSystemConfig();
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    const pageSize = 200;

    for (;;) {
      let q = db.collection('users').where('isVIP', '==', true).limit(pageSize);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;

      for (const doc of snap.docs) {
        try {
          await processVipRemindersForUser(doc.id, doc.data(), config);
        } catch {
          /* skip user */
        }
      }

      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < pageSize) break;
    }
  },
);

/** دخول غرفة الوكالة العامة (استماع / مشاهدة) */
export const enterAgencyLiveRoom = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { agencyId } = request.data as { agencyId?: string };
  if (!agencyId?.trim()) {
    throw new HttpsError('invalid-argument', 'agencyId مطلوب');
  }

  const roomId = await ensureAgencyLiveRoom(agencyId.trim());
  return { roomId };
});

// ==================== PEARL LOG (سجل الماسة) ====================

type PearlLogTab = 'income' | 'review' | 'audit' | 'withdraw' | 'refund';

const PEARL_INCOME_TYPES = new Set([
  'gift_received',
  'transfer_received',
  'agent_collected',
  'treasure_won',
  'seat_fee_received',
  'lucky_bag_won',
  'locked_media_earn',
  'call_earning',
  'withdrawal_refund',
  'refund',
]);

/** سجل الماسة — دمج transactions + withdrawals مع فلترة على السيرفر */
export const listPearlLog = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { tab = 'income', periodDays = 0 } = request.data as {
    tab?: PearlLogTab;
    periodDays?: number;
  };

  const since =
    periodDays && periodDays > 0
      ? Date.now() - periodDays * 24 * 60 * 60 * 1000
      : 0;

  const inPeriod = (createdAt: unknown) => {
    const t = Number(createdAt) || 0;
    return since <= 0 || t >= since;
  };

  const [txSnap, wSnap] = await Promise.all([
    db
      .collection('transactions')
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get(),
    db.collection('withdrawals').where('uid', '==', uid).limit(120).get(),
  ]);

  type PearlRow = Record<string, unknown> & { id: string; source: 'transaction' | 'withdrawal' };

  const pearlTx: PearlRow[] = txSnap.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      return { ...data, id: d.id, source: 'transaction' as const } as PearlRow;
    })
    .filter((t) => t.currency === 'pearls' && inPeriod(t.createdAt));

  const withdrawals = wSnap.docs
    .map((d) => {
      const w = d.data();
      const type = w.type === 'via_agent' ? 'via_agent' : 'self';
      const status = String(w.status ?? 'pending');
      const amt = Number(w.amount) || 0;
      return {
        id: d.id,
        source: 'withdrawal' as const,
        uid,
        type: `withdrawal_${type}_${status}`,
        amount: -amt,
        currency: 'pearls',
        status,
        createdAt: Number(w.createdAt) || 0,
        itemName: type === 'self' ? 'سحب ذاتي' : 'سحب عبر وكيل',
        withdrawalId: d.id,
        commission: Number(w.commission) || 0,
        netAmount: Number(w.netAmount) || 0,
        rejectionReason: w.rejectionReason,
      };
    })
    .filter((w) => inPeriod(w.createdAt));

  let items: PearlRow[] = [];

  switch (tab) {
    case 'income':
      items = pearlTx.filter(
        (t) =>
          PEARL_INCOME_TYPES.has(String(t.type)) ||
          (Number(t.amount) > 0 && !String(t.type).startsWith('withdrawal')),
      );
      break;
    case 'review':
      items = withdrawals.filter((w) => w.status === 'pending');
      break;
    case 'audit':
      items = withdrawals.filter((w) => w.status === 'completed');
      break;
    case 'withdraw':
      items = withdrawals;
      break;
    case 'refund':
      items = [
        ...withdrawals.filter((w) => w.status === 'rejected'),
        ...pearlTx.filter(
          (t) =>
            String(t.type).includes('refund') ||
            String(t.type).includes('rejected'),
        ),
      ];
      break;
    default:
      items = pearlTx;
  }

  items.sort(
    (a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0),
  );

  return { items: items.slice(0, 80) };
});

/** طلبات سحب أعضاء الوكالة — للوكيل (بدون فهرس مركّب على العميل) */
export const listAgentWithdrawals = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const snap = await db
    .collection('withdrawals')
    .where('agentUid', '==', uid)
    .limit(150)
    .get();

  const withdrawals = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort(
      (a, b) =>
        (Number((b as { createdAt?: number }).createdAt) || 0) -
        (Number((a as { createdAt?: number }).createdAt) || 0),
    );

  return { withdrawals };
});

// ==================== ADMIN NOTIFICATIONS (إشعارات مستخدم / جماعي) ====================

type AdminNotifyScenario =
  | 'custom'
  | 'account_warning'
  | 'account_banned'
  | 'account_unbanned'
  | 'withdrawal_blocked'
  | 'withdrawal_unblocked'
  | 'verification_required'
  | 'content_removed';

const ADMIN_NOTIFY_PRESETS: Record<
  AdminNotifyScenario,
  { title: string; message: string; userPatch: Record<string, unknown> | null }
> = {
  custom: { title: 'إشعار من الإدارة', message: '', userPatch: null },
  account_warning: {
    title: 'تنبيه من الإدارة',
    message: 'تم إنذارك بسبب مخالفة قواعد المنصة. يرجى الالتزام بشروط الاستخدام.',
    userPatch: {},
  },
  account_banned: {
    title: 'تم حظر حسابك',
    message: 'تم حظر حسابك. لا يمكنك استخدام التطبيق حتى رفع الحظر من الإدارة.',
    userPatch: { isBanned: true },
  },
  account_unbanned: {
    title: 'تم رفع الحظر',
    message: 'تم إعادة تفعيل حسابك. يمكنك استخدام التطبيق مجدداً.',
    userPatch: { isBanned: false, banReason: null, bannedAt: null },
  },
  withdrawal_blocked: {
    title: 'منع عمليات السحب',
    message: 'تم تعليق عمليات السحب على حسابك مؤقتاً. تواصل مع الدعم للمزيد.',
    userPatch: { withdrawalBlocked: true },
  },
  withdrawal_unblocked: {
    title: 'تفعيل السحب',
    message: 'يمكنك الآن تقديم طلبات السحب كالمعتاد.',
    userPatch: { withdrawalBlocked: false },
  },
  verification_required: {
    title: 'التحقق من الهوية مطلوب',
    message: 'يرجى إكمال التحقق من الهوية لمتابعة استخدام الميزات المالية.',
    userPatch: null,
  },
  content_removed: {
    title: 'إزالة محتوى',
    message: 'تم إزالة محتوى مخالف من حسابك وفق سياسة المنصة.',
    userPatch: null,
  },
};

/** إرسال إشعار لمستخدم (UID أو publicAccountId) + تطبيق إجراء اختياري */
export const adminSendUserNotification = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  await assertAdmin(adminUid);
  await assertHasPermission(adminUid, 'notifications');

  const {
    identifier,
    scenario = 'custom',
    title,
    message,
    applyAction = true,
    reason,
  } = request.data as {
    identifier?: string;
    scenario?: AdminNotifyScenario;
    title?: string;
    message?: string;
    applyAction?: boolean;
    reason?: string;
  };

  if (!identifier?.trim()) {
    throw new HttpsError('invalid-argument', 'identifier مطلوب (UID أو معرّف 8 أرقام)');
  }

  const preset =
    ADMIN_NOTIFY_PRESETS[scenario as AdminNotifyScenario] ?? ADMIN_NOTIFY_PRESETS.custom;

  const targetUid = await resolveUserUid(identifier.trim());
  if (!targetUid) throw new HttpsError('not-found', 'المستخدم غير موجود');

  const userRef = db.collection('users').doc(targetUid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');
  const userData = userSnap.data()!;

  const finalTitle = (title?.trim() || preset.title).slice(0, 80);
  const finalMessage = (message?.trim() || preset.message || finalTitle).slice(0, 400);
  const displayMessage =
    finalMessage === finalTitle ? finalTitle : `${finalTitle}\n${finalMessage}`;

  if (applyAction && preset.userPatch) {
    const patch: Record<string, unknown> = {
      ...preset.userPatch,
      updatedAt: Date.now(),
    };
    if (reason?.trim()) patch.banReason = reason.trim();
    if (scenario === 'account_banned') patch.bannedAt = Date.now();
    if (scenario === 'account_warning') {
      patch.moderationWarningAt = Date.now();
      patch.moderationWarningCount = (Number(userData.moderationWarningCount) || 0) + 1;
    }
    await userRef.update(patch);
  }

  const notifRef = await db.collection('notifications').add({
    uid: targetUid,
    type: 'moderation',
    message: displayMessage,
    data: {
      type: 'moderation',
      scenario,
      title: finalTitle,
      body: finalMessage,
      reason: reason?.trim() ?? null,
      fromAdmin: true,
      ...(scenario === 'verification_required' ? { route: '/wallet/kyc' } : {}),
    },
    fromName: 'إدارة LinkUp',
    isRead: false,
    createdAt: Date.now(),
  });

  await db.collection('adminModerationLogs').add({
    adminUid,
    targetUid,
    scenario,
    title: finalTitle,
    message: finalMessage,
    applyAction: !!applyAction,
    notificationId: notifRef.id,
    createdAt: Date.now(),
  });

  return {
    ok: true,
    targetUid,
    displayName:
      userData.profile?.displayName ?? userData.displayName ?? 'مستخدم',
    publicAccountId: String(userData.publicAccountId ?? ''),
    notificationId: notifRef.id,
  };
});

function formatPublicAccountIdForGrant(value: unknown, uid: string): string {
  if (value != null && String(value).trim() !== '') {
    return String(value).replace(/\D/g, '').slice(-8).padStart(8, '0');
  }
  let h = 0;
  for (let i = 0; i < uid.length; i++) {
    h = (Math.imul(31, h) + uid.charCodeAt(i)) >>> 0;
  }
  return String(h % 100_000_000).padStart(8, '0');
}

/** شحن عملات من لوحة التحكم — عبر السيرفر (يتجاوز قيود Firestore للعميل) */
export const adminGrantCoins = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  await assertAdmin(adminUid);
  await assertHasPermission(adminUid, 'wallet');

  const { accountId, coins, note } = request.data as {
    accountId?: string;
    coins?: number;
    note?: string;
  };

  if (!accountId?.trim()) {
    throw new HttpsError('invalid-argument', 'معرّف الحساب مطلوب');
  }

  const amount = Math.floor(Number(coins) || 0);
  if (amount <= 0) {
    throw new HttpsError('invalid-argument', 'أدخل عدد عملات أكبر من صفر');
  }
  if (amount > 1_000_000_000) {
    throw new HttpsError('invalid-argument', 'الحد الأقصى للشحنة الواحدة: 1,000,000,000 عملة');
  }

  const uid = await resolveUserUid(accountId.trim());
  if (!uid) throw new HttpsError('not-found', 'لم يُعثر على حساب بهذا المعرّف');

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');
  const userData = userSnap.data()!;

  await assertAdminCountryScope(adminUid, userCountryFromDoc(userData));

  const previousBalance = pickCoinsBalance(userData);

  await userRef.update({
    'stats.coins': admin.firestore.FieldValue.increment(amount),
    coins: admin.firestore.FieldValue.increment(amount),
  });

  await db.collection('transactions').add({
    uid,
    type: 'admin_grant',
    amount,
    currency: 'coins',
    itemName: note?.trim() || 'شحن من لوحة التحكم',
    status: 'completed',
    createdAt: Date.now(),
    grantedBy: adminUid,
  });

  await db.collection('notifications').add({
    uid,
    type: 'system',
    message: `تم شحن ${amount.toLocaleString()} عملة إلى حسابك`,
    data: {
      title: 'LinkUp',
      body: `+${amount.toLocaleString()} عملة — ${note?.trim() || 'شحن من الإدارة'}`,
      type: 'admin_recharge',
    },
    fromName: 'إدارة LinkUp',
    isRead: false,
    createdAt: Date.now(),
  });

  try {
    await logCasinoRechargeActivityServer(db, uid, userData, amount);
  } catch {
    /* optional live feed */
  }

  const firstRechargeBonus = await applyFirstRechargeBonus(db, uid);

  const after = await userRef.get();
  const newBalance = pickCoinsBalance(after.data()!);
  const displayName =
    (userData.profile as { displayName?: string })?.displayName ??
    String(userData.displayName ?? 'مستخدم');

  return {
    uid,
    displayName,
    publicAccountId: formatPublicAccountIdForGrant(userData.publicAccountId, uid),
    previousBalance,
    added: amount,
    firstRechargeBonus,
    newBalance,
  };
});

/** مكافأة أول شحن — يُستدعى بعد الشحن من التطبيق أو من الأدمن */
export const tryFirstRechargeBonus = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const targetUid = String((request.data as { targetUid?: string })?.targetUid ?? callerUid).trim();
  if (!targetUid) throw new HttpsError('invalid-argument', 'معرّف المستخدم مطلوب');

  if (targetUid !== callerUid) {
    await assertAdmin(callerUid);
  }

  const bonus = await applyFirstRechargeBonus(db, targetUid);
  return { bonus, granted: bonus > 0 };
});

/** إشعار جماعي — سجل broadcasts + إشعار inbox لكل مستهدف */
/**
 * رسالة على مستوى التطبيق من عضو SVIP — امتياز «appWideMessage».
 * يتحقق من المستوى/التفعيل من config/vipSystem ثم يكتب بثّاً عاماً (يتجاوز قواعد broadcasts عبر Admin SDK).
 */
export const svipSendAppMessage = onCall({ maxInstances: 10 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  const text = String((request.data as { text?: string })?.text ?? '').trim();
  if (!text) throw new HttpsError('invalid-argument', 'النص مطلوب');
  if (text.length > 200) throw new HttpsError('invalid-argument', 'النص طويل جداً (الحد 200 حرف)');

  const [userSnap, vipSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('config').doc('vipSystem').get(),
  ]);
  if (!userSnap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');
  const u = userSnap.data() as Record<string, unknown>;
  const vipLevel = Number(u.vipLevel ?? 0);
  const isVIP = u.isVIP === true || vipLevel >= 1;
  const expiresAt = u.vipExpiresAt != null ? Number(u.vipExpiresAt) : null;
  const active = isVIP && (expiresAt === null || expiresAt > Date.now());

  const privileges = (vipSnap.exists ? (vipSnap.data()?.privileges as Array<Record<string, unknown>>) : []) ?? [];
  const priv = privileges.find((p) => p?.assetKey === 'appWideMessage' && p?.enabled !== false);
  const unlockLevel = priv ? Number(priv.unlockLevel ?? 12) : 12;
  if (!active || vipLevel < unlockLevel) {
    throw new HttpsError('permission-denied', 'هذا الامتياز حصري لأعضاء SVIP المؤهّلين');
  }

  // حدّ معدّل: رسالة واحدة كل ساعة لمنع الإساءة
  const lastAt = Number(u.lastAppMessageAt ?? 0);
  if (Date.now() - lastAt < 3600_000) {
    throw new HttpsError('resource-exhausted', 'يمكنك إرسال رسالة واحدة كل ساعة');
  }

  const profile = (u.profile as Record<string, unknown> | undefined) ?? undefined;
  const name = String(profile?.displayName ?? u.displayName ?? 'SVIP');
  await db.collection('broadcasts').add({
    title: `📣 ${name}`,
    body: text,
    target: 'all',
    type: 'promo',
    sentBy: uid,
    sentCount: 0,
    viewCount: 0,
    createdAt: Date.now(),
    sentAt: Date.now(),
  });
  await db.collection('users').doc(uid).update({ lastAppMessageAt: Date.now() });
  return { ok: true };
});

export const adminSendBroadcast = onCall({ memory: '1GiB', timeoutSeconds: 300 }, async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  await assertAdmin(adminUid);
  await assertHasPermission(adminUid, 'notifications');

  const {
    title,
    body,
    target = 'all',
    type = 'info',
  } = request.data as {
    title?: string;
    body?: string;
    target?: 'all' | 'vip' | 'active';
    type?: 'info' | 'promo' | 'warning' | 'reward';
  };

  if (!title?.trim() || !body?.trim()) {
    throw new HttpsError('invalid-argument', 'title و body مطلوبان');
  }

  const usersSnap = await db.collection('users').limit(2000).get();
  let targets = usersSnap.docs;
  const weekAgo = Date.now() - 7 * 86400000;

  if (target === 'vip') {
    targets = targets.filter((d) => d.data().isVIP === true);
  } else if (target === 'active') {
    targets = targets.filter((d) => (Number(d.data().lastSeen) || 0) >= weekAgo);
  }

  const broadcastRef = await db.collection('broadcasts').add({
    title: title.trim(),
    body: body.trim(),
    target,
    type,
    sentCount: targets.length,
    viewCount: 0,
    createdAt: Date.now(),
    sentAt: Date.now(),
  });

  const displayMessage = `${title.trim()}\n${body.trim()}`;
  let batch = db.batch();
  let ops = 0;

  for (const userDoc of targets) {
    const nref = db.collection('notifications').doc();
    batch.set(nref, {
      uid: userDoc.id,
      type: 'system',
      message: displayMessage,
      data: {
        type: 'broadcast',
        broadcastId: broadcastRef.id,
        broadcastType: type,
        title: title.trim(),
        body: body.trim(),
      },
      fromName: 'إدارة LinkUp',
      isRead: false,
      createdAt: Date.now(),
    });
    ops++;
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  return { ok: true, sent: targets.length, broadcastId: broadcastRef.id };
});

/** تسجيل مشاهدة إشعار جماعي — مرة واحدة لكل مستخدم */
export const recordBroadcastView = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { broadcastId } = request.data as { broadcastId?: string };
  if (!broadcastId?.trim()) {
    throw new HttpsError('invalid-argument', 'broadcastId مطلوب');
  }

  const broadcastRef = db.collection('broadcasts').doc(broadcastId.trim());
  const viewerRef = broadcastRef.collection('viewers').doc(uid);

  // إزالة تنازع الكتابة على عدّاد البثّ: كان «اقرأ ثم اكتب» داخل transaction على
  // وثيقة واحدة → عند بثّ لـ900 شخص يتزاحم ويُعيد المحاولة ويفشل أغلبه. بدلاً:
  //  • dedup لكل مستخدم على وثيقته الخاصة (viewerRef) → لا تنازع.
  //  • increment ذرّي لا يتطلّب قراءة → يتحمّل التزامن العالي بسلاسة.
  const viewerSnap = await viewerRef.get();
  if (viewerSnap.exists) return { ok: true, recorded: false };

  const broadcastSnap = await broadcastRef.get();
  if (!broadcastSnap.exists) return { ok: true, recorded: false };

  await viewerRef.set({ viewedAt: Date.now() });
  await broadcastRef.update({
    viewCount: admin.firestore.FieldValue.increment(1),
  });

  return { ok: true, recorded: true };
});

// ==================== AGENCY HOST INVITES (دعوة المضيف) ====================

/** قائمة دعوات الوكالة — ترتيب على السيرفر (بدون فهرس مركّب على العميل) */
export const listMyAgencyInvites = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const snap = await db
    .collection('agencyInvites')
    .where('agentUid', '==', uid)
    .limit(150)
    .get();

  const invites = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }))
    .sort(
      (a, b) =>
        (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0),
    );

  return { invites };
});

/** وكيل يدعو مضيفاً للانضمام لوكالته */
export const sendAgencyHostInvite = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { invitedUid } = request.data as { invitedUid?: string };
  if (!invitedUid?.trim()) {
    throw new HttpsError('invalid-argument', 'invitedUid مطلوب');
  }
  const targetUid = invitedUid.trim();
  if (targetUid === uid) {
    throw new HttpsError('invalid-argument', 'لا يمكنك دعوة نفسك');
  }

  const agencySnap = await db
    .collection('agencies')
    .where('ownerUid', '==', uid)
    .limit(1)
    .get();
  if (agencySnap.empty) {
    throw new HttpsError('failed-precondition', 'يجب أن تكون وكيلاً أولاً');
  }
  const agencyDoc = agencySnap.docs[0];
  const agency = agencyDoc.data();
  const agencyId = agencyDoc.id;

  const invitedSnap = await db.collection('users').doc(targetUid).get();
  if (!invitedSnap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');
  const invited = invitedSnap.data()!;
  try {
    await assertUserCanJoinAgency(targetUid, agencyId);
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message ?? SINGLE_AGENCY_MSG;
    throw new HttpsError('already-exists', msg);
  }

  const existing = await db
    .collection('agencyInvites')
    .where('agencyId', '==', agencyId)
    .limit(200)
    .get();
  const hasPending = existing.docs.some(
    (d) => d.data().invitedUid === targetUid && d.data().status === 'pending',
  );
  if (hasPending) {
    throw new HttpsError('already-exists', 'الدعوة موجودة بالفعل');
  }

  const now = Date.now();
  const ref = await db.collection('agencyInvites').add({
    agencyId,
    agencyName: agency.name ?? '',
    agentUid: uid,
    agentName: agency.ownerName ?? '',
    invitedUid: targetUid,
    invitedName: invited.profile?.displayName ?? invited.displayName ?? 'مستخدم',
    invitedAvatar: invited.profile?.avatar ?? invited.avatar ?? '',
    status: 'pending',
    inviteMethod: 'direct',
    createdAt: now,
    updatedAt: now,
  });

  // إشعار للمدعو — in-app + push
  const ownerName = String(agency.ownerName ?? 'مدير الوكالة');
  const agencyLabel = String(agency.name ?? 'الوكالة');
  await notifyUser(
    targetUid,
    `دعاك ${ownerName} للانضمام إلى وكالة "${agencyLabel}"`,
    {
      type: 'agency_host_invite',
      inviteId: ref.id,
      agencyId,
      agencyName: agencyLabel,
      title: 'دعوة انضمام لوكالة',
      body: `دعاك ${ownerName} للانضمام إلى وكالة "${agencyLabel}" — اضغط للقبول مجاناً`,
      route: '/agency/my-invites',
      fromUid: uid,
      fromName: ownerName,
    },
  );

  return { ok: true, inviteId: ref.id };
});

/** المضيف يرفض دعوة مباشرة */
export const rejectDirectAgencyInvite = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { inviteId } = request.data as { inviteId?: string };
  if (!inviteId?.trim()) throw new HttpsError('invalid-argument', 'inviteId مطلوب');

  const inviteRef = db.collection('agencyInvites').doc(inviteId.trim());
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) throw new HttpsError('not-found', 'الدعوة غير موجودة');
  const invite = inviteSnap.data()!;

  if (invite.invitedUid !== uid) {
    throw new HttpsError('permission-denied', 'هذه الدعوة ليست لك');
  }
  if (invite.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'الدعوة منتهية أو مُعالَجة مسبقاً');
  }

  await inviteRef.update({ status: 'rejected', updatedAt: Date.now() });

  return { ok: true };
});

/** الوكيل يلغي دعوة معلّقة أرسلها لمستخدم */
export const cancelAgencyHostInvite = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { inviteId } = request.data as { inviteId?: string };
  if (!inviteId?.trim()) throw new HttpsError('invalid-argument', 'inviteId مطلوب');

  const inviteRef = db.collection('agencyInvites').doc(inviteId.trim());
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) throw new HttpsError('not-found', 'الدعوة غير موجودة');
  const invite = inviteSnap.data()!;

  const agencySnap = await db.collection('agencies').doc(String(invite.agencyId)).get();
  if (!agencySnap.exists) throw new HttpsError('not-found', 'الوكالة غير موجودة');
  const agency = agencySnap.data()!;
  if (String(agency.ownerUid ?? '') !== uid) {
    throw new HttpsError('permission-denied', 'فقط مدير الوكالة يمكنه إلغاء الدعوة');
  }
  if (invite.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'لا يمكن إلغاء دعوة مُعالَجة مسبقاً');
  }

  const now = Date.now();
  await inviteRef.update({ status: 'cancelled', updatedAt: now, cancelledBy: uid });

  const invitedUid = String(invite.invitedUid ?? '');
  if (invitedUid) {
    await notifyUser(
      invitedUid,
      `أُلغيت دعوة الانضمام لوكالة "${String(invite.agencyName ?? '')}"`,
      { type: 'agency_invite_cancelled', agencyId: String(invite.agencyId), inviteId: inviteRef.id },
    );
  }

  return { ok: true };
});

/** جلب الدعوات المُستلَمة للمستخدم (كمدعو) */
export const listMyReceivedInvites = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const snap = await db
    .collection('agencyInvites')
    .where('invitedUid', '==', uid)
    .limit(50)
    .get();

  const invites = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a: any, b: any) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));

  return { invites };
});

/** انضمام مضيف لوكالة عبر كود الدعوة */
export const acceptAgencyHostInviteByCode = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { code } = request.data as { code?: string };
  const normalized = code?.trim().toLowerCase();
  if (!normalized) {
    throw new HttpsError('invalid-argument', 'code مطلوب');
  }

  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'حسابك غير موجود');
  const userData = userSnap.data()!;

  // البحث في وكالات active وpending معاً
  const agencySnap = await db
    .collection('agencies')
    .where('inviteCode', '==', normalized)
    .limit(1)
    .get();
  if (agencySnap.empty) {
    throw new HttpsError('not-found', 'كود الوكالة غير صحيح');
  }
  const agencyDoc = agencySnap.docs[0];
  const agencyId = agencyDoc.id;
  const agency = agencyDoc.data();

  // لا يمكن الانضمام لوكالة منتهية أو مرفوضة
  if (['expired', 'rejected'].includes(String(agency.status ?? ''))) {
    throw new HttpsError('failed-precondition', 'هذه الوكالة غير متاحة للانضمام');
  }

  const ownerUid = String(agency.ownerUid ?? '');
  if (await isActiveAgencyMember(agencyId, uid, ownerUid)) {
    return {
      ok: true,
      agencyId,
      agencyName: String(agency.name ?? ''),
      needsHostVerification: agencyInviteNeedsHostVerification(userData),
      needsGenderVerification: agencyInviteNeedsHostVerification(userData),
      alreadyMember: true,
    };
  }

  await assertUserCanJoinAgency(uid, agencyId);

  const now = Date.now();
  const memberRef = db.collection('agencyMembers').doc();
  const inviteRef = db.collection('agencyInvites').doc();
  const joinFields = agencyMemberFieldsOnVerifiedJoin(
    uid,
    userData,
    agencyId,
    String(agency.name ?? ''),
    now,
  );

  await db.runTransaction(async (tx) => {
    await assertUserCanJoinAgencyTx(tx, uid, agencyId);

    tx.set(memberRef, joinFields.member);
    tx.update(userSnap.ref, joinFields.userPatch);

    const agencyPatch: Record<string, unknown> = {
      memberCount: (Number(agency.memberCount) || 0) + 1,
      updatedAt: now,
    };
    if (joinFields.isFemaleVerifiedHost) {
      agencyPatch.femaleHostCount = (Number(agency.femaleHostCount) || 0) + 1;
    }
    tx.update(agencyDoc.ref, agencyPatch);

    tx.set(inviteRef, {
      agencyId,
      agencyName: agency.name ?? '',
      agentUid: agency.ownerUid ?? '',
      agentName: agency.ownerName ?? '',
      invitedUid: uid,
      invitedName: userData.profile?.displayName ?? userData.displayName ?? 'مضيف',
      invitedAvatar: userData.profile?.avatar ?? userData.avatar ?? '',
      status: 'accepted',
      inviteMethod: 'code',
      createdAt: now,
      updatedAt: now,
    });
  });

  const hostName = String(
    userData.profile?.displayName ?? userData.displayName ?? 'مضيف',
  );
  const agencyLabel = String(agency.name ?? '');

  try {
    await notifyUser(
      uid,
      joinFields.isFemaleVerifiedHost
        ? `انضممت إلى وكالة "${agencyLabel}" كمضيفة موثّقة`
        : `انضممت إلى وكالة "${agencyLabel}"`,
      { type: 'agency_joined', agencyId },
    );

    if (ownerUid && ownerUid !== uid) {
      await notifyUser(
        ownerUid,
        `انضمت "${hostName}" لوكالتك "${agencyLabel}" عبر كود الدعوة`,
        {
          type: 'agency_host_joined',
          agencyId,
          agencyName: agencyLabel,
          title: 'عضو جديد في الوكالة',
          body: `انضمت "${hostName}" لوكالتك "${agencyLabel}" عبر كود الدعوة`,
          route: '/agency/members',
          fromUid: uid,
          fromName: hostName,
          fromAvatar: userData.profile?.avatar ?? userData.avatar ?? '',
          // #10: وقت الموافقة — يظهر للوكيل مع اسم المضيفة
          acceptedAt: now,
        },
      );
    }
  } catch (err) {
    console.error('acceptAgencyHostInviteByCode: notifyUser failed', agencyId, err);
  }

  return {
    ok: true,
    agencyId,
    agencyName: String(agency.name ?? ''),
    needsHostVerification: agencyInviteNeedsHostVerification(userData),
    needsGenderVerification: agencyInviteNeedsHostVerification(userData),
  };
});

// ==================== تسجيل الدخول بالمعرّف العام ====================

const FIREBASE_WEB_API_KEY =
  process.env.FIREBASE_WEB_API_KEY || 'AIzaSyB0sVIAe63jkq0O_tU8B98GWe0SywBWaBM';

function normalizePublicAccountIdForLogin(raw: string): string {
  return normalizePublicAccountId(raw);
}

async function verifyFirebaseEmailPassword(email: string, password: string): Promise<void> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: false }),
  });
  const body = (await res.json()) as { error?: { message?: string } };
  if (res.ok) return;

  const err = body.error?.message ?? 'UNKNOWN';
  if (err === 'INVALID_PASSWORD' || err === 'INVALID_LOGIN_CREDENTIALS') {
    throw new HttpsError('permission-denied', 'wrong-password');
  }
  if (err === 'EMAIL_NOT_FOUND') {
    throw new HttpsError('failed-precondition', 'auth-email-missing');
  }
  if (err === 'USER_DISABLED') {
    throw new HttpsError('permission-denied', 'user-disabled');
  }
  if (err === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
    throw new HttpsError('resource-exhausted', 'too-many-requests');
  }
  throw new HttpsError('internal', err);
}

/** تسجيل دخول بمعرّف الحساب (8 أرقام) + كلمة المرور — بدون auth مسبق */
export const signInWithPublicAccountId = onCall(async (request) => {
  const { accountId, password } = request.data as { accountId?: string; password?: string };
  if (!accountId?.trim()) {
    throw new HttpsError('invalid-argument', 'account-id-required');
  }
  if (!password || password.length < 6) {
    throw new HttpsError('invalid-argument', 'password-too-short');
  }

  const publicId = normalizePublicAccountIdForLogin(accountId.trim());
  if (!publicId || publicId.length !== 8) {
    throw new HttpsError('invalid-argument', 'invalid-account-id');
  }

  const uid = await resolveUserUid(publicId);
  if (!uid) {
    throw new HttpsError('not-found', 'account-not-found');
  }

  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'account-not-found');
  }
  const userData = userSnap.data()!;
  if (userData.isBanned === true) {
    throw new HttpsError('permission-denied', 'user-disabled');
  }

  let email = '';
  try {
    const authUser = await admin.auth().getUser(uid);
    email = (authUser.email ?? '').trim().toLowerCase();
  } catch {
    /* optional */
  }
  if (!email) {
    email = String(userData.email ?? userData.profile?.email ?? '').trim().toLowerCase();
  }
  if (!email) {
    throw new HttpsError('failed-precondition', 'account-no-email');
  }

  await verifyFirebaseEmailPassword(email, password);

  await db.collection('users').doc(uid).update({ lastSeen: Date.now() }).catch(() => {});
  await syncPublicAccountIndexForUid(publicId, uid).catch(() => {});

  // نرجع البريد بعد التحقق — العميل يسجّل الدخول بـ signInWithEmailAndPassword
  // (createCustomToken يحتاج iam.serviceAccounts.signBlob على حساب Cloud Functions)
  return { email };
});

// ==================== BD CENTER (مركز BD) ====================

/** بحث مستخدم بـ Firebase UID أو publicAccountId */
export const lookupUserByIdentifier = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { identifier } = request.data as { identifier?: string };
  if (!identifier?.trim()) {
    throw new HttpsError('invalid-argument', 'identifier مطلوب');
  }

  const resolved = await resolveUserUid(identifier.trim());
  if (!resolved) throw new HttpsError('not-found', 'المستخدم غير موجود');

  const snap = await db.collection('users').doc(resolved).get();
  if (!snap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');
  const d = snap.data()!;

  return {
    uid: resolved,
    displayName: d.profile?.displayName ?? d.displayName ?? 'مستخدم',
    avatar: d.profile?.avatar ?? d.avatar ?? '',
    isAgent: d.isAgent === true,
    hasAgency: !!d.agencyId,
    publicAccountId: String(d.publicAccountId ?? ''),
    isBanned: d.isBanned === true,
    withdrawalBlocked: d.withdrawalBlocked === true,
  };
});

/** وكيل يدعو مستخدماً ليصبح وكيل وكالة (BD) */
export const sendBdAgencyInvite = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { invitedIdentifier } = request.data as { invitedIdentifier?: string };
  if (!invitedIdentifier?.trim()) {
    throw new HttpsError('invalid-argument', 'invitedIdentifier مطلوب');
  }

  const agencySnap = await db
    .collection('agencies')
    .where('ownerUid', '==', uid)
    .limit(1)
    .get();
  if (agencySnap.empty) {
    throw new HttpsError('failed-precondition', 'يجب أن تكون وكيلاً أولاً');
  }
  const agencyData = agencySnap.docs[0].data();

  const invitedUid = await resolveUserUid(invitedIdentifier.trim());
  if (!invitedUid) throw new HttpsError('not-found', 'المستخدم غير موجود');
  if (invitedUid === uid) {
    throw new HttpsError('invalid-argument', 'لا يمكنك دعوة نفسك');
  }

  const invitedSnap = await db.collection('users').doc(invitedUid).get();
  if (!invitedSnap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');
  const invited = invitedSnap.data()!;
  if (invited.isAgent === true) {
    throw new HttpsError('already-exists', 'المستخدم وكيل بالفعل');
  }

  const existing = await db.collection('bdInvites').where('fromUid', '==', uid).limit(200).get();
  const hasPending = existing.docs.some(
    (d) =>
      d.data().invitedUid === invitedUid &&
      ['pending', 'applied'].includes(String(d.data().status ?? '')),
  );
  if (hasPending) {
    throw new HttpsError('already-exists', 'لديك دعوة معلّقة لهذا المستخدم');
  }

  const bdConfig = await getBdReferralConfig();
  const fromAgencyId = agencySnap.docs[0].id;
  const now = Date.now();

  const ref = await db.collection('bdInvites').add({
    fromUid: uid,
    fromAgencyId,
    fromName: agencyData.ownerName ?? '',
    fromAgencyName: agencyData.name ?? '',
    invitedUid,
    invitedName: invited.profile?.displayName ?? invited.displayName ?? 'مستخدم',
    invitedAvatar: invited.profile?.avatar ?? invited.avatar ?? '',
    commissionPercent: bdConfig.commissionPercent,
    benefitMonths: bdConfig.benefitMonths,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  await notifyUser(
    invitedUid,
    `دعاك ${agencyData.ownerName ?? 'وكيل'} لفتح وكالة جديدة عبر مركز BD — قدّم طلب الوكالة من التطبيق`,
    { inviteId: ref.id, type: 'bd_agency_invite' },
  );

  return {
    ok: true,
    inviteId: ref.id,
    commissionPercent: bdConfig.commissionPercent,
    benefitMonths: bdConfig.benefitMonths,
  };
});

/** إعدادات إحالة BD للتطبيق (قواعد الدخل) */
export const getBdReferralConfigPublic = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  return getBdReferralConfig();
});

/** وكالات مُحالة من الوكيل الحالي مع أرصدة عمولة BD */
export const listMyBdReferredAgencies = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const snap = await db.collection('agencies').where('referredByUid', '==', uid).limit(80).get();
  const agencies = snap.docs
    .map((d) => {
      const data = d.data();
      const benefitEndsAt = Number(data.bdBenefitEndsAt) || 0;
      const active =
        String(data.status ?? '') === 'active' &&
        (benefitEndsAt === 0 || Date.now() <= benefitEndsAt);
      return {
        id: d.id,
        name: String(data.name ?? ''),
        ownerName: String(data.ownerName ?? ''),
        ownerAvatar: String(data.ownerAvatar ?? ''),
        status: String(data.status ?? ''),
        commissionPercent: Number(data.bdCommissionPercent) || 0,
        benefitMonths: Number(data.bdBenefitMonths) || 0,
        benefitEndsAt,
        benefitActive: active,
        memberCount: Number(data.memberCount) || 0,
        femaleHostCount: Number(data.femaleHostCount) || 0,
        activatedAt: Number(data.bdBenefitStartsAt) || Number(data.createdAt) || 0,
      };
    })
    .sort((a, b) => b.activatedAt - a.activatedAt);

  const agencySnap = await db
    .collection('agencies')
    .where('ownerUid', '==', uid)
    .limit(1)
    .get();
  const bdReferralPearlsTotal = agencySnap.empty
    ? 0
    : Number(agencySnap.docs[0].data().bdReferralPearlsTotal) || 0;

  return { agencies, bdReferralPearlsTotal };
});

/** قائمة دعوات BD التي أرسلها الوكيل — بدون فهرس مركّب على العميل */
export const listMyBdInvites = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const snap = await db.collection('bdInvites').where('fromUid', '==', uid).limit(150).get();
  const invites = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }))
    .sort(
      (a, b) =>
        (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0),
    );

  return { invites };
});

// ==================== AGENCY MEMBER BALANCES ====================

/**
 * الوكيل: عرض أرصدة الماسة لجميع المضيفات في وكالته
 */
export const getAgencyMemberBalances = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'الحساب غير موجود');
  const userData = userSnap.data()!;

  if (userData.isAgent !== true && userData.agencyRole !== 'owner') {
    throw new HttpsError('permission-denied', 'هذه الدالة للوكلاء فقط');
  }

  const agencyId = userData.agencyId as string | undefined;
  if (!agencyId) throw new HttpsError('failed-precondition', 'ليس لديك وكالة مفعّلة');

  const membersSnap = await db
    .collection('agencyMembers')
    .where('agencyId', '==', agencyId)
    .limit(100)
    .get();

  const members = membersSnap.docs
    .map((d) => {
      const m = d.data();
      const earned = Number(m.pearlsEarned) || 0;
      const transferred = Number(m.pearlsTransferredToAgent) || 0;
      return {
        id: d.id,
        uid: String(m.uid ?? ''),
        name: String(m.uidName ?? 'مضيف'),
        avatar: String(m.uidAvatar ?? ''),
        role: String(m.role ?? 'member'),
        isFemaleHost: m.isFemaleHost === true,
        hostVerified: m.hostVerified === true,
        pearlsEarned: earned,
        pearlsTransferredToAgent: transferred,
        availablePearls: Math.max(0, earned - transferred),
      };
    })
    .sort((a, b) => b.availablePearls - a.availablePearls);

  return { members, agencyId };
});

// ==================== HOST DASHBOARD STATS ====================

/**
 * المضيفة: إحصائياتها الخاصة داخل الوكالة (ترتيبها، أرصدتها، أبرز الشاحنين)
 */
export const getHostDashboardStats = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'الحساب غير موجود');
  const userData = userSnap.data()!;

  const isFemale = (userData.profile?.gender ?? userData.gender) === 'female';
  if (!isFemale) {
    throw new HttpsError('permission-denied', 'هذه الدالة للمضيفات فقط');
  }

  const agencyId = userData.agencyId as string | undefined;
  if (!agencyId) throw new HttpsError('failed-precondition', 'لست في وكالة');

  const [agencySnap, memberSnap, allMembersSnap] = await Promise.all([
    db.collection('agencies').doc(agencyId).get(),
    db.collection('agencyMembers').where('uid', '==', uid).where('agencyId', '==', agencyId).limit(1).get(),
    db.collection('agencyMembers').where('agencyId', '==', agencyId).where('isFemaleHost', '==', true).get(),
  ]);

  const agencyData = agencySnap.data() ?? {};
  const memberData = memberSnap.empty ? {} : memberSnap.docs[0].data();
  const pearlsEarned = Number(memberData.pearlsEarned) || 0;
  const pearlsTransferred = Number(memberData.pearlsTransferredToAgent) || 0;

  const sortedMembers = allMembersSnap.docs
    .map((d) => ({ uid: String(d.data().uid), earned: Number(d.data().pearlsEarned) || 0 }))
    .sort((a, b) => b.earned - a.earned);
  const hostRank = sortedMembers.findIndex((m) => m.uid === uid) + 1;

  // أعلى 5 شاحنين خلال آخر 7 أيام:
  // الهدايا المُستلَمة لهذه المضيفة (uid == المضيفة، type == gift_received)
  // ملاحظة: معاملة gift_received تخزّن المُرسِل في fromUid والمبلغ موجب (ماسة)
  const since7d = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let topChargers: Array<{ uid: string; name: string; avatar: string; total: number }> = [];
  try {
    const txSnap = await db
      .collection('transactions')
      .where('uid', '==', uid)
      .where('createdAt', '>=', since7d)
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    const totalsByUid: Record<string, number> = {};
    for (const txDoc of txSnap.docs) {
      const tx = txDoc.data();
      if (String(tx.type ?? '') !== 'gift_received') continue;
      const senderUid = String(tx.fromUid ?? '');
      if (!senderUid) continue;
      totalsByUid[senderUid] = (totalsByUid[senderUid] ?? 0) + (Number(tx.amount) || 0);
    }

    const rankedUids = Object.entries(totalsByUid)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // جلب أسماء/صور المرسلين (حد أقصى 5 قراءات)
    const senderSnaps = await Promise.all(
      rankedUids.map(([senderUid]) =>
        db.collection('users').doc(senderUid).get().catch(() => null),
      ),
    );

    topChargers = rankedUids.map(([senderUid, total], i) => {
      const s = senderSnaps[i]?.data();
      return {
        uid: senderUid,
        name: String(s?.displayName ?? s?.profile?.displayName ?? 'مستخدم'),
        avatar: String(s?.avatar ?? s?.profile?.avatar ?? ''),
        total,
      };
    });
  } catch {}

  return {
    agencyName: String(agencyData.name ?? ''),
    agencyId,
    pearlsEarned,
    availablePearls: Number(userData.pearls ?? userData.stats?.pearls ?? 0),
    hostRank: hostRank > 0 ? hostRank : null,
    totalFemaleHosts: sortedMembers.length,
    topChargers,
  };
});

// ==================== AGENCY MANAGER ANALYTICS ====================

type AgencyIncomeCategory = 'gifts' | 'calls' | 'chat' | 'refund' | 'other';
type AgencyAnalyticsPeriod = 'week' | 'last_week' | '4weeks_day' | '4weeks_week';
type AgencyDataType = 'income' | 'people';
type AgencyIncomeFilter = 'all' | 'chat' | 'gifts' | 'calls' | 'refund' | 'other';

const AGENCY_PEARL_EARNING_TYPES = new Set([
  'gift_received',
  'transfer_received',
  'treasure_won',
  'seat_fee_received',
  'lucky_bag_won',
  'locked_media_earn',
  'call_earning',
  'withdrawal_refund',
  'refund',
  'agent_collected',
]);

function pearlIncomeCategory(txType: string): AgencyIncomeCategory {
  switch (txType) {
    case 'gift_received':
    case 'treasure_won':
    case 'lucky_bag_won':
      return 'gifts';
    case 'call_earning':
    case 'seat_fee_received':
      return 'calls';
    case 'locked_media_earn':
    case 'transfer_received':
      return 'chat';
    case 'withdrawal_refund':
    case 'refund':
    case 'agent_refund':
      return 'refund';
    default:
      return 'other';
  }
}

function agencyDayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/** مفتاح فترة الدعم (آخر 7 أيام) — مطابق لتطبيق الجوال */
function getAgencyPeriodWeekKey(ms = Date.now()): string {
  const DAY = 86400000;
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const weekStart = d.getTime() - 6 * DAY;
  return `w${weekStart}`;
}

/** يزيد عدّاد دعم الفترة (كوينز الهدايا) على وثيقة الوكالة */
async function bumpAgencyPeriodSupportCoins(agencyId: string, coins: number): Promise<void> {
  const amount = Math.floor(Number(coins) || 0);
  if (!agencyId || amount <= 0) return;

  const weekKey = getAgencyPeriodWeekKey();
  const agencyRef = db.collection('agencies').doc(agencyId);

  await db.runTransaction(async (t) => {
    const snap = await t.get(agencyRef);
    if (!snap.exists) return;

    const data = snap.data() ?? {};
    if (String(data.periodSupportWeekKey ?? '') === weekKey) {
      t.update(agencyRef, {
        periodSupportCoins: admin.firestore.FieldValue.increment(amount),
        updatedAt: Date.now(),
      });
    } else {
      t.update(agencyRef, {
        periodSupportWeekKey: weekKey,
        periodSupportCoins: amount,
        updatedAt: Date.now(),
      });
    }
  });
}

function startOfDayMs(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function resolveAnalyticsWindow(period: AgencyAnalyticsPeriod): {
  startMs: number;
  endMs: number;
  granularity: 'day' | 'week';
} {
  const DAY = 86400000;
  const now = Date.now();
  const todayStart = startOfDayMs(now);
  const endMs = todayStart + DAY;

  if (period === 'week') {
    return { startMs: todayStart - 6 * DAY, endMs, granularity: 'day' };
  }
  if (period === 'last_week') {
    return { startMs: todayStart - 13 * DAY, endMs: todayStart - 6 * DAY, granularity: 'day' };
  }
  if (period === '4weeks_week') {
    return { startMs: todayStart - 27 * DAY, endMs, granularity: 'week' };
  }
  return { startMs: todayStart - 27 * DAY, endMs, granularity: 'day' };
}

function incomeMatchesFilter(category: AgencyIncomeCategory, filter: AgencyIncomeFilter): boolean {
  if (filter === 'all') return true;
  return category === filter;
}

async function getAgentAgencyId(uid: string): Promise<string> {
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'الحساب غير موجود');
  const userData = userSnap.data()!;
  if (userData.isAgent !== true && userData.agencyRole !== 'owner') {
    throw new HttpsError('permission-denied', 'هذه الدالة للوكلاء فقط');
  }
  const agencyId = String(userData.agencyId ?? '').trim();
  if (!agencyId) throw new HttpsError('failed-precondition', 'ليس لديك وكالة مفعّلة');
  return agencyId;
}

async function loadAgencyMemberRows(agencyId: string) {
  const membersSnap = await db
    .collection('agencyMembers')
    .where('agencyId', '==', agencyId)
    .limit(80)
    .get();
  return membersSnap.docs.map((d) => {
    const m = d.data();
    return {
      memberDocId: d.id,
      uid: String(m.uid ?? ''),
      name: String(m.uidName ?? 'مضيف'),
      avatar: String(m.uidAvatar ?? ''),
      pearlsEarned: Number(m.pearlsEarned) || 0,
    };
  });
}

async function bumpAgencyEarningsDaily(
  agencyId: string,
  hostUid: string,
  pearls: number,
  txType: string,
): Promise<void> {
  if (!agencyId || !hostUid || pearls === 0) return;
  const category = pearlIncomeCategory(txType);
  const dayKey = agencyDayKey(Date.now());
  const ref = db.collection('agencyEarnings').doc(`${agencyId}_${dayKey}`);
  const absPearls = Math.abs(pearls);
  const incField = category;
  // ⚡ كتابة واحدة بدل اثنتين: increment يُنشئ الحقل من 0 تلقائياً، فلا حاجة لتهيئة
  //    منفصلة بـ set. يقلّل الضغط على الوثيقة الساخنة (أرباح الوكالة اليومية) ×2.
  await ref.set(
    {
      agencyId,
      dayKey,
      [incField]: admin.firestore.FieldValue.increment(absPearls),
      total: admin.firestore.FieldValue.increment(pearls),
      [`activeHosts.${hostUid}`]: true,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

/** كاش نتائج تحليلات الوكالة على الخادم — مشترك بين كل المستخدمين والإنستنسات */
const AGENCY_ANALYTICS_CACHE_TTL_MS = 120_000; // دقيقتان (البيانات أصلاً مؤجَّلة قليلاً)

async function buildAgencyAnalytics(
  agencyId: string,
  period: AgencyAnalyticsPeriod,
  dataType: AgencyDataType,
  incomeType: AgencyIncomeFilter,
) {
  // كاش قصير الأمد: يتجنّب إعادة مسح آلاف مستندات transactions لكل نداء
  const cacheId = `${agencyId}__${period}__${dataType}__${incomeType}`;
  const cacheRef = db.collection('agencyAnalyticsCache').doc(cacheId);
  try {
    const cSnap = await cacheRef.get();
    if (cSnap.exists) {
      const c = cSnap.data() as { ts?: number; data?: unknown } | undefined;
      if (c?.data && typeof c.ts === 'number' && Date.now() - c.ts < AGENCY_ANALYTICS_CACHE_TTL_MS) {
        return { ...(c.data as Record<string, unknown>), cached: true };
      }
    }
  } catch {
    // تجاهل أخطاء الكاش وواصل الحساب الطبيعي
  }

  const { startMs, endMs, granularity } = resolveAnalyticsWindow(period);
  const members = await loadAgencyMemberRows(agencyId);
  const memberUids = members.map((m) => m.uid).filter(Boolean);
  const nameByUid: Record<string, { name: string; avatar: string }> = {};
  members.forEach((m) => {
    nameByUid[m.uid] = { name: m.name, avatar: m.avatar };
  });

  type Bucket = { key: string; label: string; startMs: number; income: number; people: Set<string> };
  const buckets: Bucket[] = [];
  const DAY = 86400000;

  if (granularity === 'day') {
    const days = Math.ceil((endMs - startMs) / DAY);
    for (let i = 0; i < days; i++) {
      const s = startMs + i * DAY;
      const d = new Date(s);
      buckets.push({
        key: agencyDayKey(s),
        label: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        startMs: s,
        income: 0,
        people: new Set(),
      });
    }
  } else {
    for (let w = 0; w < 4; w++) {
      const s = startMs + w * 7 * DAY;
      const d = new Date(s);
      buckets.push({
        key: `w${w}`,
        label: `أسبوع ${w + 1}`,
        startMs: s,
        income: 0,
        people: new Set(),
      });
    }
  }

  const bucketForTs = (ts: number): Bucket | undefined => {
    if (granularity === 'day') {
      const key = agencyDayKey(ts);
      return buckets.find((b) => b.key === key);
    }
    const idx = Math.floor((ts - startMs) / (7 * DAY));
    return buckets[Math.min(Math.max(idx, 0), buckets.length - 1)];
  };

  let todayTotal = 0;
  const todayKey = agencyDayKey(Date.now());
  const memberIncome: Record<string, number> = {};

  const txResults = await Promise.all(
    memberUids.slice(0, 50).map(async (uid) => {
      try {
        const snap = await db
          .collection('transactions')
          .where('uid', '==', uid)
          .where('createdAt', '>=', startMs)
          .orderBy('createdAt', 'asc')
          .limit(400)
          .get();
        return snap.docs.map((d) => ({ uid, ...(d.data() as Record<string, unknown>) }));
      } catch {
        return [];
      }
    }),
  );

  txResults.flat().forEach((rawTx) => {
    const tx = rawTx as Record<string, unknown> & { uid: string };
    const ts = Number(tx.createdAt) || 0;
    if (ts < startMs || ts >= endMs) return;
    const type = String(tx.type ?? '');
    if (String(tx.currency ?? 'pearls') !== 'pearls') return;
    if (!AGENCY_PEARL_EARNING_TYPES.has(type) && Number(tx.amount) <= 0) return;

    const category = pearlIncomeCategory(type);
    if (!incomeMatchesFilter(category, incomeType)) return;

    const amt = Number(tx.amount) || 0;
    if (amt === 0) return;

    const uid = String(tx.uid ?? '');
    memberIncome[uid] = (memberIncome[uid] ?? 0) + amt;

    const bucket = bucketForTs(ts);
    if (bucket) {
      bucket.income += amt;
      if (uid) bucket.people.add(uid);
    }
    if (agencyDayKey(ts) === todayKey) todayTotal += amt;
  });

  const series = buckets.map((b) => ({
    label: b.label,
    value: dataType === 'people' ? b.people.size : Math.max(0, Math.round(b.income)),
  }));

  const total = series.reduce((s, p) => s + p.value, 0);
  const hostRows = members
    .map((m) => ({
      uid: m.uid,
      name: m.name,
      avatar: m.avatar,
      earnings: Math.max(0, memberIncome[m.uid] ?? 0),
      totalPearlsEarned: m.pearlsEarned,
    }))
    .sort((a, b) => b.earnings - a.earnings);

  const cycleEndMs = endMs - 1;

  const result = {
    agencyId,
    period,
    dataType,
    incomeType,
    series,
    total,
    todayTotal: Math.max(0, Math.round(todayTotal)),
    cycleEndsAt: cycleEndMs,
    hosts: hostRows,
    dataDelayNote: true,
  };

  // تخزين في الكاش دون تعطيل الرد (fire-and-forget)
  cacheRef.set({ ts: Date.now(), data: result }).catch(() => {});

  return result;
}

/** الوكيل: خط بيانات المضيفين + تفاصيل الدخل */
export const getAgencyManagerAnalytics = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const {
    period = 'week',
    dataType = 'income',
    incomeType = 'all',
  } = request.data as {
    period?: AgencyAnalyticsPeriod;
    dataType?: AgencyDataType;
    incomeType?: AgencyIncomeFilter;
  };

  const agencyId = await getAgentAgencyId(uid);
  return buildAgencyAnalytics(agencyId, period, dataType, incomeType);
});

/** الأدمن: نفس التحليلات لوكالة محددة */
export const getAgencyAdminAnalytics = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  await assertAdmin(adminUid);
  await assertHasPermission(adminUid, 'analytics');

  const {
    agencyId,
    period = 'week',
    dataType = 'income',
    incomeType = 'all',
  } = request.data as {
    agencyId?: string;
    period?: AgencyAnalyticsPeriod;
    dataType?: AgencyDataType;
    incomeType?: AgencyIncomeFilter;
  };
  if (!agencyId?.trim()) throw new HttpsError('invalid-argument', 'agencyId مطلوب');

  const agencySnap = await db.collection('agencies').doc(agencyId.trim()).get();
  if (!agencySnap.exists) throw new HttpsError('not-found', 'الوكالة غير موجودة');

  return buildAgencyAnalytics(agencyId.trim(), period, dataType, incomeType);
});

function countHostCompletions(
  progress: ReturnType<typeof readHostProgress>,
): number {
  let count = 0;
  count += Number(progress.paidMessageMilestones) || 0;
  count += Number(progress.paidVoiceCompMilestones) || 0;
  count += Number(progress.paidVideoCompMilestones) || 0;
  if (progress.voiceCallRewardPaid) count += 1;
  if (progress.videoCallRewardPaid) count += 1;
  if (progress.onlineRewardPaid) count += 1;
  return count;
}

/** الوكيل: إنهاءات مهام المضيفين في الدورة الحالية */
export const getAgencyHostCompletions = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { searchId } = request.data as { searchId?: string };
  const agencyId = await getAgentAgencyId(uid);
  const members = await loadAgencyMemberRows(agencyId);

  const cfgSnap = await db.doc('config/hostTasks').get();
  const cfgRaw = cfgSnap.exists ? cfgSnap.data() ?? {} : {};
  void cfgRaw;

  const { endMs } = resolveAnalyticsWindow('week');
  let totalCompletions = 0;
  let todayCompletions = 0;
  const hosts: Array<{
    uid: string;
    name: string;
    avatar: string;
    publicAccountId: string;
    completions: number;
    todayCompletions: number;
    pearlsThisWeek: number;
  }> = [];

  const memberUids = members.map((m) => m.uid).filter(Boolean);
  const userSnaps = await Promise.all(
    memberUids.map((mUid) => db.collection('users').doc(mUid).get()),
  );

  const weekStart = resolveAnalyticsWindow('week').startMs;
  const pearlByUid: Record<string, number> = {};
  await Promise.all(
    memberUids.slice(0, 40).map(async (mUid) => {
      try {
        const snap = await db
          .collection('transactions')
          .where('uid', '==', mUid)
          .where('createdAt', '>=', weekStart)
          .orderBy('createdAt', 'desc')
          .limit(80)
          .get();
        let sum = 0;
        snap.docs.forEach((d) => {
          const tx = d.data();
          if (String(tx.currency ?? 'pearls') !== 'pearls') return;
          if (!AGENCY_PEARL_EARNING_TYPES.has(String(tx.type ?? ''))) return;
          sum += Number(tx.amount) || 0;
        });
        pearlByUid[mUid] = sum;
      } catch {
        pearlByUid[mUid] = 0;
      }
    }),
  );

  userSnaps.forEach((snap, i) => {
    const mUid = memberUids[i];
    const member = members.find((x) => x.uid === mUid);
    if (!member || !snap.exists) return;

    const data = snap.data()!;
    const progress = readHostProgress(data);
    const taskCompletions = countHostCompletions(progress);
    const pearlsWeek = pearlByUid[mUid] ?? 0;
    const completedCycle = taskCompletions > 0 || pearlsWeek > 0;

    if (completedCycle) totalCompletions += 1;
    if (taskCompletions > 0) todayCompletions += 1;

    hosts.push({
      uid: mUid,
      name: member.name,
      avatar: member.avatar,
      publicAccountId: String(data.publicAccountId ?? ''),
      completions: taskCompletions,
      todayCompletions: taskCompletions,
      pearlsThisWeek: pearlsWeek,
    });
  });

  const term = String(searchId ?? '').trim().toLowerCase();
  const filtered = term
    ? hosts.filter(
        (h) =>
          h.uid.toLowerCase().includes(term) ||
          h.publicAccountId.toLowerCase().includes(term) ||
          h.name.toLowerCase().includes(term),
      )
    : hosts;

  return {
    agencyId,
    cycleEndsAt: endMs - 1,
    totalCompletions,
    todayCompletions,
    hosts: filtered.sort((a, b) => b.completions - a.completions || b.pearlsThisWeek - a.pearlsThisWeek),
  };
});

/** الوكيل: استرداد ماسة من مضيفة لداعم */
export const agentRefundSupporterPearls = onCall(async (request) => {
  const agentUid = request.auth?.uid;
  if (!agentUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const {
    hostIdentifier,
    supporterIdentifier,
    amount,
    reason,
  } = request.data as {
    hostIdentifier?: string;
    supporterIdentifier?: string;
    amount?: number;
    reason?: string;
  };

  const amt = Math.floor(Number(amount) || 0);
  if (!hostIdentifier?.trim() || !supporterIdentifier?.trim() || amt <= 0) {
    throw new HttpsError('invalid-argument', 'معرّف المضيف والداعم والمبلغ مطلوبان');
  }

  const agencyId = await getAgentAgencyId(agentUid);
  await assertAgencyManager(agentUid, agencyId);

  const hostUid = (await resolveUserUid(hostIdentifier.trim())) ?? hostIdentifier.trim();
  const supporterUid =
    (await resolveUserUid(supporterIdentifier.trim())) ?? supporterIdentifier.trim();

  const memberSnap = await db
    .collection('agencyMembers')
    .where('agencyId', '==', agencyId)
    .where('uid', '==', hostUid)
    .limit(1)
    .get();
  if (memberSnap.empty) {
    throw new HttpsError('failed-precondition', 'المضيف ليس في وكالتك');
  }

  const hostRef = db.collection('users').doc(hostUid);
  const supporterRef = db.collection('users').doc(supporterUid);
  const memberRef = memberSnap.docs[0].ref;
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const [hostSnap, supporterSnap, memberDoc] = await Promise.all([
      tx.get(hostRef),
      tx.get(supporterRef),
      tx.get(memberRef),
    ]);
    if (!hostSnap.exists) throw new HttpsError('not-found', 'المضيف غير موجود');
    if (!supporterSnap.exists) throw new HttpsError('not-found', 'الداعم غير موجود');

    const hostData = hostSnap.data()!;
    const hostPearls = Number(hostData.pearls ?? hostData.stats?.pearls ?? 0);
    if (hostPearls < amt) {
      throw new HttpsError('failed-precondition', 'رصيد المضيف من الماسة غير كافٍ');
    }

    const memberEarned = Number(memberDoc.data()?.pearlsEarned ?? 0);
    const newEarned = Math.max(0, memberEarned - amt);

    tx.update(hostRef, {
      pearls: admin.firestore.FieldValue.increment(-amt),
      'stats.pearls': admin.firestore.FieldValue.increment(-amt),
      updatedAt: now,
    });
    tx.update(supporterRef, {
      pearls: admin.firestore.FieldValue.increment(amt),
      'stats.pearls': admin.firestore.FieldValue.increment(amt),
      updatedAt: now,
    });
    tx.update(memberRef, { pearlsEarned: newEarned, updatedAt: now });
  });

  const refundRef = await db.collection('agencyRefunds').add({
    agencyId,
    agentUid,
    hostUid,
    supporterUid,
    amount: amt,
    reason: String(reason ?? '').trim(),
    status: 'completed',
    createdAt: now,
  });

  await db.collection('transactions').add({
    uid: hostUid,
    type: 'agent_refund',
    amount: -amt,
    currency: 'pearls',
    fromUid: agentUid,
    toUid: supporterUid,
    agencyId,
    refundId: refundRef.id,
    note: reason ?? 'استرداد للداعم',
    createdAt: now,
  });
  await db.collection('transactions').add({
    uid: supporterUid,
    type: 'refund',
    amount: amt,
    currency: 'pearls',
    fromUid: hostUid,
    toUid: supporterUid,
    agencyId,
    refundId: refundRef.id,
    note: reason ?? 'استرداد من الوكيل',
    createdAt: now,
  });

  await bumpAgencyEarningsDaily(agencyId, hostUid, -amt, 'agent_refund');

  await notifyUser(
    hostUid,
    `تم خصم ${amt.toLocaleString('ar-SA')} ماسة من رصيدك — استرداد للداعم`,
    { type: 'agency_refund', agencyId, refundId: refundRef.id },
  );
  await notifyUser(
    supporterUid,
    `استلمت ${amt.toLocaleString('ar-SA')} ماسة — استرداد من وكالتك`,
    { type: 'agency_refund', agencyId, refundId: refundRef.id },
  );

  return { ok: true, refundId: refundRef.id };
});

/** قائمة استردادات الوكالة — للوكيل أو الأدمن */
export const listAgencyRefunds = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { agencyId: rawAgencyId, limit: rawLimit } = request.data as {
    agencyId?: string;
    limit?: number;
  };

  let agencyId = String(rawAgencyId ?? '').trim();
  const adminSnap = await db.collection('admins').doc(uid).get();
  const isAdminUser = adminSnap.exists;

  if (!agencyId) {
    agencyId = await getAgentAgencyId(uid);
  } else if (!isAdminUser) {
    await assertAgencyManager(uid, agencyId);
  } else {
    await assertAdmin(uid);
  }

  const max = Math.min(100, Math.max(1, Number(rawLimit) || 50));
  const snap = await db
    .collection('agencyRefunds')
    .where('agencyId', '==', agencyId)
    .limit(max)
    .get();

  const refunds = await Promise.all(
    snap.docs.map(async (d) => {
      const r = d.data();
      const hostUid = String(r.hostUid ?? '');
      const supporterUid = String(r.supporterUid ?? '');
      const [hostSnap, supporterSnap] = await Promise.all([
        hostUid ? db.collection('users').doc(hostUid).get() : null,
        supporterUid ? db.collection('users').doc(supporterUid).get() : null,
      ]);
      return {
        id: d.id,
        agencyId: String(r.agencyId ?? ''),
        hostUid,
        hostName: String(
          hostSnap?.data()?.profile?.displayName ??
            hostSnap?.data()?.displayName ??
            'مضيف',
        ),
        supporterUid,
        supporterName: String(
          supporterSnap?.data()?.profile?.displayName ??
            supporterSnap?.data()?.displayName ??
            'داعم',
        ),
        amount: Number(r.amount) || 0,
        reason: String(r.reason ?? ''),
        status: String(r.status ?? 'completed'),
        createdAt: Number(r.createdAt) || 0,
      };
    }),
  );

  refunds.sort((a, b) => b.createdAt - a.createdAt);
  return { refunds, agencyId };
});

// ==================== AGENCY GROUP CHAT (دردشة الوكالة الخاصة) ====================

/** يحلّ معرّف المستخدم: uid مباشر أو publicAccountId (8 أرقام) */
async function resolveUidByIdentifier(identifier: string): Promise<string | null> {
  return resolveUserUid(identifier);
}

/** يتحقق أن المستخدم مدير الوكالة (المالك أو وكيل بنفس الوكالة) */
async function assertAgencyManager(uid: string, agencyId: string): Promise<void> {
  const [userSnap, agencySnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('agencies').doc(agencyId).get(),
  ]);
  const u = userSnap.data() ?? {};
  const agency = agencySnap.data() ?? {};
  const isOwner = String(agency.ownerUid ?? '') === uid;
  const isAgentHere = (u.isAgent === true || u.agencyRole === 'owner') && String(u.agencyId ?? '') === String(agencyId);
  if (!isOwner && !isAgentHere) {
    throw new HttpsError('permission-denied', 'هذه العملية لمدير الوكالة فقط');
  }
}

async function isBannedFromAgency(agencyId: string, uid: string): Promise<boolean> {
  const snap = await db.collection('agencies').doc(agencyId).collection('removedMembers').doc(uid).get();
  return snap.exists;
}

async function assertNotBannedFromAgency(agencyId: string, uid: string): Promise<void> {
  if (await isBannedFromAgency(agencyId, uid)) {
    throw new HttpsError(
      'permission-denied',
      'تم إنهاء عضويتك في هذه الوكالة ولا يمكنك الانضمام أو طلب الدخول مجدداً',
    );
  }
}

const SINGLE_AGENCY_MSG = 'يُسمح بعضوية وكالة واحدة فقط — أنت مرتبط بوكالة أخرى';

async function getOwnedAgencyId(uid: string): Promise<string | null> {
  const snap = await db.collection('agencies').where('ownerUid', '==', uid).limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

async function listMemberAgencyIds(uid: string): Promise<string[]> {
  const snap = await db.collection('agencyMembers').where('uid', '==', uid).limit(10).get();
  const ids = new Set<string>();
  const orphanDeletes: Promise<unknown>[] = [];
  snap.docs.forEach((d) => {
    const id = String(d.data().agencyId ?? '').trim();
    if (!id) {
      orphanDeletes.push(d.ref.delete().catch(() => {}));
      return;
    }
    ids.add(id);
  });
  if (orphanDeletes.length) await Promise.all(orphanDeletes);
  return Array.from(ids);
}

/** يمنع أي ارتباط بوكالة غير المسموح بها (وكالة واحدة فقط لكل مضيف/عضو) */
async function assertSingleAgencyMembership(uid: string, allowedAgencyId?: string): Promise<void> {
  const ownedId = await getOwnedAgencyId(uid);
  if (ownedId && (!allowedAgencyId || ownedId !== allowedAgencyId)) {
    throw new HttpsError(
      'already-exists',
      'أنت وكيل/مالك لوكالة — لا يمكن الانضمام أو الارتباط بوكالة أخرى',
    );
  }

  const userSnap = await db.collection('users').doc(uid).get();
  const userAgencyId = String(userSnap.data()?.agencyId ?? '').trim();
  if (userAgencyId && (!allowedAgencyId || userAgencyId !== allowedAgencyId)) {
    const agencySnap = await db.collection('agencies').doc(userAgencyId).get();
    const agencyActive =
      agencySnap.exists &&
      !['expired', 'rejected'].includes(String(agencySnap.data()?.status ?? ''));
    if (agencyActive) {
      const ownerUid = String(agencySnap.data()?.ownerUid ?? '');
      const stillMember = await isActiveAgencyMember(userAgencyId, uid, ownerUid);
      if (stillMember) {
        throw new HttpsError('already-exists', SINGLE_AGENCY_MSG);
      }
    }
    await db.collection('users').doc(uid).update(USER_AGENCY_UNLINK_PATCH).catch(() => {});
  }

  const memberAgencies = await listMemberAgencyIds(uid);
  const conflicts = allowedAgencyId
    ? memberAgencies.filter((id) => id !== allowedAgencyId)
    : memberAgencies;
  if (conflicts.length > 0) {
    throw new HttpsError('already-exists', SINGLE_AGENCY_MSG);
  }
}

async function assertUserCanJoinAgency(uid: string, targetAgencyId: string): Promise<void> {
  await assertNotBannedFromAgency(targetAgencyId, uid);
  await assertSingleAgencyMembership(uid, targetAgencyId);
}

async function assertUserCanJoinAgencyTx(
  tx: FirebaseFirestore.Transaction,
  uid: string,
  targetAgencyId: string,
): Promise<void> {
  const userRef = db.collection('users').doc(uid);
  const userSnap = await tx.get(userRef);
  const userAgencyId = String(userSnap.data()?.agencyId ?? '').trim();
  if (userAgencyId && userAgencyId !== targetAgencyId) {
    throw new HttpsError('already-exists', SINGLE_AGENCY_MSG);
  }

  const memberQuery = db.collection('agencyMembers').where('uid', '==', uid).limit(10);
  const memberSnap = await tx.get(memberQuery);
  const conflicts: string[] = [];
  for (const docSnap of memberSnap.docs) {
    const id = String(docSnap.data().agencyId ?? '').trim();
    if (!id) {
      tx.delete(docSnap.ref);
      continue;
    }
    if (id !== targetAgencyId) conflicts.push(id);
  }
  if (conflicts.length > 0) {
    throw new HttpsError('already-exists', SINGLE_AGENCY_MSG);
  }
}

async function removeUidFromAgencyChat(agencyId: string, targetUid: string): Promise<void> {
  const chatRef = db.collection('agencyChats').doc(agencyId);
  const chatSnap = await chatRef.get();
  if (!chatSnap.exists) return;
  const members: string[] = Array.isArray(chatSnap.data()?.members) ? chatSnap.data()!.members : [];
  if (!members.includes(targetUid)) return;
  await chatRef.update({
    members: admin.firestore.FieldValue.arrayRemove(targetUid),
    [`memberNames.${targetUid}`]: admin.firestore.FieldValue.delete(),
    [`memberAvatars.${targetUid}`]: admin.firestore.FieldValue.delete(),
    updatedAt: Date.now(),
  });
}

async function cancelPendingAgencyInvites(agencyId: string, invitedUid: string): Promise<void> {
  const snap = await db
    .collection('agencyInvites')
    .where('agencyId', '==', agencyId)
    .where('invitedUid', '==', invitedUid)
    .where('status', '==', 'pending')
    .limit(20)
    .get();
  await Promise.all(
    snap.docs.map((d) => d.ref.update({ status: 'cancelled', updatedAt: Date.now() })),
  );
}

async function isActiveAgencyMember(agencyId: string, uid: string, ownerUid: string): Promise<boolean> {
  if (ownerUid && ownerUid === uid) return true;
  const m = await db
    .collection('agencyMembers')
    .where('agencyId', '==', agencyId)
    .where('uid', '==', uid)
    .limit(1)
    .get();
  return !m.empty;
}

/** مشرفو الإشراف (أصفر) في غرفة الوكالة — من RTDB */
async function readAgencySupervisorUids(agencyId: string, ownerUid: string): Promise<Set<string>> {
  const supers = new Set<string>();
  const agencySnap = await db.collection('agencies').doc(agencyId).get();
  if (!agencySnap.exists) return supers;
  const liveRoomId = String(agencySnap.data()?.liveRoomId ?? '').trim();
  if (!liveRoomId) return supers;
  try {
    const roomSnap = await rtdb.ref(`rooms/${liveRoomId}`).once('value');
    if (!roomSnap.exists()) return supers;
    const room = roomSnap.val() as Record<string, unknown>;
    const coHosts = Array.isArray(room.coHosts) ? room.coHosts : [];
    for (const u of coHosts) {
      const uid = String(u ?? '').trim();
      if (uid && uid !== ownerUid) supers.add(uid);
    }
    const memberRoles = (room.memberRoles ?? {}) as Record<string, string>;
    for (const [uid, role] of Object.entries(memberRoles)) {
      if (role === 'yellow_supervisor' && uid !== ownerUid) supers.add(uid);
    }
  } catch (e) {
    console.warn('readAgencySupervisorUids failed:', agencyId, e);
  }
  return supers;
}

/**
 * إزالة عضو من الوكالة (وكيل أو أدمن) — تنظيف كامل + حظر إعادة الانضمام + إشعارات
 */
export const removeAgencyMember = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { memberDocId, agencyId, targetUid, asAdmin } = request.data as {
    memberDocId?: string;
    agencyId?: string;
    targetUid?: string;
    asAdmin?: boolean;
  };

  let memberRef: FirebaseFirestore.DocumentReference;
  let memberData: FirebaseFirestore.DocumentData;
  let aid: string;
  let removedUid: string;

  if (memberDocId?.trim()) {
    memberRef = db.collection('agencyMembers').doc(memberDocId.trim());
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) throw new HttpsError('not-found', 'العضو غير موجود');
    memberData = memberSnap.data()!;
    aid = String(memberData.agencyId ?? '');
    removedUid = String(memberData.uid ?? '');
  } else if (agencyId?.trim() && targetUid?.trim()) {
    aid = agencyId.trim();
    removedUid = targetUid.trim();
    const q = await db
      .collection('agencyMembers')
      .where('agencyId', '==', aid)
      .where('uid', '==', removedUid)
      .limit(1)
      .get();
    if (q.empty) throw new HttpsError('not-found', 'العضو غير موجود');
    memberRef = q.docs[0].ref;
    memberData = q.docs[0].data();
  } else {
    throw new HttpsError('invalid-argument', 'memberDocId أو agencyId+targetUid مطلوب');
  }

  if (!aid || !removedUid) throw new HttpsError('invalid-argument', 'بيانات العضو غير كاملة');

  const agencySnap = await db.collection('agencies').doc(aid).get();
  if (!agencySnap.exists) throw new HttpsError('not-found', 'الوكالة غير موجودة');
  const agency = agencySnap.data()!;
  const ownerUid = String(agency.ownerUid ?? '');

  if (removedUid === ownerUid) {
    throw new HttpsError('failed-precondition', 'لا يمكن إزالة مالك الوكالة');
  }

  let removedByAdmin = false;
  if (asAdmin === true) {
    await assertAdmin(callerUid);
    await assertHasPermission(callerUid, 'agencies');
    removedByAdmin = true;
  } else {
    const supervisorUids = await readAgencySupervisorUids(aid, ownerUid);
    const callerIsOwner = ownerUid === callerUid;
    const callerIsSupervisor = supervisorUids.has(callerUid);
    if (!callerIsOwner && !callerIsSupervisor) {
      throw new HttpsError('permission-denied', 'غير مسموح');
    }
    if (supervisorUids.has(removedUid)) {
      if (callerIsSupervisor) {
        throw new HttpsError('permission-denied', 'لا يمكن إزالة مشرف إشراف آخر');
      }
      throw new HttpsError(
        'failed-precondition',
        'يجب تنزيل المشرف إلى عضو أولاً قبل إنهاء عضويته',
      );
    }
  }

  const wasFemaleHost = memberData.isFemaleHost === true;
  const memberName = String(memberData.uidName ?? 'عضو');
  const agencyName = String(agency.name ?? 'الوكالة');
  const now = Date.now();

  await memberRef.delete();
  await db.collection('users').doc(removedUid).update(USER_AGENCY_UNLINK_PATCH).catch(() => {});
  // إخفاء الدردشة عن العضو المُزال فقط — الرسائل والدردشة تبقيان للوكالة
  await removeUidFromAgencyChat(aid, removedUid);
  await cancelPendingAgencyInvites(aid, removedUid);

  await db.collection('agencies').doc(aid).collection('removedMembers').doc(removedUid).set({
    uid: removedUid,
    removedAt: now,
    removedBy: callerUid,
    removedByAdmin,
    memberName,
  });

  await db.collection('agencies').doc(aid).update({
    memberCount: admin.firestore.FieldValue.increment(-1),
    ...(wasFemaleHost ? { femaleHostCount: admin.firestore.FieldValue.increment(-1) } : {}),
    updatedAt: now,
  }).catch(() => {});

  const chatSnap = await db.collection('agencyChats').doc(aid).get();
  if (chatSnap.exists) {
    await db.collection('agencyChatMessages').add({
      chatId: aid,
      fromUid: 'system',
      fromName: 'النظام',
      fromAvatar: '',
      text: `تم إنهاء عضوية ${memberName} في الوكالة`,
      type: 'text',
      createdAt: now,
    }).catch(() => {});
  }

  await notifyUser(
    removedUid,
    `تم إنهاء عضويتك في وكالة «${agencyName}» ولا يمكنك الانضمام مجدداً`,
    { type: 'agency_member_removed', agencyId: aid, fromUid: callerUid },
  );
  if (ownerUid && ownerUid !== removedUid) {
    await notifyUser(
      ownerUid,
      `تم إزالة «${memberName}» من وكالتك «${agencyName}»`,
      { type: 'agency_member_removed', agencyId: aid, fromUid: removedUid },
    );
  }

  return { ok: true, agencyId: aid, removedUid };
});

/** مزامنة ملف المستخدم — يصحّح agencyId القديم دون المساس بدردشة الوكالة أو رسائلها */
export const syncMyAgencyChats = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const userAgencyId = String(userSnap.data()?.agencyId ?? '').trim();
  if (!userAgencyId) return { ok: true, fixed: [] as string[] };

  const agencySnap = await db.collection('agencies').doc(userAgencyId).get();
  if (!agencySnap.exists) {
    await userRef.update(USER_AGENCY_UNLINK_PATCH).catch(() => {});
    return { ok: true, fixed: [userAgencyId] };
  }

  const ownerUid = String(agencySnap.data()?.ownerUid ?? '');
  const active = await isActiveAgencyMember(userAgencyId, uid, ownerUid);
  if (!active) {
    await userRef.update(USER_AGENCY_UNLINK_PATCH).catch(() => {});
    return { ok: true, fixed: [userAgencyId] };
  }

  return { ok: true, fixed: [] as string[] };
});

/** حذف وكالة نهائياً (أدمن) — تنظيف كامل لكل البيانات المرتبطة */
export const adminDeleteAgency = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { agencyId } = request.data as { agencyId?: string };
  if (!agencyId?.trim()) throw new HttpsError('invalid-argument', 'agencyId مطلوب');
  const aid = agencyId.trim();

  try {
    const agencySnap = await db.collection('agencies').doc(aid).get();
    if (!agencySnap.exists) return { ok: true, deleted: false };

    const agency = agencySnap.data()!;
    await assertAdminCountryScope(adminUid, agency.country as string | undefined);
    await assertHasPermission(adminUid, 'agencies');

    const result = await purgeAgencyCascade(aid);
    if (!result.deleted) return { ok: true, deleted: false };

    await Promise.all(
      Array.from(result.affectedUids).map((uid) =>
        notifyUser(
          uid,
          `تم حذف وكالة «${result.agencyName}» نهائياً من النظام`,
          { type: 'agency_deleted', agencyId: aid },
        ).catch((e) => {
          console.warn('adminDeleteAgency notify failed:', uid, e);
        }),
      ),
    );

    return { ok: true, deleted: true, affected: result.affectedUids.size };
  } catch (e) {
    console.error('adminDeleteAgency failed:', aid, e);
    if (e instanceof HttpsError) throw e;
    const msg = e instanceof Error ? e.message : 'فشل حذف الوكالة';
    throw new HttpsError('internal', msg);
  }
});

/** حذف كل الوكالات نهائياً — مدير النظام فقط */
export const adminDeleteAllAgencies = onCall(
  { memory: '512MiB', timeoutSeconds: 540 },
  async (request) => {
    const adminUid = request.auth?.uid;
    if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
    await assertSuperAdmin(adminUid);

    const { confirmPhrase } = request.data as { confirmPhrase?: string };
    if (confirmPhrase !== 'DELETE_ALL_AGENCIES') {
      throw new HttpsError('failed-precondition', 'اكتب DELETE_ALL_AGENCIES للتأكيد');
    }

    try {
      const result = await purgeAllAgencies();
      return { ok: true, ...result };
    } catch (e) {
      console.error('adminDeleteAllAgencies failed:', e);
      if (e instanceof HttpsError) throw e;
      const msg = e instanceof Error ? e.message : 'فشل حذف الوكالات';
      throw new HttpsError('internal', msg);
    }
  },
);

/** تنظيف بيانات يتيمة لوكالة (حتى لو حُذف مستند الوكالة سابقاً) */
export const adminPurgeAgencyOrphans = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  await assertAdmin(adminUid);
  await assertHasPermission(adminUid, 'agencies');

  const { agencyId } = request.data as { agencyId?: string };
  if (!agencyId?.trim()) throw new HttpsError('invalid-argument', 'agencyId مطلوب');

  const result = await purgeAgencyCascade(agencyId.trim());
  return { ok: true, cleaned: result.deleted, affected: result.affectedUids.size };
});

/** تنظيف بيانات يتيمة لمستخدم (حتى لو حُذف الحساب سابقاً) */
export const adminPurgeUserOrphans = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  await assertAdmin(adminUid);
  await assertHasPermission(adminUid, 'users');

  const { uid } = request.data as { uid?: string };
  if (!uid?.trim()) throw new HttpsError('invalid-argument', 'uid مطلوب');

  await purgeUserCascade(uid.trim());
  return { ok: true };
});

/** حذف منشور نهائياً (أدمن) — مع التعليقات والإعجابات والمشاركات */
export const adminDeletePost = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  await assertAdmin(adminUid);
  await assertHasPermission(adminUid, 'posts');

  const { postId } = request.data as { postId?: string };
  if (!postId?.trim()) throw new HttpsError('invalid-argument', 'postId مطلوب');

  const postSnap = await db.collection('posts').doc(postId.trim()).get();
  if (!postSnap.exists) return { ok: true, deleted: false };

  await deletePostCascade(postId.trim());
  return { ok: true, deleted: true };
});

/** فتح/إنشاء دردشة الوكالة — لأي عضو في الوكالة */
export const openAgencyChat = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  const { agencyId } = request.data as { agencyId?: string };
  if (!agencyId) throw new HttpsError('invalid-argument', 'agencyId مطلوب');

  const [agencySnap, userSnap] = await Promise.all([
    db.collection('agencies').doc(agencyId).get(),
    db.collection('users').doc(uid).get(),
  ]);
  if (!agencySnap.exists) throw new HttpsError('not-found', 'الوكالة غير موجودة');
  const agency = agencySnap.data()!;
  const u = userSnap.data() ?? {};

  const ownerUid = String(agency.ownerUid ?? '');
  const isOwner = ownerUid === uid;
  const isManager = isOwner || ((u.isAgent === true || u.agencyRole === 'owner') && String(u.agencyId ?? '') === String(agencyId));

  const isMember = await isActiveAgencyMember(agencyId, uid, ownerUid);
  if (!isMember) {
    if (String(u.agencyId ?? '') === String(agencyId)) {
      await db.collection('users').doc(uid).update(USER_AGENCY_UNLINK_PATCH).catch(() => {});
    }
    throw new HttpsError('permission-denied', 'لست عضواً في هذه الوكالة');
  }

  const chatRef = db.collection('agencyChats').doc(agencyId);
  const chatSnap = await chatRef.get();
  if (!chatSnap.exists) {
    const membersSnap = await db.collection('agencyMembers').where('agencyId', '==', agencyId).limit(500).get();
    const memberUids = new Set<string>();
    const memberNames: Record<string, string> = {};
    const memberAvatars: Record<string, string> = {};
    const ownerUid = String(agency.ownerUid ?? '');
    if (ownerUid) {
      memberUids.add(ownerUid);
      memberNames[ownerUid] = String(agency.ownerName ?? 'الوكيل');
      memberAvatars[ownerUid] = String(agency.ownerAvatar ?? '');
    }
    membersSnap.docs.forEach((d) => {
      const m = d.data();
      const muid = String(m.uid ?? '');
      if (!muid) return;
      memberUids.add(muid);
      memberNames[muid] = String(m.uidName ?? 'عضو');
      memberAvatars[muid] = String(m.uidAvatar ?? '');
    });
    await chatRef.set({
      agencyId,
      name: String(agency.name ?? 'وكالة'),
      avatar: String(agency.logo ?? agency.ownerAvatar ?? ''),
      ownerUid,
      members: Array.from(memberUids),
      memberNames,
      memberAvatars,
      lastMessage: '',
      lastMessageAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  } else {
    // الدردشة موجودة — أضف العضو الحالي إن لم يكن ضمن members (انضم بعد الإنشاء)
    const existing = chatSnap.data()!;
    const members: string[] = Array.isArray(existing.members) ? existing.members : [];
    if (!members.includes(uid)) {
      const name = String(u.profile?.displayName ?? u.displayName ?? 'عضو');
      const avatar = String(u.profile?.avatar ?? u.avatar ?? '');
      await chatRef.update({
        members: admin.firestore.FieldValue.arrayUnion(uid),
        [`memberNames.${uid}`]: name,
        [`memberAvatars.${uid}`]: avatar,
        updatedAt: Date.now(),
      });
    }
  }

  const fresh = (await chatRef.get()).data()!;
  return { chat: { id: agencyId, ...fresh }, isManager };
});

/** إضافة عضو للدردشة بالـ ID (مدير الوكالة فقط) */
export const addAgencyChatMember = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  const { agencyId, memberId } = request.data as { agencyId?: string; memberId?: string };
  if (!agencyId || !memberId) throw new HttpsError('invalid-argument', 'agencyId و memberId مطلوبان');

  await assertAgencyManager(uid, agencyId);

  const targetUid = await resolveUidByIdentifier(String(memberId));
  if (!targetUid) throw new HttpsError('not-found', 'لم يُعثر على مستخدم بهذا المعرّف');

  const agencySnap = await db.collection('agencies').doc(agencyId).get();
  if (!agencySnap.exists) throw new HttpsError('not-found', 'الوكالة غير موجودة');
  const ownerUid = String(agencySnap.data()?.ownerUid ?? '');
  const isMember = await isActiveAgencyMember(agencyId, targetUid, ownerUid);
  if (!isMember) {
    throw new HttpsError('failed-precondition', 'المستخدم ليس عضواً في هذه الوكالة');
  }

  const t = (await db.collection('users').doc(targetUid).get()).data() ?? {};
  const name = String(t.displayName ?? t.profile?.displayName ?? 'عضو');
  const avatar = String(t.avatar ?? t.profile?.avatar ?? '');

  await db.collection('agencyChats').doc(agencyId).update({
    members: admin.firestore.FieldValue.arrayUnion(targetUid),
    [`memberNames.${targetUid}`]: name,
    [`memberAvatars.${targetUid}`]: avatar,
    updatedAt: Date.now(),
  });

  return { ok: true, uid: targetUid, name, avatar };
});

/** إزالة عضو من الدردشة (مدير الوكالة فقط) */
export const removeAgencyChatMember = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  const { agencyId, targetUid } = request.data as { agencyId?: string; targetUid?: string };
  if (!agencyId || !targetUid) throw new HttpsError('invalid-argument', 'agencyId و targetUid مطلوبان');

  await assertAgencyManager(uid, agencyId);

  const agency = (await db.collection('agencies').doc(agencyId).get()).data() ?? {};
  if (String(agency.ownerUid ?? '') === String(targetUid)) {
    throw new HttpsError('failed-precondition', 'لا يمكن إزالة مالك الوكالة');
  }

  await db.collection('agencyChats').doc(agencyId).update({
    members: admin.firestore.FieldValue.arrayRemove(targetUid),
    [`memberNames.${targetUid}`]: admin.firestore.FieldValue.delete(),
    [`memberAvatars.${targetUid}`]: admin.firestore.FieldValue.delete(),
    updatedAt: Date.now(),
  });

  return { ok: true };
});

/** تغيير اسم عشيرة الوكالة (دردشة الأعضاء) — مدير الوكالة فقط */
export const updateAgencyChatName = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { agencyId, name } = request.data as { agencyId?: string; name?: string };
  const aid = String(agencyId ?? '').trim();
  const trimmed = String(name ?? '').trim();
  if (!aid) throw new HttpsError('invalid-argument', 'agencyId مطلوب');
  if (trimmed.length < 2 || trimmed.length > 40) {
    throw new HttpsError('invalid-argument', 'اسم العشيرة بين 2 و 40 حرفاً');
  }

  await assertAgencyManager(uid, aid);

  const agencySnap = await db.collection('agencies').doc(aid).get();
  if (!agencySnap.exists) throw new HttpsError('not-found', 'الوكالة غير موجودة');
  const agency = agencySnap.data()!;

  const chatRef = db.collection('agencyChats').doc(aid);
  const chatSnap = await chatRef.get();
  const now = Date.now();

  if (!chatSnap.exists) {
    const membersSnap = await db.collection('agencyMembers').where('agencyId', '==', aid).limit(500).get();
    const memberUids = new Set<string>();
    const memberNames: Record<string, string> = {};
    const memberAvatars: Record<string, string> = {};
    const ownerUid = String(agency.ownerUid ?? '');
    if (ownerUid) {
      memberUids.add(ownerUid);
      memberNames[ownerUid] = String(agency.ownerName ?? 'الوكيل');
      memberAvatars[ownerUid] = String(agency.ownerAvatar ?? '');
    }
    membersSnap.docs.forEach((d) => {
      const m = d.data();
      const muid = String(m.uid ?? '');
      if (!muid) return;
      memberUids.add(muid);
      memberNames[muid] = String(m.uidName ?? 'عضو');
      memberAvatars[muid] = String(m.uidAvatar ?? '');
    });
    await chatRef.set({
      agencyId: aid,
      name: trimmed,
      avatar: String(agency.logo ?? agency.ownerAvatar ?? ''),
      ownerUid,
      members: Array.from(memberUids),
      memberNames,
      memberAvatars,
      lastMessage: '',
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true, name: trimmed, created: true };
  }

  const oldName = String(chatSnap.data()?.name ?? '');
  await chatRef.update({ name: trimmed, updatedAt: now });

  if (oldName !== trimmed) {
    await db.collection('agencyChatMessages').add({
      chatId: aid,
      fromUid: 'system',
      fromName: 'النظام',
      fromAvatar: '',
      text: `تم تغيير اسم العشيرة إلى «${trimmed}»`,
      type: 'text',
      createdAt: now,
    }).catch(() => {});
    await chatRef.update({
      lastMessage: `تم تغيير اسم العشيرة إلى «${trimmed}»`,
      lastMessageAt: now,
    }).catch(() => {});
  }

  return { ok: true, name: trimmed, created: false };
});

/** حذف دردشة الوكالة بالكامل (الرسائل + المستند) — مدير الوكالة فقط */
export const deleteAgencyChatCompletely = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { agencyId } = request.data as { agencyId?: string };
  const aid = String(agencyId ?? '').trim();
  if (!aid) throw new HttpsError('invalid-argument', 'agencyId مطلوب');

  await assertAgencyManager(uid, aid);

  const chatRef = db.collection('agencyChats').doc(aid);
  const chatSnap = await chatRef.get();
  if (!chatSnap.exists) return { ok: true, deleted: false };

  await deleteFirestoreWhere('agencyChatMessages', 'chatId', aid);
  await chatRef.delete();

  try {
    const bucket = admin.storage().bucket();
    for (const prefix of [`agency_chat_images/${aid}/`, `agency_chat_voices/${aid}/`]) {
      const [files] = await bucket.getFiles({ prefix });
      await Promise.all(files.map((f) => f.delete().catch(() => {})));
    }
  } catch {
    /* ignore storage cleanup errors */
  }

  return { ok: true, deleted: true };
});

/** حالة اليانصيب الأسبوعي — وقت السيرفر + العداد + الفائز الحالي */
export const getWeeklyLotteryState = onCall(async (request) => {
  const uid = request.auth?.uid ?? null;
  const schedule = computeLotterySchedule(Date.now());

  const [ticketsSnap, featuredSnap, latestDrawSnap] = await Promise.all([
    db.collection('lotteryTickets').where('weekId', '==', schedule.weekId).get(),
    db.collection('lotteryState').doc('featured').get(),
    db
      .collection('weeklyLotteryDraws')
      .orderBy('drawnAt', 'desc')
      .limit(1)
      .get()
      .catch(() => null),
  ]);

  let myTickets = 0;
  if (uid) {
    myTickets = ticketsSnap.docs.filter((d) => String(d.data().uid ?? '') === uid).length;
  }

  const featured = featuredSnap.exists ? featuredSnap.data() : null;
  const latestDraw = latestDrawSnap && !latestDrawSnap.empty
    ? { weekId: latestDrawSnap.docs[0].id, ...latestDrawSnap.docs[0].data() }
    : null;

  return {
    ok: true,
    serverNowMs: schedule.serverNowMs,
    weekId: schedule.weekId,
    phase: schedule.phase,
    salesOpen: schedule.salesOpen,
    countdownTargetMs: schedule.countdownTargetMs,
    drawAtMs: schedule.drawAtMs,
    nextRoundStartMs: schedule.nextRoundStartMs,
    totalTickets: ticketsSnap.size,
    myTickets,
    featuredWinner: featured && featured.emptyDraw !== true ? featured : latestDraw,
    countdown: getCountdownParts(schedule.countdownTargetMs, schedule.serverNowMs),
  };
});

/** شراء تذاكر اليانصيب — يُتحقق من وقت السيرفر */
export const buyWeeklyLotteryTickets = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { count } = request.data as { count?: number };
  const ticketCount = Math.floor(Number(count) || 0);
  if (!Number.isFinite(ticketCount) || ticketCount < 1 || ticketCount > 500) {
    throw new HttpsError('invalid-argument', 'عدد التذاكر غير صالح (1–500)');
  }

  const schedule = computeLotterySchedule(Date.now());
  if (!schedule.salesOpen) {
    throw new HttpsError(
      'failed-precondition',
      schedule.phase === 'announcing'
        ? 'تم السحب — يفتح اليانصيب الجديد السبت الساعة 12'
        : 'شراء التذاكر مغلق حالياً',
    );
  }

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');
  const user = userSnap.data()!;

  const configSnap = await db.collection('config').doc('games').get();
  const global = configSnap.exists
    ? (configSnap.data()?.global as Record<string, unknown> | undefined)
    : undefined;
  const ticketPrice = Number(global?.lotteryTicketPrice) || 200_000;
  const totalCost = ticketPrice * ticketCount;
  const balance = pickCoinsBalance(user);
  if (balance < totalCost) {
    throw new HttpsError(
      'failed-precondition',
      `تحتاج ${totalCost.toLocaleString('en-US')} كوين — رصيدك ${balance.toLocaleString('en-US')}`,
    );
  }

  const displayName = String(
    (user.profile as { displayName?: string } | undefined)?.displayName
      ?? user.displayName
      ?? 'مستخدم',
  );
  const publicAccountId = user.publicAccountId != null ? String(user.publicAccountId) : null;
  const now = Date.now();

  await userRef.update({
    'stats.coins': admin.firestore.FieldValue.increment(-totalCost),
    coins: admin.firestore.FieldValue.increment(-totalCost),
    updatedAt: now,
  });

  const batch = db.batch();
  const ids: string[] = [];
  for (let i = 0; i < ticketCount; i++) {
    const ref = db.collection('lotteryTickets').doc();
    ids.push(ref.id);
    batch.set(ref, {
      uid,
      weekId: schedule.weekId,
      price: ticketPrice,
      purchasedAt: now + i,
      isWinner: false,
      displayName,
      publicAccountId,
    });
  }
  await batch.commit();

  return { ok: true, ticketIds: ids, weekId: schedule.weekId, totalCost };
});

/** سحب اليانصيب الأسبوعي تلقائياً — كل سبت 11:00 (الرياض) */
/**
 * كنّاس حضور الغرف — يزيل «الأشباح» من جمهور الغرف: أعضاء قُتل تطبيقهم قبل
 * أن يسجّل onDisconnect على السيرفر فبقيت صورهم على بطاقات الوكالات كأنهم
 * ما زالوا داخل الغرفة. القاعدة: عضو جمهور انضم قبل >10 دقائق وحضوره العام
 * (presence/{uid}) غائب أو أقدم من 10 دقائق = شبح ⇒ يُحذف.
 */
export const sweepGhostRoomAudience = onSchedule('every 10 minutes', async () => {
  const [audSnap, presenceSnap, roomsSnap, pointerSnap] = await Promise.all([
    rtdb.ref('roomAudience').get(),
    rtdb.ref('presence').get(),
    rtdb.ref('rooms').get(),
    rtdb.ref('userCurrentRoom').get(),
  ]);
  const presence = (presenceSnap.val() ?? {}) as Record<string, unknown>;
  const pointers = (pointerSnap.val() ?? {}) as Record<
    string,
    { roomId?: string; at?: number } | null
  >;
  const now = Date.now();
  const STALE_MS = 10 * 60 * 1000;
  const updates: Record<string, unknown> = {};
  const isStale = (uid: string): boolean => {
    const lastSeen = Number(presence[uid]) || 0;
    return now - lastSeen >= STALE_MS;
  };
  // متصل بالتطبيق لكن مؤشره الحالي يشير لغرفة أخرى منذ مدة ⇒ غادر هذه الغرفة
  // ولم يُنظَّف أثره (كان يبقى على شريط الهدايا/المقاعد وهو خارج الوكالة)
  const movedElsewhere = (uid: string, roomId: string): boolean => {
    const p = pointers[uid];
    if (!p?.roomId || p.roomId === roomId) return false;
    const at = Number(p.at) || 0;
    return now - at >= 2 * 60 * 1000;
  };
  if (audSnap.exists()) {
    audSnap.forEach((roomSnap) => {
      const roomId = String(roomSnap.key);
      roomSnap.forEach((memberSnap) => {
        const uid = memberSnap.key;
        if (!uid) return;
        const joinedAt = Number(memberSnap.child('joinedAt').val()) || 0;
        if (now - joinedAt < STALE_MS) return; // انضمام حديث — أمهله
        if (isStale(uid)) {
          updates[`roomAudience/${roomId}/${uid}`] = null;
          updates[`userCurrentRoom/${uid}`] = null;
          return;
        }
        if (movedElsewhere(uid, roomId)) {
          updates[`roomAudience/${roomId}/${uid}`] = null;
        }
      });
    });
  }
  // مقاعد «معلّقة» — جالس على مايك وحضوره منقطع كلياً أو انتقل لغرفة أخرى
  // (تنظيف الأجهزة الحيّ لا يعمل إذا خرج الجميع من الغرفة)
  if (roomsSnap.exists()) {
    roomsSnap.forEach((roomSnap) => {
      const roomId = String(roomSnap.key);
      const seatsSnap = roomSnap.child('seats');
      if (!seatsSnap.exists()) return;
      seatsSnap.forEach((seatSnap) => {
        const uid = String(seatSnap.child('uid').val() ?? '');
        if (!uid) return;
        const joinedAt = Number(seatSnap.child('joinedAt').val()) || 0;
        if (joinedAt > 0 && now - joinedAt < STALE_MS) return;
        if (!isStale(uid) && !movedElsewhere(uid, roomId)) return;
        updates[`rooms/${roomId}/seats/${seatSnap.key}`] = { uid: '' };
      });
    });
  }
  const count = Object.keys(updates).length;
  if (count > 0) {
    await rtdb.ref().update(updates);
    console.log('sweepGhostRoomAudience: removed', count, 'stale entries');
  }
});

export const scheduledWeeklyLotteryDraw = onSchedule(
  {
    schedule: '0 11 * * 6',
    timeZone: 'Asia/Riyadh',
  },
  async () => {
    const schedule = computeLotterySchedule(Date.now());
    const draw = await executeWeeklyLotteryDraw(db, schedule.weekId);
    if (!draw) {
      console.log('scheduledWeeklyLotteryDraw: no tickets for week', schedule.weekId);
      return;
    }
    console.log(
      'scheduledWeeklyLotteryDraw:',
      schedule.weekId,
      draw.winnerUid,
      draw.prize,
    );
    await notifyUser(
      draw.winnerUid,
      `مبروك! فزت باليانصيب الأسبوعي — ${draw.prize.toLocaleString('en-US')} كوين 🎉`,
      { type: 'lottery_win', weekId: draw.weekId, prize: draw.prize },
    ).catch((e) => console.warn('lottery winner notify failed:', e));
  },
);

/**
 * سحب يانصيب أسبوعي يدوي من لوحة التحكم — يستدعي نفس منطق السحب المجدول
 * (executeWeeklyLotteryDraw) عبر Admin SDK بدل الكتابة المباشرة من العميل
 * (كانت محظورة أصلاً بقواعد Firestore: weeklyLotteryDraws/lotteryTickets كتابتها false).
 */
export const adminRunWeeklyLotteryDraw = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  await assertAdmin(adminUid);
  await assertHasPermission(adminUid, 'games');

  const { weekId } = request.data as { weekId?: string };
  const draw = await executeWeeklyLotteryDraw(db, weekId?.trim() || undefined);
  if (!draw) {
    throw new HttpsError('failed-precondition', 'لا توجد تذاكر مشتراة لهذا الأسبوع');
  }

  return draw;
});

// ==================== CREDIT AGENCY PEARLS ON GIFT ====================
/**
 * Trigger: عند إنشاء معاملة ماسة واردة لمضيفة في وكالة،
 * يزيد pearlsEarned في وثيقة عضويتها (agencyMembers) تلقائياً.
 *
 * يعمل بصلاحيات admin (يتجاوز قواعد الأمان) ويغطّي كل مسارات الهدايا.
 * هذا ما يجعل لوحات الأرصدة والترتيب والرواتب تعرض أرقاماً حقيقية.
 */
const PEARL_EARNING_TYPES = new Set([
  'gift_received',
  'transfer_received',
  'treasure_won',
  'seat_fee_received',
  'lucky_bag_won',
  'locked_media_earn',
  'call_earning',
]);

/** هذه الأنواع تُحدّث محفظة المستخدم قبل إنشاء المعاملة — لا نكرّر الإضافة */
const PEARL_WALLET_PRE_CREDITED_TYPES = new Set([
  'call_earning',
  'transfer_received',
  'withdrawal_refund',
  'agent_refund',
  'gift_received',
]);

/** عند إرسال هدية داخل غرفة وكالة — يزيد دعم الفترة (مستوى الوكالة) */
export const bumpAgencyPeriodSupportOnGiftSent = onDocumentCreated(
  { document: 'transactions/{txId}', maxInstances: 20 },
  async (event) => {
    const tx = event.data?.data();
    if (!tx) return;
    if (String(tx.type ?? '') !== 'gift_sent') return;

    const roomId = String(tx.roomId ?? '').trim();
    if (!roomId) return;

    const coins = Math.abs(Number(tx.amount) || 0);
    if (coins <= 0) return;

    const guardRef = db
      .collection('processedEvents')
      .doc(`bumpAgencyPeriodSupportOnGiftSent_${event.params.txId}`);

    try {
      const alreadyProcessed = await db.runTransaction(async (t) => {
        const guardSnap = await t.get(guardRef);
        if (guardSnap.exists) return true;
        t.set(guardRef, { processedAt: Date.now(), txId: event.params.txId });
        return false;
      });
      if (alreadyProcessed) return;

      const roomSnap = await rtdb.ref(`rooms/${roomId}`).once('value');
      const agencyId = String(roomSnap.val()?.agencyId ?? '').trim();
      if (!agencyId) return;

      await bumpAgencyPeriodSupportCoins(agencyId, coins);
    } catch (e) {
      console.error('bumpAgencyPeriodSupportOnGiftSent:', e);
    }
  },
);

export const creditAgencyPearlsOnGift = onDocumentCreated(
  { document: 'transactions/{txId}', maxInstances: 20 },
  async (event) => {
    const tx = event.data?.data();
    if (!tx) return;

    // فقط معاملات الماسة الواردة (دخل) موجبة القيمة
    if (!PEARL_EARNING_TYPES.has(String(tx.type ?? ''))) return;
    if (String(tx.currency ?? 'pearls') !== 'pearls') return;
    const pearls = Number(tx.amount) || 0;
    if (pearls <= 0) return;

    const hostUid = String(tx.uid ?? '');
    if (!hostUid) return;

    // حارس idempotency: التريغر at-least-once، نمنع ازدواج العدّ عند إعادة التسليم
    // عبر تسجيل معالجة معرّف المعاملة المصدر مرّة واحدة ذرّياً قبل الزيادة.
    const guardRef = db
      .collection('processedEvents')
      .doc(`creditAgencyPearlsOnGift_${event.params.txId}`);

    try {
      const alreadyProcessed = await db.runTransaction(async (t) => {
        const guardSnap = await t.get(guardRef);
        if (guardSnap.exists) return true;
        t.set(guardRef, { processedAt: Date.now(), txId: event.params.txId });
        return false;
      });
      if (alreadyProcessed) return;

      // المستلم عضو في وكالة واحدة على الأكثر — نبحث بالـ uid مباشرة
      // (لا نعتمد على agencyId في وثيقة المستخدم لأنه قد يكون غير مضبوط في بعض المسارات)
      const memberSnap = await db
        .collection('agencyMembers')
        .where('uid', '==', hostUid)
        .limit(1)
        .get();
      if (memberSnap.empty) return;

      const memberDoc = memberSnap.docs[0];
      const txType = String(tx.type ?? '');
      const batch = db.batch();
      batch.update(memberDoc.ref, {
        pearlsEarned: admin.firestore.FieldValue.increment(pearls),
      });

      if (!PEARL_WALLET_PRE_CREDITED_TYPES.has(txType)) {
        const userRef = db.collection('users').doc(hostUid);
        batch.update(userRef, {
          pearls: admin.firestore.FieldValue.increment(pearls),
          'stats.pearls': admin.firestore.FieldValue.increment(pearls),
          updatedAt: Date.now(),
        });
      }
      await batch.commit();

      const memberAgencyId = String(memberDoc.data().agencyId ?? '');
      if (memberAgencyId) {
        await creditBdReferralCommission(memberAgencyId, pearls);
        await bumpAgencyEarningsDaily(memberAgencyId, hostUid, pearls, String(tx.type ?? ''));
      }
    } catch (e) {
      console.error('creditAgencyPearlsOnGift:', e);
    }
  },
);

/** إشعار المُبلّغ عند تحديث حالة البلاغ (تم الحل / مرفوض / قيد المراجعة) */
export const notifyReporterOnReportStatus = onDocumentUpdated(
  'reports/{reportId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const prevStatus = String(before.status ?? '');
    const nextStatus = String(after.status ?? '');
    if (prevStatus === nextStatus) return;

    const reporterUid = String(after.reporterUid ?? '');
    if (!reporterUid) return;

    let title = '';
    let body = '';

    if (nextStatus === 'resolved') {
      title = 'تمت مراجعة بلاغك ✅';
      body = 'تم قبول بلاغك واتخاذ الإجراء المناسب.';
    } else if (nextStatus === 'dismissed') {
      title = 'تم رفض البلاغ';
      body = 'راجعنا بلاغك ولم نجد مخالفة تستدعي إجراءاً.';
    } else if (nextStatus === 'reviewing') {
      title = 'بلاغك قيد المراجعة';
      body = 'بدأ فريقنا بمراجعة بلاغك وسنُبلّغك بالنتيجة.';
    } else {
      return;
    }

    const adminNote = String(after.adminNote ?? '').trim();
    const bodyWithNote = adminNote ? `${body}\nملاحظة: ${adminNote.slice(0, 200)}` : body;
    const fullMessage = `${title}\n${bodyWithNote}`;

    await notifyUser(reporterUid, fullMessage, {
      type: 'report_update',
      title,
      body: bodyWithNote,
      reportId: event.params.reportId,
      reportStatus: nextStatus,
    });
  },
);

// ==================== HOST TASKS — رسالة واردة للمضيفة ====================

const DEFAULT_HOST_TASKS_CFG = {
  enabled: true,
  tasks: {
    messages: { enabled: true, target: 1000, rewardCoins: 10_000, repeatable: true },
    voiceCalls: { enabled: true, target: 60, rewardCoins: 50_000, repeatable: false },
    videoCalls: { enabled: true, target: 60, rewardCoins: 120_000, repeatable: false },
    voiceCompetition: { enabled: true, target: 10, rewardCoins: 15_000, repeatable: true },
    videoCompetition: { enabled: true, target: 10, rewardCoins: 25_000, repeatable: true },
    dailyOnline: { enabled: true, target: 480, rewardCoins: 5_000, repeatable: false },
  },
};

function hostTodayKey(resetHour = 0): string {
  const HOST_TASKS_TZ_OFFSET_MS = 3 * 60 * 60 * 1000;
  const shifted = new Date(Date.now() + HOST_TASKS_TZ_OFFSET_MS - resetHour * 3_600_000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

function isAgencyAgentAccount(data: FirebaseFirestore.DocumentData): boolean {
  return data.agencyRole === 'owner' || data.agencyRole === 'agent' || data.isAgent === true;
}

function isHostessVerifiedAccount(data: FirebaseFirestore.DocumentData): boolean {
  return data.isVerified === true || data.verificationStatus === 'approved';
}

function canEarnHostTasksAccount(data: FirebaseFirestore.DocumentData): boolean {
  const isFemale = (data.profile?.gender ?? data.gender) === 'female';
  return isFemale && !isAgencyAgentAccount(data) && isHostessVerifiedAccount(data);
}

function shouldCountHostTaskMessage(senderData: FirebaseFirestore.DocumentData): boolean {
  if (canEarnHostTasksAccount(senderData)) return false;
  if (isAgencyAgentAccount(senderData)) return false;
  return true;
}

function readHostProgress(data: FirebaseFirestore.DocumentData, resetHour = 0) {
  const today = hostTodayKey(resetHour);
  const raw = data.hostTasksProgress ?? {};
  if (raw.dateKey !== today) {
    return {
      dateKey: today,
      messagesReceived: 0,
      paidMessageMilestones: 0,
      callSecondsByPartner: { voice: {}, video: {} },
      voiceCallRewardPaid: false,
      videoCallRewardPaid: false,
      voiceCompetitionSessions: 0,
      paidVoiceCompMilestones: 0,
      videoCompetitionSessions: 0,
      paidVideoCompMilestones: 0,
      onlineMinutes: 0,
      hasInteraction: false,
      onlineRewardPaid: false,
      coinsEarnedToday: 0,
    };
  }
  return {
    ...raw,
    dateKey: today,
    voiceCompetitionSessions: Number(raw.voiceCompetitionSessions ?? raw.voiceCompetitionMinutes ?? 0),
  };
}

function totalCallMins(secondsByPartner: Record<string, number>): number {
  return Object.values(secondsByPartner ?? {}).reduce(
    (s, v) => s + Math.floor(Number(v) / 60),
    0,
  );
}

function applyHostRewards(
  progress: ReturnType<typeof readHostProgress>,
  _cfg: typeof DEFAULT_HOST_TASKS_CFG,
) {
  return { progress, coins: 0 };
}

/**
 * @deprecated العدّ انتقل إلى countHostTaskMessageOnCreate (trigger على messages).
 * تبقى الدالة no-op حتى لا تفشل نسخ التطبيق القديمة التي ما زالت تستدعيها —
 * ولو زادت العدّاد هنا أيضاً لتضاعف العدّ مع الـ trigger.
 */
export const recordHostMessageReceived = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  return { ok: true, coins: 0 };
});

// حسابات النظام الرسمية — رسائلها مجانية فلا تدخل في عدّ مهام المضيفة
const HOST_TASKS_OFFICIAL_UIDS = new Set([
  'linkup_support',
  'linkup_assistant',
  'linkup_feedback',
  'linkup_recharge_bot',
]);

/**
 * عدّ «الرسائل الواردة» لمهام المضيفة من السيرفر مباشرة عند إنشاء مستند الرسالة —
 * لا يعتمد على نسخة تطبيق المرسل ولا على استدعاء callable من جهازه.
 * تُحسب الرسالة فقط إذا كانت مدفوعة فعلاً (نفس منطق خصم الكوينز في التطبيق):
 * نص/صورة/صوت بسعر > 0، المرسل ذكر ليس وكيلاً ولا حساباً رسمياً، والمستلمة مضيفة موثّقة.
 * الرسائل المتكررة من نفس الشخص تُحسب كلها.
 */
// (أُعيدت التسمية من countHostTaskMessageOnCreate — علِقت نسخة معطوبة بالاسم
// القديم على السيرفر من نشر جزئي فاشل ورفضت المنصة تغيير نوعها؛ الاسم الجديد
// يُنشأ نظيفاً والقديم يُحذف تلقائياً مع --force)
export const hostTaskMessageCounter = onDocumentCreated(
  'messages/{messageId}',
  async (event) => {
    const msg = event.data?.data();
    if (!msg) return;
    const fromUid = String(msg.fromUid ?? '');
    const toUid = String(msg.toUid ?? '');
    const type = String(msg.type ?? 'text');
    if (!fromUid || !toUid || fromUid === toUid) return;
    if (type !== 'text' && type !== 'image' && type !== 'voice') return;
    if (HOST_TASKS_OFFICIAL_UIDS.has(fromUid) || HOST_TASKS_OFFICIAL_UIDS.has(toUid)) return;

    const cfgSnap = await db.doc('config/hostTasks').get();
    const cfgRaw = (cfgSnap.exists ? cfgSnap.data()! : {}) as Record<string, any>;
    const cfg = {
      ...DEFAULT_HOST_TASKS_CFG,
      ...cfgRaw,
      tasks: { ...DEFAULT_HOST_TASKS_CFG.tasks, ...(cfgRaw.tasks ?? {}) },
    };
    if (!cfg.enabled || !cfg.tasks.messages.enabled) return;

    // سعر الرسالة من config/callPricing — سعر 0 أو التسعير معطّل = رسالة مجانية لا تُحسب
    const pricingSnap = await db.doc('config/callPricing').get();
    const pricingRaw = (pricingSnap.exists ? pricingSnap.data()! : {}) as Record<string, any>;
    const msgPricing = (pricingRaw.messages ?? {}) as Record<string, any>;
    if (msgPricing.enabled === false) return;
    const price = Number(
      type === 'text'
        ? msgPricing.textMessage ?? 200
        : type === 'voice'
          ? msgPricing.voiceMessage ?? 200
          : msgPricing.imageMessage ?? 200,
    );
    if (!(price > 0)) return;

    const resetHour = Number(cfgRaw.resetHour ?? 0);
    const hostRef = db.collection('users').doc(toUid);
    const senderRef = db.collection('users').doc(fromUid);

    await db.runTransaction(async (tx) => {
      const [hostSnap, senderSnap] = await Promise.all([tx.get(hostRef), tx.get(senderRef)]);
      if (!hostSnap.exists || !senderSnap.exists) return;
      const hostData = hostSnap.data()!;
      const senderData = senderSnap.data()!;
      if (!canEarnHostTasksAccount(hostData)) return;
      if (!shouldCountHostTaskMessage(senderData)) return;
      // الإناث يرسلن مجاناً (موثّقات وغير موثّقات) — رسائلهن غير مدفوعة فلا تُحسب
      if ((senderData.profile?.gender ?? senderData.gender) === 'female') return;

      const progress = readHostProgress(hostData, resetHour);
      progress.messagesReceived = (Number(progress.messagesReceived) || 0) + 1;

      tx.update(hostRef, {
        hostTasksProgress: progress,
        updatedAt: Date.now(),
      });
    });
  },
);

// ==================== REVOKE REGISTERED DEVICE ====================
/** إزالة جهاز من الحساب — يُضاف لقائمة المحظورين ولا يستطيع الدخول مجدداً */
export const revokeRegisteredDevice = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const { deviceId } = request.data as { deviceId?: string };
  if (!deviceId?.trim()) {
    throw new HttpsError('invalid-argument', 'deviceId مطلوب');
  }

  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');

  const data = snap.data()!;
  const devices = Array.isArray(data.registeredDevices) ? data.registeredDevices : [];
  const revoked = new Set<string>(
    Array.isArray(data.revokedDeviceIds) ? data.revokedDeviceIds.map(String) : [],
  );
  revoked.add(deviceId.trim());

  await userRef.update({
    registeredDevices: devices.filter((d: { id?: string }) => d?.id !== deviceId.trim()),
    revokedDeviceIds: Array.from(revoked),
    updatedAt: Date.now(),
  });

  return { ok: true };
});

// ==================== ARISTOCRACY — استعادة أصول Storage (أدمن) ====================
const ARISTOCRACY_LEVEL_FOLDER_IDS = ['noble', 'minister', 'prince', 'king', 'aristocrat'] as const;

type AristocracyStorageMeta = {
  levelId: string;
  privId: string;
  assetKey: string;
  titleAr?: string;
  titleEn?: string;
};

/** يفهرس ملفات config/aristocracy/* عبر Admin SDK (يتجاوز قيود list في العميل) */
export const adminDiscoverAristocracyUploads = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  await assertAdmin(adminUid);
  await assertHasPermission(adminUid, 'aristocracy');

  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles({ prefix: 'config/aristocracy/' });
  const byFolder = new Map<string, typeof files>();

  for (const file of files) {
    const parts = file.name.split('/');
    if (parts.length < 3) continue;
    const storageId = parts[2];
    const list = byFolder.get(storageId) ?? [];
    list.push(file);
    byFolder.set(storageId, list);
  }

  const uploads: Array<
    AristocracyStorageMeta & {
      storageId: string;
      imageUrl?: string;
      videoUrl?: string;
      videoUrlMp4?: string;
    }
  > = [];

  for (const [storageId, folderFiles] of byFolder) {
    if (ARISTOCRACY_LEVEL_FOLDER_IDS.includes(storageId as (typeof ARISTOCRACY_LEVEL_FOLDER_IDS)[number])) {
      continue;
    }

    let levelId = '';
    let privId = '';
    for (const lid of ARISTOCRACY_LEVEL_FOLDER_IDS) {
      if (storageId.startsWith(`${lid}_`)) {
        levelId = lid;
        privId = storageId.slice(lid.length + 1);
        break;
      }
    }
    if (!levelId || !privId) continue;

    let imageUrl: string | undefined;
    let videoUrl: string | undefined;
    let videoUrlMp4: string | undefined;
    let meta: AristocracyStorageMeta | undefined;

    for (const file of folderFiles) {
      const name = file.name.split('/').pop()?.toLowerCase() ?? '';
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`;

      if (name === 'meta.json') {
        try {
          const [buf] = await file.download();
          meta = JSON.parse(buf.toString('utf8')) as AristocracyStorageMeta;
        } catch {
          /* ignore invalid meta */
        }
        continue;
      }
      if (name.startsWith('privilege.') || name.startsWith('emblem.')) imageUrl = publicUrl;
      else if (name.startsWith('video_ios.')) videoUrlMp4 = publicUrl;
      else if (name.startsWith('video.')) videoUrl = publicUrl;
    }

    if (!imageUrl && !videoUrl && !videoUrlMp4) continue;

    const assetKey = meta?.assetKey || (videoUrl || videoUrlMp4 ? 'entry' : 'badge');
    uploads.push({
      storageId,
      levelId: meta?.levelId || levelId,
      privId: meta?.privId || privId,
      assetKey,
      titleAr: meta?.titleAr,
      titleEn: meta?.titleEn,
      imageUrl,
      videoUrl,
      videoUrlMp4,
    });
  }

  return { uploads };
});

// ==================== SHARE LINKS (روابط مختصرة + Deep Link) ====================
export { createShareLink, shareRedirect, resolveShareLink } from './shareLinks';
export { recordLoginSession } from './loginSession';
export { processKycVerification, verifyGenderFace, repairKycMismatchBan } from './kycVerification';
export { getLandmarkQuizRound, getLandmarkCountries } from './intelligenceLandmarkQuiz';
export { placeIntelligenceGameBet } from './intelligenceGames';
export { roomGamesApi } from './roomGamesApi';
export { rechargeBotApi } from './rechargeBotApi';
export { onRoomAudienceRemoved, onUserPresenceRemoved, onRoomSeatHoldRemoved } from './roomPresenceCleanup';
export {
  adminCreateStaffUser,
  adminUpdateStaffUser,
  adminRemoveStaffUser,
} from './platformStaff';
