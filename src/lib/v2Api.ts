/**
 * الجسر إلى سيرفر LinkUp v2 — the dashboard's new data source.
 *
 * This panel was written against Firebase directly (firestore SDK in the
 * browser). The app now lives on our own NestJS + Postgres server, so the data
 * has to come from there instead. The approach is deliberately minimal: keep
 * every page and every function in `services/admin.ts` exactly as it is, and
 * swap only the layer underneath — so nothing about how the panel works changes,
 * only where the bytes come from.
 *
 * No Firebase Function is touched. Nothing here writes to Firestore.
 */

const BASE: string =
  (import.meta.env.VITE_V2_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  'https://linkup-v2.onrender.com/api';

const TOKEN_KEY = 'linkup.v2.admin.token';

export function getV2Token(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // private mode / storage disabled
  }
}

export function setV2Token(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* session then lasts only for this page load */
  }
}

export class V2ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'V2ApiError';
  }
}

/** Arabic copy for the codes the server actually returns. */
const MESSAGES: Record<string, string> = {
  'no-token': 'يجب تسجيل الدخول',
  'invalid-token': 'انتهت الجلسة، سجّل الدخول من جديد',
  'not-admin': 'هذا الحساب لا يملك صلاحية الدخول للوحة',
  'missing-permission': 'ليس لديك صلاحية لهذه الصفحة',
  'super-only': 'هذا الإجراء للمالك فقط',
  'config-not-found': 'هذا الإعداد غير موجود',
  'config-must-be-object': 'المحتوى يجب أن يكون كائن JSON',
  'bad-config-id': 'معرّف إعداد غير صالح',
  'user-not-found': 'المستخدم غير موجود',
  network: 'تعذّر الاتصال بالخادم',
};

export function v2ErrorMessage(e: unknown): string {
  if (e instanceof V2ApiError) return MESSAGES[e.code] ?? e.message;
  return e instanceof Error ? e.message : 'حدث خطأ غير متوقع';
}

let onUnauthorized: (() => void) | null = null;
export function setV2UnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  auth = true,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getV2Token();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new V2ApiError(0, 'network', MESSAGES.network);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const parsed: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    const code = extractCode(parsed);
    // 401 = the token is gone or expired, so drop the session. 403 only means
    // this account lacks a permission — staying logged in is correct there.
    if (res.status === 401) onUnauthorized?.();
    throw new V2ApiError(res.status, code, MESSAGES[code] ?? `فشل الطلب (${res.status})`);
  }
  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractCode(parsed: unknown): string {
  if (parsed && typeof parsed === 'object') {
    const message = (parsed as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (message && typeof message === 'object') {
      const code = (message as { code?: unknown }).code;
      if (typeof code === 'string') return code;
    }
    const code = (parsed as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return 'unknown';
}

export const v2 = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
  /** Sign-in runs before there is a token. */
  login: <T>(path: string, body: unknown) => request<T>('POST', path, body, false),
};

/** `?a=1&b=2`, dropping empties so the server never sees a blank filter. */
export function v2Qs(params: Record<string, string | number | undefined>): string {
  const usable = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== '' && v !== null,
  );
  if (usable.length === 0) return '';
  return `?${usable.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`;
}
