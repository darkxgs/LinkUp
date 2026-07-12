/**
 * KYC — تحليل الوجه (Nyckel أساسي + رأي ثانٍ من Gemini/AWS/HuggingFace للمنطقة الرمادية)
 *
 * الحالات في Firestore (كما في المشروع):
 *   kycRequests/{uid}.status → processing | pending | approved | rejected | failed
 *   users/{uid}.isVerified, verificationStatus → approved | rejected | pending
 *
 * الهدف: قرار آلي خلال ثوانٍ — «غير واضح» يُرفض بلطف فوراً برسالة إعادة تصوير،
 * والمراجعة اليدوية استثناء حقيقي فقط (انقطاع مزوّدات/تعارض بيانات) برسالة صريحة.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { RekognitionClient, DetectFacesCommand } from '@aws-sdk/client-rekognition';
import { detectGenderWithNyckel, isNyckelConfigured } from './nyckelGender';
import {
  applyKycDetectionResult,
  approveFemaleKyc,
  clearKycGenderMismatchBan,
  kycBanClearPatch,
  decodeBase64Image,
  notifyUser,
  persistKycVerificationImage,
  readRegisteredGender,
  rejectKycVerification,
  DUAL_AGREEMENT_THRESHOLD,
  NYCKEL_AUTO_THRESHOLD,
  SECOND_OPINION_MIN_PRIMARY,
  type DetectionResult,
  type Gender,
} from './kycVerification.shared';

const db = admin.firestore();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_MODEL = 'gemini-2.0-flash';
const HF_GENDER_MODEL = 'dima806/fairface_gender_image_detection';

/**
 * مهلة قصوى لكل استدعاء مزوّد خارجي — اتصال معلّق واحد كان يجمّد الطلب كله
 * حتى سقف الدالة (120 ثانية) ثم يظهر للمستخدمة كفشل غامض. الهدف: قرار خلال ثوانٍ،
 * ومزوّد بطيء يُتخطى إلى البديل التالي بدل انتظار غير محدود.
 */
export const KYC_PROVIDER_TIMEOUT_MS = 15_000;

/** تهدئة verifyGenderFace — أدنى فاصل بين محاولتين (الالتقاط نفسه يستغرق ~3 ثوانٍ) */
const FACE_ATTEMPT_MIN_INTERVAL_MS = 15_000;
/** نافذة عدّ المحاولات وسقفها — يكفي مستخدمة حقيقية بإضاءة سيئة ويصد الطرق الآلي */
const FACE_ATTEMPT_WINDOW_MS = 60 * 60 * 1000;
const FACE_ATTEMPT_MAX_PER_WINDOW = 10;

