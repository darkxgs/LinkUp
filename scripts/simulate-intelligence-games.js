#!/usr/bin/env node
/**
 * محاكاة سيناريو ألعاب الذكاء داخل التطبيق (WebView <-> React Native).
 *
 * يحمّل الجسر الحقيقي (intel-app-bridge.js + games-config-utils.js) داخل بيئة
 * معزولة، ويشغّل طرف التطبيق وهمياً بنفس منطق app/games/webview.tsx، ثم يختبر
 * السيناريو كاملاً لكل لعبة تختارها:
 *   تهيئة → رهان صالح/غير صالح → فوز → خسارة → استرداد → حد يومي (نفس اللعبة + بين الألعاب).
 *
 * الاستخدام:
 *   node simulate-intelligence-games.js                 # قائمة تفاعلية للاختيار
 *   node simulate-intelligence-games.js all             # كل الألعاب
 *   node simulate-intelligence-games.js flag-guess      # لعبة واحدة
 *   node simulate-intelligence-games.js flag-guess memory-match
 */
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const readline = require('readline');

const GAMES_DIR = path.resolve(__dirname, '../hosting/public/games');

const CHIPS = [5000, 10000, 25000, 50000];
const WIN_MULTIPLIER = 5; // صافي الربح = الدخولية × 5، الإجمالي = الدخولية × 6

const GAMES = {
  'flag-guess': { title: 'خمّن المكان', policy: 'js/policyConfig.js' },
  'sequence-memory': { title: 'تذكّر التسلسل', policy: 'js/policyConfig.js' },
  'memory-match': { title: 'تطابق الأشكال', policy: 'js/policyConfig.js' },
};

const C = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

/**
 * يبني بيئة معزولة تحاكي WebView + طرف التطبيق، ويحمّل الجسر الحقيقي.
 * @returns {{ bridge: object, app: object, sendInitData: Function }}
 */
