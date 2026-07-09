#!/usr/bin/env node
/**
 * فحص ألعاب الروم — health + hosting + WebSocket (محاكاة لاعبين)
 *
 * الاستخدام:
 *   node scripts/smoke-test.mjs
 *   ROOM_GAMES_BASE=https://... HOSTING_BASE=https://... node scripts/smoke-test.mjs
 */
import WebSocket from 'ws';

const ROOM_GAMES_BASE =
  process.env.ROOM_GAMES_BASE ||
  'https://linkup-room-games-521319798732.us-central1.run.app';

const HOSTING_BASE =
  process.env.HOSTING_BASE || 'https://linkup-dc45f.web.app/games/room-free';

const WS_BASE = ROOM_GAMES_BASE.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');

const TIMEOUT_MS = 12_000;

const results = [];

function log(msg) {
  console.log(msg);
}

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

function wsUrl(path) {
  return `${WS_BASE.replace(/\/$/, '')}${path}`;
}

function httpUrl(path) {
  return `${ROOM_GAMES_BASE.replace(/\/$/, '')}${path}`;
}

function hostingUrl(slug) {
  return `${HOSTING_BASE.replace(/\/$/, '')}/${slug}/`;
}

async function fetchOk(url, label) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) {
      fail(label, `HTTP ${res.status}`);
      return false;
    }
    pass(label, `${res.status}`);
    return true;
  } catch (e) {
    fail(label, e.message);
    return false;
  }
}

function openWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error(`timeout connecting ${url}`));
    }, TIMEOUT_MS);
    ws.once('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function waitWs(ws, predicate, label = 'message') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMsg);
      reject(new Error(`timeout waiting ${label}`));
    }, TIMEOUT_MS);

    function onMsg(raw) {
      let data;
      try {
        data = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (predicate(data)) {
        clearTimeout(timer);
        ws.off('message', onMsg);
        resolve(data);
      }
    }
    ws.on('message', onMsg);
  });
}

function sendJson(ws, obj) {
  ws.send(JSON.stringify(obj));
}

function closeWs(ws) {
  try {
    if (ws.readyState === WebSocket.OPEN) ws.close();
  } catch {
    /* ignore */
  }
}

async function primeServer() {
  try {
    const res = await fetch(httpUrl('/health'));
    const body = await res.json();
    if (body?.ok) {
      pass('Cloud Run /health', JSON.stringify(body));
      return true;
    }
    fail('Cloud Run /health', `unexpected: ${JSON.stringify(body)}`);
    return false;
  } catch (e) {
    fail('Cloud Run /health', e.message);
    return false;
  }
}

async function testHostingPages() {
  log('\n📦 Hosting (واجهات WebView)');
  const slugs = [
    ['ludo', 'لودو'],
    ['uno', 'أونو'],
    ['mask-chat', 'ماسك شات'],
    ['monster-crush', 'مونستر كراش'],
    ['jackaroo', 'جاكارو'],
    ['carrom', 'كيرم'],
    ['domino', 'دومينو'],
    ['xo', 'XO'],
  ];

  for (const [slug, label] of slugs) {
    await fetchOk(hostingUrl(slug), `صفحة ${label} (${slug})`);
  }
  await fetchOk(`${HOSTING_BASE.replace(/\/$/, '')}/shared/linkup-room-boot.js`, 'linkup-room-boot.js');
}

async function testLudoMultiplayer() {
  log('\n🎲 Ludo — لاعبان');
  let p1;
  let p2;
  try {
    await fetch(httpUrl('/health'));
    p1 = await openWs(wsUrl('/ws/ludo'));
    sendJson(p1, { type: 'create_room', payload: { playerName: 'Player1' } });
    const created = await waitWs(p1, (m) => m.type === 'room_created', 'room_created');
    const roomCode = created.payload?.roomCode;
    if (!roomCode) throw new Error('no roomCode');

    p2 = await openWs(wsUrl('/ws/ludo'));
    const joinedPromise = waitWs(p1, (m) => m.type === 'player_joined', 'player_joined');
    sendJson(p2, { type: 'join_room', payload: { playerName: 'Player2', roomCode } });
    const joined = await waitWs(p2, (m) => m.type === 'room_joined', 'room_joined');
    await joinedPromise.catch(() => null);

    const players = joined.payload?.players ?? [];
    if (players.length < 2) throw new Error(`expected 2 players, got ${players.length}`);

    sendJson(p1, { type: 'roll_dice' });
    await waitWs(p1, (m) => m.type === 'dice_rolled', 'dice_rolled');

    pass('Ludo — إنشاء غرفة + انضمام لاعب ثانٍ', `room=${roomCode}`);
    pass('Ludo — رمي النرد', `players=${players.length}`);
  } catch (e) {
    fail('Ludo multiplayer', e.message);
  } finally {
    closeWs(p1);
    closeWs(p2);
  }
}

