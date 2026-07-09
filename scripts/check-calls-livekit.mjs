#!/usr/bin/env node
/**
 * فحص المكالمات والمطابقات عبر LiveKit + Cloud Functions
 *
 * الاستخدام:
 *   node scripts/check-calls-livekit.mjs
 *   node scripts/check-calls-livekit.mjs --email=user@test.com --password=secret
 *   node scripts/check-calls-livekit.mjs --skip-livekit-connect   # بدون اتصال WebRTC
 *
 * متغيّرات البيئة (أو ملف linkup-functions/functions/.env):
 *   FIREBASE_API_KEY          — من google-services.json
 *   FIREBASE_PROJECT_ID       — افتراضي: linkup-dc45f
 *   FIREBASE_REGION           — افتراضي: us-central1
 *   TEST_USER_EMAIL           — حساب اختبار 1
 *   TEST_USER_PASSWORD
 *   TEST_USER_B_EMAIL         — حساب اختبار 2 (للمطابقة — اختياري)
 *   TEST_USER_B_PASSWORD
 *   LIVEKIT_API_KEY / LIVEKIT_API_SECRET / LIVEKIT_WS_URL — للتحقق المحلي
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FUNCTIONS_ENV = path.join(ROOT, 'functions', '.env');
const APP_ROOT = path.resolve(ROOT, '../sada-app 14');

const JSON_OUT = process.argv.includes('--json');
const SKIP_LIVE = process.argv.includes('--skip-livekit-connect');

function argValue(name) {
  const pref = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : '';
}

// ─── تحميل .env ───────────────────────────────────────────────────────────
function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnv(FUNCTIONS_ENV);

function readGoogleServicesApiKey() {
  const gsPath = path.join(APP_ROOT, 'google-services.json');
  if (!fs.existsSync(gsPath)) return null;
  try {
    const gs = JSON.parse(fs.readFileSync(gsPath, 'utf8'));
    return gs?.client?.[0]?.api_key?.[0]?.current_key ?? null;
  } catch {
    return null;
  }
}

const CONFIG = {
  apiKey: process.env.FIREBASE_API_KEY || readGoogleServicesApiKey(),
  projectId: process.env.FIREBASE_PROJECT_ID || 'linkup-dc45f',
  region: process.env.FIREBASE_REGION || 'us-central1',
  userA: {
    email: argValue('email') || process.env.TEST_USER_EMAIL || '',
    password: argValue('password') || process.env.TEST_USER_PASSWORD || '',
  },
  userB: {
    email: argValue('email-b') || process.env.TEST_USER_B_EMAIL || '',
    password: argValue('password-b') || process.env.TEST_USER_B_PASSWORD || '',
  },
  livekit: {
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
    wsUrl: process.env.LIVEKIT_WS_URL || '',
  },
};

const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!JSON_OUT) {
    const icon = ok ? '✅' : '❌';
    console.log(`${icon} ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function callableUrl(fn) {
  return `https://${CONFIG.region}-${CONFIG.projectId}.cloudfunctions.net/${fn}`;
}

async function signIn(email, password) {
  if (!email || !password) {
    throw new Error('TEST_USER_EMAIL و TEST_USER_PASSWORD مطلوبان');
  }
  if (!CONFIG.apiKey) {
    throw new Error('FIREBASE_API_KEY غير موجود — ضعه في .env أو google-services.json');
  }
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CONFIG.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message || `Auth failed (${res.status})`);
  }
  return {
    uid: body.localId,
    email: body.email,
    idToken: body.idToken,
    refreshToken: body.refreshToken,
  };
}

async function callFunction(name, data, idToken) {
  const res = await fetch(callableUrl(name), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data }),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (body?.error) {
    const status = body.error.status || 'unknown';
    throw Object.assign(new Error(body.error.message || status), { code: status });
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  if (body?.result === undefined) {
    throw new Error('استجابة Callable بدون result');
  }
  return body.result;
}

function decodeJwtPayload(token) {
  const part = token.split('.')[1];
  if (!part) throw new Error('JWT غير صالح');
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

async function loadLiveKitClient() {
  const candidates = [
    path.join(APP_ROOT, 'node_modules', 'livekit-client'),
    path.join(ROOT, 'functions', 'node_modules', 'livekit-client'),
  ];
  for (const p of candidates) {
    try {
      return await import(p);
    } catch {
      // try next
    }
  }
  return null;
}

async function testLiveKitConnect(wsUrl, token, label) {
  if (SKIP_LIVE) {
    record(`${label}: اتصال LiveKit`, true, 'تخطّي (--skip-livekit-connect)');
    return;
  }
  const lk = await loadLiveKitClient();
  if (!lk?.Room) {
    record(`${label}: اتصال LiveKit`, false, 'livekit-client غير مثبت — npm install في sada-app 14');
    return;
  }
  const room = new lk.Room();
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('انتهت مهلة الاتصال (15ث)')), 15_000),
  );
  try {
    await Promise.race([room.connect(wsUrl, token), timeout]);
    const state = room.state;
    await room.disconnect().catch(() => {});
    const ok = state === lk.ConnectionState?.Connected || String(state).includes('connected');
    record(`${label}: اتصال LiveKit`, ok, `state=${state}`);
  } catch (e) {
    record(`${label}: اتصال LiveKit`, false, e.message);
  }
}

async function run() {
  if (!JSON_OUT) {
    console.log('\n🔍 فحص المكالمات والمطابقات (LiveKit)\n');
    console.log(`   Project: ${CONFIG.projectId}`);
    console.log(`   Region:  ${CONFIG.region}\n`);
  }

  // ── 1) مفاتيح LiveKit محلياً ──
  const lkKeysOk =
    !!CONFIG.livekit.apiKey && !!CONFIG.livekit.apiSecret && !!CONFIG.livekit.wsUrl.startsWith('wss://');
  record(
    'مفاتيح LiveKit في .env (محلي)',
    true,
    lkKeysOk ? CONFIG.livekit.wsUrl : 'فارغة — اختبار السيرفر المنشور يكفي',
  );

  // ── 2) رفض بدون Auth ──
  try {
    const res = await fetch(callableUrl('generateLiveKitToken'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { roomName: 'test_unauth' } }),
    });
    const body = await res.json().catch(() => ({}));
    const rejected = !res.ok || !!body?.error;
    record(
      'generateLiveKitToken بدون Auth',
      rejected,
      rejected ? `${body?.error?.status || res.status} كما متوقع` : 'لم يُرفض!',
    );
  } catch (e) {
    record('generateLiveKitToken بدون Auth', false, e.message);
  }

  // ── 3) تسجيل دخول المستخدم A ──
  let userA;
  try {
    userA = await signIn(CONFIG.userA.email, CONFIG.userA.password);
    record('تسجيل دخول المستخدم A', true, `${userA.email} (${userA.uid.slice(0, 8)}…)`);
  } catch (e) {
    record('تسجيل دخول المستخدم A', false, e.message);
    if (!JSON_OUT) {
      console.log('\n💡 عيّن TEST_USER_EMAIL و TEST_USER_PASSWORD في functions/.env\n');
    }
    printSummary();
    process.exit(1);
  }

  // ── 4) توكن مكالمة ──
  const callChannel = `test_call_${Date.now()}`;
  let callToken;
  try {
    callToken = await callFunction(
      'generateLiveKitToken',
      { roomName: callChannel, canPublish: true, peerUid: 'test_peer_uid' },
      userA.idToken,
    );
    const hasToken = typeof callToken.token === 'string' && callToken.token.length > 20;
    const hasWs = typeof callToken.wsUrl === 'string' && callToken.wsUrl.startsWith('wss://');
    record(
      'generateLiveKitToken (مكالمة)',
      hasToken && hasWs,
      `room=${callToken.roomName} identity=${callToken.identity}`,
    );
    if (hasToken) {
      const payload = decodeJwtPayload(callToken.token);
      const grantOk = payload.video?.roomJoin === true && !!payload.sub;
      record('JWT LiveKit صالح', grantOk, `room=${payload.video?.room || '?'} exp=${new Date(payload.exp * 1000).toISOString()}`);
    }
    await testLiveKitConnect(callToken.wsUrl, callToken.token, 'مكالمة 1-to-1');
  } catch (e) {
    record('generateLiveKitToken (مكالمة)', false, e.message);
  }

  // ── 5) توكن غرفة صوتية ──
  const roomName = `room_test_${Date.now()}`;
  try {
    const roomToken = await callFunction(
      'generateLiveKitToken',
      { roomName, canPublish: false },
      userA.idToken,
    );
    record(
      'generateLiveKitToken (غرفة مستمع)',
      !!roomToken.token && roomToken.roomName === roomName,
      `canPublish=false`,
    );
    await testLiveKitConnect(roomToken.wsUrl, roomToken.token, 'غرفة مستمع');
  } catch (e) {
    record('generateLiveKitToken (غرفة مستمع)', false, e.message);
  }

  // ── 6) startCall + endCall ──
  const fakeCallee = 'test_callee_not_self_' + userA.uid.slice(0, 6);
  try {
    const start = await callFunction(
      'startCall',
      {
        calleeUid: fakeCallee,
        type: 'voice',
        channelName: callChannel,
        source: 'chat',
      },
      userA.idToken,
    );
    const sessionOk = typeof start.sessionId === 'string' && start.sessionId.length > 4;
    record('startCall', sessionOk, `sessionId=${start.sessionId} billed=${start.billed}`);

    const end = await callFunction(
      'endCall',
      { channelName: callChannel, durationSeconds: 5, sessionId: start.sessionId },
      userA.idToken,
    );
    record('endCall', end?.ended === true, 'duration=5s');
  } catch (e) {
    record('startCall / endCall', false, e.message);
  }

  // ── 7) مطابقة ──
  try {
    await callFunction('cancelMatch', { type: 'voice' }, userA.idToken);
  } catch {
    // ignore cleanup
  }

  let userB = null;
  const hasUserB = CONFIG.userB.email && CONFIG.userB.password;

  if (hasUserB) {
    try {
      userB = await signIn(CONFIG.userB.email, CONFIG.userB.password);
      record('تسجيل دخول المستخدم B', true, `${userB.email}`);
      await callFunction('cancelMatch', { type: 'voice' }, userB.idToken).catch(() => {});
    } catch (e) {
      record('تسجيل دخول المستخدم B', false, e.message);
    }
  }

  // A يدخل الانتظار
  let matchA;
  try {
    matchA = await callFunction('createMatch', { type: 'voice' }, userA.idToken);
    if (matchA.matched) {
      record('createMatch (A)', true, `مطابق فوراً channel=${matchA.channelName}`);
    } else if (matchA.waiting) {
      record('createMatch (A)', true, 'في قائمة الانتظار');
    } else {
      record('createMatch (A)', false, JSON.stringify(matchA));
    }
  } catch (e) {
    record('createMatch (A)', false, e.message);
  }

  // B يحاول المطابقة
  if (userB) {
    try {
      const matchB = await callFunction('createMatch', { type: 'voice' }, userB.idToken);
      const matched = matchB.matched === true && !!matchB.channelName && !!matchB.partnerUid;
      record(
        'createMatch (B → مطابقة)',
        matched,
        matched
          ? `channel=${matchB.channelName} partner=${matchB.partnerUid.slice(0, 8)}…`
          : JSON.stringify(matchB),
      );

      if (matched) {
        // كلا الطرفين يحصلان على توكن LiveKit لنفس القناة
        const [tokA, tokB] = await Promise.all([
          callFunction(
            'generateLiveKitToken',
            { roomName: matchB.channelName, canPublish: true, peerUid: matchB.partnerUid },
            userA.idToken,
          ),
          callFunction(
            'generateLiveKitToken',
            {
              roomName: matchB.channelName,
              canPublish: true,
              peerUid: matchB.partnerUid === userB.uid ? userA.uid : matchB.partnerUid,
            },
            userB.idToken,
          ),
        ]);
        const tokensOk = tokA.token && tokB.token && tokA.roomName === matchB.channelName;
        record('توكنات LiveKit للمطابقة', tokensOk, matchB.channelName);
        if (tokensOk) {
          await testLiveKitConnect(tokA.wsUrl, tokA.token, 'مطابقة — A');
          await testLiveKitConnect(tokB.wsUrl, tokB.token, 'مطابقة — B');
        }

        // startCall من الدافع (B غالباً إن كان غير مضيفة)
        try {
          const payerToken = userB.idToken;
          const calleeUid = matchB.partnerUid;
          const start = await callFunction(
            'startCall',
            {
              calleeUid,
              type: 'voice',
              channelName: matchB.channelName,
              source: 'match',
            },
            payerToken,
          );
          record('startCall (مطابقة)', !!start.sessionId, `session=${start.sessionId}`);
          await callFunction(
            'endCall',
            { channelName: matchB.channelName, durationSeconds: 3, sessionId: start.sessionId },
            payerToken,
          ).catch(() => {});
        } catch (e) {
          record('startCall (مطابقة)', false, e.message);
        }
      }
    } catch (e) {
      record('createMatch (B → مطابقة)', false, e.message);
    }
  } else {
    record(
      'مطابقة طرفين',
      true,
      'تخطّي — عيّن TEST_USER_B_EMAIL/PASSWORD لاختبار مطابقة كاملة',
    );
  }

  // تنظيف
  await callFunction('cancelMatch', { type: 'voice' }, userA.idToken).catch(() => {});
  if (userB) await callFunction('cancelMatch', { type: 'voice' }, userB.idToken).catch(() => {});

  printSummary();
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

function printSummary() {
  const failed = results.filter((r) => !r.ok);
  if (JSON_OUT) {
    console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
    return;
  }
  console.log('\n────────────────────────────────────');
  console.log(`النتيجة: ${failed.length === 0 ? '✅ كل الاختبارات نجحت' : `❌ ${failed.length} فشل`}`);
  if (failed.length) {
    console.log('\nفشل:');
    for (const f of failed) console.log(`  • ${f.name}: ${f.detail}`);
  }
  console.log('');
}

run().catch((e) => {
  console.error('خطأ غير متوقع:', e);
  process.exit(1);
});
