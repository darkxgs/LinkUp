/* ============================================================
   Linkup — i18n  (English / Arabic, with RTL)
   ------------------------------------------------------------
   Adds data-i18n / data-i18n-title support. Sets <html lang/dir>.
   Auto-detects Arabic browsers on first visit; choice is saved.
   ============================================================ */
(function (global) {
  "use strict";

  const STORAGE_KEY = "linkup_lang";

  const dict = {
    en: {
      manual: "Manual",
      auto: "Auto",
      bet_amount: "Bet Amount",
      bet: "Bet",
      profit_on_win: "Profit on Win",
      number_of_bets: "Number of Bets",
      on_win: "On Win",
      on_loss: "On Loss",
      reset: "Reset",
      increase_by: "Increase by:",
      stop_on_profit: "Stop on Profit",
      stop_on_loss: "Stop on Loss",
      start_autobet: "Start Autobet",
      stop_autobet: "Stop Autobet",
      target_multiplier: "Target Multiplier",
      win_chance: "Win Chance",
      fairness: "Fairness",
      settings: "Settings",
      sound: "Sound",
      live_stats: "Live Stats",
      demo: "DEMO",
      profit: "Profit",
      wins: "Wins",
      wagered: "Wagered",
      losses: "Losses",
      reset_balance: "Reset demo balance",
      switch_lang: "العربية",
      go_to_hilo: "Go to Hilo ◢",
      err_insufficient: "Insufficient balance.",
      err_invalid_amount: "Bet amount must be greater than 0.",
      err_set_bet: "Set a bet amount",
      min_target_error: 'Minimum is "1.01"',
      max_win_chance_error: 'Maximum is "98.01980198"',
      fairness_modal_title: "Solving the Trust Issue with Online Gambling",
      fairness_p1: "The underlying concept of provable fairness is that players have the ability to prove and verify that their results are fair and unmanipulated. This is achieved through the use of a commitment scheme, along with cryptographic hashing.",
      fairness_p2: "The commitment scheme is used to ensure that the player has an influence on all results generated. Cryptographic hashing is used to ensure that the casino also remains honest to this commitment scheme. Both concepts combined creates a trust-less environment when gambling online.",
      fairness_p3: "This is simplified in the following representation:",
      overview: "Overview",
    },
    ar: {
      manual: "يدوي",
      auto: "تلقائي",
      bet_amount: "مبلغ الرهان",
      bet: "راهن",
      profit_on_win: "الربح عند الفوز",
      number_of_bets: "عدد الرهانات",
      on_win: "عند الفوز",
      on_loss: "عند الخسارة",
      reset: "إعادة تعيين",
      increase_by: "زيادة بنسبة:",
      stop_on_profit: "التوقف عند الربح",
      stop_on_loss: "التوقف عند الخسارة",
      start_autobet: "بدء الرهان التلقائي",
      stop_autobet: "إيقاف الرهان التلقائي",
      target_multiplier: "المضاعف المستهدف",
      win_chance: "فرصة الفوز",
      fairness: "النزاهة",
      settings: "الإعدادات",
      sound: "الصوت",
      live_stats: "إحصائيات مباشرة",
      demo: "تجريبي",
      profit: "الربح",
      wins: "الانتصارات",
      wagered: "إجمالي المراهنات",
      losses: "الخسائر",
      reset_balance: "إعادة تعيين الرصيد التجريبي",
      switch_lang: "English",
      go_to_hilo: "الذهاب إلى هيلو ◢",
      err_insufficient: "الرصيد غير كافٍ.",
      err_invalid_amount: "يجب أن يكون مبلغ الرهان أكبر من صفر.",
      err_set_bet: "أدخل مبلغ الرهان",
      min_target_error: 'الحد الأدنى هو "1.01"',
      max_win_chance_error: 'الحد الأقصى هو "98.01980198"',
      fairness_modal_title: "حل مشكلة الثقة في ألعاب القمار عبر الإنترنت",
      fairness_p1: "المفهوم الأساسي للنزاهة القابلة للإثبات هو أن اللاعبين لديهم القدرة على إثبات والتحقق من أن نتائجهم عادلة وغير متلاعب بها. ويتم تحقيق ذلك من خلال استخدام مخطط الالتزام، إلى جانب التجزئة التشفيرية.",
      fairness_p2: "يُسخدم مخطط الالتزام لضمان أن يكون للاعب تأثير على جميع النتائج التي يتم إنشاؤها. وتُستخدم التجزئة التشفيرية لضمان بقاء الكازينو صادقًا أيضًا في مخطط الالتزام هذا. كلا المفهومين معًا يخلقان بيئة خالية من الثقة عند اللعب عبر الإنترنت.",
      fairness_p3: "يتم تبسيط ذلك في التمثيل التالي:",
      overview: "نظرة عامة",
    },
  };

  const I18N = {
    lang: "en",
    dict,

    t(key) {
      return (dict[this.lang] && dict[this.lang][key]) || dict.en[key] || key;
    },

    apply() {
      const root = document.documentElement;
      root.lang = this.lang;
      root.dir = this.lang === "ar" ? "rtl" : "ltr";

      document.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = this.t(el.getAttribute("data-i18n"));
      });
      document.querySelectorAll("[data-i18n-title]").forEach((el) => {
        el.title = this.t(el.getAttribute("data-i18n-title"));
      });
    },

    set(lang) {
      this.lang = dict[lang] ? lang : "en";
      try { localStorage.setItem(STORAGE_KEY, this.lang); } catch (e) {}
      this.apply();
    },

    init() {
      let lang = null;
      try { lang = localStorage.getItem(STORAGE_KEY); } catch (e) {}
      if (!lang) {
        lang = (navigator.language || "en").toLowerCase().startsWith("ar") ? "ar" : "en";
      }
      this.lang = dict[lang] ? lang : "en";
      this.apply();
    },
  };

  global.I18N = I18N;
})(window);