async function testUnoMultiplayer() {
  log('\n🟥 UNO — لاعبان');
  let p1;
  let p2;
  try {
    await fetch(httpUrl('/health'));
    p1 = await openWs(wsUrl('/ws/uno'));
    sendJson(p1, { action: 'join', name: 'UnoP1' });
    const p1Players = await waitWs(p1, (m) => m.action === 'players', 'players p1');
    const lobbyId = p1Players.lobbyId;
    if (!lobbyId) throw new Error('no lobbyId');

    p2 = await openWs(wsUrl('/ws/uno'));
    sendJson(p2, { action: 'join', name: 'UnoP2', lobbyId });
    await waitWs(p2, (m) => m.action === 'players' && (m.players?.length ?? 0) >= 2, 'players p2');

    sendJson(p1, { action: 'ready' });
    sendJson(p2, { action: 'ready' });

    const startMsg = await Promise.race([
      waitWs(p1, (m) => m.action === 'start', 'start p1'),
      waitWs(p2, (m) => m.action === 'start', 'start p2'),
    ]);

    if (!startMsg?.hand && !startMsg?.players) {
      pass('UNO — بدء اللعبة', `lobby=${lobbyId}`);
    } else {
      pass('UNO — بدء اللعبة', `lobby=${lobbyId}, cards dealt`);
    }
    pass('UNO — لوبي + جاهزية لاعبين', '2 players ready');
  } catch (e) {
    fail('UNO multiplayer', e.message);
  } finally {
    closeWs(p1);
    closeWs(p2);
  }
}

async function testMaskChatMultiplayer() {
  log('\n🎭 Mask Chat — لاعبان');
  let p1;
  let p2;
  const code = `T${Date.now().toString(36).toUpperCase().slice(-5)}`;
  try {
    await fetch(httpUrl('/health'));
    p1 = await openWs(wsUrl('/ws/mask-chat'));
    sendJson(p1, {
      type: 'join',
      payload: { code, playerId: 'mask_p1', realName: 'Ali', uid: 'u1' },
    });
    const j1 = await waitWs(p1, (m) => m.type === 'joined', 'joined p1');
    if (!j1.payload?.state) throw new Error('no state on join');

    p2 = await openWs(wsUrl('/ws/mask-chat'));
    sendJson(p2, {
      type: 'join',
      payload: { code, playerId: 'mask_p2', realName: 'Sara', uid: 'u2' },
    });
    await waitWs(p2, (m) => m.type === 'joined', 'joined p2');

    const msgPromise = waitWs(p1, (m) => m.type === 'message', 'chat message');
    sendJson(p2, { type: 'chat', payload: { text: 'مرحبا من اللاعب 2' } });
    const chatMsg = await msgPromise;
    if (!chatMsg.payload?.text) throw new Error('empty chat');

    const count = j1.payload?.state?.players?.length ?? 0;
    pass('Mask Chat — انضمام لاعبين', `code=${code}`);
    pass('Mask Chat — رسالة بين اللاعبين', chatMsg.payload.text.slice(0, 30));
  } catch (e) {
    fail('Mask Chat multiplayer', e.message);
  } finally {
    closeWs(p1);
    closeWs(p2);
  }
}

async function testDominoMultiplayer() {
  log('\n⚫ Domino — لاعبان');
  let p1;
  let p2;
  try {
    await fetch(httpUrl('/health'));
    p1 = await openWs(wsUrl('/ws/domino'));
    sendJson(p1, { action: 'join', name: 'DomP1' });
    const s1 = await waitWs(p1, (m) => m.action === 'state' && m.lobbyId, 'state p1');
    const lobbyId = s1.lobbyId;
    if (!lobbyId) throw new Error('no lobbyId');

    p2 = await openWs(wsUrl('/ws/domino'));
    sendJson(p2, { action: 'join', name: 'DomP2', lobbyId });
    await waitWs(p2, (m) => m.action === 'state' && (m.players?.length ?? 0) >= 2, 'state p2');

    sendJson(p1, { action: 'ready' });
    sendJson(p2, { action: 'ready' });

    const started = await waitWs(
      p1,
      (m) => m.action === 'state' && m.started === true,
      'game started',
    );
    if (!started.myHand?.length) throw new Error('no hand dealt');

    pass('Domino — لوبي + بدء اللعبة', `lobby=${lobbyId}, hand=${started.myHand.length}`);
  } catch (e) {
    fail('Domino multiplayer', e.message);
  } finally {
    closeWs(p1);
    closeWs(p2);
  }
}

async function testCarromMultiplayer() {
  log('\n🎯 Carrom — لاعبان');
  let p1;
  let p2;
  const code = `C${Date.now().toString(36).toUpperCase().slice(-5)}`;
  try {
    await fetch(httpUrl('/health'));
    p1 = await openWs(wsUrl('/ws/carrom'));
    sendJson(p1, { type: 'join', payload: { code, name: 'CarP1' } });
    const j1 = await waitWs(p1, (m) => m.type === 'joined', 'joined p1');

    p2 = await openWs(wsUrl('/ws/carrom'));
    sendJson(p2, { type: 'join', payload: { code, name: 'CarP2' } });
    await waitWs(p2, (m) => m.type === 'joined', 'joined p2');

    sendJson(p1, { type: 'ready' });
    sendJson(p2, { type: 'ready' });

    const started = await waitWs(
      p1,
      (m) => m.type === 'state' && m.payload?.started === true,
      'game started',
    );
    if (!started.payload?.coins?.length) throw new Error('no coins');

    pass('Carrom — انضمام + بدء', `code=${code}`);
  } catch (e) {
    fail('Carrom multiplayer', e.message);
  } finally {
    closeWs(p1);
    closeWs(p2);
  }
}

