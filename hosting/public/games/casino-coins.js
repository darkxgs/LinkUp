/**
 * عملة LinkUp للكازينو — أيقونة coin-gold.png الموحّدة
 */
(function (global) {
  'use strict';

  var COIN_VER = '4';
  var observerStarted = false;

  function getCoinUrl() {
    if (global.__LU_COIN_URL) return global.__LU_COIN_URL;
    var origin = global.location && global.location.origin ? global.location.origin : '';
    global.__LU_COIN_URL = origin + '/images/coin-gold.png?v=' + COIN_VER;
    return global.__LU_COIN_URL;
  }

  function label() {
    if (global.CasinoI18n && typeof global.CasinoI18n.t === 'function') {
      return global.CasinoI18n.t('currency');
    }
    return global.CasinoI18n && global.CasinoI18n.getLang && global.CasinoI18n.getLang() === 'en'
      ? 'Coins'
      : 'كوين';
  }

  function isEmbedded() {
    return !!(global.CasinoBridge && global.CasinoBridge.isEmbedded());
  }

  function fmt(n) {
    return Math.floor(Number(n) || 0).toLocaleString('en-US');
  }

  /** تنسيق المبلغ: كوينز صحيحة في التطبيق، عشري في الديمو */
  function fmtAmount(n, demoDecimals) {
    if (isEmbedded()) return fmt(n);
    return Number(n).toFixed(demoDecimals == null ? 8 : demoDecimals);
  }

  function fmtInput(n) {
    if (isEmbedded()) return String(Math.floor(Number(n) || 0));
    return Number(n).toFixed(8);
  }

  function coinFallbackSvg(size) {
    size = size || 18;
    return (
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24">' +
        '<circle cx="12" cy="12" r="11" fill="#F5B301" stroke="#C8960C" stroke-width="1"/>' +
        '<text x="12" y="16" text-anchor="middle" font-size="11" font-weight="bold" fill="#5C3D00">C</text></svg>'
      )
    );
  }

  function img(size) {
    size = size || 18;
    var url = getCoinUrl();
    var fb = coinFallbackSvg(size);
    return (
      '<img class="lu-coin-icon" src="' + url + '" alt="' + label() + '" width="' + size + '" height="' + size + '"' +
      ' loading="lazy" decoding="async" style="object-fit:contain;vertical-align:middle;display:inline-block;flex-shrink:0;"' +
      " onerror=\"this.onerror=null;this.src='" + fb + "'\" />"
    );
  }

  function formatAmount(amount, size) {
    return (
      '<span class="lu-coin-wrap" style="display:inline-flex;align-items:center;gap:4px;">' +
      '<span class="lu-coin-amount">' + fmt(amount) + '</span>' +
      img(size) +
      '</span>'
    );
  }

  function formatAmountWithLabel(amount, size) {
    return formatAmount(amount, size) + ' <span class="lu-coin-label">' + label() + '</span>';
  }

  function hideFiatHints() {
    global.document.querySelectorAll('.fiat, [data-fiat-hint], .usd-conversion, [data-usd-hint]').forEach(function (el) {
      el.style.display = 'none';
    });
  }

  function hideStablecoinArt() {
    global.document.querySelectorAll('svg[data-ds-icon], svg[data-ds-icon="USDC"]').forEach(function (el) {
      var wrap = el.closest('.badge-profit-row, .payout-result, .currency-icon, [data-embed-hide]');
      if (wrap) wrap.style.display = 'none';
      else el.style.display = 'none';
    });
  }

  function replaceCoinSlots() {
    global.document.querySelectorAll('.coin, .coin-sm, .coin-input, .in-coin').forEach(function (el) {
      if (el.tagName === 'IMG' || el.classList.contains('lu-coin-slot')) return;
      var size = el.classList.contains('coin-sm') ? 14 : el.classList.contains('coin-input') ? 16 : 18;
      el.innerHTML = img(size);
      el.classList.add('lu-coin-slot');
      el.style.background = 'transparent';
      el.style.color = 'transparent';
      el.style.borderRadius = '0';
    });
  }

  function dedupeBalanceIcons() {
    global.document.querySelectorAll('.balance-box, .balance-wrap, .wallet-amount').forEach(function (box) {
      var wrap = box.querySelector('.lu-coin-wrap');
      if (!wrap) return;
      box.querySelectorAll('.coin-sm.lu-coin-slot, .coin.lu-coin-slot').forEach(function (extra) {
        if (extra !== wrap.querySelector('.lu-coin-icon') && !wrap.contains(extra)) {
          extra.style.display = 'none';
        }
      });
    });
  }

  /** يخفي $ ويستبدل رموز العملة بأيقونة الكوين في وضع التطبيق */
  function applyEmbedCoinUI() {
    if (!isEmbedded()) return;
    hideFiatHints();
    hideStablecoinArt();
    replaceCoinSlots();
    dedupeBalanceIcons();
    var bal = global.document.querySelector('[data-balance-label]');
    if (bal) bal.textContent = global.CasinoI18n ? global.CasinoI18n.t('yourBalance') : 'رصيدك الحالي';
    global.document.documentElement.classList.add('linkup-embed');
  }

  function startObserver() {
    if (!isEmbedded() || observerStarted || !global.MutationObserver || !global.document.body) return;
    observerStarted = true;
    var timer = null;
    var obs = new global.MutationObserver(function () {
      if (timer) return;
      timer = global.setTimeout(function () {
        timer = null;
        applyEmbedCoinUI();
      }, 80);
    });
    obs.observe(global.document.body, { childList: true, subtree: true, characterData: true });
  }

  function installBridgeHooks(refreshFn) {
    var prev = global.onCasinoBridgeReady;
    global.onCasinoBridgeReady = function (state) {
      applyEmbedCoinUI();
      startObserver();
      if (typeof prev === 'function') prev(state);
      if (typeof refreshFn === 'function') refreshFn(state);
      applyEmbedCoinUI();
    };
    if (isEmbedded()) {
      var run = function () {
        applyEmbedCoinUI();
        startObserver();
        if (typeof refreshFn === 'function') refreshFn();
      };
      if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', run);
      } else {
        run();
      }
    }
  }

  global.CasinoCoins = {
    COIN_URL: getCoinUrl(),
    label: label,
    fmt: fmt,
    fmtAmount: fmtAmount,
    fmtInput: fmtInput,
    img: img,
    formatAmount: formatAmount,
    formatAmountWithLabel: formatAmountWithLabel,
    applyEmbedCoinUI: applyEmbedCoinUI,
    startObserver: startObserver,
    installBridgeHooks: installBridgeHooks,
    isEmbedded: isEmbedded,
  };
})(typeof window !== 'undefined' ? window : this);
