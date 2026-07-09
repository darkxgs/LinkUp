#!/usr/bin/env node
/**
 * فحص ألعاب الكازينو (WebView) — كما تظهر في التطبيق
 *
 * يتحقق من:
 * - HTTP للصفحة + embed=1 (كما WebView)
 * - تحميل JS/CSS المشار إليها في HTML
 * - وجود جسر المحفظة (LinkUpGameBoot / useLinkUpWallet / INIT_GAME)
 * - تطابق gameId في التطبيق مع الرابط
 *
 * الاستخدام:
 *   node scripts/casino-webview-smoke.mjs
 *   HOSTING_BASE=https://linkup-dc45f.web.app node scripts/casino-webview-smoke.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOSTING = (process.env.HOSTING_BASE || 'https://linkup-dc45f.web.app').replace(/\/$/, '');
const CASINO = `${HOSTING}/games/casino`;
const GAMES = `${HOSTING}/games`;
const TIMEOUT_MS = 20_000;

/** ألعاب WebView من casinoGames.ts (kind !== native) */
const CASINO_WEBVIEW_GAMES = [
  { id: 'plinko', name: 'بلينكو', url: `${CASINO}/plinko`, react: true },
  { id: 'crash-rocket', name: 'الصاروخ', url: `${CASINO}/crash`, react: true },
  { id: 'dino', name: 'دينو رن', url: `${CASINO}/dino`, react: true },
  { id: 'spin-win', name: 'Spin & Win', url: `${CASINO}/spin-win`, react: true },
  { id: 'mines', name: 'الألغام', url: `${CASINO}/mines`, react: true },
  { id: 'lucky-777', name: 'لاكي 777', url: `${GAMES}/slot/`, react: false },
  { id: 'wheel', name: 'عجلة الحظ', url: `${GAMES}/wheel/`, react: false },
  { id: 'dice', name: 'النرد', url: `${GAMES}/dice/`, react: false },
  { id: 'coin-flip', name: 'العملة', url: `${GAMES}/coin/`, react: false },
];

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

function warn(name, detail = '') {
  results.push({ name, ok: true, detail: `WARN: ${detail}`, warn: true });
  log(`  ⚠️  ${name} — ${detail}`);
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'LinkUpCasinoSmoke/1.0' },
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, url: res.url, text, headers: res.headers };
  } finally {
    clearTimeout(timer);
  }
}

function extractAssets(html, pageUrl) {
  const assets = [];
  const srcRe = /<(?:script|link)[^>]+(?:src|href)=["']([^"']+)["']/gi;
  let m;
  while ((m = srcRe.exec(html))) {
    const href = m[1];
    if (href.startsWith('data:') || href.startsWith('http')) {
      assets.push(href);
    } else {
      assets.push(new URL(href, pageUrl).href);
    }
  }
  return [...new Set(assets)];
}

