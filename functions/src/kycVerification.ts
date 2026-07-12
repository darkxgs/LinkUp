/**
 * KYC — تحليل الوجه (face-api محلي + Gemini/HuggingFace/AWS)
 *
 * الحالات في Firestore (كما في المشروع):
 *   kycRequests/{uid}.status → processing | pending | approved | rejected
 *   users/{uid}.isVerified, verificationStatus → approved | rejected | pending
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { RekognitionClient, DetectFacesCommand } from '@aws-sdk/client-rekognition';
import { detectGenderWithFaceApi } from './faceApiGender';
import { detectGenderWithNyckel, isNyckelConfigured } from './nyckelGender';
import {
  applyKycDetectionResult,
  approveFemaleKyc,
  clearKycGenderMismatchBan,
  decodeBase64Image,
  notifyUser,
  persistKycVerificationImage,
  readRegisteredGender,
  rejectKycVerification,
  AI_CONFIDENCE_REVIEW,
  NYCKEL_REVIEW_THRESHOLD,
  type DetectionResult,
  type Gender,
} from './kycVerification.shared';

const db = admin.firestore();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_MODEL = 'gemini-2.0-flash';
const HF_GENDER_MODEL = 'dima806/fairface_gender_image_detection';

async function fetchImageBytes(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`تعذّر تحميل صورة التحقق (${res.status})`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

function labelToGender(label: string): Gender {
  const n = label.toLowerCase();
  if (n.includes('female') || n.includes('woman') || n === 'f') return 'female';
  if (n.includes('male') || n.includes('man') || n === 'm') return 'male';
  return 'unknown';
}

async function detectWithGemini(imageBytes: Buffer): Promise<DetectionResult | null> {
  const apiKey = GEMINI_API_KEY;
  if (!apiKey) return null;

  const b64 = imageBytes.toString('base64');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            text: 'You analyze a single face photo for identity verification. Reply with ONLY valid JSON, no markdown: {"gender":"male"|"female"|"unknown","confidence":0-100}. confidence is how sure you are. Use unknown if no clear face or ambiguous.',
          },
          { inline_data: { mime_type: 'image/jpeg', data: b64 } },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 64 },
    }),
  });

  if (!res.ok) {
    console.warn('Gemini KYC error:', res.status, await res.text());
    return null;
  }

  const data = await res.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { gender?: string; confidence?: number };
    const gender = labelToGender(String(parsed.gender ?? ''));
    const confidence = Math.min(100, Math.max(0, Number(parsed.confidence) || 0));
    if (gender === 'unknown') return { gender, confidence: 0, provider: 'gemini' };
    return { gender, confidence, provider: 'gemini' };
  } catch {
    return null;
  }
}

async function detectWithHuggingFace(imageBytes: Buffer): Promise<DetectionResult | null> {
  const token = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
  if (!token) return null;

  const endpoint = `https://api-inference.huggingface.co/models/${HF_GENDER_MODEL}`;

  const call = async (): Promise<Response> =>
    fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: new Uint8Array(imageBytes),
    });

  let res = await call();
  if (res.status === 503) {
    await new Promise((r) => setTimeout(r, 12_000));
    res = await call();
  }
  if (!res.ok) {
    console.warn('HuggingFace KYC error:', res.status, await res.text());
    return null;
  }

  const raw = await res.json() as { label?: string; score?: number }[] | { error?: string };
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const top = raw.reduce((best, cur) => ((cur.score ?? 0) > (best.score ?? 0) ? cur : best), raw[0]!);
  const gender = labelToGender(String(top.label ?? ''));
  const confidence = Math.round((top.score ?? 0) * 100);
  if (gender === 'unknown') return { gender, confidence: 0, provider: 'huggingface' };
  return { gender, confidence, provider: 'huggingface' };
}

async function detectWithAws(imageBytes: Buffer): Promise<DetectionResult | null> {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return null;

  const client = new RekognitionClient({
    region: process.env.AWS_REGION || 'eu-central-1',
    credentials: { accessKeyId, secretAccessKey },
  });

  const out = await client.send(
    new DetectFacesCommand({
      Image: { Bytes: imageBytes },
      Attributes: ['ALL'],
    }),
  );

  const face = out.FaceDetails?.[0];
  if (!face?.Gender?.Value) return null;

  const value = String(face.Gender.Value);
  const confidence = Number(face.Gender.Confidence ?? 0);
  const gender: Gender =
    value === 'Female' ? 'female' : value === 'Male' ? 'male' : 'unknown';

  return { gender, confidence, provider: 'aws_rekognition' };
}

async function detectGenderFromImage(imageBytes: Buffer): Promise<DetectionResult> {
  if (isNyckelConfigured()) {
    try {
      const nyckel = await detectGenderWithNyckel(imageBytes);
      if (nyckel && nyckel.gender !== 'unknown' && nyckel.confidence >= NYCKEL_REVIEW_THRESHOLD) {
        return nyckel;
      }
      if (nyckel && nyckel.confidence > 0) {
        return nyckel;
      }
    } catch (e) {
      console.warn('Nyckel KYC skipped:', e);
    }
  }

  try {
    const faceApi = await detectGenderWithFaceApi(imageBytes);
    if (faceApi && faceApi.gender !== 'unknown' && faceApi.confidence >= 50) {
      return { ...faceApi, provider: 'face_api' };
    }
  } catch (e) {
    console.warn('face-api skipped:', e);
  }

  for (const fn of [detectWithGemini, detectWithHuggingFace, detectWithAws]) {
    try {
      const result = await fn(imageBytes);
      if (result && result.gender !== 'unknown' && result.confidence >= AI_CONFIDENCE_REVIEW) {
        return result;
      }
      if (result && result.confidence > 0) {
        return result;
      }
    } catch (e) {
      console.warn('KYC provider failed:', e);
    }
  }
  return { gender: 'unknown', confidence: 0, provider: 'none' };
}

type FaceVerifyPersonal = {
  fullName?: string;
  birthDate?: string;
  nationality?: string;
  phoneNumber?: string;
  displayName?: string;
};

type MultiFrameMeta = {
  framesReceived: number;
  framesAnalyzed: number;
  /** كل الإطارات متطابقة بايتاً-ببايت — صورة ثابتة مُعادة وليست لقطات كاميرا حية */
  staticFrames: boolean;
  /** إطارات أعطت جنسين متعارضين — مشبوه، يتحوّل لمراجعة يدوية */
  genderConflict: boolean;
  perFrame: Array<{ gender: Gender; confidence: number; provider: string }>;
};

