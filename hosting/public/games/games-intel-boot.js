/**
 * تحميل games-config-utils مع إعادة محاولة + مساعدات التجربة المباشرة
 */
(function (global) {
  var UTILS_VER = '12';
  var FX_VER = '6';

  function applyEmbedMode() {
    var embedded = !!(global.ReactNativeWebView || (global.parent && global.parent !== global));
    var embedParam = /(?:^|[?&])embed=1(?:&|$)/.test(global.location.search || '');
    if (embedded || embedParam) {
      global.document.documentElement.classList.add('linkup-embed');
    }
  }
  applyEmbedMode();

  function bootPerfAll() {
    if (global.GameProFX) {
      global.GameProFX.boot();
      global.GameProFX.setPerfMode(true);
    }
    if (global.IntelFX) {
      if (typeof global.IntelFX.setPerfMode === 'function') {
        global.IntelFX.setPerfMode(true);
      }
      if (typeof global.IntelFX.boot === 'function') {
        global.IntelFX.boot({ lite: true });
      }
    }
  }

  function isStandalonePlay() {
    return !(global.ReactNativeWebView || (global.parent && global.parent !== global));
  }

  function getUtils() {
    return global.GamesConfigUtils;
  }

  function utilsReady() {
    var U = getUtils();
    return U && typeof U.initGameBridge === 'function';
  }

  function loadUtils(onReady) {
    if (utilsReady()) {
      onReady();
      return;
    }
    var s = global.document.createElement('script');
    s.src = '../games-config-utils.js?v=' + UTILS_VER + '&_=' + Date.now();
    s.onload = onReady;
    s.onerror = function () {
      global.alert('فشل تحميل ملف اللعبة. اضغط Ctrl+Shift+R لتحديث الصفحة.');
    };
    global.document.head.appendChild(s);
  }

  function bootDemo(onReady) {
    loadUtils(function () {
      var U = getUtils();
      if (isStandalonePlay()) {
        if (U && typeof U.ensureDemoReady === 'function') {
          U.ensureDemoReady();
        }
      } else if (U && typeof U.applyEmbeddedLabels === 'function') {
        U.applyEmbeddedLabels();
      }
      if (onReady) onReady();
    });
  }

  /** للتطبيق — يطلب الرصيد الحقيقي من React Native */
  function bootApp(onReady) {
    loadUtils(function () {
      var U = getUtils();
      if (U && typeof U.applyEmbeddedLabels === 'function') {
        U.applyEmbeddedLabels();
      }
      if (U && typeof U.initGameBridge === 'function') {
        U.initGameBridge();
      }
      if (onReady) onReady();
    });
  }

  function postBet(stake, onConfirmed) {
    var U = getUtils();
    if (U && typeof U.postToApp === 'function') {
      U.postToApp({ type: 'PLACE_BET', stake: stake });
      return true;
    }
    if (isStandalonePlay() && onConfirmed) {
      onConfirmed();
      return true;
    }
    return false;
  }

  function getDemoBalance() {
    var U = getUtils();
    if (U && U.DEFAULT_GLOBAL && U.DEFAULT_GLOBAL.demoBalance != null) {
      return U.DEFAULT_GLOBAL.demoBalance;
    }
    return 50000;
  }

  global.LinkUpGameBoot = {
    UTILS_VER: UTILS_VER,
    FX_VER: FX_VER,
    bootPerfAll: bootPerfAll,
    isStandalonePlay: isStandalonePlay,
    getUtils: getUtils,
    utilsReady: utilsReady,
    loadUtils: loadUtils,
    bootDemo: bootDemo,
    bootApp: bootApp,
    postBet: postBet,
    getDemoBalance: getDemoBalance,
    get DEMO_BALANCE() { return getDemoBalance(); },
  };
})(window);
