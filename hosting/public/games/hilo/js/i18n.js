/* ============================================================
   Linkup — Hilo Localization (i18n)
   ------------------------------------------------------------
   Key-value dictionary translation for English / Arabic.
   Updates HTML lang/dir and updates text content in DOM.
   ============================================================ */
(function (global) {
  "use strict";

  const STORAGE_KEY = "linkup_lang";

  const dict = {
    en: {
      manual: "Manual",
      bet_amount: "Bet Amount",
      bet: "Bet",
      skip_card: "Skip Card",
      higher_or_same: "Higher or Same",
      lower_or_same: "Lower or Same",
      total_profit: "Total Profit",
      profit_higher: "Profit Higher",
      profit_lower: "Profit Lower",
      cashout: "Cashout",
      king_highest: "King being the highest",
      ace_lowest: "Ace being the lowest",
      go_to_limbo: "Go to Limbo ◢",
      fairness: "Fairness",
      sound: "Sound",
      live_stats: "Live Stats",
      demo: "DEMO",
      profit: "Profit",
      wins: "Wins",
      wagered: "Wagered",
      losses: "Losses",
      reset_balance: "Reset demo balance",
      switch_lang: "العربية",
      err_insufficient: "Insufficient balance.",
      err_invalid_amount: "Bet amount must be greater than 0.",
      err_set_bet: "Set a bet amount",
      fairness_modal_title: "Solving the Trust Issue with Online Gambling",
      fairness_p1: "The underlying concept of provable fairness is that players have the ability to prove and verify that their results are fair and unmanipulated. This is achieved through the use of a commitment scheme, along with cryptographic hashing.",
      fairness_p2: "The commitment scheme is used to ensure that the player has an influence on all results generated. Cryptographic hashing is used to ensure that the casino also remains honest to this commitment scheme. Both concepts combined creates a trust-less environment when gambling online.",
      fairness_p3: "This is simplified in the following representation:",
      overview: "Overview",
      start_card: "Start Card"
    },
    ar: {
      manual: "يدوي",
      bet_amount: "مبلغ الرهان",
      bet: "راهن",
      skip_card: "تخطي البطاقة",
      higher_or_same: "أعلى أو مساوٍ",
      lower_or_same: "أقل أو مساوٍ",
      total_profit: "إجمالي الربح",
      profit_higher: "ربح أعلى",
      profit_lower: "ربح أقل",
      cashout: "سحب الأرباح",
      king_highest: "الملك هو الأعلى",
      ace_lowest: "الآس هو الأدنى",
      go_to_limbo: "الذهاب إلى ليمبو ◢",
      fairness: "النزاهة",
      sound: "الصوت",
      live_stats: "إحصائيات مباشرة",
      demo: "تجريبي",
      profit: "الربح",
      wins: "الانتصارات",
      wagered: "إجمالي المراهنات",
      losses: "الخسائر",
      reset_balance: "إعادة تعيين الرصيد التجريبي",
      switch_lang: "English",
      err_insufficient: "الرصيد غير كافٍ.",
      err_invalid_amount: "يجب أن يكون مبلغ الرهان أكبر من صفر.",
      err_set_bet: "أدخل مبلغ الرهان",
      fairness_modal_title: "حل مشكلة الثقة في ألعاب القمار عبر الإنترنت",
      fairness_p1: "المفهوم الأساسي للنزاهة القابلة للإثبات هو أن اللاعبين لديهم القدرة على إثبات والتحقق من أن نتائجهم عادلة وغير متلاعب بها. ويتم تحقيق ذلك من خلال استخدام مخطط الالتزام، إلى جانب التجزئة التشفيرية.",
      fairness_p2: "يُسخدم مخطط الالتزام لضمان أن يكون للاعب تأثير على جميع النتائج التي يتم إنشاؤها. وتُستخدم التجزئة التشفيرية لضمان بقاء الكازينو صادقًا أيضًا في مخطط الالتزام هذا. كلا المفهومين معًا يخلقان بيئة خالية من الثقة عند اللعب عبر الإنترنت.",
      fairness_p3: "يتم تبسيط ذلك في التمثيل التالي:",
      overview: "نظرة عامة",
      start_card: "بطاقة البداية"
    }
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
    }
  };

  global.I18N = I18N;
})(window);