/**
 * تحليل عدة إطارات (حتى 3) من فيديو/كاميرا التحقق — أدق من إطار واحد:
 * - الإطارات المتطابقة تماماً تُعدّ صورة ثابتة → مراجعة يدوية
 * - جنسان متعارضان بين الإطارات → مراجعة يدوية
 * - اتفاق الإطارات → الثقة = متوسط الإطارات المتفقة (أثبت من لقطة واحدة)
 */
async function detectGenderFromFrames(
  frames: Buffer[],
): Promise<{ detected: DetectionResult; meta: MultiFrameMeta }> {
  const capped = frames.slice(0, 3);

  // إزالة التكرار البايتي — التقاط حي من كاميرا لا يعطي بايتات متطابقة أبداً
  const { createHash } = await import('crypto');
  const seen = new Set<string>();
  const unique: Buffer[] = [];
  for (const f of capped) {
    const h = createHash('sha1').update(f).digest('hex');
    if (seen.has(h)) continue;
    seen.add(h);
    unique.push(f);
  }
  const staticFrames = capped.length > 1 && unique.length === 1;

  const results = await Promise.all(
    unique.map(async (bytes) => {
      try {
        return await detectGenderFromImage(bytes);
      } catch {
        return { gender: 'unknown', confidence: 0, provider: 'none' } as DetectionResult;
      }
    }),
  );

  const meta: MultiFrameMeta = {
    framesReceived: capped.length,
    framesAnalyzed: unique.length,
    staticFrames,
    genderConflict: false,
    perFrame: results.map((r) => ({
      gender: r.gender,
      confidence: r.confidence,
      provider: r.provider,
    })),
  };

  const valid = results.filter((r) => r.gender !== 'unknown' && r.confidence > 0);
  if (!valid.length) {
    return { detected: { gender: 'unknown', confidence: 0, provider: 'none' }, meta };
  }

  const hasMale = valid.some((r) => r.gender === 'male');
  const hasFemale = valid.some((r) => r.gender === 'female');
  if (hasMale && hasFemale) {
    // تعارض بين الإطارات — لا قرار تلقائي؛ يذهب لمراجعة الإدارة
    meta.genderConflict = true;
    return { detected: { gender: 'unknown', confidence: 0, provider: valid[0]!.provider }, meta };
  }

  if (staticFrames) {
    // صورة ثابتة مُعادة — لا توثيق تلقائي مهما كانت الثقة
    return { detected: { gender: 'unknown', confidence: 0, provider: valid[0]!.provider }, meta };
  }

  const gender = valid[0]!.gender;
  const best = valid.reduce((a, b) => (b.confidence > a.confidence ? b : a), valid[0]!);
  const avgConfidence = Math.round(
    valid.reduce((s, r) => s + r.confidence, 0) / valid.length,
  );
  return {
    detected: { gender, confidence: avgConfidence, provider: best.provider },
    meta,
  };
}

