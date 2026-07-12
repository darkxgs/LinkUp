/**
 * منطق KYC المشترك — الحالات والنتائج كما في Firestore
 *
 * فلسفة القرار (سريع + مظبوط):
 * - قرار آلي فوري (قبول/رفض) لكل النتائج الحاسمة.
 * - «غير واضح» أو «منطقة رمادية» → رفض لطيف فوري برسالة «أعيدي التصوير في إضاءة أوضح»
 *   بدل تعليق الطلب في صف مراجعة صامت.
 * - المراجعة اليدوية استثناء مُدار للحالات الحقيقية فقط (انقطاع المزوّدات، تعارض بيانات
 *   الحساب، محاولات رمادية متكررة) مع رسالة صريحة «قيد المراجعة اليدوية».
 */
import { randomUUID } from 'crypto';
import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';

const db = admin.firestore();

/** يحفظ صورة التحقق في Storage ويرجع رابطاً دائماً للوحة التحكم */
export async function persistKycVerificationImage(
  uid: string,
  imageBytes: Buffer,
  kind: 'face' | 'frame' = 'face',
): Promise<string> {
  const bucket = admin.storage().bucket();
  const fileName = kind === 'face' ? `face_${Date.now()}.jpg` : `frame_${Date.now()}.jpg`;
  const path = `kyc/${uid}/${fileName}`;
  const token = randomUUID();
  const file = bucket.file(path);
  await file.save(imageBytes, {
    metadata: {
      contentType: 'image/jpeg',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  const encoded = encodeURIComponent(path);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encoded}?alt=media&token=${token}`;
}

export type Gender = 'male' | 'female' | 'unknown';

export type DetectionResult = {
  gender: Gender;
  confidence: number;
  provider: 'gemini' | 'huggingface' | 'aws_rekognition' | 'nyckel' | 'none';
  /** رأي ثانٍ من مزوّد مستقل وافق على النتيجة — يسمح بعتبة قبول أدنى */
  corroborated?: boolean;
  secondProvider?: string;
  secondConfidence?: number;
  /** لم يستجب أي مزوّد إطلاقاً (انقطاع/غير مضبوط) — تختلف عن «وجه غير واضح» */
  noProvider?: boolean;
};

export type KycOutcome = {
  ok: boolean;
  verified?: boolean;
  pending?: boolean;
  suspended?: boolean;
  genderMismatch?: boolean;
  /** غير واضح/غير حاسم — على المستخدمة إعادة التصوير فوراً (ليست مراجعة يدوية) */
  retry?: boolean;
  message?: string;
  aiGender?: string;
  aiConfidence?: number;
};

export const AI_CONFIDENCE_AUTO = 85;
export const AI_CONFIDENCE_REVIEW = 65;
/** Nyckel — عتبة الموافقة التلقائية للمضيفة (0–100) */
export const NYCKEL_AUTO_THRESHOLD = 72;
/** Nyckel — أقل منها = «غير واضح» (إعادة تصوير فورية) */
export const NYCKEL_REVIEW_THRESHOLD = 58;
/** اتفاق مزوّدين مستقلين على نفس الجنس → عتبة قبول أدنى من عتبة المزوّد الواحد */
export const DUAL_AGREEMENT_THRESHOLD = 65;
/**
 * أدنى ثقة من المزوّد الأساسي تستحق طلب رأي ثانٍ (تحتها = غير واضح أصلاً).
 * مساوية لعتبة «غير الواضح» (NYCKEL_REVIEW_THRESHOLD): ثقة Gemini المُبلَّغة ذاتياً
 * منفوخة عادة (80-95)، فلا نسمح لاتفاقه برفع حالة كانت سترفض كـ«غير واضح» أصلاً.
 */
export const SECOND_OPINION_MIN_PRIMARY = 58;
/** محاولات «المنطقة الرمادية» المسموحة قبل التحويل للمراجعة اليدوية */
export const MAX_FACE_GRAY_RETRIES = 2;
/** سبب حظر قديم من منطق KYC السابق — يُرفع تلقائياً ولا يُعاد تطبيقه */
export const KYC_GENDER_MISMATCH_BAN_REASON = 'gender_verification_mismatch';

/** الجنس كما هو مخزّن فعلاً (بدون افتراض) — undefined إن لم يُسجَّل */
export function readRawGender(
  userData: FirebaseFirestore.DocumentData,
): string | undefined {
  const g =
    (userData.profile as { gender?: string } | undefined)?.gender
    ?? userData.gender;
  return typeof g === 'string' && g ? g : undefined;
}

export function readRegisteredGender(userData: FirebaseFirestore.DocumentData): Gender {
  return readRawGender(userData) === 'female' ? 'female' : 'male';
}

export function decodeBase64Image(raw: string): Buffer {
  const trimmed = raw.trim();
  const b64 = trimmed.replace(/^data:image\/\w+;base64,/, '');
  if (!b64) throw new HttpsError('invalid-argument', 'صورة غير صالحة');
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 1000) throw new HttpsError('invalid-argument', 'صورة صغيرة جداً — حاول مجدداً');
  if (buf.length > 8 * 1024 * 1024) throw new HttpsError('invalid-argument', 'حجم الصورة كبير جداً');
  return buf;
}

async function activateAgencyHostIfNeeded(uid: string): Promise<void> {
  const memberQ = await db.collection('agencyMembers').where('uid', '==', uid).limit(1).get();
  if (memberQ.empty) return;

  const memberDoc = memberQ.docs[0];
  const memberData = memberDoc.data();
  const agencyId = String(memberData.agencyId ?? '');
  if (!agencyId) return;

  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.data() ?? {};
  const isFemale =
    (userData.profile as { gender?: string } | undefined)?.gender === 'female'
    || userData.gender === 'female';

  if (!isFemale) return;

  const now = Date.now();
  await memberDoc.ref.update({
    hostVerified: true,
    isFemaleHost: true,
    role: 'host',
    verifiedAt: now,
    verifiedBy: 'ai_kyc',
  });

  await db.collection('users').doc(uid).update({
    agencyRole: 'host',
    isFemaleHost: true,
    accountKind: 'host',
    updatedAt: now,
  });

  const agencyRef = db.collection('agencies').doc(agencyId);
  const agencySnap = await agencyRef.get();
  if (!agencySnap.exists) return;

  const agency = agencySnap.data()!;
  const newFemaleCount = (Number(agency.femaleHostCount) || 0) + 1;
  await agencyRef.update({ femaleHostCount: newFemaleCount, updatedAt: now });
}

export async function notifyUser(uid: string, message: string, data: Record<string, unknown>): Promise<void> {
  await db.collection('notifications').add({
    uid,
    type: 'system',
    message,
    data,
    isRead: false,
    createdAt: Date.now(),
  });
}

/**
 * حقول رفع الحظر التي يجوز لمسار KYC كتابتها — لا يُرفع حظر إداري لسبب آخر:
 * محظور بسبب سبام/احتيال مثلاً لا يفك حظره بمجرد خوض محاولة توثيق تنتهي بالرفض.
 */
export function kycBanClearPatch(
  userData: FirebaseFirestore.DocumentData,
): Record<string, unknown> {
  const bannedForOtherReason =
    userData.isBanned === true
    && String(userData.banReason ?? '') !== KYC_GENDER_MISMATCH_BAN_REASON;
  if (bannedForOtherReason) return {};
  return {
    isBanned: false,
    banReason: admin.firestore.FieldValue.delete(),
    bannedAt: admin.firestore.FieldValue.delete(),
  };
}

/** يرفع حظراً خاطئاً من محاولات توثيق سابقة */
export async function clearKycGenderMismatchBan(
  userRef: FirebaseFirestore.DocumentReference,
  userData: FirebaseFirestore.DocumentData,
): Promise<boolean> {
  if (
    userData.isBanned !== true
    || String(userData.banReason ?? '') !== KYC_GENDER_MISMATCH_BAN_REASON
  ) {
    return false;
  }
  await userRef.update({
    isBanned: false,
    banReason: admin.firestore.FieldValue.delete(),
    bannedAt: admin.firestore.FieldValue.delete(),
    updatedAt: Date.now(),
  });
  return true;
}

export async function approveFemaleKyc(
  uid: string,
  kycRef: FirebaseFirestore.DocumentReference,
  userRef: FirebaseFirestore.DocumentReference,
  userData: FirebaseFirestore.DocumentData,
  aiPatch: Record<string, unknown>,
  method: 'ai' | 'face' | 'manual',
  now: number,
  detected: DetectionResult,
  fullName?: string,
): Promise<KycOutcome> {
  const profile = (userData.profile as Record<string, unknown> | undefined) ?? {};
  const resolvedName = fullName?.trim() || String(userData.displayName ?? '').trim();

  await kycRef.set(
    {
      // تنظيف آثار محاولات سابقة (مراجعة/منطقة رمادية) — القرار الحالي نهائي
      aiNeedsReview: admin.firestore.FieldValue.delete(),
      faceGrayAttempts: admin.firestore.FieldValue.delete(),
      rejectionReason: admin.firestore.FieldValue.delete(),
      ...aiPatch,
      status: 'approved',
      // مؤشر أن users/{uid} زُومن في نفس المسار — يمنع إعادة المعالجة في kycStatusSyncV2
      syncedStatus: 'approved',
      method,
      approvedAt: now,
      genderMatch: true,
      ...(resolvedName ? { fullName: resolvedName, displayName: resolvedName } : {}),
    },
    { merge: true },
  );

  const userPatch: Record<string, unknown> = {
    isVerified: true,
    verifiedGender: 'female',
    gender: 'female',
    profile: { ...profile, gender: 'female' },
    verifiedAt: now,
    verificationStatus: 'approved',
    // يرفع فقط حظر «تعارض الجنس» القديم — الحظر الإداري لسبب آخر يبقى
    ...kycBanClearPatch(userData),
    updatedAt: now,
  };
  if (resolvedName) userPatch.displayName = resolvedName;

  await userRef.update(userPatch);
  await activateAgencyHostIfNeeded(uid);
  await notifyUser(
    uid,
    'تم توثيق حسابك بنجاح ✓',
    { title: 'توثيق ناجح', type: 'kyc_approved', route: '/wallet/kyc' },
  );
  return {
    ok: true,
    verified: true,
    message: 'تم التوثيق بنجاح ✓',
    aiGender: detected.gender,
    aiConfidence: detected.confidence,
  };
}

export async function rejectKycVerification(
  uid: string,
  kycRef: FirebaseFirestore.DocumentReference,
  userRef: FirebaseFirestore.DocumentReference,
  aiPatch: Record<string, unknown>,
  method: 'ai' | 'face' | 'manual',
  now: number,
  rejectionReason: string,
  userMessage: string,
  detected: DetectionResult,
  options?: {
    /**
     * رفض لطيف قابل لإعادة المحاولة فوراً («أعيدي التصوير») — لا يمس عدّاد
     * المنطقة الرمادية ويُعيد retry:true للتطبيق ليعرض رسالة إعادة التصوير.
     */
    retry?: boolean;
    /** بيانات users/{uid} — لتقييد رفع الحظر بحظر «تعارض الجنس» فقط */
    userData?: FirebaseFirestore.DocumentData;
  },
): Promise<KycOutcome> {
  const isRetry = options?.retry === true;
  await kycRef.set(
    {
      aiNeedsReview: admin.firestore.FieldValue.delete(),
      // الرفض النهائي يصفّر عدّاد المحاولات الرمادية؛ رفض إعادة التصوير يُبقيه
      ...(isRetry ? {} : { faceGrayAttempts: admin.firestore.FieldValue.delete() }),
      ...aiPatch,
      status: 'rejected',
      syncedStatus: 'rejected',
      method,
      rejectionReason,
    },
    { merge: true },
  );
  await userRef.update({
    isVerified: false,
    verificationStatus: 'rejected',
    // بلا userData لا نلمس الحظر إطلاقاً (الأسلم) — ومعه يُرفع حظر «تعارض الجنس» فقط،
    // فمحظور إدارياً لسبب آخر لا يفك حظره بمجرد محاولة توثيق تنتهي بالرفض
    ...(options?.userData ? kycBanClearPatch(options.userData) : {}),
    updatedAt: now,
  });
  await notifyUser(
    uid,
    userMessage,
    isRetry
      ? { title: 'أعيدي التصوير', type: 'kyc_retry', route: '/wallet/kyc' }
      : { title: 'رفض التحقق', type: 'kyc_rejected', route: '/wallet/kyc' },
  );
  return {
    ok: false,
    ...(isRetry ? { retry: true } : { genderMismatch: true }),
    message: userMessage,
    aiGender: detected.gender,
    aiConfidence: detected.confidence,
  };
}

/**
 * الحالة اليدوية الحقيقية الوحيدة — pending صريح مع رسالة واضحة للمستخدمة
 * (لا صمت ٢٠ دقيقة): انقطاع المزوّدات، تعارض بيانات الحساب، أو محاولات رمادية متكررة.
 */
export async function holdForManualReview(
  uid: string,
  kycRef: FirebaseFirestore.DocumentReference,
  userRef: FirebaseFirestore.DocumentReference,
  aiPatch: Record<string, unknown>,
  method: 'ai' | 'face' | 'manual',
  now: number,
  detected: DetectionResult,
  userMessage: string,
  reviewReason?: string,
): Promise<KycOutcome> {
  await kycRef.set(
    {
      ...aiPatch,
      status: 'pending',
      syncedStatus: 'pending',
      method,
      aiNeedsReview: true,
      ...(reviewReason ? { aiReviewReason: reviewReason } : {}),
      rejectionReason: admin.firestore.FieldValue.delete(),
    },
    { merge: true },
  );
  await userRef.set(
    { verificationStatus: 'pending', updatedAt: now },
    { merge: true },
  );
  await notifyUser(uid, userMessage, {
    title: 'التحقق من الهوية',
    type: 'kyc_pending',
    route: '/wallet/kyc',
  });
  return {
    ok: true,
    pending: true,
    message: userMessage,
    aiGender: detected.gender,
    aiConfidence: detected.confidence,
  };
}

/**
 * يطبّق نتيجة AI على kycRequests + users:
 * - approved → isVerified + verificationStatus: approved
 * - rejected → verificationStatus: rejected فقط (بدون حظر الحساب)
 * - retry (غير واضح/رمادي) → rejected برسالة «أعيدي التصوير» — إعادة محاولة فورية
 * - pending → للحالات اليدوية الحقيقية فقط، مع رسالة «قيد المراجعة اليدوية» صريحة
 */
export async function applyKycDetectionResult(
  uid: string,
  kycRef: FirebaseFirestore.DocumentReference,
  userRef: FirebaseFirestore.DocumentReference,
  userData: FirebaseFirestore.DocumentData,
  detected: DetectionResult,
  method: 'ai' | 'face' | 'manual',
  options?: {
    fullName?: string;
    /** عدد المحاولات السابقة التي انتهت في المنطقة الرمادية (من kycRequests.faceGrayAttempts) */
    grayAttempts?: number;
  },
): Promise<KycOutcome> {
  await clearKycGenderMismatchBan(userRef, userData);

  const registeredGender = readRegisteredGender(userData);
  const rawGender = readRawGender(userData);
  const now = Date.now();
  const aiPatch = {
    aiGender: detected.gender,
    aiConfidence: detected.confidence,
    aiProvider: detected.provider,
    ...(detected.corroborated ? { aiCorroborated: true } : {}),
    ...(detected.secondProvider
      ? {
          aiSecondProvider: detected.secondProvider,
          aiSecondConfidence: detected.secondConfidence ?? 0,
        }
      : {}),
    registeredGender,
    genderMatch: detected.gender === 'unknown' ? null : detected.gender === registeredGender,
    updatedAt: now,
  };

  const autoThreshold =
    detected.provider === 'nyckel' ? NYCKEL_AUTO_THRESHOLD : AI_CONFIDENCE_AUTO;
  const reviewThreshold =
    detected.provider === 'nyckel' ? NYCKEL_REVIEW_THRESHOLD : AI_CONFIDENCE_REVIEW;
  // اتفاق مزوّدين مستقلين يعوّض العتبة الأعلى للمزوّد الواحد
  const effectiveAuto = detected.corroborated
    ? Math.min(autoThreshold, DUAL_AGREEMENT_THRESHOLD)
    : autoThreshold;

  const resolvedFullName = options?.fullName?.trim();

  /**
   * التحقق الفوري بالوجه — مصفوفة قرار كاملة، كل مساراتها فورية عدا
   * حالتين حقيقيتين للمراجعة اليدوية (انقطاع المزوّدات / تعارض بيانات الحساب).
   */
  if (method === 'face') {
    const grayAttempts = options?.grayAttempts ?? 0;

    // أنثى بثقة حاسمة → توثيق فوري
    if (detected.gender === 'female' && detected.confidence >= effectiveAuto) {
      if (rawGender === 'male') {
        // حساب مسجّل ذكراً صراحةً — لا نقلب جنس الحساب بقرار AI واحد
        return holdForManualReview(
          uid, kycRef, userRef, aiPatch, method, now, detected,
          'بيانات حسابك مسجّلة بجنس مختلف — أُحيل طلبك للمراجعة اليدوية وسنبلغك بالنتيجة',
          'female_detected_on_male_account',
        );
      }
      return approveFemaleKyc(
        uid, kycRef, userRef, userData, aiPatch, method, now, detected, resolvedFullName,
      );
    }

    // ذكر بثقة حاسمة → رفض فوري
    if (detected.gender === 'male' && detected.confidence >= effectiveAuto) {
      return rejectKycVerification(
        uid, kycRef, userRef, aiPatch, method, now,
        'التحقق متاح للمضيفات الإناث فقط',
        'فشل التوثيق: التحقق متاح للمضيفات الإناث فقط',
        detected,
        { userData },
      );
    }

    // لا مزوّد استجاب إطلاقاً (انقطاع/غير مضبوط) — حالة يدوية حقيقية برسالة صريحة
    if (detected.gender === 'unknown' && detected.noProvider === true) {
      return holdForManualReview(
        uid, kycRef, userRef, aiPatch, method, now, detected,
        'تعذّر التحليل الآلي مؤقتاً — طلبك قيد المراجعة اليدوية وسنبلغك بالنتيجة فور الانتهاء',
        'no_ai_provider',
      );
    }

    // وجه غير واضح — رفض لطيف فوري بدل تعليق الطلب في صف مراجعة صامت
    if (detected.gender === 'unknown' || detected.confidence < reviewThreshold) {
      return rejectKycVerification(
        uid, kycRef, userRef, aiPatch, method, now,
        'لم يظهر الوجه بوضوح في الصور',
        'لم نتمكن من رؤية وجهك بوضوح — أعيدي التصوير في إضاءة أوضح مع إبقاء وجهك كاملاً داخل الإطار',
        detected,
        { retry: true, userData },
      );
    }

    // منطقة رمادية (بين عتبة المراجعة وعتبة القبول) — إعادة تصوير فورية أولاً
    if (grayAttempts < MAX_FACE_GRAY_RETRIES) {
      return rejectKycVerification(
        uid, kycRef, userRef,
        { ...aiPatch, faceGrayAttempts: grayAttempts + 1 },
        method, now,
        'نتيجة غير حاسمة — مطلوبة إعادة تصوير بجودة أفضل',
        'النتيجة غير حاسمة — أعيدي التصوير في إضاءة أوضح ووجهك مكشوف ومواجه للكاميرا',
        detected,
        { retry: true, userData },
      );
    }

    // محاولات رمادية متكررة — حالة يدوية حقيقية مع رسالة صريحة (لا صمت)
    return holdForManualReview(
      uid, kycRef, userRef, aiPatch, method, now, detected,
      'تعذّر الحسم تلقائياً بعد عدة محاولات — طلبك الآن قيد المراجعة اليدوية وسنبلغك بالنتيجة',
      'gray_zone_retries_exhausted',
    );
  }

  /** مركز التحقق للمضيفات — ذكر مُكتشَف بثقة عالية → رفض التوثيق فقط (بدون حظر) */
  if (
    detected.provider === 'nyckel'
    && detected.gender === 'male'
    && detected.confidence >= effectiveAuto
  ) {
    return rejectKycVerification(
      uid,
      kycRef,
      userRef,
      aiPatch,
      method,
      now,
      'التحقق متاح للمضيفات الإناث فقط',
      registeredGender === 'female'
        ? 'فشل التوثيق: نتيجة التحليل لا تطابق متطلبات التحقق كمضيفة'
        : 'فشل التوثيق: التحقق متاح للمضيفات الإناث فقط',
      detected,
      { userData },
    );
  }

  /** Nyckel — أنثى مُكتشَفة بثقة عالية → توثيق تلقائي (بلا قلب جنس حساب مسجّل ذكراً) */
  if (
    detected.provider === 'nyckel'
    && detected.gender === 'female'
    && detected.confidence >= effectiveAuto
  ) {
    if (rawGender === 'male') {
      return holdForManualReview(
        uid, kycRef, userRef, aiPatch, method, now, detected,
        'بيانات حسابك مسجّلة بجنس مختلف — أُحيل طلبك للمراجعة اليدوية وسنبلغك بالنتيجة',
        'female_detected_on_male_account',
      );
    }
    return approveFemaleKyc(
      uid,
      kycRef,
      userRef,
      userData,
      aiPatch,
      method,
      now,
      detected,
      resolvedFullName,
    );
  }

  if (detected.gender === 'unknown' || detected.confidence < reviewThreshold) {
    await kycRef.set(
      {
        ...aiPatch,
        status: 'pending',
        syncedStatus: 'pending',
        method: detected.confidence > 0 ? method : 'manual',
        aiNeedsReview: true,
        rejectionReason: admin.firestore.FieldValue.delete(),
      },
      { merge: true },
    );
    await userRef.set(
      { verificationStatus: 'pending', updatedAt: now },
      { merge: true },
    );
    await notifyUser(
      uid,
      'لم نتمكن من التعرف على الوجه بوضوح — حاول مجدداً أو انتظر المراجعة',
      { title: 'التحقق من الهوية', type: 'kyc_pending', route: '/wallet/kyc' },
    );
    return {
      ok: true,
      pending: true,
      message: 'عذراً، لم يتم التعرف عليك — حاول مجدداً',
      aiGender: detected.gender,
      aiConfidence: detected.confidence,
    };
  }

  if (detected.gender !== registeredGender && detected.confidence >= effectiveAuto) {
    return rejectKycVerification(
      uid,
      kycRef,
      userRef,
      aiPatch,
      method,
      now,
      'تعارض بين الجنس المسجّل ونتيجة التحقق',
      'فشل التوثيق: نتيجة التحليل لا تطابق بيانات حسابك — يمكنك المحاولة مجدداً',
      detected,
      { userData },
    );
  }

  if (detected.gender === registeredGender && detected.confidence >= effectiveAuto) {
    await kycRef.set(
      {
        ...aiPatch,
        status: 'approved',
        syncedStatus: 'approved',
        method,
        approvedAt: now,
      },
      { merge: true },
    );
    await userRef.update({
      isVerified: true,
      verifiedGender: detected.gender,
      verifiedAt: now,
      verificationStatus: 'approved',
      // يرفع فقط حظر «تعارض الجنس» القديم — الحظر الإداري لسبب آخر يبقى
      ...kycBanClearPatch(userData),
      updatedAt: now,
    });
    await activateAgencyHostIfNeeded(uid);
    await notifyUser(
      uid,
      'تم توثيق حسابك بنجاح ✓',
      { title: 'توثيق ناجح', type: 'kyc_approved', route: '/wallet/kyc' },
    );
    return {
      ok: true,
      verified: true,
      message: 'تم التوثيق بنجاح ✓',
      aiGender: detected.gender,
      aiConfidence: detected.confidence,
    };
  }

  await kycRef.set(
    {
      ...aiPatch,
      status: 'pending',
      syncedStatus: 'pending',
      method,
      aiNeedsReview: true,
    },
    { merge: true },
  );
  await userRef.set({ verificationStatus: 'pending', updatedAt: now }, { merge: true });
  return {
    ok: true,
    pending: true,
    message: 'قيد المراجعة اليدوية — سنبلغك بالنتيجة فور الانتهاء',
    aiGender: detected.gender,
    aiConfidence: detected.confidence,
  };
}
