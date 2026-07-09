/**
 * Lit-App Telegram Bot — Admin API client
 * @see https://www.api.linkuppay.store/docs
 */

const DEFAULT_BASE = 'https://www.api.linkuppay.store';
const LS_KEY = 'bot_admin_api_key';

export class BotAdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'BotAdminApiError';
    this.status = status;
  }
}

export function getBotAdminApiBase(): string {
  return (import.meta.env.VITE_BOT_ADMIN_API_URL as string | undefined)?.trim() || DEFAULT_BASE;
}

export function getBotAdminApiKey(): string {
  const fromEnv = (import.meta.env.VITE_BOT_ADMIN_API_KEY as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  try {
    return localStorage.getItem(LS_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function setBotAdminApiKey(key: string): void {
  try {
    const trimmed = key.trim();
    if (trimmed) localStorage.setItem(LS_KEY, trimmed);
    else localStorage.removeItem(LS_KEY);
  } catch {
    // ignore
  }
}

export function isBotAdminConfigured(): boolean {
  return getBotAdminApiKey().length > 0;
}

// ─── Types (from OpenAPI) ───────────────────────────────────────────────────

export interface BotOrder {
  id: number;
  user_id: number;
  amount?: number | null;
  service?: string | null;
  coin?: string | null;
  chain?: string | null;
  transaction_hash?: string | null;
  lit_app_user_id?: string | null;
  status: string;
  created_at?: string | null;
  completed_at?: string | null;
}

export interface BotOrderListResponse {
  total: number;
  limit: number;
  offset: number;
  orders: BotOrder[];
}

export interface BotUser {
  user_id: number;
  username?: string | null;
  first_name?: string | null;
  claimed_key?: string | null;
  language?: string;
  verified_at?: string | null;
}

export interface BotUserListResponse {
  total: number;
  limit: number;
  offset: number;
  users: BotUser[];
}

export interface BotAccessKey {
  key: string;
  is_claimed: boolean;
  claimed_by_user_id?: number | null;
  claimed_at?: string | null;
  created_at?: string | null;
}

export interface BotAccessKeyListResponse {
  keys: BotAccessKey[];
}

export interface BotCoinRate {
  coin_type: string;
  chain: string;
  rate_per_usd: number;
  is_active: boolean;
  updated_at?: string | null;
}

export interface BotStatsResponse {
  orders: { total: number; by_status: Record<string, number>; last_24h: number };
  users: { total: number };
  access_keys: { total: number; claimed: number; available: number };
}

export interface BotCoinRateUpdate {
  coin: string;
  chain: string;
  rate_per_usd: number;
}

export interface BotAccessKeyCreate {
  /** مفتاح مخصص — يُولَّد تلقائياً إن تُرك فارغاً */
  key?: string | null;
  prefix?: string;
}

export interface BotAccessKeyBulkCreate {
  count: number;
  prefix?: string;
  length?: number;
}

export interface BotAccessKeyResponse {
  success: boolean;
  keys: string[];
  count: number;
  message: string;
}

export interface BotListQuery {
  limit?: number;
  offset?: number;
}

// ─── HTTP ───────────────────────────────────────────────────────────────────

async function botFetch<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string | number | boolean | undefined | null> },
): Promise<T> {
  const apiKey = getBotAdminApiKey();
  if (!apiKey) {
    throw new BotAdminApiError('مفتاح Bot Admin API غير مُعرَّف — أضفه في الإعدادات أو VITE_BOT_ADMIN_API_KEY', 0);
  }

  const base = getBotAdminApiBase().replace(/\/$/, '');
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }

  const { query: _q, ...rest } = init ?? {};
  const res = await fetch(url.toString(), {
    ...rest,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      ...rest.headers,
    },
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err?.detail) {
        msg = Array.isArray(err.detail)
          ? err.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(' · ')
          : String(err.detail);
      } else if (err?.message) msg = String(err.message);
    } catch {
      // ignore
    }
    throw new BotAdminApiError(msg, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const botHealthCheck = () =>
  botFetch<{ status?: string; database?: string }>('/health', { method: 'GET' });

export const botGetStats = () => botFetch<BotStatsResponse>('/api/v1/stats/');

export const botListOrders = (params?: {
  limit?: number;
  offset?: number;
  status?: string;
  user_id?: number;
  tx_hash?: string;
}) => botFetch<BotOrderListResponse>('/api/v1/orders/', { query: params });

export const botGetOrder = (orderId: number) =>
  botFetch<BotOrder>(`/api/v1/orders/${orderId}`);

export const botListUsers = (params?: { limit?: number; offset?: number }) =>
  botFetch<BotUserListResponse>('/api/v1/users/', { query: params });

export const botGetUser = (userId: number) =>
  botFetch<BotUser>(`/api/v1/users/${userId}`);

export const botListAccessKeys = (claimedOnly?: boolean | null) =>
  botFetch<BotAccessKeyListResponse>('/api/v1/users/keys/all', {
    query: claimedOnly === undefined || claimedOnly === null ? {} : { claimed_only: claimedOnly },
  });

export const botListRates = () => botFetch<BotCoinRate[]>('/api/v1/rates/');

export const botGetRate = (coin: string, chain: string) =>
  botFetch<BotCoinRate>(`/api/v1/rates/${encodeURIComponent(coin)}/${encodeURIComponent(chain)}`);

export const botUpdateRate = (body: BotCoinRateUpdate) =>
  botFetch<{ success: boolean; message: string; rate?: BotCoinRate | null }>('/api/v1/rates/update', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const botDeactivateRate = (coin: string, chain: string) =>
  botFetch<{ success: boolean; message: string; rate?: BotCoinRate | null }>(
    `/api/v1/rates/deactivate/${encodeURIComponent(coin)}/${encodeURIComponent(chain)}`,
    { method: 'POST' },
  );

/** POST /api/v1/keys/create — إنشاء مفتاح واحد */
export const botCreateAccessKey = (body?: BotAccessKeyCreate) =>
  botFetch<BotAccessKeyResponse>('/api/v1/keys/create', {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });

/** POST /api/v1/keys/bulk — توليد مفاتيح دفعة واحدة */
export const botCreateAccessKeysBulk = (body: BotAccessKeyBulkCreate) =>
  botFetch<BotAccessKeyResponse>('/api/v1/keys/bulk', {
    method: 'POST',
    body: JSON.stringify(body),
  });

/** GET /api/v1/keys/list — قائمة مفاتيح مع ترقيم */
export const botListKeysPaginated = (params?: BotListQuery & { claimed_only?: boolean | null }) =>
  botFetch<BotAccessKey[]>('/api/v1/keys/list', {
    query: params as Record<string, string | number | boolean | null | undefined>,
  });

/** DELETE /api/v1/keys/{key} — حذف مفتاح غير مُستخدم */
export const botDeleteAccessKey = (key: string) =>
  botFetch<{ success?: boolean; message?: string }>(
    `/api/v1/keys/${encodeURIComponent(key)}`,
    { method: 'DELETE' },
  );

/** كل مسارات الـ API المدعومة — للمرجع */
export const BOT_ADMIN_API_ENDPOINTS = [
  { method: 'GET', path: '/health', label: 'فحص الصحة' },
  { method: 'GET', path: '/api/v1/stats/', label: 'إحصائيات' },
  { method: 'GET', path: '/api/v1/orders/', label: 'قائمة الطلبات' },
  { method: 'GET', path: '/api/v1/orders/{id}', label: 'تفاصيل طلب' },
  { method: 'GET', path: '/api/v1/users/', label: 'قائمة المستخدمين' },
  { method: 'GET', path: '/api/v1/users/{id}', label: 'تفاصيل مستخدم' },
  { method: 'GET', path: '/api/v1/users/keys/all', label: 'كل المفاتيح' },
  { method: 'POST', path: '/api/v1/keys/create', label: 'إنشاء مفتاح' },
  { method: 'POST', path: '/api/v1/keys/bulk', label: 'توليد مفاتيح' },
  { method: 'GET', path: '/api/v1/keys/list', label: 'قائمة مفاتيح (ترقيم)' },
  { method: 'DELETE', path: '/api/v1/keys/{key}', label: 'حذف مفتاح' },
  { method: 'GET', path: '/api/v1/rates/', label: 'أسعار الصرف' },
  { method: 'GET', path: '/api/v1/rates/{coin}/{chain}', label: 'سعر محدد' },
  { method: 'POST', path: '/api/v1/rates/update', label: 'تحديث سعر' },
  { method: 'POST', path: '/api/v1/rates/deactivate/{coin}/{chain}', label: 'إلغاء سعر' },
] as const;