function createGameEnv(gameId) {
  const listeners = { message: [] };

  // طرف التطبيق الوهمي — مرآة لمنطق app/games/webview.tsx
  const app = {
    gameId,
    balance: 0,
    hasPlayedToday: false,
    placeBetCalls: 0,
    lastResult: null,
    lastError: null,
    intelligenceGame: true,
  };

  function toGame(obj) {
    sandbox.dispatchEvent(new sandbox.MessageEvent('message', { data: JSON.stringify(obj) }));
  }

  function sendInitData() {
    toGame({
      type: 'INIT_DATA',
      balance: app.balance,
      hasPlayedToday: app.hasPlayedToday,
      config: { id: gameId, minBet: 5000, maxBet: 50000, multipliers: [5], rtp: 90 },
      global: { intelligenceStakeChips: CHIPS, CANONICAL_INTELLIGENCE_CHIPS: CHIPS },
    });
  }

  // يستقبل الرسائل القادمة من اللعبة (مثل handleMessage في webview.tsx)
  function appReceive(raw) {
    let data;
    try { data = JSON.parse(raw); } catch (_) { return; }
    app.lastError = null;

    if (data.type === 'INIT_GAME') {
      sendInitData();
      return;
    }

    if (data.type === 'PLACE_BET') {
      app.placeBetCalls += 1;
      const stake = Number(data.stake);
      try {
        if (app.intelligenceGame && app.hasPlayedToday) {
          throw new Error('لقد لعبت ألعاب الذكاء اليوم (محاولة واحدة لجميع الألعاب). عد غداً!');
        }
        if (!Number.isFinite(stake) || stake <= 0) throw new Error('قيمة الدخولية غير صالحة');
        if (!CHIPS.includes(Math.floor(stake))) throw new Error('اختر إحدى فئات الدخولية المعتمدة');
        if (app.balance < stake) throw new Error('رصيدك لا يكفي لهذه الدخولية');
        app.balance -= stake;
        toGame({ type: 'BET_CONFIRMED', status: 'success' });
      } catch (e) {
        app.lastError = e.message;
        toGame({ type: 'ERROR', message: e.message });
      }
      return;
    }

    if (data.type === 'CANCEL_BET') {
      const stake = Number(data.stake) || 0;
      app.balance += stake;
      toGame({ type: 'BET_CANCELLED', status: 'success' });
      return;
    }

    if (data.type === 'GAME_RESULT') {
      const stake = Number(data.stake) || 0;
      const isWin = !!data.isWin;
      const winAmount = Number(data.winAmount) || 0;
      if (isWin && winAmount > 0) app.balance += winAmount; // recordIntelligenceWin
      app.hasPlayedToday = true; // محاولة يومية واحدة لكل ألعاب الذكاء
      app.lastResult = { isWin, stake, winAmount };
      toGame({ type: 'RESULT_RECORDED', status: 'success' });
      return;
    }
  }

  // عنصر DOM وهمي بسيط
  const fakeEl = new Proxy({ style: {}, classList: { add() {}, remove() {} } }, {
    get(t, k) { return k in t ? t[k] : () => {}; },
  });

  const sandbox = {
    console,
    ReactNativeWebView: { postMessage: (str) => appReceive(str) },
    alert: (msg) => { sandbox.__lastAlert = msg; },
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener: () => {},
    dispatchEvent: (evt) => { (listeners[evt.type] || []).forEach((fn) => fn(evt)); },
    onIntelBridgeReady: (state) => { sandbox.__ready = state; },
    document: {
      body: fakeEl,
      getElementById: () => null,
      createElement: () => fakeEl,
      querySelectorAll: () => [],
      addEventListener: () => {},
    },
    MessageEvent: class {
      constructor(type, init) { this.type = type; this.data = init && init.data; }
    },
    setTimeout, clearTimeout, setInterval, clearInterval,
    IntelI18n: {
      init() {}, applyDocument() {},
      t(k) {
        const map = {
          chooseBet: 'اختر إحدى فئات الدخولية المعتمدة',
          dailyLimitUsed: 'تجاوزت الحد اليومي',
          insufficientBalance: 'رصيدك غير كافٍ',
          syncBalance: 'تعذّرت مزامنة الرصيد',
        };
        return map[k] || k;
      },
    },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.global = sandbox;

  const ctx = vm.createContext(sandbox);

  const utilsSrc = fs.readFileSync(path.join(GAMES_DIR, 'games-config-utils.js'), 'utf8');
  const bridgeSrc = fs.readFileSync(path.join(GAMES_DIR, 'intel-app-bridge.js'), 'utf8');
  vm.runInContext(utilsSrc, ctx, { filename: 'games-config-utils.js' });
  vm.runInContext(bridgeSrc, ctx, { filename: 'intel-app-bridge.js' });

  return { sandbox, app, sendInitData, bridge: () => sandbox.IG.AppBridge };
}

let totalPass = 0;
let totalFail = 0;

function check(label, cond, extra) {
  if (cond) {
    totalPass += 1;
    console.log('  ' + C.green('✓') + ' ' + label + (extra ? C.dim(' — ' + extra) : ''));
  } else {
    totalFail += 1;
    console.log('  ' + C.red('✗') + ' ' + label + (extra ? C.red(' — ' + extra) : ''));
  }
}

async function expectReject(promise) {
  try {
    await promise;
    return null;
  } catch (e) {
    return e && e.message ? e.message : String(e);
  }
}

async function runScenario(gameId) {
  const meta = GAMES[gameId];
  console.log('\n' + C.bold(C.cyan(`════ ${meta.title} (${gameId}) ════`)));

  // 0) فحص ملفات اللعبة الثابتة
  const policyPath = path.join(GAMES_DIR, gameId, meta.policy);
  const indexPath = path.join(GAMES_DIR, gameId, 'index.html');
  const policy = fs.existsSync(policyPath) ? fs.readFileSync(policyPath, 'utf8') : '';
  const index = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
  check('ملف السياسة يحوي الفئات المعتمدة', /5000,\s*10000,\s*25000,\s*50000/.test(policy));
  check('ملف السياسة يحوي مضاعف 5×', /REWARD_MULTIPLIER\s*[:=]\s*5/.test(policy));
  check('index.html يحمّل الجسر intel-app-bridge', /intel-app-bridge\.js/.test(index));

  const env = createGameEnv(gameId);
  const bridge = env.bridge;

  // 1) التهيئة (INIT_GAME -> INIT_DATA)
  env.app.balance = 100000;
  env.app.hasPlayedToday = false;
  bridge().boot({ gameId, userId: 'sim-user' });
  // boot يرسل INIT_GAME، والتطبيق يرد INIT_DATA
  const st0 = bridge().getState();
  check('التهيئة: الجسر يعمل بوضع embedded', bridge().isEmbedded());
  check('التهيئة: الرصيد متزامن', st0.walletReady && st0.balance === 100000, 'balance=' + st0.balance);

  // 2) رهان غير صالح (فئة غير معتمدة)
  const errBad = await expectReject(bridge().placeBet(7000));
  check('رفض رهان بفئة غير معتمدة (7000)', !!errBad, errBad || 'لم يُرفض!');
  check('لم يُخصم شيء عند الرفض المحلي', env.app.balance === 100000 && env.app.placeBetCalls === 0);

  // 3) رهان صالح
  await bridge().placeBet(10000);
  check('قبول رهان صالح (10000)', env.app.balance === 90000 && bridge().getState().balance === 90000,
    'app=' + env.app.balance + ' bridge=' + bridge().getState().balance);

  // 4) فوز — الإجمالي = الدخولية × 6، الصافي = الدخولية × 5
  const win = bridge().reportGameResult({ isWin: true, stake: 10000, result: {} });
  const expectedWin = 10000 * (1 + WIN_MULTIPLIER);
  check('الفوز: مبلغ الجائزة = الدخولية × 6', win.winAmount === expectedWin, 'winAmount=' + win.winAmount);
  check('الفوز: صافي الربح = الدخولية × 5', win.netProfit === 10000 * WIN_MULTIPLIER, 'net=' + win.netProfit);
  check('الفوز: الرصيد بعد الجائزة (90000+60000)',
    env.app.balance === 150000 && bridge().getState().balance === 150000,
    'app=' + env.app.balance + ' bridge=' + bridge().getState().balance);
  check('الفوز: تسجّل المحاولة اليومية', env.app.hasPlayedToday === true);

  // 5) إعادة التهيئة لاختبار الخسارة
  env.app.balance = 100000;
  env.app.hasPlayedToday = false;
  env.sendInitData();
  await bridge().placeBet(5000);
  check('خسارة: خصم الدخولية (5000)', env.app.balance === 95000);
  bridge().reportGameResult({ isWin: false, stake: 5000, result: {} });
  check('خسارة: لا تُضاف جائزة', env.app.balance === 95000 && bridge().getState().balance === 95000,
    'app=' + env.app.balance);
  check('خسارة: تسجّل المحاولة اليومية', env.app.hasPlayedToday === true);

  // 6) الحد اليومي — نفس اللعبة بعد اللعب
  const errDaily = await expectReject(bridge().placeBet(5000));
  check('منع اللعب مرة ثانية في نفس اليوم', !!errDaily, errDaily || 'سُمح باللعب!');
  check('لم يتغيّر الرصيد بعد منع الحد اليومي', env.app.balance === 95000);

  // 7) الحد اليومي بين الألعاب (التطبيق يرفض رغم أن الجسر يظن أنه متاح)
  env.app.balance = 100000;
  env.app.hasPlayedToday = true; // لعبة ذكاء أخرى لُعبت اليوم
  env.sendInitData(); // الجسر يستلم hasPlayedToday=true أيضاً
  // نجبر حالة سباق: الجسر يظن أنه متاح لكن التطبيق يرفض
  bridge().getState().hasPlayedToday = false;
  const errCross = await expectReject(bridge().placeBet(10000));
  check('رفض التطبيق للحد اليومي المشترك بين الألعاب', !!errCross, errCross || 'لم يُرفض!');
  check('لا خصم عند رفض التطبيق', env.app.balance === 100000 && bridge().getState().balance === 100000,
    'app=' + env.app.balance + ' bridge=' + bridge().getState().balance);

  // 8) استرداد الدخولية (CANCEL_BET) عند فشل تحميل المحتوى
  env.app.balance = 100000;
  env.app.hasPlayedToday = false;
  env.sendInitData();
  await bridge().placeBet(25000);
  check('استرداد: الخصم قبل الإلغاء (25000)', env.app.balance === 75000);
  await bridge().cancelBet(25000);
  check('استرداد: إعادة الدخولية كاملة', env.app.balance === 100000 && bridge().getState().balance === 100000,
    'app=' + env.app.balance + ' bridge=' + bridge().getState().balance);

  // 9) رصيد غير كافٍ
  env.app.balance = 4000;
  env.app.hasPlayedToday = false;
  env.sendInitData();
  const errLow = await expectReject(bridge().placeBet(5000));
  check('رفض الرهان عند عدم كفاية الرصيد', !!errLow, errLow || 'سُمح بالرهان!');
  check('لا خصم عند عدم كفاية الرصيد', env.app.balance === 4000);
}

function chooseGamesInteractive() {
  return new Promise((resolve) => {
    const ids = Object.keys(GAMES);
    console.log(C.bold('\nاختر اللعبة لتشغيل السيناريو:'));
    ids.forEach((id, i) => console.log(`  ${C.cyan(String(i + 1))}) ${GAMES[id].title} ${C.dim('(' + id + ')')}`));
    console.log(`  ${C.cyan('0')}) ${C.bold('كل الألعاب')}`);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('\nرقمك (أو أرقام مفصولة بمسافة): ', (ans) => {
      rl.close();
      const tokens = ans.trim().split(/\s+/).filter(Boolean);
      if (!tokens.length || tokens.includes('0')) return resolve(ids);
      const picked = tokens
        .map((t) => ids[parseInt(t, 10) - 1])
        .filter(Boolean);
      resolve(picked.length ? picked : ids);
    });
  });
}

async function main() {
  const args = process.argv.slice(2).filter(Boolean);
  let selected;

  if (args.length) {
    if (args.includes('all')) selected = Object.keys(GAMES);
    else selected = args.filter((a) => GAMES[a]);
    const unknown = args.filter((a) => a !== 'all' && !GAMES[a]);
    if (unknown.length) {
      console.log(C.red('ألعاب غير معروفة: ' + unknown.join(', ')));
      console.log('المتاح: ' + Object.keys(GAMES).join(', ') + ', all');
    }
  } else if (process.stdin.isTTY) {
    selected = await chooseGamesInteractive();
  } else {
    selected = Object.keys(GAMES);
  }

  if (!selected || !selected.length) {
    console.log(C.red('لم تُختر أي لعبة.'));
    process.exit(1);
  }

  console.log(C.bold('\n==========================================='));
  console.log(C.bold('  محاكاة سيناريو ألعاب الذكاء — LinkUp'));
  console.log(C.bold('==========================================='));
  console.log(C.dim('الألعاب: ' + selected.join('، ')));

  for (const id of selected) {
    await runScenario(id);
  }

  console.log('\n' + C.bold('═══════════ النتيجة ═══════════'));
  console.log(`  نجح: ${C.green(totalPass)} | فشل: ${totalFail ? C.red(totalFail) : C.green(0)}`);
  if (totalFail > 0) {
    console.log(C.red('\nفشل بعض فحوصات السيناريو — راجع أعلاه.'));
    process.exit(1);
  }
  console.log(C.green('\nنجح سيناريو كل الألعاب المختارة ✓'));
}

main().catch((e) => {
  console.error(C.red('خطأ غير متوقع:'), e);
  process.exit(1);
});
