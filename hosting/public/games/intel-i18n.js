/**
 * Intelligence games i18n — ar / en (follows ?lang= from LinkUp app WebView)
 */
(function (global) {
  'use strict';

  var lang = 'ar';

  var STR = {
    ar: {
      currency: 'كوين',
      currencyIcon: '◎',
      intelSuite: 'ألعاب الذكاء',
      yourBalance: 'رصيدك',
      entryFee: 'قيمة الدخولية',
      startRound: 'ابدأ الجولة',
      confirmingEntry: 'جاري تأكيد الدخولية...',
      dailyLimitUsed: 'لقد لعبت هذه اللعبة اليوم — جرّب لعبة ذكاء أخرى أو عد غداً.',
      dailyLimitTitle: 'تجاوزت الحد اليومي',
      dailyLimitHint: 'عد غداً بعد منتصف الليل لتلعب مرة أخرى.',
      dailyLimitLocked: 'تم استهلاك الحد اليومي',
      insufficientBalance: 'الرصيد غير كافٍ!',
      loadingBalance: 'جاري التحميل...',
      syncBalance: 'جاري مزامنة رصيدك من التطبيق... حاول مرة أخرى بعد ثانية.',
      winTitle: 'أحسنت! فوز رائع',
      loseTitle: 'حاول مرة أخرى غداً',
      netWin: 'ربحت +{{amount}}',
      entryLost: 'خصم دخولية -{{amount}}',
      backConfirm: 'العودة وتأكيد النتيجة',
      blockedTitle: 'تجاوزت الحد اليومي',
      blockedSub: 'لقد استخدمت محاولتك الوحيدة اليوم في ألعاب الذكاء. عُد غداً بعد منتصف الليل.',
      countdownLabel: 'الوقت المتبقي حتى الجولة القادمة',
      chooseBet: 'اختر قيمة الدخولية',
      customBetMin: 'أو دخولية مخصصة (الحد الأدنى {{min}})',
      flagTitle: 'خمّن المكان',
      flagSub: 'معالم حقيقية — اختر الدولة الصحيحة',
      memoryTitle: 'تطابق الأشكال',
      memorySub: 'اعثر على الأزواج المتطابقة قبل انتهاء الوقت',
      sequenceTitle: 'تذكر التسلسل',
      sequenceSub: 'احفظ الترتيب وأعد ترتيب الألوان',
      sequenceSquaresCount: '{{count}} مربعات',
      live: 'مباشر',
      loadingGame: 'جاري تحميل اللعبة...',
      playResponsibly: 'العب بمسؤولية',
    },
    en: {
      currency: 'Coin',
      currencyIcon: '◎',
      intelSuite: 'Intelligence Games',
      yourBalance: 'Your balance',
      entryFee: 'Entry fee',
      startRound: 'Start round',
      confirmingEntry: 'Confirming entry...',
      dailyLimitUsed: 'You already played this game today — try another brain game or come back tomorrow.',
      dailyLimitTitle: 'Daily limit reached',
      dailyLimitHint: 'Come back tomorrow after midnight to play again.',
      dailyLimitLocked: 'Daily limit used',
      insufficientBalance: 'Insufficient balance!',
      loadingBalance: 'Loading...',
      syncBalance: 'Syncing your balance from the app... try again in a second.',
      winTitle: 'Great job! You won',
      loseTitle: 'Try again tomorrow',
      netWin: 'You won +{{amount}}',
      entryLost: 'Entry fee -{{amount}}',
      backConfirm: 'Back & confirm result',
      blockedTitle: 'Daily limit reached',
      blockedSub: 'You used your only attempt today. Come back tomorrow after midnight.',
      countdownLabel: 'Time until next round',
      chooseBet: 'Choose your entry fee',
      customBetMin: 'Or custom entry (min {{min}})',
      flagTitle: 'Guess the Place',
      flagSub: 'Real landmarks — pick the correct country',
      memoryTitle: 'Shape Match',
      memorySub: 'Find all matching pairs before time runs out',
      sequenceTitle: 'Remember the Sequence',
      sequenceSub: 'Memorize the order and rebuild the colors',
      sequenceSquaresCount: '{{count}} squares',
      live: 'Live',
      loadingGame: 'Loading game...',
      playResponsibly: 'Play responsibly',
    },
  };

  function parseLang() {
    var m = (global.location.search || '').match(/[?&]lang=(en|ar)/i);
    return m ? m[1].toLowerCase() : 'ar';
  }

  function t(key, vars) {
    var table = STR[lang] || STR.ar;
    var out = table[key] != null ? table[key] : (STR.ar[key] != null ? STR.ar[key] : key);
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        out = out.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), String(vars[k]));
      });
    }
    return out;
  }

  function applyDocument() {
    var root = global.document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    global.document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (!key) return;
      var vars = null;
      var varsAttr = el.getAttribute('data-i18n-vars');
      if (varsAttr) {
        try { vars = JSON.parse(varsAttr); } catch (e) { /* ignore */ }
      }
      el.textContent = t(key, vars);
    });
    if (global.IntelCoins && typeof global.IntelCoins.injectContainers === 'function') {
      global.IntelCoins.injectContainers();
    }
  }

  function init() {
    lang = parseLang();
    applyDocument();
  }

  global.IntelI18n = {
    init: init,
    t: t,
    getLang: function () { return lang; },
    isRtl: function () { return lang === 'ar'; },
    applyDocument: applyDocument,
  };

  init();
})(typeof window !== 'undefined' ? window : this);