async function testJackarooMultiplayer() {
  log('\n🃏 Jackaroo — لاعبان');
  let p1;
  let p2;
  const code = `J${Date.now().toString(36).toUpperCase().slice(-5)}`;
  try {
    await fetch(httpUrl('/health'));
    p1 = await openWs(wsUrl('/ws/jackaroo'));
    sendJson(p1, { type: 'join', payload: { code, name: 'JacP1' } });
    await waitWs(p1, (m) => m.type === 'joined', 'joined p1');

    p2 = await openWs(wsUrl('/ws/jackaroo'));
    sendJson(p2, { type: 'join', payload: { code, name: 'JacP2' } });
    await waitWs(p2, (m) => m.type === 'joined', 'joined p2');

    sendJson(p1, { type: 'ready' });
    sendJson(p2, { type: 'ready' });

    const started = await waitWs(
      p1,
      (m) => m.type === 'state' && m.payload?.started === true,
      'game started',
    );
    if (!started.payload?.myHand?.length) throw new Error('no hand dealt');

    pass('Jackaroo — انضمام + بدء', `code=${code}, hand=${started.payload.myHand.length}`);
  } catch (e) {
    fail('Jackaroo multiplayer', e.message);
  } finally {
    closeWs(p1);
    closeWs(p2);
  }
}

async function testXoMultiplayer() {
  log('\n❌ XO — لاعبان');
  let p1;
  let p2;
  const code = `X${Date.now().toString(36).toUpperCase().slice(-5)}`;
  try {
    await fetch(httpUrl('/health'));
    p1 = await openWs(wsUrl('/ws/xo'));
    sendJson(p1, { type: 'join', payload: { code, name: 'XoP1' } });
    await waitWs(p1, (m) => m.type === 'joined', 'joined p1');

    p2 = await openWs(wsUrl('/ws/xo'));
    sendJson(p2, { type: 'join', payload: { code, name: 'XoP2' } });
    await waitWs(p2, (m) => m.type === 'joined', 'joined p2');

    sendJson(p1, { type: 'ready' });
    sendJson(p2, { type: 'ready' });

    const started = await waitWs(
      p1,
      (m) => m.type === 'state' && m.payload?.started === true,
      'game started',
    );
    if (!started.payload?.board) throw new Error('no board');

    sendJson(p1, { type: 'move', payload: { cell: 0 } });
    await waitWs(p2, (m) => m.type === 'state' && m.payload?.board?.[0] === 'X', 'move applied');

    pass('XO — انضمام + حركة', `code=${code}`);
  } catch (e) {
    fail('XO multiplayer', e.message);
  } finally {
    closeWs(p1);
    closeWs(p2);
  }
}

async function testWsPaths() {
  log('\n🔌 WebSocket — اتصال أولي');
  for (const path of [
    '/ws/ludo',
    '/ws/uno',
    '/ws/mask-chat',
    '/ws/domino',
    '/ws/carrom',
    '/ws/jackaroo',
    '/ws/xo',
  ]) {
    try {
      await fetch(httpUrl('/health'));
      const ws = await openWs(wsUrl(path));
      pass(`WS connect ${path}`);
      closeWs(ws);
    } catch (e) {
      fail(`WS connect ${path}`, e.message);
    }
  }
}

async function main() {
  log('═══════════════════════════════════════════');
  log('  LinkUp — فحص ألعاب الروم (smoke test)');
  log(`  Server: ${ROOM_GAMES_BASE}`);
  log(`  Hosting: ${HOSTING_BASE}`);
  log('═══════════════════════════════════════════');

  log('\n🏥 Cloud Run');
  const healthy = await primeServer();
  if (!healthy) {
    log('\n⚠️  السيرفر غير متاح — تخطي اختبارات WebSocket');
  } else {
    await testWsPaths();
    await testLudoMultiplayer();
    await testUnoMultiplayer();
    await testMaskChatMultiplayer();
    await testDominoMultiplayer();
    await testCarromMultiplayer();
    await testJackarooMultiplayer();
    await testXoMultiplayer();
  }

  await testHostingPages();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  log('\n═══════════════════════════════════════════');
  log(`  النتيجة: ${passed} نجح | ${failed} فشل`);
  if (failed > 0) {
    log('\n  الفاشلة:');
    results.filter((r) => !r.ok).forEach((r) => log(`    • ${r.name}: ${r.detail}`));
    process.exit(1);
  }
  log('  ✅ كل الفحوصات نجحت');
  log('═══════════════════════════════════════════\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
