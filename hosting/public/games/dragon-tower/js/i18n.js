/* ============================================================
 * Linkup · Dragon Tower — i18n (English / Arabic)
 * ------------------------------------------------------------
 * Static text uses [data-i18n] / [data-i18n-title] attributes.
 * Dynamic text (buttons, row labels) calls I18N.t() / rowsLabel().
 * Switching language also flips document direction (LTR/RTL).
 * ============================================================ */
const I18N = (() => {
  'use strict';

  const STORAGE_KEY = 'linkup_lang';

  const dict = {
    en: {
      manual: 'Manual',
      auto: 'Auto',
      betAmount: 'Bet Amount',
      difficulty: 'Difficulty',
      numberOfBets: 'Number of Bets',
      cashoutAfterRows: 'Cashout After Rows',
      bet: 'Bet',
      cashout: 'Cashout',
      startAutobet: 'Start Autobet',
      stopAutobet: 'Stop Autobet',
      randomPick: 'Random Pick',
      totalProfit: 'Total Profit',
      nextTile: 'Next tile:',
      runUntilStopped: '0 = run until stopped',
      resetTitle: 'Reset balance',
      soundTitle: 'Toggle sound',
      diff_easy: 'Easy',
      diff_medium: 'Medium',
      diff_hard: 'Hard',
      diff_expert: 'Expert',
      diff_master: 'Master',
      rows_one: 'row',
      rows_other: 'rows',
    },
    ar: {
      manual: 'يدوي',
      auto: 'تلقائي',
      betAmount: 'مبلغ الرهان',
      difficulty: 'الصعوبة',
      numberOfBets: 'عدد الرهانات',
      cashoutAfterRows: 'السحب بعد صفوف',
      bet: 'راهن',
      cashout: 'اسحب الأرباح',
      startAutobet: 'بدء الرهان التلقائي',
      stopAutobet: 'إيقاف الرهان التلقائي',
      randomPick: 'اختيار عشوائي',
      totalProfit: 'إجمالي الربح',
      nextTile: 'البلاطة التالية:',
      runUntilStopped: '٠ = يستمر حتى الإيقاف',
      resetTitle: 'إعادة تعيين الرصيد',
      soundTitle: 'كتم/تشغيل الصوت',
      diff_easy: 'سهل',
      diff_medium: 'متوسط',
      diff_hard: 'صعب',
      diff_expert: 'خبير',
      diff_master: 'محترف',
      rows_one: 'صف',
      rows_other: 'صفوف',
    },
  };

  let lang = (() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return dict[saved] ? saved : 'ar'; // Arabic is the default
  })();

  const callbacks = [];

  const t = key => (dict[lang][key] != null ? dict[lang][key] : key);

  function rowsLabel(n, mult) {
    const word = n === 1 ? dict[lang].rows_one : dict[lang].rows_other;
    return `${n} ${word} (${mult}×)`;
  }

  function applyStatic() {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const v = dict[lang][el.dataset.i18n];
      if (v != null) el.textContent = v;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const v = dict[lang][el.dataset.i18nTitle];
      if (v != null) el.title = v;
    });
  }

  function set(l) {
    lang = dict[l] ? l : 'en';
    localStorage.setItem(STORAGE_KEY, lang);
    applyStatic();
    callbacks.forEach(fn => fn(lang));
  }

  const onChange = fn => { callbacks.push(fn); };

  return {
    get lang() { return lang; },
    t, rowsLabel, set, applyStatic, onChange,
  };
})();
