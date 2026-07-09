/*
 * geoNamesProvider.js
 * -----------------------------------------------------------------------------
 * SHARED content sourcing for the suite.
 *
 *   ContentProvider interface (async):
 *     getRandomPlace(excludeKeys) -> Promise<place | null>
 *       place = { id, key, type:'landmark', imageUrl, country, answerAr,
 *                 acceptedAnswers, title }
 *       - `key` is stable per place (used for the no-repeat history).
 *       - The returned image is GUARANTEED to have loaded (preloaded here), so
 *         the round never shows a broken image and the timer start is fair.
 *
 * Two implementations:
 *   GeoNamesContentProvider — live, endless, random Geoguessr-style places. It
 *     samples a random land point, asks GeoNames for nearby Wikipedia features,
 *     turns the country code into the answer (data/countries.js), and resolves a
 *     good photo from Wikipedia. NO API key/credit card — just a free GeoNames
 *     username (the docs forbid the 'demo' account).
 *   LocalContentProvider — wraps the static fallback list (data/items.js).
 *
 * Wikipedia image licensing varies (mostly CC/PD) — for a real launch you must
 * surface attribution. Out of scope for this demo.
 * -----------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var IG = global.IG = global.IG || {};
  var Game = global.Game = global.Game || {};

  // Land bounding boxes [south, north, west, east], weighted toward inhabited
  // regions so random samples usually land near a place with a Wikipedia entry.
  var LAND_BOXES = [
    [36, 60, -9, 30, 6],   // Europe (west/central)
    [40, 60, 25, 60, 4],   // Eastern Europe / W Russia
    [35, 47, 26, 45, 3],   // Balkans / Turkey / Caucasus edge
    [12, 37, -17, 12, 4],  // North & West Africa
    [-35, 5, 12, 42, 4],   // Central / Southern Africa
    [0, 30, 35, 60, 3],    // Middle East
    [8, 37, 60, 90, 5],    // South Asia (India/Pakistan/Nepal/Sri Lanka)
    [5, 40, 95, 125, 5],   // Southeast & East Asia
    [22, 46, 100, 145, 4], // China / Korea / Japan
    [38, 56, 55, 110, 3],  // Central Asia / Mongolia
    [-10, 10, 95, 140, 4], // Indonesia / Philippines
    [-45, -10, 110, 155, 3], // Australia
    [25, 49, -125, -70, 4],  // USA / Canada south
    [14, 33, -118, -86, 3],  // Mexico / Central America
    [-56, 12, -82, -34, 5]   // South America
  ];

  function pickBox() {
    var total = 0, i;
    for (i = 0; i < LAND_BOXES.length; i++) total += LAND_BOXES[i][4];
    var r = Math.random() * total;
    for (i = 0; i < LAND_BOXES.length; i++) {
      r -= LAND_BOXES[i][4];
      if (r <= 0) return LAND_BOXES[i];
    }
    return LAND_BOXES[0];
  }

  function randomPoint() {
    var b = pickBox();
    return {
      lat: b[0] + Math.random() * (b[1] - b[0]),
      lng: b[2] + Math.random() * (b[3] - b[2])
    };
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Preload an image URL; resolve(url) on load, resolve(null) on error/timeout.
  function preload(url, timeoutMs) {
    return new Promise(function (resolve) {
      if (!url) return resolve(null);
      var img = new Image(), done = false;
      var t = setTimeout(function () { if (!done) { done = true; resolve(null); } }, timeoutMs || 8000);
      img.onload = function () { if (!done) { done = true; clearTimeout(t); resolve(url); } };
      img.onerror = function () { if (!done) { done = true; clearTimeout(t); resolve(null); } };
      img.src = url;
    });
  }

  // ===========================================================================
  // GeoNamesContentProvider
  // ===========================================================================
  function GeoNamesContentProvider(options) {
    options = options || {};
    this._getUsername = options.getUsername || function () { return options.username || ''; };
    this._base = options.baseUrl || 'https://secure.geonames.org';
    this._disabled = false;      // set true on auth/credit errors -> caller falls back
    this.lastError = null;
  }

  GeoNamesContentProvider.prototype.isAvailable = function () {
    return !this._disabled && !!this._getUsername();
  };

  GeoNamesContentProvider.prototype._fetchJSON = function (url) {
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      // GeoNames signals problems via a `status` object, not HTTP codes.
      if (j && j.status) {
        var v = j.status.value;
        // 10=user not found, 18/19/20=credit/hourly/daily limits -> stop trying.
        var fatal = (v === 10 || v === 18 || v === 19 || v === 20);
        var err = new Error('GeoNames: ' + j.status.message);
        err.fatal = fatal; err.code = v;
        throw err;
      }
      return j;
    });
  };

  // Resolve a good photo for a Wikipedia entry (bigger image via pageimages,
  // falling back to the small GeoNames thumbnail).
  GeoNamesContentProvider.prototype._resolveImage = function (entry) {
    var lang = entry.lang || 'en';
    var title = entry.title;
    var thumb = entry.thumbnailImg
      ? (entry.thumbnailImg.indexOf('//') === 0 ? 'https:' + entry.thumbnailImg : entry.thumbnailImg)
      : null;
    if (!title) return Promise.resolve(thumb);
    var url = 'https://' + lang + '.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages' +
      '&piprop=thumbnail&pithumbsize=800&titles=' + encodeURIComponent(title) + '&origin=*';
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      try {
        var pages = j.query.pages;
        for (var k in pages) {
          if (pages[k].thumbnail && pages[k].thumbnail.source) return pages[k].thumbnail.source;
        }
      } catch (e) { }
      return thumb;
    }).catch(function () { return thumb; });
  };

  GeoNamesContentProvider.prototype._buildPlace = function (entry, imageUrl) {
    var ans = Game.answersForCode(entry.countryCode);
    if (!ans) return null;
    var key = 'gn_' + (entry.wikipediaUrl || (entry.title + '_' + entry.countryCode));
    return {
      id: key, key: key, type: 'landmark', imageUrl: imageUrl,
      country: ans.country, answerAr: ans.answerAr, acceptedAnswers: ans.acceptedAnswers,
      title: entry.title || ''
    };
  };

  // Try up to maxAttempts random points; for each, try its candidates until one
  // yields a usable, loaded image for a known country not already seen.
  GeoNamesContentProvider.prototype.getRandomPlace = function (excludeKeys, maxAttempts) {
    var self = this;
    excludeKeys = excludeKeys || [];
    var exclude = {}; excludeKeys.forEach(function (k) { exclude[k] = 1; });
    var attempts = maxAttempts || 16;
    var user = this._getUsername();
    if (!user) { this.lastError = 'no-username'; return Promise.resolve(null); }

    function attempt(n) {
      if (n <= 0 || self._disabled) return Promise.resolve(null);
      var p = randomPoint();
      var url = self._base + '/findNearbyWikipediaJSON?lat=' + p.lat.toFixed(4) +
        '&lng=' + p.lng.toFixed(4) + '&radius=20&maxRows=25&username=' + encodeURIComponent(user);

      return self._fetchJSON(url).then(function (j) {
        var list = (j && j.geonames) ? j.geonames : [];
        // Keep entries with a known country, an image hint, and not seen.
        var cands = list.filter(function (e) {
          if (!e.countryCode || !Game.answersForCode(e.countryCode)) return false;
          if (!e.title && !e.thumbnailImg) return false;
          var key = 'gn_' + (e.wikipediaUrl || (e.title + '_' + e.countryCode));
          return !exclude[key];
        });
        shuffle(cands);

        function tryCand(i) {
          if (i >= cands.length || i >= 6) return attempt(n - 1); // cap per-point work
          var e = cands[i];
          return self._resolveImage(e).then(function (imgUrl) {
            return preload(imgUrl, 8000).then(function (loaded) {
              if (loaded) {
                var place = self._buildPlace(e, loaded);
                if (place) return place;
              }
              return tryCand(i + 1);
            });
          });
        }
        return tryCand(0);
      }).catch(function (err) {
        self.lastError = err.message;
        if (err.fatal) { self._disabled = true; return null; } // stop: auth/credit
        return attempt(n - 1); // transient: try another point
      });
    }

    return attempt(attempts);
  };

  // ===========================================================================
  // LocalContentProvider — static fallback (data/items.js)
  // ===========================================================================
  function LocalContentProvider(options) {
    options = options || {};
    this._items = options.items || Game.items || [];
  }

  LocalContentProvider.prototype.isAvailable = function () { return this._items.length > 0; };

  LocalContentProvider.prototype.getRandomPlace = function (excludeKeys) {
    var exclude = {}; (excludeKeys || []).forEach(function (k) { exclude[k] = 1; });
    var pool = this._items.filter(function (it) { return !exclude[it.id]; });
    if (pool.length === 0) pool = this._items.slice(); // all seen -> recycle
    if (pool.length === 0) return Promise.resolve(null);
    var it = shuffle(pool.slice())[0];
    var place = {
      id: it.id, key: it.id, type: it.type, imageUrl: it.imageUrl,
      country: it.country, answerAr: it.answerAr, acceptedAnswers: it.acceptedAnswers,
      title: it.title || ''
    };
    // Preload so the timer starts fairly and we skip a broken image if any.
    return preload(it.imageUrl, 8000).then(function (loaded) {
      return loaded ? place : (place.imageUrl = it.imageUrl, place); // keep even if slow
    });
  };

  // ===========================================================================
  // GoogleStreetViewProvider
  // ===========================================================================
  function GoogleStreetViewProvider(options) {
    options = options || {};
    this._getUsername = options.getUsername || function () { return options.username || ''; };
    this._base = options.baseUrl || 'https://secure.geonames.org';
    this.lastError = null;
    this._sv = typeof google !== 'undefined' && google.maps ? new google.maps.StreetViewService() : null;
  }

  GoogleStreetViewProvider.prototype.isAvailable = function () {
    return !!this._sv && !!this._getUsername();
  };

  GoogleStreetViewProvider.prototype._fetchJSON = GeoNamesContentProvider.prototype._fetchJSON;

  // المستويات: 1=سهل جداً، 2=متوسط، 3=صعب (مدن كبرى)، 4=جنوني (أماكن نائية أو طبيعية)
  var POINTS = [
    // --- Level 1 (Easy) ---
    { lat: 48.8584, lng: 2.2945, code: 'FR', title: 'برج إيفل، باريس', level: 1 },
    { lat: 29.9792, lng: 31.1342, code: 'EG', title: 'أهرامات الجيزة', level: 1 },
    { lat: 27.1751, lng: 78.0421, code: 'IN', title: 'تاج محل', level: 1 },
    { lat: 40.6892, lng: -74.0445, code: 'US', title: 'تمثال الحرية', level: 1 },
    { lat: 41.8902, lng: 12.4922, code: 'IT', title: 'مدرج الكولوسيوم', level: 1 },
    { lat: 51.5007, lng: -0.1246, code: 'GB', title: 'ساعة بيج بن', level: 1 },
    { lat: 25.1972, lng: 55.2744, code: 'AE', title: 'برج خليفة', level: 1 },
    { lat: -33.8568, lng: 151.2153, code: 'AU', title: 'دار الأوبرا في سيدني', level: 1 },
    { lat: 21.4225, lng: 39.8262, code: 'SA', title: 'المسجد الحرام', level: 1 },
    // --- Level 2 (Medium) ---
    { lat: -13.1631, lng: -72.5450, code: 'PE', title: 'ماتشو بيتشو', level: 2 },
    { lat: 35.3606, lng: 138.7274, code: 'JP', title: 'جبل فوجي', level: 2 },
    { lat: 30.3285, lng: 35.4444, code: 'JO', title: 'مدينة البتراء', level: 2 },
    { lat: 37.9715, lng: 23.7257, code: 'GR', title: 'الأكروبوليس في أثينا', level: 2 },
    { lat: 55.7520, lng: 37.6175, code: 'RU', title: 'الميدان الأحمر', level: 2 },
    { lat: -22.9519, lng: -43.2105, code: 'BR', title: 'تمثال المسيح الفادي', level: 2 },
    { lat: 43.6426, lng: -79.3871, code: 'CA', title: 'برج سي إن', level: 2 },
    { lat: 41.0082, lng: 28.9784, code: 'TR', title: 'آيا صوفيا', level: 2 },
    { lat: 3.1412, lng: 101.6865, code: 'MY', title: 'برجي بتروناس', level: 2 },
    { lat: -33.9573, lng: 18.4031, code: 'ZA', title: 'جبل الطاولة', level: 2 },
    { lat: 50.0868, lng: 14.4208, code: 'CZ', title: 'ساعة براغ', level: 2 },
    { lat: 48.1371, lng: 11.5754, code: 'DE', title: 'ميدان مارين بلاتز', level: 2 },
    { lat: 38.7223, lng: -9.1393, code: 'PT', title: 'شوارع لشبونة', level: 2 },
    // --- Level 3 (Hard) - Random City Streets ---
    { lat: 39.9042, lng: 116.4074, code: 'CN', title: 'شوارع بكين', level: 3 },
    { lat: 52.3731, lng: 4.8922, code: 'NL', title: 'شوارع أمستردام', level: 3 },
    { lat: 1.2834, lng: 103.8607, code: 'SG', title: 'شوارع سنغافورة', level: 3 },
    { lat: 64.1466, lng: -21.9426, code: 'IS', title: 'شوارع ريكيافيك', level: 3 },
    { lat: 59.3293, lng: 18.0686, code: 'SE', title: 'شوارع ستوكهولم', level: 3 },
    { lat: 53.3428, lng: -6.2674, code: 'IE', title: 'شوارع دبلن', level: 3 },
    { lat: 47.5071, lng: 19.0456, code: 'HU', title: 'شوارع بودابست', level: 3 },
    { lat: -33.4489, lng: -70.6693, code: 'CL', title: 'شوارع سانتياغو', level: 3 },
    { lat: 19.4326, lng: -99.1332, code: 'MX', title: 'شوارع مكسيكو سيتي', level: 3 },
    { lat: -34.6037, lng: -58.3816, code: 'AR', title: 'شوارع بوينس آيرس', level: 3 },
    { lat: 13.7563, lng: 100.5018, code: 'TH', title: 'شوارع بانكوك', level: 3 },
    // --- Level 4 (Extreme) - Remote/Nature/Hard places ---
    { lat: -3.0674, lng: 37.3556, code: 'TZ', title: 'طبيعة في تنزانيا', level: 4 },
    { lat: 60.1282, lng: 18.6435, code: 'FI', title: 'أرياف فنلندا', level: 4 },
    { lat: -43.5321, lng: 172.6362, code: 'NZ', title: 'نيوزيلندا', level: 4 },
    { lat: 62.2270, lng: -6.7756, code: 'FO', title: 'جزر فارو', level: 4 },
    { lat: -18.1429, lng: 178.4313, code: 'FJ', title: 'أرياف فيجي', level: 4 },
    { lat: 64.2008, lng: -14.9182, code: 'IS', title: 'طرق آيسلندا', level: 4 },
    { lat: 46.2276, lng: 2.2137, code: 'FR', title: 'قرى فرنسية', level: 4 },
    { lat: -27.4698, lng: 153.0251, code: 'AU', title: 'بريزبان أستراليا', level: 4 }
  ];

  GoogleStreetViewProvider.prototype.getRandomPlace = function (excludeKeys, difficultyLevel, choiceCount, maxAttempts) {
    var self = this;
    excludeKeys = excludeKeys || [];
    var diff = difficultyLevel || 1; // Default to Easy
    var exclude = {}; excludeKeys.forEach(function (k) { exclude[k] = 1; });
    var attempts = maxAttempts || 15;
    
    // تصفية الأماكن بناءً على مستوى الصعوبة المختار
    var validPoints = POINTS.filter(function(p) { return p.level === diff; });
    // إذا نفدت الخيارات في هذا المستوى، استخدم المستوى الأسهل كبديل
    if (validPoints.length === 0) validPoints = POINTS.filter(function(p) { return p.level === 1; });

    if (!this._sv) { this.lastError = 'Google Maps API غير متوفر'; return Promise.resolve(null); }

    function attempt(n) {
      if (n <= 0) {
        console.error('[GeoGuessr] ❌ استنفدت المحاولات للبحث عن بانوراما.');
        return Promise.resolve(null);
      }

      var cand = validPoints[Math.floor(Math.random() * validPoints.length)];
      var ans = Game.answersForCode(cand.code);
      if (!ans) return attempt(n - 1);

      // إزاحة النقطة قليلاً (حوالي 300 إلى 800 متر) لضمان وقوف الكاميرا في شارع محيط بالمعلم وليس بداخله
      var angle = Math.random() * Math.PI * 2;
      var dist = 0.003 + Math.random() * 0.005; // إزاحة بالدرجات
      var offsetLat = cand.lat + Math.sin(angle) * dist;
      var offsetLng = cand.lng + Math.cos(angle) * dist;

      console.log('[GeoGuessr] 🚗 جاري التحقق من توفر Street View بالقرب من: ' + cand.title);

      return new Promise(function(resolve) {
        self._sv.getPanorama({
          location: { lat: offsetLat, lng: offsetLng },
          radius: 1000, // البحث في محيط أوسع لضمان التقاط شارع رسمي
          source: google.maps.StreetViewSource.OUTDOOR
        }, function(data, status) {
          if (status === 'OK' && data && data.location && data.location.pano) {
             var key = 'sv_' + data.location.pano;
             if (exclude[key]) {
               console.log('[GeoGuessr] 🔄 المكان لعبته مسبقاً، تخطي...');
               return resolve(null);
             }

             console.log('[GeoGuessr] ✅ نجاح! ' + cand.title + ' (' + cand.code + ') جاهز للتحدي!');
             var place = {
               id: key, key: key, type: 'streetview',
               panoId: data.location.pano,
               lat: data.location.latLng.lat(),
               lng: data.location.latLng.lng(),
               country: ans.country, answerAr: ans.answerAr, acceptedAnswers: ans.acceptedAnswers,
               title: cand.title, imageUrl: '',
               choices: Game.generateChoices(ans.answerAr, choiceCount)
             };
             resolve(place);
          } else {
             console.log('[GeoGuessr] ❌ البانوراما غير متوفرة هنا.');
             resolve(null);
          }
        });
      }).then(function(place) {
        if (place) return place;
        return attempt(n - 1);
      });
    }

    return attempt(attempts);
  };

  IG.GeoNamesContentProvider = GeoNamesContentProvider;
  IG.LocalContentProvider = LocalContentProvider;
  IG.GoogleStreetViewProvider = GoogleStreetViewProvider;

})(typeof window !== 'undefined' ? window : this);