/**
 * تحليل صورة وجه مباشرة (base64) — للتحقق السريع من التطبيق.
 * يدعم `framesBase64` (حتى 3 إطارات تُلتقط تلقائياً أثناء إيماءة بسيطة عشوائية):
 * اتفاق الإطارات يرفع الدقة، وتعارضها أو تطابقها البايتي (صورة ثابتة) → مراجعة يدوية.
 * التوافق الخلفي: `imageBase64` وحدها تعمل كالسابق تماماً.
 */
export const verifyGenderFace = onCall({ memory: '1GiB', timeoutSeconds: 120 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const imageBase64 = String(request.data?.imageBase64 ?? '');
  const rawFrames = Array.isArray(request.data?.framesBase64)
    ? (request.data.framesBase64 as unknown[]).map((f) => String(f ?? '')).filter(Boolean)
    : [];
  const gesture = String(request.data?.gesture ?? '').slice(0, 80);
  const personal = (request.data?.personal ?? {}) as FaceVerifyPersonal;

  const frameSources = (rawFrames.length ? rawFrames : [imageBase64]).slice(0, 3);
  const frames: Buffer[] = [];
  for (const src of frameSources) {
    try {
      frames.push(decodeBase64Image(src));
    } catch (e) {
      // إطار تالف واحد لا يُسقط الطلب إذا وُجد غيره
      if (!frames.length && frameSources.length === 1) {
        if (e instanceof HttpsError) throw e;
        throw new HttpsError('invalid-argument', 'صورة غير صالحة');
      }
    }
  }
  if (!frames.length) throw new HttpsError('invalid-argument', 'صورة غير صالحة');

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');
  const userData = userSnap.data()!;

  const now = Date.now();
  const kycRef = db.collection('kycRequests').doc(uid);
  const frameUrls: string[] = [];
  for (let i = 0; i < frames.length; i++) {
    try {
      frameUrls.push(
        await persistKycVerificationImage(uid, frames[i]!, i === 0 ? 'face' : 'frame'),
      );
    } catch (e) {
      console.error('KYC face image persist error:', e);
    }
  }
  const verificationImageUrl = frameUrls[0] ?? '';

  await kycRef.set(
    {
      uid,
      displayName: personal.displayName ?? userData.displayName ?? '',
      fullName: personal.fullName?.trim() ?? personal.displayName ?? userData.displayName ?? '',
      status: 'processing',
      method: 'face',
      ...(verificationImageUrl
        ? { selfie: verificationImageUrl, verificationFrameUrl: verificationImageUrl }
        : {}),
      ...(frameUrls.length > 1 ? { verificationFrameUrls: frameUrls } : {}),
      ...(gesture ? { livenessGesture: gesture } : {}),
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  let detected: DetectionResult;
  try {
    const analysis = await detectGenderFromFrames(frames);
    detected = analysis.detected;
    await kycRef.set(
      {
        livenessFrames: analysis.meta.framesAnalyzed,
        livenessStatic: analysis.meta.staticFrames,
        livenessConflict: analysis.meta.genderConflict,
        livenessPerFrame: analysis.meta.perFrame,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  } catch (e) {
    console.error('verifyGenderFace analyze error:', e);
    detected = { gender: 'unknown', confidence: 0, provider: 'none' };
  }

  return applyKycDetectionResult(uid, kycRef, userRef, userData, detected, 'face', {
    fullName: personal.fullName?.trim() || personal.displayName?.trim(),
  });
});

/** مسار KYC الكامل — يحلّل إطار الفيديو/السيلفي المرفوع مسبقاً */
export const processKycVerification = onCall({ memory: '512MiB', timeoutSeconds: 180 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const kycRef = db.collection('kycRequests').doc(uid);
  const kycSnap = await kycRef.get();
  if (!kycSnap.exists) {
    throw new HttpsError('failed-precondition', 'لم يُرسل طلب التحقق بعد');
  }

  const kyc = kycSnap.data()!;
  const frameUrls = (Array.isArray(kyc.verificationFrameUrls)
    ? (kyc.verificationFrameUrls as unknown[]).map((u) => String(u ?? '').trim())
    : []
  ).filter(Boolean);
  const singleUrl = String(kyc.verificationFrameUrl ?? kyc.selfie ?? '').trim();
  const urls = (frameUrls.length ? frameUrls : [singleUrl]).filter(Boolean).slice(0, 3);
  if (!urls.length) {
    throw new HttpsError('failed-precondition', 'صورة/إطار التحقق مفقود');
  }

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');
  const userData = userSnap.data()!;

  let detected: DetectionResult;
  try {
    const frames = (
      await Promise.all(urls.map((u) => fetchImageBytes(u).catch(() => null)))
    ).filter((b): b is Buffer => b != null);
    if (!frames.length) throw new Error('تعذّر تحميل إطارات التحقق');
    const analysis = await detectGenderFromFrames(frames);
    detected = analysis.detected;
    await kycRef.set(
      {
        livenessFrames: analysis.meta.framesAnalyzed,
        livenessStatic: analysis.meta.staticFrames,
        livenessConflict: analysis.meta.genderConflict,
        livenessPerFrame: analysis.meta.perFrame,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  } catch (e) {
    console.error('KYC AI analyze error:', e);
    detected = { gender: 'unknown', confidence: 0, provider: 'none' };
  }

  return applyKycDetectionResult(uid, kycRef, userRef, userData, detected, 'ai');
});

/**
 * موافقة/رفض الإدارة مباشرة على kycRequests/{uid} (لوحة التحكم) — تُزامن users/{uid}
 * بنفس أثر مسار الـ AI (isVerified + verificationStatus + تفعيل مضيفة الوكالة + إشعار).
 * بدونها يبقى المستخدم «غير موثّق» في التطبيق رغم موافقة الإدارة — «وثّقت مرتين وما تغيّر شيء».
 * كتابات دوال KYC نفسها تحمل syncedStatus مطابقاً للحالة فلا تُعاد معالجتها (ولا تتكرر الإشعارات).
 */
// الاسم V2: كان syncKycStatusToUser HTTPS قديمة في الإنتاج، وتغيير النوع إلى trigger مرفوض من Firebase
export const kycStatusSyncV2 = onDocumentUpdated('kycRequests/{uid}', async (event) => {
  const after = event.data?.after.data();
  if (!after) return;

  const status = String(after.status ?? '');
  if (status !== 'approved' && status !== 'rejected') return;
  // الحالة مُزامنة مسبقاً من verifyGenderFace/processKycVerification أو من تشغيل سابق للمزامنة
  if (String(after.syncedStatus ?? '') === status) return;

  const uid = event.params.uid;
  const kycRef = event.data!.after.ref;
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return;
  const userData = userSnap.data()!;
  const now = Date.now();
  const method: 'ai' | 'face' | 'manual' =
    after.method === 'ai' || after.method === 'face' ? after.method : 'manual';

  if (status === 'approved') {
    if (userData.isVerified === true && userData.verificationStatus === 'approved') {
      // users محدث بالفعل (مثلاً عبر adminUpdateAppUser) — نكتفي بتعليم الطلب
      await kycRef.set({ syncedStatus: 'approved', updatedAt: now }, { merge: true });
      return;
    }
    if (readRegisteredGender(userData) === 'female') {
      await approveFemaleKyc(
        uid,
        kycRef,
        userRef,
        userData,
        { updatedAt: now },
        method,
        now,
        {
          gender: 'female',
          confidence: Number(after.aiConfidence) || 0,
          provider: 'none',
        },
        typeof after.fullName === 'string' ? after.fullName : undefined,
      );
      return;
    }
    // حالة نادرة: طلب لحساب مسجّل ذكراً — توثيق بدون قلب الجنس
    await kycRef.set(
      { status: 'approved', syncedStatus: 'approved', approvedAt: now, updatedAt: now },
      { merge: true },
    );
    await userRef.update({
      isVerified: true,
      verifiedGender: readRegisteredGender(userData),
      verifiedAt: now,
      verificationStatus: 'approved',
      isBanned: false,
      banReason: admin.firestore.FieldValue.delete(),
      updatedAt: now,
    });
    await notifyUser(
      uid,
      'تم توثيق حسابك بنجاح ✓',
      { title: 'توثيق ناجح', type: 'kyc_approved', route: '/wallet/kyc' },
    );
    return;
  }

  // status === 'rejected' — رفض من لوحة التحكم
  if (userData.verificationStatus === 'rejected' && userData.isVerified !== true) {
    await kycRef.set({ syncedStatus: 'rejected', updatedAt: now }, { merge: true });
    return;
  }
  const reason =
    typeof after.rejectionReason === 'string' && after.rejectionReason.trim()
      ? after.rejectionReason.trim()
      : 'تم رفض طلب التوثيق من الإدارة';
  await rejectKycVerification(
    uid,
    kycRef,
    userRef,
    { updatedAt: now },
    method,
    now,
    reason,
    'تم رفض طلب التوثيق — راجع بياناتك وحاول مجدداً',
    { gender: 'unknown', confidence: 0, provider: 'none' },
  );
});

/** يرفع حظراً خاطئاً من فشل توثيق سابق — يُستدعى من التطبيق عند تسجيل الدخول */
export const repairKycMismatchBan = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');

  const repaired = await clearKycGenderMismatchBan(userRef, userSnap.data()!);
  return { repaired };
});
