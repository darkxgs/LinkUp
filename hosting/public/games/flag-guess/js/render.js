/*
 * render.js
 * -----------------------------------------------------------------------------
 * Game #1 view layer. Draws whatever Game.state holds. NO game logic, NO timers,
 * NO providers. Full rebuild on 'phase', cheap timer-only update on 'tick'.
 * Currency is COINS (كوين). Single difficulty; payout is ×5. Arabic, RTL.
 *
 * Stable IDs/classes input.js depends on:
 *   .chip[data-bet], #custom-bet-form, #custom-bet-input, #bet-error,
 *   #answer-form, #answer-input, #submit-btn, #dev-reset,
 *   #timer, #timer-bar, #timer-num, #blocked-countdown
 * -----------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var IG = global.IG;
  var Game = global.Game = global.Game || {};
  var cfg = IG.policyConfig;

  function t(key, vars) {
    return (global.IntelI18n && global.IntelI18n.t(key, vars)) || key;
  }

  var RING_R = 26;
  var RING_C = 2 * Math.PI * RING_R;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function coinHTML(n) {
    if (global.IntelCoins) return global.IntelCoins.formatAmountWithLabel(n, 18);
    return '<span class="coin">' + cfg.CURRENCY_ICON + '</span> ' + fmt(n);
  }
  function pad(n) { return ('0' + n).slice(-2); }

  var app;

  // ---- Reusable bits ----------------------------------------------------------
  function header(state) {
    return '' +
      '<header class="topbar">' +
        '<div class="brand"><span class="brand-mark">🧠</span><span>' + esc(t('intelSuite')) + '</span></div>' +
        '<div class="balance" id="balance">' +
          '<span class="balance-label">' + esc(t('yourBalance')) + ' (' + esc(cfg.CURRENCY_LABEL) + ')</span>' +
          '<span class="balance-amount">' + coinHTML(state.balance) + '</span>' +
        '</div>' +
      '</header>';
  }

  function blockedCountdownMarkup() {
    var t = IG.timeUntilNextReset();
    return pad(t.hours) + ':' + pad(t.minutes) + ':' + pad(t.seconds);
  }

  function rulesCard(state) {
    var mult = cfg.REWARD_MULTIPLIER;
    var rules = [
      ['💰', 'اربح ×' + mult, 'إجابة صحيحة وفي الوقت تضاعف رهانك ' + mult + ' مرات'],
      ['⏱️', state.challengeSeconds + ' ثوانٍ', 'لكتابة اسم الدولة بشكل صحيح'],
      ['📍', 'صور أماكن', 'معالم شهيرة حول العالم — خمّن الدولة'],
      ['🗓️', 'مرة كل يوم', 'محاولة واحدة، يتصفّر العداد منتصف الليل'],
      ['🎚️', 'اختر رهانك', 'مبالغ جاهزة أو مبلغ مخصّص (الدفع أكثر مسموح)'],
      ['💡', 'كشف الإجابة', 'عند الخطأ تظهر الإجابة الصحيحة تلقائياً']
    ];
    var cells = rules.map(function (r) {
      return '' +
        '<div class="rule">' +
          '<span class="rule-ico">' + r[0] + '</span>' +
          '<div class="rule-txt"><strong>' + r[1] + '</strong><span>' + r[2] + '</span></div>' +
        '</div>';
    }).join('');
    return '<div class="rules-grid">' + cells + '</div>';
  }

  // ---- Screens ----------------------------------------------------------------
  function renderBlocked(state) {
    var panel = global.IntelUI
      ? global.IntelUI.blockedPanelHTML(blockedCountdownMarkup())
      : (
        '<div class="intel-blocked-panel">' +
          '<div class="intel-blocked-icon">🔒</div>' +
          '<h2 class="intel-blocked-title">' + esc(t('blockedTitle')) + '</h2>' +
          '<p class="intel-blocked-msg">' + esc(t('dailyLimitUsed')) + '</p>' +
          '<p class="intel-blocked-sub">' + esc(t('dailyLimitHint')) + '</p>' +
          '<div class="intel-blocked-countdown-box">' +
            '<span class="intel-blocked-countdown-label">' + esc(t('countdownLabel')) + '</span>' +
            '<span class="intel-blocked-countdown" id="blocked-countdown">' + blockedCountdownMarkup() + '</span>' +
          '</div>' +
        '</div>'
      );
    app.innerHTML = header(state) + '<section class="screen blocked-screen">' + panel + '</section>';
  }

  function renderBetSelect(state) {
    var chips = cfg.ALLOWED_BETS.map(function (bet) {
      var disabled = state.balance < bet ? ' disabled' : '';
      return '' +
        '<button class="chip" data-bet="' + bet + '"' + disabled + ' aria-label="رهان ' + bet + ' كوين">' +
          '<span class="chip-token">' +
            '<span class="chip-ring"></span>' +
            '<span class="chip-amount">' + fmt(bet) + '</span>' +
          '</span>' +
          '<span class="chip-cur">' + esc(cfg.CURRENCY_LABEL) + '</span>' +
        '</button>';
    }).join('');

    var custom = '';
    if (cfg.ALLOW_CUSTOM_BET && !(IG.AppBridge && IG.AppBridge.isEmbedded())) {
      custom =
        '<div class="custom-bet">' +
          '<span class="custom-label">🎯 رهان مخصّص</span>' +
          '<form id="custom-bet-form" class="custom-row" autocomplete="off">' +
            '<input id="custom-bet-input" class="custom-input" type="number" inputmode="numeric" ' +
                   'min="' + cfg.MIN_BET + '" step="1000" placeholder="مثال: ' + fmt(cfg.MIN_BET * 3) + '" aria-label="مبلغ الرهان المخصص" />' +
            '<button type="submit" class="submit-btn">ابدأ</button>' +
          '</form>' +
          '<div class="custom-hint">الحد الأدنى ' + coinHTML(cfg.MIN_BET) +
            ' — يمكنك دفع أكثر (وليس أقل)، وكلما زاد الرهان زاد الربح ×' + cfg.REWARD_MULTIPLIER + '</div>' +
          '<div class="bet-error" id="bet-error" role="alert"></div>' +
        '</div>';
    }

    var errorBanner = '';
    if (state.loadError) {
      var isDaily = global.IntelUI && global.IntelUI.isDailyLimitMessage(state.loadError);
      if (isDaily) {
        errorBanner =
          '<div class="intel-daily-inline" role="alert">' +
            '<strong>' + esc(t('dailyLimitTitle')) + '</strong>' +
            '<p>' + esc(state.loadError) + '</p>' +
            '<p class="intel-daily-inline-hint">' + esc(t('dailyLimitHint')) + '</p>' +
          '</div>';
      } else {
        errorBanner = '<div class="load-error">⚠️ ' + esc(state.loadError) + '</div>';
      }
    }

    app.innerHTML =
      header(state) +
      '<section class="screen bet-screen">' +
        '<div class="hero">' +
          '<div class="hero-emojis">🗺️ 📍 🏛️</div>' +
          '<h1 class="screen-title">خمّن المكان</h1>' +
          '<p class="screen-sub">صورة لمكان في العالم... اكتب اسم دولته خلال ' + state.challengeSeconds + ' ثوانٍ</p>' +
        '</div>' +
        errorBanner +
        '<h2 class="section-h">اختر قيمة الرهان</h2>' +
        '<div class="chips">' + chips + '</div>' +
        custom +
        '<h2 class="section-h">كيف تلعب؟</h2>' +
        rulesCard(state) +
      '</section>';
  }

  function renderLoading(state) {
    app.innerHTML =
      header(state) +
      '<section class="screen loading-screen">' +
        '<div class="spinner" aria-hidden="true"></div>' +
        '<h1 class="screen-title">جارٍ اختيار مكان...</h1>' +
        '<p class="screen-sub">نبحث عن مكان جديد لم يأتِك من قبل حول العالم</p>' +
      '</section>';
  }

  function renderChallenge(state) {
    var item = state.currentItem;
    app.innerHTML =
      '<section class="screen challenge-screen">' +
        '<div class="challenge-top">' +
          timerRingMarkup(state) +
          '<div class="challenge-meta">' +
            '<span class="type-badge">📍 أين هذا المكان؟</span>' +
            '<span class="meta-bet">الرهان ' + coinHTML(state.currentBet) + ' · ربح ×' + cfg.REWARD_MULTIPLIER + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="image-wrap" id="image-wrap">' +
          (item.type === 'streetview'
            ? '<div id="street-view" style="position:absolute; top:0; left:0; width:100%; height:100%; border-radius:inherit;"></div>'
            : '<div class="img-shine"></div><img id="challenge-img" class="challenge-img" alt="خمّن الدولة" src="' + esc(item.imageUrl) + '" onerror="this.classList.add(\'img-failed\');this.alt=\'تعذّر تحميل الصورة\';" />') +
        '</div>' +
        '<div class="mcq-grid count-' + (item.choices ? item.choices.length : 4) + '" id="mcq-grid">' +
          (item.choices ? item.choices.map(function(c) {
            return '<button class="mcq-btn" data-answer="' + esc(c) + '">' + esc(c) + '</button>';
          }).join('') : '') +
        '</div>' +
      '</section>';

    updateTimer(state);

    if (item.type === 'streetview' && typeof google !== 'undefined' && google.maps) {
      new google.maps.StreetViewPanorama($('street-view'), {
        pano: item.panoId,
        pov: { heading: 0, pitch: 0 },
        addressControl: false,
        showRoadLabels: false,
        linksControl: true,
        panControl: true,
        enableCloseButton: false,
        zoomControl: false,
        fullscreenControl: false,
        motionTracking: false,
        motionTrackingControl: false
      });
      var wrap = $('image-wrap');
      if (wrap) {
        wrap.style.padding = '0';
        wrap.style.boxShadow = 'var(--shadow)';
      }
    }
  }

  function renderResult(state) {
    var r = state.result;
    var win = r.outcome === 'WIN';
    var item = r.item;

    var confetti = win ? confettiMarkup() : '';
    var revealBlock = win ? '' :
      '<div class="reveal">' +
        '<span class="reveal-label">الإجابة الصحيحة</span>' +
        '<span class="reveal-answer">' + esc(r.correctAnswer) + '</span>' +
      '</div>';

    app.innerHTML =
      header(state) +
      '<section class="screen result-screen ' + (win ? 'is-win' : 'is-lose') + '">' +
        confetti +
        '<div class="result-badge ' + (win ? 'win' : 'lose') + '">' +
          '<div class="result-emoji">' + (win ? '🎉' : '❌') + '</div>' +
          '<h1 class="result-title">' + (win ? 'إجابة صحيحة!' : (r._timeout ? 'انتهى الوقت!' : 'إجابة خاطئة')) + '</h1>' +
        '</div>' +
        '<div class="result-thumb-wrap">' +
          '<img class="result-thumb" alt="" src="' + esc(item.imageUrl) + '" onerror="this.style.display=\'none\';" />' +
          '<div class="result-names">' +
            '<span class="result-country-ar">' + esc(item.answerAr) + '</span>' +
            '<span class="result-country-en">' + esc(item.country) + '</span>' +
            (item.title ? '<span class="result-place">📍 ' + esc(item.title) + '</span>' : '') +
          '</div>' +
        '</div>' +
        revealBlock +
        '<div class="payout">' +
          (win
            ? '<span class="payout-win">+ ' + coinHTML(r.payout) + '</span><span class="payout-note">ربح ×' + cfg.REWARD_MULTIPLIER + ' 🎯</span>'
            : '<span class="payout-lose">− ' + coinHTML(r.bet) + '</span><span class="payout-note">خسارة الرهان</span>') +
        '</div>' +
        '<div class="balance-after">رصيدك الآن: <strong>' + coinHTML(state.balance) + '</strong></div>' +
        '<div class="countdown-box small">' +
          '<span class="countdown-label">انتهت جولة اليوم — عُد غداً</span>' +
          '<span class="countdown-clock" id="blocked-countdown">' + blockedCountdownMarkup() + '</span>' +
        '</div>' +
      '</section>';
  }
    var colors = ['#ffce4f', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#fb7185'];
    var pieces = '';
    for (var i = 0; i < 24; i++) {
      var left = Math.round((i / 24) * 100);
      var delay = (Math.random() * 0.6).toFixed(2);
      var dur = (1.6 + Math.random() * 1.2).toFixed(2);
      var c = colors[i % colors.length];
      var rot = Math.round(Math.random() * 360);
      pieces += '<span class="confetti-piece" style="left:' + left + '%;' +
        'background:' + c + ';animation-delay:' + delay + 's;animation-duration:' + dur + 's;' +
        'transform:rotate(' + rot + 'deg)"></span>';
    }
    return '<div class="confetti" aria-hidden="true">' + pieces + '</div>';
  }

  // ---- Timer ring -------------------------------------------------------------
  function timerRingMarkup(state) {
    return '' +
      '<div class="timer" id="timer">' +
        '<svg class="timer-svg" viewBox="0 0 64 64" aria-hidden="true">' +
          '<circle class="timer-track" cx="32" cy="32" r="' + RING_R + '"></circle>' +
          '<circle class="timer-bar" id="timer-bar" cx="32" cy="32" r="' + RING_R + '" ' +
                  'stroke-dasharray="' + RING_C.toFixed(2) + '" stroke-dashoffset="0"></circle>' +
        '</svg>' +
        '<span class="timer-num" id="timer-num">' + Math.ceil(state.timeLeft) + '</span>' +
      '</div>';
  }

  function updateTimer(state) {
    var bar = $('timer-bar'), num = $('timer-num'), timer = $('timer');
    if (!bar || !num) return;
    var frac = Math.max(0, Math.min(1, state.timeLeft / state.challengeSeconds));
    bar.style.strokeDashoffset = (RING_C * (1 - frac)).toFixed(2);
    num.textContent = Math.ceil(Math.max(0, state.timeLeft));
    if (timer) {
      timer.classList.toggle('warn', state.timeLeft <= 5 && state.timeLeft > 3);
      timer.classList.toggle('danger', state.timeLeft <= 3);
    }
  }

  function updateBlockedCountdown() {
    var el = $('reset-countdown') || $('blocked-countdown');
    if (!el) return;
    if (global.IntelUI && typeof global.IntelUI.formatCountdownHMS === 'function') {
      var ms = global.IntelUI.getMsUntilNextReset ? global.IntelUI.getMsUntilNextReset() : 0;
      el.textContent = global.IntelUI.formatCountdownHMS(ms);
      return;
    }
    el.textContent = blockedCountdownMarkup();
  }

  // ---- Main entry -------------------------------------------------------------
  function render(state, reason) {
    if (!app) app = $('app');

    if (reason === 'tick' && state.phase === state.PHASES.CHALLENGE_ACTIVE) {
      updateTimer(state);
      return;
    }

    switch (state.phase) {
      case state.PHASES.BLOCKED_UNTIL_TOMORROW: renderBlocked(state); break;
      case state.PHASES.BET_SELECT: renderBetSelect(state); break;
      case state.PHASES.CHALLENGE_LOADING: renderLoading(state); break;
      case state.PHASES.CHALLENGE_ACTIVE: renderChallenge(state); break;
      case state.PHASES.RESULT: renderResult(state); break;
      default: app.innerHTML = header(state) + '<section class="screen"><p class="screen-sub">جارٍ التحميل...</p></section>';
    }
  }

  // Lets input.js show a validation message under the custom-bet field.
  function showBetError(msg) {
    var el = $('bet-error');
    if (el) el.textContent = msg || '';
  }

  Game.render = {
    render: render,
    updateBlockedCountdown: updateBlockedCountdown,
    showBetError: showBetError
  };

})(typeof window !== 'undefined' ? window : this);
