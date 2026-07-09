/**
 * Casino / luck games i18n — ar / en via ?lang= from WebView
 */
(function (global) {
  'use strict';

  var lang = 'ar';

  var STR = {
    ar: {
      currency: 'كوين',
      yourBalance: 'رصيدك',
      casinoCoins: 'عملات الكازينو',
      bet: 'الرهان',
      spin: 'العب',
      start: 'ابدأ',
      insufficientBalance: 'رصيدك غير كافٍ',
      invalidStake: 'قيمة الدخولية غير صالحة',
      syncBalance: 'جاري مزامنة الرصيد...',
      minBet: 'أقل رهان مسموح:',
      maxBet: 'أقصى رهان مسموح:',
      win: 'فوز!',
      lose: 'حاول مجدداً',
      chooseBet: 'اختر قيمة الرهان',
      playResponsibly: 'العب بمسؤولية',
      vsCpu: 'العب ضد الكمبيوتر',
      ready: 'جاهز',
      startMatch: 'ابدأ المباراة',
    },
    en: {
      currency: 'Coins',
      yourBalance: 'Your balance',
      casinoCoins: 'Casino coins',
      bet: 'Bet',
      spin: 'Play',
      start: 'Start',
      insufficientBalance: 'Insufficient balance',
      invalidStake: 'Invalid stake',
      syncBalance: 'Syncing balance...',
      minBet: 'Min bet:',
      maxBet: 'Max bet:',
      win: 'You won!',
      lose: 'Try again',
      chooseBet: 'Choose your stake',
      playResponsibly: 'Play responsibly',
      vsCpu: 'Play vs CPU',
      ready: 'Ready',
      startMatch: 'Start match',
    },
  };

  function parseLang() {
    var m = (global.location.search || '').match(/[?&]lang=(en|ar)/i);
    return m ? m[1].toLowerCase() : 'ar';
  }

  function t(key) {
    var table = STR[lang] || STR.ar;
    return table[key] != null ? table[key] : (STR.ar[key] != null ? STR.ar[key] : key);
  }

  function init(forcedLang) {
    if (forcedLang === 'en' || forcedLang === 'ar') lang = forcedLang;
    else lang = parseLang();
    var root = global.document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    global.document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    hideDemoOnly();
  }

  function hideDemoOnly() {
    if (!global.CasinoBridge || !global.CasinoBridge.isEmbedded()) return;
    global.document.querySelectorAll('[data-demo-only]').forEach(function (el) {
      el.style.display = 'none';
    });
    global.document.querySelectorAll('[data-embed-hide]').forEach(function (el) {
      el.style.display = 'none';
    });
  }

  global.CasinoI18n = {
    init: init,
    t: t,
    getLang: function () { return lang; },
    isRtl: function () { return lang === 'ar'; },
    hideDemoOnly: hideDemoOnly,
  };

  init();
})(typeof window !== 'undefined' ? window : this);
