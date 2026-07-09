/**
 * روابط مشاركة مختصرة + إعادة توجيه Deep Link
 * الرابط القصير: https://linkuplivechat.com/r/{code}
 */

import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const db = admin.firestore();
const rtdb = admin.database();

/** الدومين الرسمي للمشاركة و Deep Linking */
const SHARE_LINK_BASE =
  process.env.SHARE_LINK_BASE || 'https://linkuplivechat.com';
const APP_SCHEME = 'linkup';
const ANDROID_PACKAGE = 'com.linkup.app';
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const CODE_LENGTH = 7;
const LINK_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 يوم

type ShareLinkType = 'room' | 'profile' | 'post' | 'party';

interface ShareLinkDoc {
  type: ShareLinkType;
  targetId: string;
  label?: string;
  createdBy: string;
  createdAt: admin.firestore.Timestamp;
  expiresAt: admin.firestore.Timestamp;
  clicks: number;
}

function randomCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
  }
  return out;
}

function buildDeepLink(type: ShareLinkType, targetId: string): string {
  if (type === 'room') return `${APP_SCHEME}://room/${targetId}`;
  if (type === 'post') return `${APP_SCHEME}://post/${targetId}`;
  if (type === 'party') return `${APP_SCHEME}://party/${targetId}`;
  return `${APP_SCHEME}://profile/${targetId}`;
}

function buildShortUrl(code: string): string {
  const base = SHARE_LINK_BASE.replace(/\/$/, '');
  return `${base}/r/${code}`;
}

async function assertShareTarget(type: ShareLinkType, targetId: string): Promise<string> {
  if (!targetId || typeof targetId !== 'string' || targetId.length > 128) {
    throw new HttpsError('invalid-argument', 'معرّف الهدف غير صالح');
  }
  if (type === 'room') {
    const snap = await rtdb.ref(`rooms/${targetId}`).once('value');
    if (!snap.exists()) throw new HttpsError('not-found', 'الغرفة غير موجودة');
    const data = snap.val() as { name?: string; isActive?: boolean };
    return typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'غرفة LinkUp';
  }
  if (type === 'profile') {
    const snap = await db.collection('users').doc(targetId).get();
    if (!snap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');
    const data = snap.data() as { displayName?: string; name?: string };
    const name = data.displayName || data.name;
    return typeof name === 'string' && name.trim() ? name.trim() : 'LinkUp';
  }
  if (type === 'post') {
    const snap = await db.collection('posts').doc(targetId).get();
    if (!snap.exists) throw new HttpsError('not-found', 'المنشور غير موجود');
    const data = snap.data() as {
      status?: string;
      authorName?: string;
      text?: string;
    };
    if (data.status === 'removed' || data.status === 'hidden') {
      throw new HttpsError('not-found', 'المنشور غير متاح');
    }
    const author =
      typeof data.authorName === 'string' && data.authorName.trim()
        ? data.authorName.trim()
        : 'LinkUp';
    const rawText = typeof data.text === 'string' ? data.text.trim() : '';
    const excerpt = rawText ? rawText.slice(0, 48) : '';
    return excerpt
      ? `${author}: ${excerpt}${rawText.length > 48 ? '…' : ''}`
      : `منشور ${author}`;
  }
  if (type === 'party') {
    const snap = await db.collection('agencyPartyRequests').doc(targetId).get();
    if (!snap.exists) throw new HttpsError('not-found', 'الحفلة غير موجودة');
    const data = snap.data() as {
      status?: string;
      description?: string;
      agencyName?: string;
      startAt?: number;
      durationMinutes?: number;
      stoppedAt?: number;
    };
    if (data.status !== 'approved') {
      throw new HttpsError('failed-precondition', 'الحفلة غير متاحة للمشاركة');
    }
    const endAt =
      (typeof data.stoppedAt === 'number' ? data.stoppedAt : null) ??
      ((data.startAt ?? 0) + (data.durationMinutes ?? 0) * 60_000);
    if (endAt < Date.now()) {
      throw new HttpsError('failed-precondition', 'انتهى وقت الحفلة');
    }
    const title =
      typeof data.description === 'string' && data.description.trim()
        ? data.description.trim()
        : 'احتفال LinkUp';
    const agency =
      typeof data.agencyName === 'string' && data.agencyName.trim()
        ? data.agencyName.trim()
        : '';
    return agency ? `${title} — ${agency}` : title;
  }
  throw new HttpsError('invalid-argument', 'نوع الرابط غير مدعوم');
}

/**
 * إنشاء رابط مشاركة مختصر (غرفة أو بروفايل)
 */
export const createShareLink = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const type = request.data?.type as ShareLinkType;
  const targetId = String(request.data?.targetId ?? '').trim();
  const labelInput = typeof request.data?.label === 'string' ? request.data.label.trim() : '';

  if (type !== 'room' && type !== 'profile' && type !== 'post' && type !== 'party') {
    throw new HttpsError('invalid-argument', 'type يجب أن يكون room أو profile أو post أو party');
  }

  const defaultLabel = await assertShareTarget(type, targetId);
  const label = labelInput || defaultLabel;

  // إعادة استخدام رابط حديث لنفس الهدف من نفس المستخدم (خلال 7 أيام)
  const weekAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const existing = await db
    .collection('shareLinks')
    .where('type', '==', type)
    .where('targetId', '==', targetId)
    .where('createdBy', '==', uid)
    .where('createdAt', '>', weekAgo)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0]!;
    const data = doc.data() as ShareLinkDoc;
    const code = doc.id;
    const deepLink = buildDeepLink(data.type, data.targetId);
    return {
      code,
      shortUrl: buildShortUrl(code),
      deepLink,
      webLink: buildShortUrl(code),
      label: data.label || label,
      reused: true,
    };
  }

  let code = '';
  let ref: admin.firestore.DocumentReference | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    code = randomCode();
    ref = db.collection('shareLinks').doc(code);
    const taken = await ref.get();
    if (!taken.exists) break;
    if (attempt === 7) throw new HttpsError('resource-exhausted', 'تعذّر إنشاء رمز، حاول لاحقاً');
  }

  const now = admin.firestore.Timestamp.now();
  const doc: ShareLinkDoc = {
    type,
    targetId,
    label,
    createdBy: uid,
    createdAt: now,
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + LINK_TTL_MS),
    clicks: 0,
  };
  await ref!.set(doc);

  const deepLink = buildDeepLink(type, targetId);
  const shortUrl = buildShortUrl(code);
  return { code, shortUrl, deepLink, webLink: shortUrl, label, reused: false };
});