function checkClassicBridge(html, gameId) {
  const hasWindow = /window\.addEventListener\s*\(\s*['"]message['"]/.test(html);
  const hasDocument = /document\.addEventListener\s*\(\s*['"]message['"]/.test(html);
  const hasInitGame = /INIT_GAME/.test(html);
  const hasPlaceBet = /PLACE_BET/.test(html);

  if (!hasInitGame) {
    return { ok: false, detail: 'لا يرسل INIT_GAME للتطبيق' };
  }
  if (hasWindow && !hasDocument) {
    return {
      ok: false,
      detail: 'Android WebView: يستمع window.message فقط — INIT_DATA من التطبيق لا يصل!',
      critical: true,
    };
  }
  if (!hasPlaceBet) {
    return { ok: true, detail: 'جسر جزئي (INIT_GAME)', warn: true };
  }
  return { ok: true, detail: hasDocument ? 'window + document message ✓' : 'initGameBridge' };
}

function checkBridgeSignals(html, react) {
  if (!react) {
    return checkClassicBridge(html);
  }
  const signals = {
    reactBundle: /\/games\/casino\/assets\/index-/.test(html),
    rootDiv: /<div id="root"/i.test(html),
  };
  return {
    ok: signals.reactBundle && signals.rootDiv,
    detail: signals.reactBundle
      ? 'React SPA + useLinkUpWallet (window+document)'
      : 'لا يوجد bundle React في index.html',
  };
}

async function testGame(game) {
  log(`\n🎰 ${game.name} (${game.id})`);
  const pageUrl = `${game.url}${game.url.includes('?') ? '&' : '?'}embed=1`;

  let page;
  try {
    page = await fetchText(pageUrl);
  } catch (e) {
    fail(`${game.id} — صفحة`, e.message);
    return;
  }

  if (!page.ok) {
    fail(`${game.id} — صفحة`, `HTTP ${page.status} → ${pageUrl}`);
    return;
  }
  pass(`${game.id} — صفحة`, `HTTP ${page.status}`);

  if (page.text.length < 200) {
    fail(`${game.id} — محتوى`, 'HTML فارغ أو قصير جداً');
    return;
  }

  const bridge = checkBridgeSignals(page.text, game.react);
  if (bridge.ok && !bridge.warn) pass(`${game.id} — جسر`, bridge.detail);
  else if (bridge.ok && bridge.warn) warn(`${game.id} — جسر`, bridge.detail);
  else fail(`${game.id} — جسر`, bridge.detail);

  const assets = extractAssets(page.text, page.url).filter(
    (u) => /\.(js|css|mjs)(\?|$)/i.test(u) || u.includes('/assets/'),
  );

  if (!assets.length) {
    warn(`${game.id} — أصول`, 'لم تُستخرج ملفات JS/CSS من HTML');
    return;
  }

  let assetFails = 0;
  for (const assetUrl of assets.slice(0, 12)) {
    try {
      const res = await fetch(assetUrl, {
        redirect: 'follow',
        headers: { 'User-Agent': 'LinkUpCasinoSmoke/1.0' },
      });
      if (!res.ok) {
        assetFails += 1;
        fail(`${game.id} — أصل`, `${res.status} ${assetUrl.split('/').slice(-2).join('/')}`);
      }
    } catch (e) {
      assetFails += 1;
      fail(`${game.id} — أصل`, `${e.message} ${assetUrl.split('/').slice(-2).join('/')}`);
    }
  }

  if (assetFails === 0) {
    pass(`${game.id} — أصول`, `${Math.min(assets.length, 12)} ملف OK`);
  }

  if (game.react) {
    const hasMain = assets.some((u) => /\/assets\/index-/.test(u));
    if (!hasMain) fail(`${game.id} — bundle`, 'index-*.js مفقود');
    else pass(`${game.id} — bundle`, 'index-*.js موجود');

    if (game.id === 'dino') {
      const dinoAtlas = `${CASINO}/dino-assets/sprites/dino-atlas.json`;
      try {
        const r = await fetch(dinoAtlas);
        if (r.ok) pass(`${game.id} — dino-atlas`, 'OK');
        else fail(`${game.id} — dino-atlas`, `HTTP ${r.status}`);
      } catch (e) {
        fail(`${game.id} — dino-atlas`, e.message);
      }
    }
  }
}

function checkAppRoutes() {
  log('\n📱 مسارات التطبيق (casinoGames.ts)');
  const casinoTs = path.join(
    __dirname,
    '../../sada-app 14/src/constants/casinoGames.ts',
  );
  if (!fs.existsSync(casinoTs)) {
    warn('casinoGames.ts', 'ملف التطبيق غير موجود محلياً');
    return;
  }
  const src = fs.readFileSync(casinoTs, 'utf8');
  for (const g of CASINO_WEBVIEW_GAMES) {
    if (!src.includes(`id: '${g.id}'`) && !src.includes(`id: "${g.id}"`)) {
      warn(`route ${g.id}`, 'غير موجود في casinoGames.ts');
      continue;
    }
    const routeRe = new RegExp(
      "id:\\s*['\"]" + g.id.replace(/-/g, '\\-') + "['\"][\\s\\S]*?route:\\s*[`'\"]([^`'\"]+)",
    );
    const routeMatch = src.match(routeRe);
    if (!routeMatch) {
      warn(`route ${g.id}`, 'تعذّر استخراج route');
      continue;
    }
    const route = routeMatch[1];
    const urlMatch = route.match(/url=([^&]+)/);
    if (!urlMatch) {
      if (route.startsWith('/games/') && !route.includes('webview')) {
        pass(`route ${g.id}`, `native: ${route}`);
      } else {
        fail(`route ${g.id}`, `route غير صالح: ${route}`);
      }
      continue;
    }
    let encoded = urlMatch[1];
    // resolve template vars for static analysis
    encoded = encoded
      .replace(/\$\{CASINO_HOST\}/g, CASINO)
      .replace(/\$\{HOST\}/g, GAMES);
    const actualBase = decodeURIComponent(encoded).replace(/\/$/, '');
    const expectedBase = g.url.replace(/\/$/, '');
    if (actualBase === expectedBase) {
      pass(`route ${g.id}`, actualBase);
    } else {
      fail(`route ${g.id}`, `متوقع ${expectedBase} — فعلي ${actualBase}`);
    }
    if (!route.includes('encodeURIComponent')) {
      warn(`route ${g.id}`, 'الرابط غير مُرمّز بـ encodeURIComponent — قد ينكسر على بعض الأجهزة');
    }
  }
}

function checkWebViewBridgeCode() {
  log('\n🔗 جسر WebView في التطبيق (webview.tsx)');
  const webviewTs = path.join(__dirname, '../../sada-app 14/app/games/webview.tsx');
  if (!fs.existsSync(webviewTs)) {
    warn('webview.tsx', 'غير موجود');
    return;
  }
  const src = fs.readFileSync(webviewTs, 'utf8');
  for (const g of CASINO_WEBVIEW_GAMES) {
    const pattern =
      g.id === 'lucky-777'
        ? /slot|lucky-777/
        : g.id === 'crash-rocket'
          ? /crash/
          : g.id === 'coin-flip'
            ? /coin/
            : new RegExp(g.id.replace('-', '[-/]'));
    if (src.match(new RegExp(`return\\s+['"]${g.id}['"]`)) || src.match(pattern)) {
      pass(`gameId ${g.id}`, 'معرّف في getGameId()');
    } else {
      fail(`gameId ${g.id}`, 'غير معرّف في getGameId() — الرهان/الفوز لن يُسجّل');
    }
  }

  if (/isCasinoReact/.test(src) && /sendInitDataToWebView/.test(src)) {
    pass('casino INIT', 'isCasinoReact يرسل INIT_DATA عند التحميل');
  } else {
    fail('casino INIT', 'لا يُرسل INIT_DATA لألعاب React');
  }
}

async function main() {
  log('═══════════════════════════════════════════');
  log('  LinkUp — فحص ألعاب الكازينو (WebView)');
  log(`  HOST: ${HOSTING}`);
  log('═══════════════════════════════════════════');

  checkAppRoutes();
  checkWebViewBridgeCode();

  log('\n🌐 فحص الاستضافة (Firebase Hosting)');
  for (const game of CASINO_WEBVIEW_GAMES) {
    await testGame(game);
  }

  const failed = results.filter((r) => !r.ok);
  const warned = results.filter((r) => r.warn);

  log('\n═══════════════════════════════════════════');
  log(`  النتيجة: ${results.length - failed.length}/${results.length} نجح`);
  if (warned.length) log(`  تحذيرات: ${warned.length}`);
  if (failed.length) {
    log(`  فشل: ${failed.length}`);
    log('═══════════════════════════════════════════');
    log('\n🔍 أسباب شائعة:');
    log('  1. casino-games لم تُبنَ/تُنشر → npm run build في casino-games ثم firebase deploy');
    log('  2. rewrite /games/casino/** → index.html مفقود في firebase.json');
    log('  3. ألعاب HTML القديمة بدون LinkUpGameBoot → لا تعمل داخل WebView');
    log('  4. gameId غير معرّف في webview.tsx → الرهان يفشل صامتاً');
    log('  5. المستخدم غير مسجّل → INIT_DATA يرسل ERROR');
    process.exitCode = 1;
  } else {
    log('═══════════════════════════════════════════');
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
