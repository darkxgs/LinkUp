/**
 * عملة LinkUp الموحّدة — نفس أيقونة التطبيق (coin-gold.png)
 */
(function (global) {
  'use strict';

  var COIN_URL = '/images/coin-gold.png?v=4';
  var COIN_LABEL_AR = 'كوين';
  var COIN_LABEL_EN = 'Coin';

  function label() {
    return global.IntelI18n && global.IntelI18n.getLang() === 'en' ? COIN_LABEL_EN : COIN_LABEL_AR;
  }

  function fmt(n) {
    return Math.floor(Number(n) || 0).toLocaleString('en-US');
  }

  function img(size) {
    size = size || 18;
    return '<img class="lu-coin-icon" src="' + COIN_URL + '" alt="' + label() + '" width="' + size + '" height="' + size + '" loading="lazy" decoding="async" style="object-fit:contain;vertical-align:middle;display:inline-block;" onerror="this.style.display=\'none\'" />';
  }

  function formatAmount(amount, size) {
    return '<span class="lu-coin-wrap">' + img(size) + '<span class="lu-coin-amount">' + fmt(amount) + '</span></span>';
  }

  function formatAmountWithLabel(amount, size) {
    return formatAmount(amount, size) + ' <span class="lu-coin-label">' + label() + '</span>';
  }

  function injectContainers() {
    var coinHtml = img(20);
    global.document.querySelectorAll('.wallet-coin-container, .btn-coin-container, .custom-coin-container').forEach(function (el) {
      el.innerHTML = coinHtml;
    });
  }

  global.IntelCoins = {
    COIN_URL: COIN_URL,
    label: label,
    fmt: fmt,
    img: img,
    formatAmount: formatAmount,
    formatAmountWithLabel: formatAmountWithLabel,
    injectContainers: injectContainers,
  };
})(typeof window !== 'undefined' ? window : this);
