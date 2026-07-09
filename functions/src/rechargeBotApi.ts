/**
 * HTTP API لبوت الشحن — تحقق من الحساب + شحن عملات
 *
 * POST /rechargeBotApi/verify-account
 * Header: X-Bot-Api-Key: <RECHARGE_BOT_API_KEY>
 * Body: { "accountId": "12345678" }
 *
 * POST /rechargeBotApi/credit-coins
 * Header: X-Bot-Api-Key: <RECHARGE_BOT_API_KEY>
 * Body: {
 *   "accountId": "12345678",
 *   "coins": 1000,
 *   "note": "اختياري — وصف الطلب",
 *   "reference": "اختياري — معرّف فريد لمنع التكرار"
 * }
 *
 * POST /rechargeBotApi/recharge
 * فحص الحساب + شحن بخطوة واحدة (إذا الحساب فعال فقط)
 * Body: نفس credit-coins
 */
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  resolveUserUid,
  pickCoinsBalance,
  getAccountDisableReason,
  formatPublicAccountId,
  type AccountDisableReason,
} from './shared/userLookup';
import { applyFirstRechargeBonus } from './firstRechargeBonus';
import { logCasinoRechargeActivityServer } from './casinoLiveActivityLog';

const db = admin.firestore();
const RECHARGE_BOT_UID = 'linkup_recharge_bot';
const MAX_CREDIT_COINS = 1_000_000_000;

type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'METHOD_NOT_ALLOWED'
  | 'INVALID_REQUEST'
  | 'ACCOUNT_NOT_FOUND'
  | 'ACCOUNT_DISABLED'
  | 'NOT_FOUND'
  | 'CREDIT_FAILED';

interface ApiErrorBody {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    reason?: AccountDisableReason;
  };
}

interface VerifySuccessBody {
  success: true;
  data: {
    uid: string;
    publicAccountId: string;
    displayName: string;
    coins: number;
    isVerified: boolean;
  };
}

interface CreditSuccessBody {
  success: true;
  data: {
    uid: string;
    publicAccountId: string;
    displayName: string;
    previousBalance: number;
    credited: number;
    firstRechargeBonus: number;
    newBalance: number;
    reference?: string;
  };
  duplicate?: boolean;
}

interface RechargeSuccessBody {
  success: true;
  data: {
    account: {
      status: 'active';
      uid: string;
      publicAccountId: string;
      displayName: string;
      isVerified: boolean;
    };
    beforeRecharge: {
      coins: number;
    };
    recharge: {
      credited: number;
      firstRechargeBonus: number;
      newBalance: number;
      reference?: string;
    };
  };
  duplicate?: boolean;
}

const DISABLE_MESSAGES: Record<AccountDisableReason, string> = {
  banned: 'الحساب محظور أو معطّل من الإدارة',
  auth_disabled: 'الحساب معطّل في نظام الدخول',
  pending_deletion: 'الحساب قيد الحذف ولا يمكن الشحن',
};

function json(
  res: import('express').Response,
  status: number,
  body: ApiErrorBody | VerifySuccessBody | CreditSuccessBody | RechargeSuccessBody | Record<string, unknown>,
) {
  res.status(status).set('Content-Type', 'application/json').json(body);
}

function setCors(res: import('express').Response) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-Bot-Api-Key, Authorization');
}

function readBotApiKey(req: import('express').Request): string {
  const headerKey = req.headers['x-bot-api-key'];
  if (typeof headerKey === 'string' && headerKey.trim()) return headerKey.trim();
  const auth = req.headers.authorization;
  if (typeof auth === 'string') {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return '';
}

function assertBotApiKey(req: import('express').Request): boolean {
  const expected = process.env.RECHARGE_BOT_API_KEY?.trim();
  if (!expected) return false;
  return readBotApiKey(req) === expected;
}

function readAccountId(req: import('express').Request): string {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const fromBody = body.accountId ?? body.publicAccountId ?? body.userId ?? body.id;
  if (fromBody != null && String(fromBody).trim()) return String(fromBody).trim();
  const q = req.query.accountId ?? req.query.publicAccountId ?? req.query.userId ?? req.query.id;
  if (q != null && String(q).trim()) return String(q).trim();
  return '';
}

function readCoinsAmount(req: import('express').Request): number {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const raw = body.coins ?? body.coinAmount ?? body.amount ?? req.query.coins ?? req.query.amount;
  return Math.floor(Number(raw) || 0);
}

function readOptionalString(req: import('express').Request, key: string): string {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const fromBody = body[key];
  if (fromBody != null && String(fromBody).trim()) return String(fromBody).trim();
  const fromQuery = req.query[key];
  if (fromQuery != null && String(fromQuery).trim()) return String(fromQuery).trim();
  return '';
}

function sanitizeReference(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

async function resolveActiveUser(accountId: string): Promise<
  | { ok: false; status: number; body: ApiErrorBody }
  | { ok: true; uid: string; userData: FirebaseFirestore.DocumentData; userRef: FirebaseFirestore.DocumentReference }
> {
  const uid = await resolveUserUid(accountId);
  if (!uid) {
    return {
      ok: false,
      status: 404,
      body: {
        success: false,
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: 'الحساب غير موجود — تحقق من معرّف الحساب',
        },
      },
    };
  }

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return {
      ok: false,
      status: 404,
      body: {
        success: false,
        error: { code: 'ACCOUNT_NOT_FOUND', message: 'الحساب غير موجود' },
      },
    };
  }

  const userData = userSnap.data()!;
  const disableReason = await getAccountDisableReason(uid, userData);
  if (disableReason) {
    return {
      ok: false,
      status: 403,
      body: {
        success: false,
        error: {
          code: 'ACCOUNT_DISABLED',
          message: DISABLE_MESSAGES[disableReason],
          reason: disableReason,
        },
      },
    };
  }

  return { ok: true, uid, userData, userRef };
}

