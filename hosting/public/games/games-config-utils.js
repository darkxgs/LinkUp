/**
 * أدوات مشتركة لربط ألعاب WebView بإعدادات لوحة التحكم (config/games).
 * كل الأسعار والشرائح والمؤقتات تأتي من Firestore عبر INIT_DATA.global
 */
(function (global) {
  var INTELLIGENCE_WIN_MULTIPLIER = 20;

  var DEFAULT_GLOBAL = {
    challengeWinnerPercent: 80,
    challengeAppPercent: 20,
    lotteryTicketPrice: 200000,
    lotteryGrandPrize: 10000000,
    casinoToCoinsRate: 10000,
    COINS_PER_CASINO_COIN: 10000,
    coinsPerDollar: 10000,
    intelligenceStakeChips: [5000, 10000, 25000, 50000],
    /** الشرائح المعتمدة لألعاب الذكاء — تُستخدم إذا Firestore ناقص */
    CANONICAL_INTELLIGENCE_CHIPS: [5000, 10000, 25000, 50000],
    challengeStakeChips: [5000, 10000, 25000, 50000],
    demoBalance: 50000,
    billiardsTurnMs: 420000,
    penaltyRounds: 5,
    penaltyTurnSeconds: 10,
    coinChallengeRounds: 3,
    coinChallengeTurnSeconds: 10,
    sequenceMemoryMemorizeSeconds: 5,
    sequenceMemoryReconstructSeconds: 15,
    /** مؤقّت سؤال ألعاب الذكاء (خمّن العلم) بالثواني — من لوحة التحكم */
    intelligenceQuestionSeconds: 10,
  };

  var gamesGlobal = null;
  var demoBalance = DEFAULT_GLOBAL.demoBalance;
  var standaloneDemo = false;
  var demoBooted = false;

  var DEMO_CONFIG = {
    minBet: 100,
    maxBet: 100000,
    multipliers: [20],
    rtp: 95,
    id: 'demo',
    name: 'تجريبي',
  };

  function mergeGlobal(data) {
    if (!data) return Object.assign({}, DEFAULT_GLOBAL);
    var merged = Object.assign({}, DEFAULT_GLOBAL, data);
    if (!merged.intelligenceStakeChips || !merged.intelligenceStakeChips.length) {
      merged.intelligenceStakeChips = canonicalIntelligenceChips();
    }
    return merged;
  }

  function resolveWinMultiplier(config, defaults) {
    var multipliers = config && Array.isArray(config.multipliers) ? config.multipliers : [];
    if (multipliers.length && Number(multipliers[0]) > 0) {
      return Number(multipliers[0]);
    }
    if (defaults && Number(defaults.winMultiplier) > 0) {
      return Number(defaults.winMultiplier);
    }
    return INTELLIGENCE_WIN_MULTIPLIER;
  }

  function syncIntelligencePolicyMultiplier(mult) {
    var m = Math.max(1, Number(mult) || INTELLIGENCE_WIN_MULTIPLIER);
    if (global.IG && global.IG.policyConfig) {
      global.IG.policyConfig.REWARD_MULTIPLIER = m;
    }
    if (global.policyConfig) {
      global.policyConfig.REWARD_MULTIPLIER = m;
    }
    return m;
  }

  /** مؤقّت السؤال (ثواني) لألعاب الذكاء — يُطبَّق حياً على اللعبة الجارية أيضاً */
  function syncIntelligenceQuestionSeconds(seconds) {
    var s = Math.min(120, Math.max(3, Math.floor(Number(seconds)) || 10));
    if (global.IG && global.IG.policyConfig) {
      global.IG.policyConfig.CHALLENGE_SECONDS = s;
    }
    if (global.policyConfig) {
      global.policyConfig.CHALLENGE_SECONDS = s;
    }
    // اللعبة قد تكون هيّأت حالتها قبل وصول INIT_DATA — حدّث الحالة الحية
    if (global.Game && global.Game.state && typeof global.Game.state.challengeSeconds === 'number') {
      global.Game.state.challengeSeconds = s;
    }
    return s;
  }

  function syncSequenceMemoryTiming(memorizeSeconds, reconstructSeconds) {
    var mem = Math.min(60, Math.max(3, Number(memorizeSeconds) || 5));
    var rec = Math.min(180, Math.max(5, Number(reconstructSeconds) || 15));
    if (global.policyConfig) {
      global.policyConfig.DISPLAY_SECONDS = mem;
      global.policyConfig.RECONSTRUCT_SECONDS = rec;
    }
    return { memorizeSeconds: mem, reconstructSeconds: rec };
  }

  var DEFAULT_TIMING_BY_STAKE = {
    5000: { memorize: 5, reconstruct: 15 },
    10000: { memorize: 6, reconstruct: 18 },
    25000: { memorize: 8, reconstruct: 20 },
    50000: { memorize: 10, reconstruct: 25 },
  };

  function buildSequenceTimingMap(timingArray, globalData) {
    var map = {};
    if (timingArray && timingArray.length) {
      timingArray.forEach(function (t) {
        var key = String(Math.floor(Number(t.stake)));
        if (!key || key === '0' || key === 'NaN') return;
        map[key] = {
          memorize: Math.min(60, Math.max(3, Number(t.memorizeSeconds) || 5)),
          reconstruct: Math.min(180, Math.max(5, Number(t.reconstructSeconds) || 15)),
        };
      });
      if (Object.keys(map).length) return map;
    }
    var g = globalData || getGlobal();
    var fallbackMem = Number(g.sequenceMemoryMemorizeSeconds) || 5;
    var fallbackRec = Number(g.sequenceMemoryReconstructSeconds) || 15;
    var chips = g.intelligenceStakeChips || DEFAULT_GLOBAL.intelligenceStakeChips;
    chips.forEach(function (stake) {
      var key = String(Math.floor(Number(stake)));
      var preset = DEFAULT_TIMING_BY_STAKE[stake];
      map[key] = preset
        ? { memorize: preset.memorize, reconstruct: preset.reconstruct }
        : { memorize: fallbackMem, reconstruct: fallbackRec };
    });
    return map;
  }

  function syncSequenceMemoryTimingByStake(timingMap) {
    var map = timingMap || {};
    if (global.policyConfig) {
      global.policyConfig.TIMING_BY_BET = map;
    }
    return map;
  }

  var DEFAULT_SEQUENCE_LENGTH_BY_STAKE = {
    5000: 8,
    10000: 10,
    25000: 10,
    50000: 12,
  };

  function buildSequenceLengthMap(timingArray, globalData) {
    var map = {};
    if (timingArray && timingArray.length) {
      timingArray.forEach(function (t) {
        var key = String(Math.floor(Number(t.stake)));
        var len = Number(t.sequenceLength);
        if (!key || key === '0' || key === 'NaN') return;
        if (len >= 4 && len <= 20) {
          map[key] = Math.floor(len);
          map[Math.floor(Number(t.stake))] = Math.floor(len);
        }
      });
      if (Object.keys(map).length) return map;
    }
    var g = globalData || getGlobal();
    var chips = g.intelligenceStakeChips || DEFAULT_GLOBAL.intelligenceStakeChips;
    chips.forEach(function (stake) {
      var key = String(Math.floor(Number(stake)));
      map[key] = DEFAULT_SEQUENCE_LENGTH_BY_STAKE[stake] || 8;
      map[Math.floor(Number(stake))] = map[key];
    });
    return map;
  }

  function syncSequenceMemoryLengthByStake(lengthMap) {
    var map = lengthMap || {};
    if (global.policyConfig) {
      global.policyConfig.SEQUENCE_LENGTH_BY_BET = map;
    }
    return map;
  }

  function resolveSequenceMemoryTiming(globalData, config, stake) {
    var g = globalData || getGlobal();
    var map = buildSequenceTimingMap(config && config.sequenceTimingByStake, g);
    syncSequenceMemoryTimingByStake(map);
    var key = stake != null && stake !== '' ? String(Math.floor(Number(stake))) : '';
    var entry = key && map[key] ? map[key] : null;
    if (entry) {
      return { memorizeSeconds: entry.memorize, reconstructSeconds: entry.reconstruct };
    }
    return syncSequenceMemoryTiming(
      g.sequenceMemoryMemorizeSeconds,
      g.sequenceMemoryReconstructSeconds,
    );
  }

  function isEmbedded() {
    return !!(global.ReactNativeWebView || (global.parent && global.parent !== global));
  }

  function dispatchToGame(data) {
    global.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  function getGlobal() {
    return gamesGlobal || DEFAULT_GLOBAL;
  }

  function ensureDemoBanner() {
    if (document.getElementById('lu-intel-demo-banner')) return;
    var bal = getGlobal().demoBalance || DEFAULT_GLOBAL.demoBalance;
    var el = document.createElement('div');
    el.id = 'lu-intel-demo-banner';
    el.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:99999;' +
      'background:linear-gradient(90deg,#7c3aed,#ec4899);color:#fff;' +
      'font-size:12px;font-weight:600;text-align:center;padding:8px 12px;' +
      'font-family:Cairo,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,0.35);';
    el.innerHTML = '🎮 <b>' + (global.CasinoI18n ? global.CasinoI18n.t('demoMode') : 'وضع تجريبي') + '</b> — ' +
      (global.CasinoI18n ? global.CasinoI18n.t('demoBalance') : 'رصيد افتراضي') + ' ' +
      bal.toLocaleString('en-US') + ' ' +
      (global.CasinoI18n ? global.CasinoI18n.currencyName() : 'كوين');
    if (document.body) {
      document.body.prepend(el);
    }
  }

  function dispatchDemoInit() {
    var g = getGlobal();
    demoBalance = g.demoBalance || DEFAULT_GLOBAL.demoBalance;
    demoBooted = true;
    dispatchToGame({
      type: 'INIT_DATA',
      balance: demoBalance,
      hasPlayedToday: false,
      config: DEMO_CONFIG,
      global: g,
    });
  }

  function ensureDemoReady(force) {
    if (isEmbedded()) return;
    if (!force && demoBooted) return;
    standaloneDemo = true;
    gamesGlobal = mergeGlobal(null);
    ensureDemoBanner();
    dispatchDemoInit();
  }

  /** بعد تجهيز مستمع الرسائل — يمرّر config مخصص */
  function bootStandaloneDemo(customConfig) {
    if (isEmbedded()) return;
    standaloneDemo = true;
    gamesGlobal = mergeGlobal(null);
    demoBalance = getGlobal().demoBalance || DEFAULT_GLOBAL.demoBalance;
    demoBooted = true;
    ensureDemoBanner();
    dispatchToGame({
      type: 'INIT_DATA',
      balance: demoBalance,
      hasPlayedToday: false,
      config: customConfig || DEMO_CONFIG,
      global: getGlobal(),
    });
  }

  function handleStandaloneMessage(data) {
    if (data.type === 'INIT_GAME') {
      dispatchDemoInit();
      return;
    }
    if (data.type === 'PLACE_BET') {
      var stake = Number(data.stake) || 0;
      if (demoBalance < stake) {
        dispatchToGame({ type: 'ERROR', message: 'الرصيد الافتراضي غير كافٍ!' });
      } else {
        demoBalance -= stake;
        dispatchToGame({ type: 'UPDATE_BALANCE', balance: demoBalance });
        dispatchToGame({ type: 'BET_CONFIRMED', status: 'success' });
      }
      return;
    }
    if (data.type === 'GAME_RESULT') {
      var win = Number(data.winAmount) || 0;
      if (data.isWin && win > 0) {
        demoBalance += win;
        dispatchToGame({ type: 'UPDATE_BALANCE', balance: demoBalance });
      }
      dispatchToGame({ type: 'RESULT_RECORDED', status: 'success' });
    }
  }

  function applyInitData(data, defaults) {
    defaults = defaults || {};
    if (data && data.global) {
      gamesGlobal = mergeGlobal(data.global);
    }
    var config = data && data.config ? data.config : null;
    var g = getGlobal();
    var minBet = config && config.minBet != null ? Number(config.minBet) : 5000;
    var maxBet = config && config.maxBet != null ? Number(config.maxBet) : 50000;
    var winMultiplier = resolveWinMultiplier(config, defaults);
    syncIntelligencePolicyMultiplier(winMultiplier);
    var questionSeconds = syncIntelligenceQuestionSeconds(g.intelligenceQuestionSeconds);
    var sequenceTiming = resolveSequenceMemoryTiming(g, config);
    var sequenceTimingByStake = buildSequenceTimingMap(config && config.sequenceTimingByStake, g);
    syncSequenceMemoryTimingByStake(sequenceTimingByStake);
    var sequenceLengthByStake = buildSequenceLengthMap(config && config.sequenceTimingByStake, g);
    syncSequenceMemoryLengthByStake(sequenceLengthByStake);
    var rtp = config && config.rtp != null ? Number(config.rtp) : (defaults.rtp || 95);
    var stakeChips = buildIntelligenceStakeChips(minBet, maxBet);

    return {
      config: config,
      global: g,
      balance: data && data.balance != null ? Number(data.balance) : (defaults.balance || 0),
      hasPlayedToday: !!(data && data.hasPlayedToday),
      minBet: minBet,
      maxBet: maxBet,
      winMultiplier: winMultiplier,
      questionSeconds: questionSeconds,
      memorizeSeconds: sequenceTiming.memorizeSeconds,
      reconstructSeconds: sequenceTiming.reconstructSeconds,
      sequenceTimingByStake: sequenceTimingByStake,
      sequenceLengthByStake: sequenceLengthByStake,
      rtp: rtp,
      stakeChips: stakeChips,
    };
  }

  function canonicalIntelligenceChips() {
    return DEFAULT_GLOBAL.CANONICAL_INTELLIGENCE_CHIPS.slice();
  }

  function buildIntelligenceStakeChips(minBet, maxBet) {
    var g = getGlobal();
    var chips = g.intelligenceStakeChips;
    if (chips && chips.length) {
      var min = Math.max(1, Number(minBet) || 5000);
      var max = Math.max(min, Number(maxBet) || 50000);
      var filtered = chips
        .map(function (v) { return Math.floor(Number(v)); })
        .filter(function (n) { return n >= min && n <= max; })
        .sort(function (a, b) { return a - b; });
      if (filtered.length) return filtered;
    }
    return canonicalIntelligenceChips();
  }

  function buildChipValues(minBet, maxBet, stakeChips) {
    if (stakeChips && stakeChips.length >= 4 &&
        stakeChips[0] === 5000 && stakeChips[1] === 10000 &&
        stakeChips[2] === 25000 && stakeChips[3] === 50000) {
      return buildIntelligenceStakeChips();
    }
    var min = Math.max(1, Number(minBet) || 100);
    var max = Math.max(min, Number(maxBet) || 100000);
    var canonical = canonicalIntelligenceChips();
    var source = canonical;
    if (stakeChips && stakeChips.length >= 4) {
      source = stakeChips.slice();
    } else if (stakeChips && stakeChips.length) {
      source = canonical.concat(stakeChips);
    }
    var seen = {};
    var chips = [];
    source.forEach(function (v) {
      var n = Math.floor(Number(v));
      if (!n || n < min || n > max || seen[n]) return;
      seen[n] = true;
      chips.push(n);
    });
    chips.sort(function (a, b) { return a - b; });
    if (chips.length === 0) chips.push(Math.max(min, canonical[0] || min));
    return chips;
  }

  function formatChipLabel(value) {
    return Math.floor(Number(value) || 0).toLocaleString('en-US');
  }

  function renderChipGrid(containerEl, minBet, maxBet, activeStake, onSelect, stakeChips) {
    if (!containerEl) return activeStake;
    var chips = buildIntelligenceStakeChips(minBet, maxBet);
    var nextStake = activeStake;
    if (chips.indexOf(nextStake) === -1) nextStake = chips[0];

    containerEl.innerHTML = '';
    chips.forEach(function (val) {
      var btn = document.createElement('button');
      btn.className = 'chip-btn' + (val === nextStake ? ' active' : '');
      btn.type = 'button';
      btn.title = val.toLocaleString() + ' كوين';
      btn.innerHTML =
        '<span class="chip-btn-inner">' +
        '<span class="chip-amount">' + formatChipLabel(val) + '</span>' +
        '<img class="chip-coin-img" src="/images/coin-gold.png?v=4" alt="coin" style="width:14px; height:14px; margin-inline-start:4px; vertical-align:middle; object-fit:contain;" />' +
        '</span>';
      btn.onclick = function () {
        onSelect(val);
        containerEl.querySelectorAll('.chip-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
      };
      containerEl.appendChild(btn);
    });

    return nextStake;
  }

  /**
   * ألعاب الذكاء: الدخولية تُخصم عبر placeBet أولاً.
   * المضاعف = صافي الربح (الدخولية × المضاعف) — يُضاف مع استرجاع الدخولية.
   */
  function calcIntelligenceNetProfit(stake, winMultiplier) {
    var s = Number(stake);
    var m = Number(winMultiplier || INTELLIGENCE_WIN_MULTIPLIER);
    return Math.floor(s * m);
  }

  function calcWinAmount(stake, winMultiplier) {
    var s = Number(stake);
    if (!s || s <= 0) return 0;
    return s + calcIntelligenceNetProfit(stake, winMultiplier);
  }

  function formatIntelligenceWinLabel(winMultiplier) {
    var m = Number(winMultiplier);
    if (!m || m <= 0) m = INTELLIGENCE_WIN_MULTIPLIER;
    return 'صافي ×' + m + ' من الدخولية';
  }

  var COINS_PER_CASINO = DEFAULT_GLOBAL.COINS_PER_CASINO_COIN;

  /** ربح بالكوينز → عملة كازينو للعرض (10,000 كوين = 1 كازينو) */
  function coinWinToCasinoDisplay(coinWin) {
    return (Number(coinWin) || 0) / COINS_PER_CASINO;
  }

  /** رصيد مخزّن (micro) → عملة كازينو للعرض */
  function storedToCasinoDisplay(stored) {
    return (Number(stored) || 0) / COINS_PER_CASINO;
  }

  function formatCasinoDisplay(storedOrCoinWin, fromCoins) {
    var display = fromCoins ? coinWinToCasinoDisplay(storedOrCoinWin) : storedToCasinoDisplay(storedOrCoinWin);
    if (!display) return '0';
    if (display >= 1000) return Math.floor(display).toLocaleString('en-US');
    return Number(display.toFixed(4)).toString();
  }

  function postToApp(data) {
    var payload = JSON.stringify(data);
    if (global.ReactNativeWebView) {
      global.ReactNativeWebView.postMessage(payload);
    } else if (global.parent && global.parent !== global) {
      global.parent.postMessage(payload, '*');
    } else if (standaloneDemo) {
      handleStandaloneMessage(data);
    }
  }

  function applyEmbeddedLabels() {
    if (!isEmbedded()) return;
    if (document.body) document.body.classList.add('lu-embedded-app');
    var titles = document.querySelectorAll('.balance-title, [data-balance-label]');
    for (var i = 0; i < titles.length; i++) {
      var el = titles[i];
      if (/تجريبي/i.test(el.textContent || '')) {
        el.textContent = 'رصيدك الحالي';
      }
    }
    var stakeLabels = document.querySelectorAll('.balance-title');
    for (var s = 0; s < stakeLabels.length; s++) {
      var txt = stakeLabels[s].textContent || '';
      if (/رهان/i.test(txt)) {
        stakeLabels[s].textContent = txt.replace(/رهان/g, 'دخولية');
      }
    }
    var demoOnly = document.querySelectorAll('[data-demo-only]');
    for (var j = 0; j < demoOnly.length; j++) {
      demoOnly[j].style.display = 'none';
    }
  }

  function bindAppMessageListener(handler) {
    function onMsg(event) {
      try {
        var raw = event && event.data;
        if (typeof raw !== 'string' || !raw.length) return;
        handler(JSON.parse(raw));
      } catch (e) {
        console.warn('bindAppMessageListener parse error:', e);
      }
    }
    window.addEventListener('message', onMsg);
    document.addEventListener('message', onMsg);
  }

  function initGameBridge() {
    if (isEmbedded()) {
      applyEmbeddedLabels();
      postToApp({ type: 'INIT_GAME' });
    } else {
      ensureDemoReady();
    }
  }

  global.GamesConfigUtils = {
    applyInitData: applyInitData,
    buildChipValues: buildChipValues,
    canonicalIntelligenceChips: canonicalIntelligenceChips,
    formatChipLabel: formatChipLabel,
    renderChipGrid: renderChipGrid,
    calcWinAmount: calcWinAmount,
    calcIntelligenceNetProfit: calcIntelligenceNetProfit,
    formatIntelligenceWinLabel: formatIntelligenceWinLabel,
    postToApp: postToApp,
    initGameBridge: initGameBridge,
    applyEmbeddedLabels: applyEmbeddedLabels,
    bindAppMessageListener: bindAppMessageListener,
    ensureDemoReady: ensureDemoReady,
    bootStandaloneDemo: bootStandaloneDemo,
    isEmbedded: isEmbedded,
    isStandaloneDemo: function () { return standaloneDemo; },
    getGlobal: getGlobal,
    mergeGlobal: mergeGlobal,
    INTELLIGENCE_WIN_MULTIPLIER: INTELLIGENCE_WIN_MULTIPLIER,
    resolveWinMultiplier: resolveWinMultiplier,
    syncIntelligencePolicyMultiplier: syncIntelligencePolicyMultiplier,
    syncSequenceMemoryTiming: syncSequenceMemoryTiming,
    syncSequenceMemoryTimingByStake: syncSequenceMemoryTimingByStake,
    buildSequenceLengthMap: buildSequenceLengthMap,
    syncSequenceMemoryLengthByStake: syncSequenceMemoryLengthByStake,
    buildSequenceTimingMap: buildSequenceTimingMap,
    resolveSequenceMemoryTiming: resolveSequenceMemoryTiming,
    COINS_PER_CASINO_COIN: COINS_PER_CASINO,
    coinWinToCasinoDisplay: coinWinToCasinoDisplay,
    storedToCasinoDisplay: storedToCasinoDisplay,
    formatCasinoDisplay: formatCasinoDisplay,
    DEMO_BALANCE: DEFAULT_GLOBAL.demoBalance,
  };
})(window);
