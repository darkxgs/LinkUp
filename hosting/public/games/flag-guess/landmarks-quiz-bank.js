/**
 * بنك أسئلة خمّن المعلم — محلي، صور حقيقية، بدون Wikidata
 */
(function (global) {
  var BANK_URL = 'landmarks-quiz-bank.json';
  var _bank = null;
  var _promise = null;
  var _recentIds = [];
  var _localFiles = null;
  var _manifestPromise = null;

  function loadLocalManifest() {
    if (_localFiles) return Promise.resolve(_localFiles);
    if (_manifestPromise) return _manifestPromise;
    _manifestPromise = fetch('assets/landmarks/manifest.json', { cache: 'default' })
      .then(function (res) {
        if (!res.ok) return { files: [] };
        return res.json();
      })
      .then(function (data) {
        _localFiles = new Set((data && data.files) || []);
        return _localFiles;
      })
      .catch(function () {
        _localFiles = new Set();
        return _localFiles;
      });
    return _manifestPromise;
  }

  function hasLocalImage(item) {
    if (!item || !item.slug) return false;
    if (!_localFiles || !_localFiles.size) return !!item.localImage;
    return _localFiles.has(item.slug + '.jpg');
  }

  function cleanName(name) {
    return String(name || '').replace(/\s*\(\d+\)\s*$/, '').trim();
  }

  function loadBank() {
    if (_bank) return Promise.resolve(_bank);
    if (_promise) return _promise;
    _promise = fetch(BANK_URL, { cache: 'default' })
      .then(function (res) {
        if (!res.ok) throw new Error('bank ' + res.status);
        return res.json();
      })
      .then(function (data) {
        _bank = data;
        if (!_bank.items || !_bank.items.length) throw new Error('empty bank');
        if (global.FlagGuessMedia && typeof global.FlagGuessMedia.preloadBankItems === 'function') {
          global.FlagGuessMedia.preloadBankItems(_bank.items, 20);
        }
        return _bank;
      })
      .catch(function (e) {
        _promise = null;
        throw e;
      });
    return _promise;
  }

  function pickWrong(correct, count, strategy) {
    var all = (_bank.countries || []).filter(function (c) {
      return c !== correct;
    });
    var pool = all;
    if (strategy === 'region') {
      var region = null;
      var item = (_bank.items || []).find(function (x) {
        return x.countryAr === correct;
      });
      if (item && item.region && _bank.regions && _bank.regions[item.region]) {
        var regional = _bank.regions[item.region].filter(function (c) {
          return c !== correct;
        });
        if (regional.length >= count) pool = regional;
      }
    }
    var wrong = [];
    var tries = 0;
    while (wrong.length < count && pool.length && tries < 80) {
      tries += 1;
      var pick = pool[Math.floor(Math.random() * pool.length)];
      if (!wrong.includes(pick)) wrong.push(pick);
    }
    return wrong;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function pickItem(tier) {
    var pool = (_bank.items || []).filter(function (x) {
      if (_recentIds.indexOf(x.id) >= 0) return false;
      if (!hasLocalImage(x)) return false;
      if (!tier) return true;
      return (x.tier || 1) <= tier + 1;
    });
    if (!pool.length) {
      pool = (_bank.items || []).filter(function (x) {
        return hasLocalImage(x);
      });
    }
    if (!pool.length) {
      _recentIds = [];
      pool = (_bank.items || []).slice();
    }
    var item = pool[Math.floor(Math.random() * pool.length)];
    _recentIds.push(item.id);
    if (_recentIds.length > 24) _recentIds.shift();
    return item;
  }

  function fetchRound(opts) {
    opts = opts || {};
    var tier = opts.tier || 1;
    var optionCount = Math.max(2, Math.min(6, opts.optionCount || 4));
    var strategy = opts.wrongStrategy || (tier >= 3 ? 'region' : 'random');

    return Promise.all([loadBank(), loadLocalManifest()]).then(function () {
      var item = pickItem(tier);
      var wrongCount = optionCount - 1;
      var wrong = pickWrong(item.countryAr, wrongCount, strategy);
      var options = shuffle([item.countryAr].concat(wrong));
      return {
        type: 'landmark',
        landmarkName: item.landmarkName,
        nameAr: item.countryAr,
        imageUrl: item.imageUrl,
        localImage: item.localImage,
        slug: item.slug,
        options: options,
        provider: 'local-bank',
        attribution: _bank.attribution || '',
        bankId: item.id,
      };
    });
  }

  function loadCountries() {
    return loadBank().then(function () {
      return (_bank.countries || []).slice();
    });
  }

  function renderRound(viewport, item, options) {
    if (!viewport || !item) return;
    if (global.FlagGuessMedia && typeof global.FlagGuessMedia.render === 'function') {
      global.FlagGuessMedia.render(viewport, item, options);
      return;
    }
    viewport.innerHTML = '';
    var img = document.createElement('img');
    img.className = 'landmark-img';
    img.alt = item.landmarkName || 'معلم';
    img.referrerPolicy = 'no-referrer';
    img.src = item.imageUrl || '';
    img.onerror = function () {
      this.src =
        'data:image/svg+xml,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260"><rect fill="#1a1030" width="100%" height="100%"/><text x="50%" y="50%" fill="#a78bfa" font-size="16" text-anchor="middle" font-family="sans-serif">تعذّر تحميل الصورة</text></svg>',
        );
    };
    viewport.appendChild(img);
  }

  global.LandmarksQuizBank = {
    loadBank: loadBank,
    fetchRound: fetchRound,
    loadCountries: loadCountries,
    renderRound: renderRound,
    cleanName: cleanName,
  };
})(typeof window !== 'undefined' ? window : globalThis);