async function fetchImageBytes(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(KYC_PROVIDER_TIMEOUT_MS) });
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
    signal: AbortSignal.timeout(KYC_PROVIDER_TIMEOUT_MS),
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

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    signal: AbortSignal.timeout(KYC_PROVIDER_TIMEOUT_MS),
    body: new Uint8Array(imageBytes),
  });
  if (res.status === 503) {
    // النموذج بارد — لا انتظار 12 ثانية هنا: الهدف قرار خلال ثوانٍ، والبدائل تكفي
    console.warn('HuggingFace KYC model cold (503) — skipped');
    return null;
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

function isAwsConfigured(): boolean {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

let rekognitionClient: RekognitionClient | null = null;
function getRekognitionClient(): RekognitionClient | null {
  if (!isAwsConfigured()) return null;
  if (!rekognitionClient) {
    rekognitionClient = new RekognitionClient({
      region: process.env.AWS_REGION || 'eu-central-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return rekognitionClient;
}

/** جنس + وضعية رأس (Yaw) من Rekognition — الوضعية تُستخدم لتحقق الحيوية */
async function detectFaceWithAws(
  imageBytes: Buffer,
): Promise<{ gender: Gender; confidence: number; yaw: number | null } | null> {
  const client = getRekognitionClient();
  if (!client) return null;

  const out = await client.send(
    new DetectFacesCommand({
      Image: { Bytes: imageBytes },
      Attributes: ['ALL'],
    }),
    { abortSignal: AbortSignal.timeout(KYC_PROVIDER_TIMEOUT_MS) },
  );

  const face = out.FaceDetails?.[0];
  if (!face) return null;

  const value = String(face.Gender?.Value ?? '');
  const gender: Gender =
    value === 'Female' ? 'female' : value === 'Male' ? 'male' : 'unknown';
  return {
    gender,
    confidence: Number(face.Gender?.Confidence ?? 0),
    yaw: typeof face.Pose?.Yaw === 'number' ? face.Pose.Yaw : null,
  };
}

async function detectWithAws(imageBytes: Buffer): Promise<DetectionResult | null> {
  const face = await detectFaceWithAws(imageBytes);
  if (!face || face.gender === 'unknown') return null;
  return { gender: face.gender, confidence: face.confidence, provider: 'aws_rekognition' };
}

/** رأي ثانٍ من أول مزوّد مضبوط غير Nyckel — null إن لم يُضبط أي بديل */
async function getSecondOpinion(imageBytes: Buffer): Promise<DetectionResult | null> {
  for (const fn of [detectWithAws, detectWithGemini, detectWithHuggingFace]) {
    try {
      const result = await fn(imageBytes);
      if (result && result.gender !== 'unknown' && result.confidence > 0) return result;
    } catch (e) {
      console.warn('KYC second-opinion provider failed:', e);
    }
  }
  return null;
}

/**
 * Nyckel أولاً؛ نتيجته الحاسمة (≥ عتبة القبول) قرار فوري بلا استدعاءات إضافية.
 * المنطقة الرمادية أو غيابه → رأي ثانٍ من مزوّد مستقل: اتفاق المزوّدين يقبل بعتبة
 * أدنى (DUAL_AGREEMENT_THRESHOLD)، وتعارضهما = «غير حاسم» (إعادة تصوير فورية).
 */
async function detectGenderFromImage(imageBytes: Buffer): Promise<DetectionResult> {
  let primary: DetectionResult | null = null;
  if (isNyckelConfigured()) {
    try {
      primary = await detectGenderWithNyckel(imageBytes);
    } catch (e) {
      console.warn('Nyckel KYC skipped:', e);
    }
  }

  if (primary && primary.gender !== 'unknown' && primary.confidence >= NYCKEL_AUTO_THRESHOLD) {
    return primary;
  }

  const second = await getSecondOpinion(imageBytes);

  if (primary && primary.gender !== 'unknown' && primary.confidence > 0) {
    if (
      second
      && second.gender === primary.gender
      && primary.confidence >= SECOND_OPINION_MIN_PRIMARY
      && second.confidence >= DUAL_AGREEMENT_THRESHOLD
    ) {
      // اتفاق مزوّدين مستقلين — يرفع الحالة الرمادية إلى قرار تلقائي
      return {
        ...primary,
        confidence: Math.max(primary.confidence, second.confidence),
        corroborated: true,
        secondProvider: second.provider,
        secondConfidence: second.confidence,
      };
    }
    if (second && second.gender !== primary.gender) {
      // مزوّدان متعارضان — غير حاسم؛ الأسلم والأسرع إعادة التصوير
      return {
        gender: 'unknown',
        confidence: 0,
        provider: primary.provider,
        secondProvider: second.provider,
        secondConfidence: second.confidence,
      };
    }
    // لا رأي ثانٍ متاح — نتيجة Nyckel وحدها (قد تكون رمادية → إعادة تصوير)
    return primary;
  }

  // Nyckel غائب/فاشل/غير حاسم — المزوّد البديل وحده بعتبته العالية (85)
  if (second) return second;

  // Nyckel ردّ «غير معروف» (وجه غير واضح مثلاً «Humans only») — إعادة تصوير
  if (primary) return primary;

  // لا مزوّد استجاب إطلاقاً — تُميَّز عن «وجه غير واضح» لتذهب للمراجعة اليدوية
  return { gender: 'unknown', confidence: 0, provider: 'none', noProvider: true };
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
  /** إطارات أعطت جنسين متعارضين */
  genderConflict: boolean;
  perFrame: Array<{ gender: Gender; confidence: number; provider: string }>;
};

/**
 * تحليل عدة إطارات (حتى 3) من كاميرا التحقق — أدق من إطار واحد:
 * - الإطارات المتطابقة تماماً تُعدّ صورة ثابتة → غير حاسم (لا توثيق تلقائي)
 * - أغلبية الإطارات تحسم الجنس؛ التعادل أو أقلية واثقة جداً → غير حاسم
 * - الثقة = أفضل إطار من الأغلبية (لا «متوسط» يسمح لإطار الالتفاتة الأضعف
 *   بإسقاط أنثى حقيقية إلى صف المراجعة)
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
        return { gender: 'unknown', confidence: 0, provider: 'none', noProvider: true } as DetectionResult;
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

  // «لا مزوّد» فقط إذا لم يستجب أي مزوّد لأي إطار — حالة انقطاع حقيقية
  const noProvider = results.length > 0 && results.every((r) => r.noProvider === true);

  const valid = results.filter((r) => r.gender !== 'unknown' && r.confidence > 0);
  if (!valid.length) {
    return {
      detected: {
        gender: 'unknown',
        confidence: 0,
        provider: 'none',
        ...(noProvider ? { noProvider: true } : {}),
      },
      meta,
    };
  }

  if (staticFrames) {
    // صورة ثابتة مُعادة — لا توثيق تلقائي مهما كانت الثقة
    return { detected: { gender: 'unknown', confidence: 0, provider: valid[0]!.provider }, meta };
  }

  const females = valid.filter((r) => r.gender === 'female');
  const males = valid.filter((r) => r.gender === 'male');
  meta.genderConflict = females.length > 0 && males.length > 0;

  const majority =
    females.length > males.length ? females : males.length > females.length ? males : null;
  if (!majority) {
    // تعادل (إطار ضد إطار) — غير حاسم
    return { detected: { gender: 'unknown', confidence: 0, provider: valid[0]!.provider }, meta };
  }

  // أقلية معارضة واثقة بمستوى القبول — مشبوه؛ لا قرار تلقائي
  const minority = majority === females ? males : females;
  const minorityTop = minority.reduce((m, r) => Math.max(m, r.confidence), 0);
  if (meta.genderConflict && minorityTop >= NYCKEL_AUTO_THRESHOLD) {
    return { detected: { gender: 'unknown', confidence: 0, provider: valid[0]!.provider }, meta };
  }

  // أفضل إطار من الأغلبية — إطار الالتفاتة الأضعف لا يسحب النتيجة للأسفل
  const best = majority.reduce((a, b) => (b.confidence > a.confidence ? b : a), majority[0]!);
  return { detected: best, meta };
}

/**
 * تحقق فعلي من إيماءة الالتفات بمقارنة زاوية الرأس (Yaw) بين لقطة الثبات
 * ولقطة الإيماءة — يعمل فقط عند ضبط AWS Rekognition؛ بدونه يُتخطى بلا أثر.
 */
async function verifyGestureLiveness(
  frames: Buffer[],
  gesture: string,
): Promise<'passed' | 'failed' | 'skipped'> {
  if (!isAwsConfigured()) return 'skipped';
  if (!gesture.startsWith('turn_') || frames.length < 2) return 'skipped';
  try {
    const [before, during] = await Promise.all([
      detectFaceWithAws(frames[0]!),
      detectFaceWithAws(frames[1]!),
    ]);
    if (before?.yaw == null || during?.yaw == null) return 'skipped';
    // عتبة متساهلة (٤°) حتى لا تُرفض التفاتة خفيفة حقيقية
    return Math.abs(during.yaw - before.yaw) >= 4 ? 'passed' : 'failed';
  } catch (e) {
    console.warn('KYC gesture liveness check skipped:', e);
    return 'skipped';
  }
}

/**
 * تحليل صورة وجه مباشرة (base64) — للتحقق السريع من التطبيق.
 * يدعم `framesBase64` (حتى 3 إطارات تُلتقط تلقائياً أثناء إيماءة بسيطة عشوائية):
 * اتفاق الإطارات يرفع الدقة، وتعارضها أو تطابقها البايتي (صورة ثابتة) → إعادة تصوير.
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
  const kycRef = db.collection('kycRequests').doc(uid);
  const [userSnap, kycSnap] = await Promise.all([userRef.get(), kycRef.get()]);
  if (!userSnap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');
  const userData = userSnap.data()!;
  const kycData = kycSnap.data() ?? {};
  // عدّاد المحاولات الرمادية السابقة — بعد MAX يتحوّل الطلب لمراجعة يدوية صريحة
  const grayAttempts = Number(kycData.faceGrayAttempts) || 0;

  const now = Date.now();

  // تهدئة: كل محاولة تكلّف حتى 3 استدعاءات Nyckel + 9 آراء ثانية + 3 كتابات Storage،
  // ورسالة «أعيدي المحاولة» تشجّع التكرار — فاصل أدنى بين المحاولات + سقف بالساعة.
  // الحقول تُكتب من السيرفر فقط (محمية في firestore.rules من تعديل العميل).
  const lastAttemptAt = Number(kycData.faceLastAttemptAt) || 0;
  if (lastAttemptAt && now - lastAttemptAt < FACE_ATTEMPT_MIN_INTERVAL_MS) {
    throw new HttpsError(
      'resource-exhausted',
      'محاولات متتالية سريعة — انتظري ثوانٍ قليلة ثم أعيدي المحاولة',
    );
  }
  let attemptWindowStart = Number(kycData.faceAttemptWindowStart) || 0;
  let attemptCount = Number(kycData.faceAttemptCount) || 0;
  if (!attemptWindowStart || now - attemptWindowStart >= FACE_ATTEMPT_WINDOW_MS) {
    attemptWindowStart = now;
    attemptCount = 0;
  }
  if (attemptCount >= FACE_ATTEMPT_MAX_PER_WINDOW) {
    throw new HttpsError(
      'resource-exhausted',
      'وصلتِ الحد الأقصى من المحاولات مؤقتاً — أعيدي المحاولة بعد نحو ساعة',
    );
  }

  // حفظ الإطارات في Storage بالتوازي مع التحليل — لا يؤخر القرار
  // (العميل لم يعد يرفع الإطار الأول بنفسه؛ هذا هو المصدر الوحيد للروابط)
  const persistPromise = Promise.allSettled(
    frames.map((f, i) => persistKycVerificationImage(uid, f, i === 0 ? 'face' : 'frame')),
  );

  await kycRef.set(
    {
      uid,
      displayName: personal.displayName ?? userData.displayName ?? '',
      fullName: personal.fullName?.trim() ?? personal.displayName ?? userData.displayName ?? '',
      status: 'processing',
      method: 'face',
      ...(gesture ? { livenessGesture: gesture } : {}),
      faceLastAttemptAt: now,
      faceAttemptWindowStart: attemptWindowStart,
      faceAttemptCount: attemptCount + 1,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  // فحص الإيماءة (حيوية) بالتوازي مع تحليل الجنس — AWS فقط، وإلا skipped
  const gesturePromise = verifyGestureLiveness(frames, gesture);

  let detected: DetectionResult;
  let meta: MultiFrameMeta | null = null;
  try {
    const analysis = await detectGenderFromFrames(frames);
    detected = analysis.detected;
    meta = analysis.meta;
  } catch (e) {
    console.error('verifyGenderFace analyze error:', e);
    detected = { gender: 'unknown', confidence: 0, provider: 'none', noProvider: true };
  }
  const gestureCheck = await gesturePromise;

  // روابط الإطارات + بيانات الحيوية — كتابة واحدة بعد اكتمال الحفظ المتوازي
  const persisted = await persistPromise;
  persisted.forEach((r) => {
    if (r.status === 'rejected') console.error('KYC face image persist error:', r.reason);
  });
  const frameUrls = persisted
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
    .map((r) => r.value);
  const verificationImageUrl = frameUrls[0] ?? '';
  await kycRef.set(
    {
      ...(verificationImageUrl
        ? { selfie: verificationImageUrl, verificationFrameUrl: verificationImageUrl }
        : {}),
      ...(frameUrls.length > 1 ? { verificationFrameUrls: frameUrls } : {}),
      ...(meta
        ? {
            livenessFrames: meta.framesAnalyzed,
            livenessStatic: meta.staticFrames,
            livenessConflict: meta.genderConflict,
            livenessPerFrame: meta.perFrame,
          }
        : {}),
      livenessGestureCheck: gestureCheck,
      updatedAt: Date.now(),
    },
    { merge: true },
  );

  if (gestureCheck === 'failed') {
    // الرأس لم يتحرك مع تعليمة الالتفات — مشبوه (صورة معروضة؟) → إعادة تصوير لا توثيق
    return rejectKycVerification(
      uid,
      kycRef,
      userRef,
      {
        aiGender: detected.gender,
        aiConfidence: detected.confidence,
        aiProvider: detected.provider,
        updatedAt: Date.now(),
      },
      'face',
      Date.now(),
      'لم تُرصد الحركة المطلوبة أثناء الالتقاط',
      'لم نلحظ الحركة المطلوبة أثناء التصوير — أعيدي المحاولة واتبعي التعليمة التي تظهر على الشاشة',
      detected,
      { retry: true, userData },
    );
  }

  return applyKycDetectionResult(uid, kycRef, userRef, userData, detected, 'face', {
    fullName: personal.fullName?.trim() || personal.displayName?.trim(),
    grayAttempts,
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
      // يرفع فقط حظر «تعارض الجنس» القديم — الحظر الإداري لسبب آخر يبقى
      ...kycBanClearPatch(userData),
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
    { userData },
  );
});

/** processing أقدم من هذا = عالق (سقف verifyGenderFace 120ث وprocessKycVerification 180ث) */
const KYC_PROCESSING_STALE_MS = 5 * 60 * 1000;
/** pending (مراجعة يدوية) أقدم من هذا يُصعَّد للأدمن مرة واحدة */
const KYC_PENDING_ESCALATE_MS = 10 * 60 * 1000;

/**
 * سويب SLA من السيرفر وحده — يحل سيناريو «20 دقيقة صامتة» بلا APK جديد:
 *
 * 1) processing عالق (أغلقت التطبيق/انقطعت الشبكة قبل وصول قرار السيرفر، أو
 *    استدعاء قديم فشل): يتحوّل إلى failed مع إشعار «أعيدي المحاولة» — بديل
 *    failStaleKycProcessing في التطبيق يعمل فقط مع APK الجديد وفقط وشاشة KYC
 *    مفتوحة؛ هذا السويب يغطي مستخدمات الـAPK الحالي المُسلَّم أيضاً، ويعالج
 *    المتراكم الحالي بأثر رجعي من أول تشغيل.
 * 2) pending (مراجعة يدوية حقيقية) أقدم من 10 دقائق: تصعيد للأدمن مرة واحدة
 *    لكل طلب (slaEscalatedAt) حتى لا تنام الطلبات في الصف بلا أحد ينتبه.
 *
 * الاستعلام بالحالة فقط (بلا نطاق زمني) — لا يحتاج فهرساً مركّباً؛ الترشيح الزمني هنا.
 */
export const kycSlaSweep = onSchedule('every 5 minutes', async () => {
  const now = Date.now();

  // 1) processing عالقة → failed + إشعار إعادة محاولة فوري
  const processingSnap = await db
    .collection('kycRequests')
    .where('status', '==', 'processing')
    .limit(300)
    .get();
  let failedCount = 0;
  for (const docSnap of processingSnap.docs) {
    const data = docSnap.data();
    const updatedAt = Number(data.updatedAt) || Number(data.createdAt) || 0;
    // بلا أي طابع زمني نعتبره قديماً (وثائق تالفة من مسارات قديمة) — يُنهى أيضاً
    if (updatedAt && now - updatedAt < KYC_PROCESSING_STALE_MS) continue;
    try {
      await docSnap.ref.set(
        { status: 'failed', failedReason: 'stale_processing_sweep', updatedAt: now },
        { merge: true },
      );
      await notifyUser(
        docSnap.id,
        'تعذّر إكمال محاولة التوثيق السابقة — افتحي شاشة التوثيق وأعيدي المحاولة الآن',
        // data.route صريح — إشعار kyc_retry يفتح شاشة KYC حتى مع APK قديم
        { title: 'أعيدي المحاولة', type: 'kyc_retry', route: '/wallet/kyc' },
      );
      failedCount += 1;
    } catch (e) {
      console.error('kycSlaSweep stale-processing error:', docSnap.id, e);
    }
  }
  if (failedCount) console.warn(`kycSlaSweep: حوّل ${failedCount} طلب processing عالق إلى failed`);

  // 2) pending أقدم من 10 دقائق → تصعيد للأدمن (مرة واحدة لكل طلب)
  const pendingSnap = await db
    .collection('kycRequests')
    .where('status', '==', 'pending')
    .limit(400)
    .get();
  const stalePending = pendingSnap.docs.filter((d) => {
    const data = d.data();
    if (Number(data.slaEscalatedAt) > 0) return false;
    const updatedAt = Number(data.updatedAt) || Number(data.createdAt) || 0;
    return !updatedAt || now - updatedAt >= KYC_PENDING_ESCALATE_MS;
  });
  if (!stalePending.length) return;

  const batch = db.batch();
  stalePending.forEach((d) => batch.set(d.ref, { slaEscalatedAt: now }, { merge: true }));
  await batch.commit();

  console.warn(
    `kycSlaSweep: تصعيد ${stalePending.length} طلب KYC معلّق للمراجعة اليدوية:`,
    stalePending.map((d) => d.id).join(', '),
  );

  // إشعار موجز واحد لكل أدمن (لا إشعار لكل طلب) — يظهر في التطبيق/الدفع إن وُجد جهاز
  try {
    const adminsSnap = await db.collection('admins').limit(10).get();
    const message = `يوجد ${stalePending.length} طلب توثيق (KYC) بانتظار المراجعة اليدوية منذ أكثر من 10 دقائق`;
    await Promise.allSettled(
      adminsSnap.docs.map((a) =>
        notifyUser(a.id, message, { title: 'مراجعة KYC متأخرة', type: 'kyc_admin_escalation' }),
      ),
    );
  } catch (e) {
    console.error('kycSlaSweep admin escalation notify error:', e);
  }
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
