/**
 * Nyckel — كشف الجنس من صورة الوجه (مركز التحقق للمضيفات)
 * @see https://www.nyckel.com/pretrained-classifiers/gender-detector/
 * @see https://www.nyckel.com/docs/developer-platform/
 */
import type { DetectionResult, Gender } from './kycVerification.shared';

const NYCKEL_BASE = (process.env.NYCKEL_API_URL ?? 'https://www.nyckel.com').replace(/\/$/, '');
const NYCKEL_CLIENT_ID = (process.env.NYCKEL_CLIENT_ID ?? '').trim();
const NYCKEL_CLIENT_SECRET = (process.env.NYCKEL_CLIENT_SECRET ?? '').trim();
/** معرّف الدالة المسبقة — من لوحة Nyckel أو slug: gender-detector */
const NYCKEL_GENDER_FUNCTION_ID = (
  process.env.NYCKEL_GENDER_FUNCTION_ID ?? 'gender-detector'
).trim();

/** مهلة قصوى لاستدعاءات Nyckel — اتصال معلّق لا يجمّد طلب KYC كله */
const NYCKEL_TIMEOUT_MS = 15_000;

let tokenCache: { token: string; renewAt: number } | null = null;

export function isNyckelConfigured(): boolean {
  return Boolean(NYCKEL_CLIENT_ID && NYCKEL_CLIENT_SECRET && NYCKEL_GENDER_FUNCTION_ID);
}

async function getNyckelBearerToken(): Promise<string | null> {
  if (!isNyckelConfigured()) return null;

  const now = Date.now();
  if (tokenCache && now < tokenCache.renewAt) return tokenCache.token;

  const res = await fetch(`${NYCKEL_BASE}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(NYCKEL_TIMEOUT_MS),
    body: new URLSearchParams({
      client_id: NYCKEL_CLIENT_ID,
      client_secret: NYCKEL_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) {
    console.warn('Nyckel token error:', res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  const marginMs = 10 * 60 * 1000;
  const ttlMs = Math.max(60_000, ((data.expires_in ?? 3600) * 1000) - marginMs);
  tokenCache = { token: data.access_token, renewAt: now + ttlMs };
  return data.access_token;
}

function labelToGender(label: string): Gender {
  const n = label.toLowerCase();
  if (n.includes('female') || n.includes('woman') || n === 'f') return 'female';
  if (n.includes('male') || n.includes('man') || n === 'm') return 'male';
  // تسميات Nyckel الأخرى: "Humans only, please" وغيرها
  return 'unknown';
}

function toConfidencePercent(confidence: number): number {
  if (!Number.isFinite(confidence)) return 0;
  if (confidence <= 1) return Math.round(confidence * 100);
  return Math.min(100, Math.round(confidence));
}

/**
 * يحلّل صورة الوجه عبر Nyckel Gender Detector.
 * يُرجع confidence بنطاق 0–100.
 */
export async function detectGenderWithNyckel(imageBytes: Buffer): Promise<DetectionResult | null> {
  if (!isNyckelConfigured()) return null;

  const token = await getNyckelBearerToken();
  if (!token) return null;

  const b64 = imageBytes.toString('base64');
  const dataUri = `data:image/jpeg;base64,${b64}`;

  const res = await fetch(
    `${NYCKEL_BASE}/v1/functions/${encodeURIComponent(NYCKEL_GENDER_FUNCTION_ID)}/invoke`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Nyckel-Client-Name': 'linkup-kyc',
      },
      signal: AbortSignal.timeout(NYCKEL_TIMEOUT_MS),
      body: JSON.stringify({ data: dataUri }),
    },
  );

  if (!res.ok) {
    console.warn('Nyckel invoke error:', res.status, await res.text());
    return null;
  }

  const payload = (await res.json()) as {
    labelName?: string;
    confidence?: number;
    sampleId?: string;
  };

  const gender = labelToGender(String(payload.labelName ?? ''));
  const confidence = toConfidencePercent(Number(payload.confidence ?? 0));

  if (gender === 'unknown') {
    return { gender, confidence: 0, provider: 'nyckel' };
  }

  return { gender, confidence, provider: 'nyckel' };
}
