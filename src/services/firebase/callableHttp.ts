/**
 * استدعاء Cloud Functions Callable عبر HTTP مع Bearer token صريح.
 *
 * على React Native، httpsCallable أحياناً لا يرفق Firebase Auth token
 * (خصوصاً مع bundle خاطئ) فيُرجع 403/unauthenticated رغم أن المستخدم مسجّل دخول.
 * والعكس: HTTP على cloudfunctions.net قد يُرجع 404 لدوال Gen2 بينما SDK يعمل.
 */
import { httpsCallable } from 'firebase/functions';
import { app, auth, functions } from './index';
import { translateCallableError } from './authReady';

const FUNCTIONS_REGION = 'us-central1';

type CallableEnvelope<T> = {
  result?: T;
  error?: { status?: string; message?: string; details?: unknown };
};

function callableUrl(functionName: string): string {
  const projectId = app.options.projectId;
  if (!projectId) {
    throw new Error('Firebase project غير مهيّأ');
  }
  return `https://${FUNCTIONS_REGION}-${projectId}.cloudfunctions.net/${functionName}`;
}

function shouldFallbackToSdk(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? '');
  const code = String((err as { code?: string })?.code ?? '');
  if (code === 'functions/unauthenticated') return false;
  return (
    msg.includes('404') ||
    msg.includes('403') ||
    msg.includes('استجابة غير متوقعة') ||
    msg.includes('Failed to fetch') ||
    msg.includes('Network request failed')
  );
}

/** يستدعي Callable Gen2 مع Authorization: Bearer <Firebase ID Token> */
export async function callCallableHttp<TReq, TRes>(
  functionName: string,
  data: TReq,
  idToken: string,
): Promise<TRes> {
  const response = await fetch(callableUrl(functionName), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data }),
  });

  let body: CallableEnvelope<TRes> | null = null;
  try {
    body = (await response.json()) as CallableEnvelope<TRes>;
  } catch {
    body = null;
  }

  if (body?.error) {
    const status = String(body.error.status ?? 'unknown').toLowerCase();
    throw Object.assign(new Error(body.error.message ?? status), {
      code: `functions/${status}`,
    });
  }

  if (!response.ok) {
    if (response.status === 403 || response.status === 401) {
      throw Object.assign(new Error('unauthenticated'), {
        code: 'functions/unauthenticated',
      });
    }
    if (response.status === 404) {
      throw Object.assign(new Error('not-found'), {
        code: 'functions/not-found',
      });
    }
    throw new Error(`فشل الاتصال بالسيرفر (${response.status})`);
  }

  if (body?.result === undefined) {
    throw new Error('استجابة غير متوقعة من السيرفر');
  }

  return body.result;
}

/** HTTP + fallback إلى Firebase SDK (Gen2 Callable) */
export async function callCallableWithAuth<TReq, TRes>(
  functionName: string,
  data: TReq,
  idToken: string,
): Promise<TRes> {
  try {
    return await callCallableHttp<TReq, TRes>(functionName, data, idToken);
  } catch (httpErr) {
    if (!shouldFallbackToSdk(httpErr) || !auth.currentUser) {
      throw new Error(translateCallableError(httpErr));
    }
    if (__DEV__) {
      console.warn(`[Callable] HTTP ${functionName} failed, trying httpsCallable`, {
        message: (httpErr as Error)?.message,
        projectId: app.options.projectId,
      });
    }
    try {
      const fn = httpsCallable<TReq, TRes>(functions, functionName);
      const result = await fn(data);
      return result.data;
    } catch (sdkErr) {
      throw new Error(translateCallableError(sdkErr));
    }
  }
}