function readDisplayName(userData: FirebaseFirestore.DocumentData): string {
  return String(
    (userData.profile as { displayName?: string } | undefined)?.displayName ??
      userData.displayName ??
      'مستخدم',
  );
}

type CreditInput = {
  uid: string;
  userData: FirebaseFirestore.DocumentData;
  userRef: FirebaseFirestore.DocumentReference;
  amount: number;
  note: string;
  reference: string;
};

async function performCredit(input: CreditInput): Promise<CreditSuccessBody['data']> {
  const { uid, userData, userRef, amount, note, reference } = input;
  const previousBalance = pickCoinsBalance(userData);
  const displayName = readDisplayName(userData);
  const publicAccountId = formatPublicAccountId(userData.publicAccountId, uid);
  const now = Date.now();
  const creditNote = note || 'شحن عبر بوت LinkUp';

  await userRef.update({
    'stats.coins': admin.firestore.FieldValue.increment(amount),
    coins: admin.firestore.FieldValue.increment(amount),
  });

  await db.collection('transactions').add({
    uid,
    type: 'recharge_bot_credit',
    amount,
    currency: 'coins',
    itemName: creditNote,
    status: 'completed',
    createdAt: now,
    grantedBy: RECHARGE_BOT_UID,
    reference: reference || null,
    publicAccountId,
  });

  await db.collection('notifications').add({
    uid,
    type: 'system',
    message: `تم شحن ${amount.toLocaleString('en-US')} عملة إلى حسابك`,
    data: {
      title: 'LinkUp',
      body: `+${amount.toLocaleString('en-US')} عملة — ${creditNote}`,
      type: 'recharge_bot',
    },
    fromName: 'بوت الشحن',
    isRead: false,
    createdAt: now,
  });

  try {
    await logCasinoRechargeActivityServer(db, uid, userData, amount);
  } catch {
    /* optional live feed */
  }

  const firstRechargeBonus = await applyFirstRechargeBonus(db, uid);
  const afterSnap = await userRef.get();
  const newBalance = pickCoinsBalance(afterSnap.data()!);

  return {
    uid,
    publicAccountId,
    displayName,
    previousBalance,
    credited: amount,
    firstRechargeBonus,
    newBalance,
    ...(reference ? { reference } : {}),
  };
}

function toRechargePayload(credit: CreditSuccessBody['data'], isVerified: boolean): RechargeSuccessBody['data'] {
  return {
    account: {
      status: 'active',
      uid: credit.uid,
      publicAccountId: credit.publicAccountId,
      displayName: credit.displayName,
      isVerified,
    },
    beforeRecharge: {
      coins: credit.previousBalance,
    },
    recharge: {
      credited: credit.credited,
      firstRechargeBonus: credit.firstRechargeBonus,
      newBalance: credit.newBalance,
      ...(credit.reference ? { reference: credit.reference } : {}),
    },
  };
}

async function readDuplicateCredit(
  reference: string,
): Promise<CreditSuccessBody['data'] | null> {
  if (!reference) return null;
  const prior = await db.collection('rechargeBotCreditLog').doc(reference).get();
  if (!prior.exists) return null;
  const stored = prior.data() as { result?: CreditSuccessBody['data'] } | undefined;
  return stored?.result ?? null;
}

async function saveDuplicateCreditLog(
  reference: string,
  uid: string,
  publicAccountId: string,
  amount: number,
  result: CreditSuccessBody['data'],
): Promise<void> {
  if (!reference) return;
  await db.collection('rechargeBotCreditLog').doc(reference).set({
    uid,
    publicAccountId,
    credited: amount,
    result,
    createdAt: Date.now(),
  });
}

function validateCreditRequest(
  accountId: string,
  amount: number,
): ApiErrorBody | null {
  if (!accountId) {
    return {
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'accountId مطلوب في الـ body',
      },
    };
  }
  if (amount <= 0) {
    return {
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'coins مطلوب — أدخل عدد عملات أكبر من صفر',
      },
    };
  }
  if (amount > MAX_CREDIT_COINS) {
    return {
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: `الحد الأقصى للشحنة الواحدة: ${MAX_CREDIT_COINS.toLocaleString('en-US')} عملة`,
      },
    };
  }
  return null;
}