/**
 * حل رمز الرابط المختصر — للتطبيق عند فتح https://linkuplivechat.com/r/{code}
 */
export const resolveShareLink = onCall(async (request) => {
  const code = String(request.data?.code ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '');

  if (!code || code.length < 5 || code.length > 12) {
    throw new HttpsError('invalid-argument', 'رمز الرابط غير صالح');
  }

  const snap = await db.collection('shareLinks').doc(code).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'الرابط غير موجود أو منتهٍ');
  }

  const data = snap.data() as ShareLinkDoc;
  if (data.expiresAt.toMillis() < Date.now()) {
    throw new HttpsError('failed-precondition', 'انتهت صلاحية الرابط');
  }

  const deepLink = buildDeepLink(data.type, data.targetId);
  let route = `/profile/${data.targetId}`;
  if (data.type === 'room') route = `/room/${data.targetId}`;
  else if (data.type === 'post') route = `/post/${data.targetId}`;
  else if (data.type === 'party') {
    const partySnap = await db.collection('agencyPartyRequests').doc(data.targetId).get();
    const roomId = partySnap.exists
      ? String((partySnap.data() as { roomId?: string })?.roomId ?? '')
      : '';
    route = roomId ? `/room/${roomId}` : `/agency/party`;
  }

  return {
    code,
    type: data.type,
    targetId: data.targetId,
    deepLink,
    route,
    label: data.label ?? 'LinkUp',
    shortUrl: buildShortUrl(code),
  };
});

function redirectHtml(opts: {
  title: string;
  deepLink: string;
  subtitle: string;
}): string {
  const { title, deepLink, subtitle } = opts;
  const intentPath = deepLink.replace(`${APP_SCHEME}://`, '');
  const intentUrl = `intent://${intentPath}#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE};end`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} — LinkUp</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#1a1028;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center}
    a{color:#c4b5fd;text-decoration:none;font-weight:600}
    .btn{display:inline-block;margin-top:20px;padding:14px 28px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border-radius:12px;text-decoration:none}
  </style>
  <script>
    (function(){
      var deep = ${JSON.stringify(deepLink)};
      var intent = ${JSON.stringify(intentUrl)};
      var isAndroid = /Android/i.test(navigator.userAgent);
      try { window.location.replace(isAndroid ? intent : deep); } catch(e) {}
      setTimeout(function(){ document.getElementById('fallback').style.display='block'; }, 1200);
    })();
  </script>
</head>
<body>
  <div>
    <h1>${title}</h1>
    <p>${subtitle}</p>
    <div id="fallback" style="display:none">
      <a class="btn" href="${deepLink}">افتح في LinkUp</a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * فتح الرابط المختصر — يُستدعى من Hosting: /r/{code}
 */
export const shareRedirect = onRequest({ cors: false }, async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  let code = '';
  const path = (req.path || req.url || '').split('?')[0]!;
  const parts = path.split('/').filter(Boolean);
  const rIdx = parts.indexOf('r');
  if (rIdx >= 0 && parts[rIdx + 1]) {
    code = parts[rIdx + 1]!;
  } else if (typeof req.query.c === 'string') {
    code = req.query.c;
  }

  code = code.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (!code || code.length < 5 || code.length > 12) {
    res.status(404).send('الرابط غير صالح');
    return;
  }

  const snap = await db.collection('shareLinks').doc(code).get();
  if (!snap.exists) {
    res.status(404).send('الرابط منتهٍ أو غير موجود');
    return;
  }

  const data = snap.data() as ShareLinkDoc;
  if (data.expiresAt.toMillis() < Date.now()) {
    res.status(410).send('انتهت صلاحية الرابط');
    return;
  }

  if (req.method === 'GET') {
    await snap.ref.update({ clicks: admin.firestore.FieldValue.increment(1) }).catch(() => {});
  }

  const deepLink = buildDeepLink(data.type, data.targetId);
  const title = data.label || 'LinkUp';
  const subtitle =
    data.type === 'room'
      ? 'جاري فتح الغرفة في التطبيق…'
      : data.type === 'post'
        ? 'جاري فتح المنشور في التطبيق…'
        : data.type === 'party'
          ? 'جاري فتح الحفلة في التطبيق…'
          : 'جاري فتح الملف الشخصي…';

  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(redirectHtml({ title, deepLink, subtitle }));
});
