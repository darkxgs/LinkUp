/**
 * منطق KYC المشترك — الحالات والنتائج كما في Firestore
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
  provider: 'face_api' | 'gemini' | 'huggingface' | 'aws_rekognition' | 'nyckel' | 'none';
};

export type KycOutcome = {
  ok: boolean;
  verified?: boolean;
  pending?: boolean;
  suspended?: boolean;
  genderMismatch?: boolean;
  message?: string;
  aiGender?: string;
  aiConfidence?: number;
};

export const AI_CONFIDENCE_AUTO = 85;
export const AI_CONFIDENCE_REVIEW = 65;
/** Nyckel — عتبة الموافقة التلقائية للمضيفة (0–100) */
export const NYCKEL_AUTO_THRESHOLD = 72;
/** Nyckel — أقل منها → مراجعة يدوية */
export const NYCKEL_REVIEW_THRESHOLD = 58;
/** عتبة face-api للموافقة التلقائية (0–100) — 70 ≈ 0.7 */
export const FACE_API_AUTO_THRESHOLD = 70;
/** سبب حظر قديم من منطق KYC السابق — يُرفع تلقائياً ولا يُعاد تطبيقه */
export const KYC_GENDER_MISMATCH_BAN_REASON = 'gender_verification_mismatch';

export function readRegisteredGender(userData: FirebaseFirestore.DocumentData): Gender {
  const g =
    (userData.profile as { gender?: string } | undefined)?.gender
    ?? userData.gender;
  return g === 'female' ? 'female' : 'male';
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
      ...aiPatch,
      status: 'approved',
      // مؤشر أن users/{uid} زُومن في نفس المسار — يمنع إعادة المعالجة في syncKycStatusToUser
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
    isBanned: false,
    banReason: admin.firestore.FieldValue.delete(),
    bannedAt: admin.firestore.FieldValue.delete(),
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
): Promise<KycOutcome> {
  await kycRef.set(
    {
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
    isBanned: false,
    banReason: admin.firestore.FieldValue.delete(),
    bannedAt: admin.firestore.FieldValue.delete(),
    updatedAt: now,
  });
  await notifyUser(uid, userMessage, {
    title: 'رفض التحقق',
    type: 'kyc_rejected',
    route: '/wallet/kyc',
  });
  return {
    ok: false,
    genderMismatch: true,
    message: userMessage,
    aiGender: detected.gender,
    aiConfidence: detected.confidence,
  };
}

/**
 * يطبّق نتيجة AI على kycRequests + users — نفس السيناريو الحالي:
 * - approved → isVerified + verificationStatus: approved
 * - rejected → verificationStatus: rejected فقط (بدون حظر الحساب)
 * - pending → status: pending
 */
export async function applyKycDetectionResult(
  uid: string,
  kycRef: FirebaseFirestore.DocumentReference,
  userRef: FirebaseFirestore.DocumentReference,
  userData: FirebaseFirestore.DocumentData,
  detected: DetectionResult,
  method: 'ai' | 'face' | 'manual',
  options?: { fullName?: string },
): Promise<KycOutcome> {
  await clearKycGenderMismatchBan(userRef, userData);

  const registeredGender = readRegisteredGender(userData);
  const now = Date.now();
  const aiPatch = {
    aiGender: detected.gender,
    aiConfidence: detected.confidence,
    aiProvider: detected.provider,
    registeredGender,
    genderMatch: detected.gender === 'unknown' ? null : detected.gender === registeredGender,
    updatedAt: now,
  };

  const autoThreshold =
    detected.provider === 'face_api'
      ? FACE_API_AUTO_THRESHOLD
      : detected.provider === 'nyckel'
        ? NYCKEL_AUTO_THRESHOLD
        : AI_CONFIDENCE_AUTO;
  const reviewThreshold =
    detected.provider === 'face_api'
      ? 50
      : detected.provider === 'nyckel'
        ? NYCKEL_REVIEW_THRESHOLD
        : AI_CONFIDENCE_REVIEW;

  const resolvedFullName = options?.fullName?.trim();

  /** التحقق الفوري بالوجه — أنثى بثقة كافية → توثيق مباشر */
  if (method === 'face') {
    if (detected.gender === 'female' && detected.confidence >= autoThreshold) {
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
    if (detected.gender === 'male' && detected.confidence >= autoThreshold) {
      return rejectKycVerification(
        uid,
        kycRef,
        userRef,
        aiPatch,
        method,
        now,
        'التحقق متاح للمضيفات الإناث فقط',
        'فشل التوثيق: التحقق متاح للمضيفات الإناث فقط',
        detected,
      );
    }
  }

  /** مركز التحقق للمضيفات — ذكر مُكتشَف بثقة عالية → رفض التوثيق فقط (بدون حظر) */
  if (
    detected.provider === 'nyckel'
    && detected.gender === 'male'
    && detected.confidence >= autoThreshold
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
    );
  }

  /** Nyckel — أنثى مُكتشَفة بثقة عالية → توثيق تلقائي */
  if (
    detected.provider === 'nyckel'
    && detected.gender === 'female'
    && detected.confidence >= autoThreshold
  ) {
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

  if (detected.gender !== registeredGender && detected.confidence >= autoThreshold) {
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
    );
  }

  if (detected.gender === registeredGender && detected.confidence >= autoThreshold) {
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
      isBanned: false,
      banReason: admin.firestore.FieldValue.delete(),
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
    message: 'قيد المراجعة',
    aiGender: detected.gender,
    aiConfidence: detected.confidence,
  };
}