async function handleVerifyAccount(
  req: import('express').Request,
  res: import('express').Response,
): Promise<void> {
  const accountId = readAccountId(req);
  if (!accountId) {
    json(res, 400, {
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'accountId مطلوب (معرّف الحساب 8 أرقام أو Firebase UID)',
      },
    });
    return;
  }

  const resolved = await resolveActiveUser(accountId);
  if (!resolved.ok) {
    json(res, resolved.status, resolved.body);
    return;
  }

  const { uid, userData } = resolved;
  const coins = pickCoinsBalance(userData);
  const displayName = readDisplayName(userData);

  json(res, 200, {
    success: true,
    data: {
      uid,
      publicAccountId: formatPublicAccountId(userData.publicAccountId, uid),
      displayName,
      coins,
      isVerified: userData.isVerified === true,
    },
  });
}

async function handleCreditCoins(
  req: import('express').Request,
  res: import('express').Response,
): Promise<void> {
  const accountId = readAccountId(req);
  const amount = readCoinsAmount(req);
  const note = readOptionalString(req, 'note');
  const reference = sanitizeReference(readOptionalString(req, 'reference'));

  const invalid = validateCreditRequest(accountId, amount);
  if (invalid) {
    json(res, 400, invalid);
    return;
  }

  const duplicate = await readDuplicateCredit(reference);
  if (duplicate) {
    json(res, 200, { success: true, data: duplicate, duplicate: true });
    return;
  }

  const resolved = await resolveActiveUser(accountId);
  if (!resolved.ok) {
    json(res, resolved.status, resolved.body);
    return;
  }

  const { uid, userData, userRef } = resolved;

  try {
    const result = await performCredit({
      uid,
      userData,
      userRef,
      amount,
      note,
      reference,
    });
    await saveDuplicateCreditLog(reference, uid, result.publicAccountId, amount, result);
    json(res, 200, { success: true, data: result });
  } catch {
    json(res, 500, {
      success: false,
      error: { code: 'CREDIT_FAILED', message: 'تعذّر إضافة العملات — حاول لاحقاً' },
    });
  }
}

async function handleRecharge(
  req: import('express').Request,
  res: import('express').Response,
): Promise<void> {
  const accountId = readAccountId(req);
  const amount = readCoinsAmount(req);
  const note = readOptionalString(req, 'note');
  const reference = sanitizeReference(readOptionalString(req, 'reference'));

  const invalid = validateCreditRequest(accountId, amount);
  if (invalid) {
    json(res, 400, invalid);
    return;
  }

  const duplicate = await readDuplicateCredit(reference);
  if (duplicate) {
    const userSnap = await db.collection('users').doc(duplicate.uid).get();
    const isVerified = userSnap.exists ? userSnap.data()?.isVerified === true : false;
    json(res, 200, {
      success: true,
      data: toRechargePayload(duplicate, isVerified),
      duplicate: true,
    });
    return;
  }

  const resolved = await resolveActiveUser(accountId);
  if (!resolved.ok) {
    json(res, resolved.status, resolved.body);
    return;
  }

  const { uid, userData, userRef } = resolved;
  const isVerified = userData.isVerified === true;

  try {
    const credit = await performCredit({
      uid,
      userData,
      userRef,
      amount,
      note,
      reference,
    });
    await saveDuplicateCreditLog(reference, uid, credit.publicAccountId, amount, credit);
    json(res, 200, {
      success: true,
      data: toRechargePayload(credit, isVerified),
    });
  } catch {
    json(res, 500, {
      success: false,
      error: { code: 'CREDIT_FAILED', message: 'تعذّر إضافة العملات — حاول لاحقاً' },
    });
  }
}

export const rechargeBotApi = onRequest(
  {
    region: 'us-central1',
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req, res) => {
    setCors(res);

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    const path = (req.path || req.url || '').split('?')[0];
    const isVerify =
      !path ||
      path === '/' ||
      path.endsWith('/verify-account') ||
      path.endsWith('/verify-account/');
    const isCredit =
      path.endsWith('/credit-coins') || path.endsWith('/credit-coins/');
    const isRecharge =
      path.endsWith('/recharge') || path.endsWith('/recharge/');

    if (!isVerify && !isCredit && !isRecharge) {
      json(res, 404, {
        success: false,
        error: { code: 'NOT_FOUND', message: 'المسار غير موجود' },
      });
      return;
    }

    if (isCredit || isRecharge) {
      if (req.method !== 'POST') {
        json(res, 405, {
          success: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: 'استخدم POST لشحن العملات' },
        });
        return;
      }
    } else if (req.method !== 'POST' && req.method !== 'GET') {
      json(res, 405, {
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: 'استخدم GET أو POST' },
      });
      return;
    }

    if (!assertBotApiKey(req)) {
      json(res, 401, {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'مفتاح API غير صالح أو مفقود (X-Bot-Api-Key)',
        },
      });
      return;
    }

    if (isRecharge) {
      await handleRecharge(req, res);
      return;
    }

    if (isCredit) {
      await handleCreditCoins(req, res);
      return;
    }

    await handleVerifyAccount(req, res);
  },
);
