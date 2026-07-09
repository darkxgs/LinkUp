/**
 * واجهة مشتركة لألعاب الذكاء — رسائل الحد اليومي وغيرها
 */
(function (global) {
  'use strict';

  function t(key, vars) {
    return global.IntelI18n ? global.IntelI18n.t(key, vars) : key;
  }

  function isDailyLimitMessage(msg) {
    if (!msg) return false;
    var s = String(msg);
    return /حد اليوم|اليوم|غدا|daily limit|tomorrow|played.*today/i.test(s);
  }

  function removeNotice() {
    var el = global.document.getElementById('intel-daily-notice');
    if (el) el.remove();
  }

  /** إشعار بارز عند محاولة اللعب بعد استهلاك الحد اليومي */
  function showDailyLimitNotice(message) {
    removeNotice();
    var msg = message || t('dailyLimitUsed');
    var el = global.document.createElement('div');
    el.id = 'intel-daily-notice';
    el.className = 'intel-daily-notice';
    el.setAttribute('role', 'alert');
    el.innerHTML =
      '<div class="intel-daily-notice-inner">' +
        '<div class="intel-daily-notice-icon" aria-hidden="true">🔒</div>' +
        '<div class="intel-daily-notice-body">' +
          '<strong class="intel-daily-notice-title">' + esc(t('dailyLimitTitle')) + '</strong>' +
          '<p class="intel-daily-notice-msg">' + esc(msg) + '</p>' +
          '<p class="intel-daily-notice-hint">' + esc(t('dailyLimitHint')) + '</p>' +
        '</div>' +
        '<button type="button" class="intel-daily-notice-close" aria-label="إغلاق">×</button>' +
      '</div>';
    global.document.body.appendChild(el);
    el.querySelector('.intel-daily-notice-close').addEventListener('click', removeNotice);
    global.setTimeout(removeNotice, 12000);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function getResetHour() {
    if (global.policyConfig && global.policyConfig.DAILY_LIMIT_RESET_HOUR_LOCAL != null) {
      return Number(global.policyConfig.DAILY_LIMIT_RESET_HOUR_LOCAL) || 0;
    }
    if (global.IG && global.IG.policyConfig && global.IG.policyConfig.DAILY_LIMIT_RESET_HOUR_LOCAL != null) {
      return Number(global.IG.policyConfig.DAILY_LIMIT_RESET_HOUR_LOCAL) || 0;
    }
    return 0;
  }

  function getMsUntilNextReset() {
    var synced = getServerSyncedMsUntilReset();
    if (synced != null) return synced;
    var now = new Date();
    var resetHour = getResetHour();
    var next = new Date(now);
    next.setHours(resetHour, 0, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    return next.getTime() - now.getTime();
  }

  function formatCountdownHMS(ms) {
    var totalSecs = Math.max(0, Math.floor(Number(ms) / 1000));
    var hours = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    var minutes = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    var seconds = String(totalSecs % 60).padStart(2, '0');
    return hours + ':' + minutes + ':' + seconds;
  }

  var resetCountdownInterval = null;
  var serverClock = {
    anchor: 0,
    serverNowAtAnchor: 0,
    msUntilNextDailyReset: 0,
  };

  function setServerClock(opts) {
    opts = opts || {};
    if (typeof opts.serverNow !== 'number' || typeof opts.msUntilNextDailyReset !== 'number') return;
    serverClock.anchor = Date.now();
    serverClock.serverNowAtAnchor = opts.serverNow;
    serverClock.msUntilNextDailyReset = Math.max(0, opts.msUntilNextDailyReset);
  }

  function getServerSyncedMsUntilReset() {
    if (!serverClock.anchor || !serverClock.msUntilNextDailyReset) return null;
    var elapsed = Date.now() - serverClock.anchor;
    return Math.max(0, serverClock.msUntilNextDailyReset - elapsed);
  }

  function stopResetCountdown() {
    if (resetCountdownInterval) {
      global.clearInterval(resetCountdownInterval);
      resetCountdownInterval = null;
    }
  }

  /** عدّ تنازلي حي حتى منتصف الليل (أو ساعة إعادة التعيين) */
  function startResetCountdown(options) {
    options = options || {};
    var elementId = options.elementId || 'reset-countdown';
    var selector = options.selector || ('#' + elementId);

    stopResetCountdown();

    function resolveMs() {
      if (typeof options.getMs === 'function') return options.getMs();
      if (global.dailyLimitProvider && typeof global.dailyLimitProvider.getMsUntilNextReset === 'function') {
        return global.dailyLimitProvider.getMsUntilNextReset();
      }
      if (global.IG && typeof global.IG.timeUntilNextReset === 'function') {
        return global.IG.timeUntilNextReset().ms;
      }
      return getMsUntilNextReset();
    }

    function getDisplay() {
      return global.document.querySelector(selector)
        || global.document.getElementById(elementId)
        || global.document.querySelector('.intel-blocked-countdown');
    }

    function update() {
      var display = getDisplay();
      if (!display) return;
      var ms = resolveMs();
      if (ms <= 0) {
        stopResetCountdown();
        if (typeof options.onExpire === 'function') {
          options.onExpire();
        } else {
          global.location.reload();
        }
        return;
      }
      display.textContent = formatCountdownHMS(ms);
    }

    update();
    resetCountdownInterval = global.setInterval(update, 1000);
  }

  /** محتوى شاشة الحظر اليومي الكاملة */
  function blockedPanelHTML(countdownText) {
    var initial = countdownText;
    if (!initial || initial === '--:--:--') {
      initial = formatCountdownHMS(getMsUntilNextReset());
    }
    return (
      '<div class="intel-blocked-panel">' +
        '<div class="intel-blocked-icon" aria-hidden="true">🔒</div>' +
        '<h2 class="intel-blocked-title">' + esc(t('dailyLimitTitle')) + '</h2>' +
        '<p class="intel-blocked-msg">' + esc(t('dailyLimitUsed')) + '</p>' +
        '<p class="intel-blocked-sub">' + esc(t('dailyLimitHint')) + '</p>' +
        '<div class="intel-blocked-countdown-box">' +
          '<span class="intel-blocked-countdown-label">' + esc(t('countdownLabel')) + '</span>' +
          '<span class="intel-blocked-countdown" id="reset-countdown">' + esc(initial) + '</span>' +
        '</div>' +
      '</div>'
    );
  }

  global.IntelUI = {
    showDailyLimitNotice: showDailyLimitNotice,
    isDailyLimitMessage: isDailyLimitMessage,
    blockedPanelHTML: blockedPanelHTML,
    removeNotice: removeNotice,
    getMsUntilNextReset: getMsUntilNextReset,
    setServerClock: setServerClock,
    formatCountdownHMS: formatCountdownHMS,
    startResetCountdown: startResetCountdown,
    stopResetCountdown: stopResetCountdown,
  };
})(typeof window !== 'undefined' ? window : this);
