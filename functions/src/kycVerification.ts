/**
 * KYC — تحليل الوجه (face-api محلي + Gemini/HuggingFace/AWS)
 *
 * الحالات في Firestore (كما في المشروع):
 *   kycRequests/{uid}.status → processing | pending | approved | rejected
 *   users/{uid}.isVerified, verificationStatus → approved | rejected | pending
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { RekognitionClient, DetectFacesCommand } from '@aws-sdk/client-rekognition';
import { detectGenderWithFaceApi } from './faceApiGender';
import { detectGenderWithNyckel, isNyckelConfigured } from './nyckelGender';
import {
  applyKycDetectionResult,
  clearKycGenderMismatchBan,
  decodeBase64Image,
  persistKycVerificationImage,
  readRegisteredGender,
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

/** تحليل صورة وجه مباشرة (base64) — للتحقق السريع من التطبيق */
export const verifyGenderFace = onCall({ memory: '1GiB', timeoutSeconds: 120 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const imageBase64 = String(request.data?.imageBase64 ?? '');
  const personal = (request.data?.personal ?? {}) as FaceVerifyPersonal;

  let imageBytes: Buffer;
  try {
    imageBytes = decodeBase64Image(imageBase64);
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    throw new HttpsError('invalid-argument', 'صورة غير صالحة');
  }

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');
  const userData = userSnap.data()!;

  const now = Date.now();
  const kycRef = db.collection('kycRequests').doc(uid);
  let verificationImageUrl = '';
  try {
    verificationImageUrl = await persistKycVerificationImage(uid, imageBytes, 'face');
  } catch (e) {
    console.error('KYC face image persist error:', e);
  }

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
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  let detected: DetectionResult;
  try {
    detected = await detectGenderFromImage(imageBytes);
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
  const frameUrl = String(kyc.verificationFrameUrl ?? kyc.selfie ?? '').trim();
  if (!frameUrl) {
    throw new HttpsError('failed-precondition', 'صورة/إطار التحقق مفقود');
  }

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');
  const userData = userSnap.data()!;

  let detected: DetectionResult;
  try {
    const bytes = await fetchImageBytes(frameUrl);
    detected = await detectGenderFromImage(bytes);
  } catch (e) {
    console.error('KYC AI analyze error:', e);
    detected = { gender: 'unknown', confidence: 0, provider: 'none' };
  }

  return applyKycDetectionResult(uid, kycRef, userRef, userData, detected, 'ai');
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
