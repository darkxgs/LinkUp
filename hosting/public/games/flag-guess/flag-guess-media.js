/**
 * صور خمّن المعلم — محلية أولاً (Firebase Hosting)، Wikimedia احتياطي فقط
 */
(function (global) {
  var W = 640;
  var PRELOADED = Object.create(null);

  var LANDMARK_PHOTOS = {
    'برج إيفل': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Tour_eiffel_at_sunrise_from_the_trocadero.jpg/' + W + 'px-Tour_eiffel_at_sunrise_from_the_trocadero.jpg',
    'تاج محل': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Taj_Mahal%2C_Agra%2C_India_edited.jpg/' + W + 'px-Taj_Mahal%2C_Agra%2C_India_edited.jpg',
    'تمثال الحرية': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Statue_of_Liberty_7.jpg/' + W + 'px-Statue_of_Liberty_7.jpg',
    'الأهرامات': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Kheops-Pyramid.jpg/' + W + 'px-Kheops-Pyramid.jpg',
    'أهرامات الجيزة': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Kheops-Pyramid.jpg/' + W + 'px-Kheops-Pyramid.jpg',
    'سور الصين العظيم': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/The_Great_Wall_of_China_at_Jinshanling-edit.jpg/' + W + 'px-The_Great_Wall_of_China_at_Jinshanling-edit.jpg',
    'برج خليفة': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Burj_Khalifa.jpg/' + W + 'px-Burj_Khalifa.jpg',
    'برج خليفة دبي': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Burj_Khalifa.jpg/' + W + 'px-Burj_Khalifa.jpg',
    'الكولوسيوم': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Colosseo_2020.jpg/' + W + 'px-Colosseo_2020.jpg',
    'ماتشو بيتشو': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Machu_Picchu%2C_Peru.jpg/' + W + 'px-Machu_Picchu%2C_Peru.jpg',
    'ساعة بيغ بن': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Clock_Tower_-_Palace_of_Westminster%2C_London_-_May_2007.jpg/' + W + 'px-Clock_Tower_-_Palace_of_Westminster%2C_London_-_May_2007.jpg',
    'دار أوبرا سيدني': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Sydney_Opera_House_Spitfire_over_flight.jpg/' + W + 'px-Sydney_Opera_House_Spitfire_over_flight.jpg',
    'برج بيزا المائل': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/The_Leaning_Tower_of_Pisa_SB.jpeg/' + W + 'px-The_Leaning_Tower_of_Pisa_SB.jpeg',
    'البتراء': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Al_Khazneh_Petra_edit_2.jpg/' + W + 'px-Al_Khazneh_Petra_edit_2.jpg',
    'المسجد الأقصى': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Al-Aqsa_Mosque.jpg/' + W + 'px-Al-Aqsa_Mosque.jpg',
    'قبة الصخرة': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Dome_of_the_Rock_02.jpg/' + W + 'px-Dome_of_the_Rock_02.jpg',
    'الكعبة المشرفة': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Kaaba_mirror_edit_jjron_00.jpg/' + W + 'px-Kaaba_mirror_edit_jjron_00.jpg',
    'جامع الشيخ زايد': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Sheikh_Zayed_Mosque%2C_Abu_Dhabi%2C_UAE.jpg/' + W + 'px-Sheikh_Zayed_Mosque%2C_Abu_Dhabi%2C_UAE.jpg',
    'مسجد السلطان أحمد': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Blue_Mosque%2C_Istanbul%2C_Turkey.jpg/' + W + 'px-Blue_Mosque%2C_Istanbul%2C_Turkey.jpg',
    'مسجد آيا صوفيا': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Hagia_Sophia_Mars_2013.jpg/' + W + 'px-Hagia_Sophia_Mars_2013.jpg',
    'جبل فوتجي': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/080103_hiru_fuji_sanzenjuroku_ichi.jpg/' + W + 'px-080103_hiru_fuji_sanzenjuroku_ichi.jpg',
    'جبل فوجي': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/080103_hiru_fuji_sanzenjuroku_ichi.jpg/' + W + 'px-080103_hiru_fuji_sanzenjuroku_ichi.jpg',
    'تمثال المسيح الفادي': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Christ_the_Redeemer_-_Cristo_Redentor.jpg/' + W + 'px-Christ_the_Redeemer_-_Cristo_Redentor.jpg',
    'بوابة براندنبورغ': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Brandenburger_Tor_abends.jpg/' + W + 'px-Brandenburger_Tor_abends.jpg',
    'جسر البوابة الذهبية': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/GoldenGateBridge-001.jpg/' + W + 'px-GoldenGateBridge-001.jpg',
    'ستونهنج': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Stonehenge2007_07_30.jpg/' + W + 'px-Stonehenge2007_07_30.jpg',
    'متحف اللوفر': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Louvre_Museum_Wikimedia_Commons.jpg/' + W + 'px-Louvre_Museum_Wikimedia_Commons.jpg',
    'قصر الكرملين': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Moscow_Kremlin%2C_Russia.jpg/' + W + 'px-Moscow_Kremlin%2C_Russia.jpg',
    'جامع القرويين': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Mosque_of_Al-Quaraouiyine.jpg/' + W + 'px-Mosque_of_Al-Quaraouiyine.jpg',
    'أبراج الكويت': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Kuwait_Towers.jpg/' + W + 'px-Kuwait_Towers.jpg',
    'قصر فرساي': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Chateau_de_Versailles.jpg/' + W + 'px-Chateau_de_Versailles.jpg',
    'معبد البارثينون': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/The_Parthenon_in_Athens.jpg/' + W + 'px-The_Parthenon_in_Athens.jpg',
    'معبد الكرنك': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Karnak_Temple_Ruins_Egypt.jpg/' + W + 'px-Karnak_Temple_Ruins_Egypt.jpg',
    'سوق الحميدية': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Al-Hamidiyah_Souq%2C_Damascus.jpg/' + W + 'px-Al-Hamidiyah_Souq%2C_Damascus.jpg',
    'قلعة حلب': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Aleppo_Citadel_2011.jpg/' + W + 'px-Aleppo_Citadel_2011.jpg',
    'مبنى الكابيتول': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/United_States_Capitol_-_west_front.jpg/' + W + 'px-United_States_Capitol_-_west_front.jpg',
    'صخرة الروشة': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Preikestolen_2013.jpg/' + W + 'px-Preikestolen_2013.jpg',
    'جسر البوسفور': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Bosphorus_Bridge_at_night.jpg/' + W + 'px-Bosphorus_Bridge_at_night.jpg',
    'بحيرة جنيف': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Lake_Geneva_from_Chexbres.jpg/' + W + 'px-Lake_Geneva_from_Chexbres.jpg',
    'جبال الألب': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Matterhorn_from_Domh%C3%BCtte_-_2.jpg/' + W + 'px-Matterhorn_from_Domh%C3%BCtte_-_2.jpg',
    'جبال الألب السويسرية': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Matterhorn_from_Domh%C3%BCtte_-_2.jpg/' + W + 'px-Matterhorn_from_Domh%C3%BCtte_-_2.jpg',
    'معبد أنغكور وات': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Angkor_Wat.jpg/' + W + 'px-Angkor_Wat.jpg',
    'برج العرب': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Burj_al_Arab_2024.jpg/' + W + 'px-Burj_al_Arab_2024.jpg',
  };

  var COUNTRY_SCENIC = {
    'فرنسا': LANDMARK_PHOTOS['برج إيفل'],
    'الهند': LANDMARK_PHOTOS['تاج محل'],
    'الولايات المتحدة': LANDMARK_PHOTOS['تمثال الحرية'],
    'مصر': LANDMARK_PHOTOS['الأهرامات'],
    'الصين': LANDMARK_PHOTOS['سور الصين العظيم'],
    'الإمارات': LANDMARK_PHOTOS['برج خليفة'],
    'إيطاليا': LANDMARK_PHOTOS['الكولوسيوم'],
    'بيرو': LANDMARK_PHOTOS['ماتشو بيتشو'],
    'المملكة المتحدة': LANDMARK_PHOTOS['ساعة بيغ بن'],
    'أستراليا': LANDMARK_PHOTOS['دار أوبرا سيدني'],
    'الأردن': LANDMARK_PHOTOS['البتراء'],
    'فلسطين': LANDMARK_PHOTOS['قبة الصخرة'],
    'السعودية': LANDMARK_PHOTOS['الكعبة المشرفة'],
    'تركيا': LANDMARK_PHOTOS['مسجد السلطان أحمد'],
    'اليابان': LANDMARK_PHOTOS['جبل فوجي'],
    'البرازيل': LANDMARK_PHOTOS['تمثال المسيح الفادي'],
    'ألمانيا': LANDMARK_PHOTOS['بوابة براندنبورغ'],
    'روسيا': LANDMARK_PHOTOS['قصر الكرملين'],
    'المغرب': LANDMARK_PHOTOS['جامع القرويين'],
    'الكويت': LANDMARK_PHOTOS['أبراج الكويت'],
    'اليونان': LANDMARK_PHOTOS['معبد البارثينون'],
    'سوريا': LANDMARK_PHOTOS['سوق الحميدية'],
    'النرويج': LANDMARK_PHOTOS['صخرة الروشة'],
    'سويسرا': LANDMARK_PHOTOS['جبال الألب'],
    'كمبوديا': LANDMARK_PHOTOS['معبد أنغكور وات'],
    'إندونيسيا': LANDMARK_PHOTOS['برج إيفل'],
    'تايلاند': LANDMARK_PHOTOS['برج إيفل'],
    'فيتنام': LANDMARK_PHOTOS['برج إيفل'],
  };

  function landmarkKey(name) {
    if (!name) return '';
    return String(name).replace(/\s*\(\d+\)\s*$/, '').trim();
  }

  function resolveLocal(item) {
    if (!item) return '';
    if (item.localImage) {
      var p = String(item.localImage);
      if (p.indexOf('assets/landmarks/') === 0) return p;
      if (p.indexOf('/') === -1) return 'assets/landmarks/' + p;
      return p;
    }
    if (item.slug) return 'assets/landmarks/' + item.slug + '.jpg';
    return '';
  }

  function directCommons(url) {
    if (!url) return '';
    var s = String(url).split('?')[0];
    if (s.indexOf('/thumb/') !== -1) {
      var m = s.match(/\/thumb\/(.+?)\/\d+px-/i);
      if (m) return 'https://upload.wikimedia.org/wikipedia/commons/' + m[1];
    }
    var bad = s.match(
      /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(?:[a-f0-9]\/[a-f0-9]{2}\/)?[^/]+\.(?:jpg|jpeg|png|webp))\/\d+px-/i,
    );
    if (bad) return bad[1];
    return s;
  }

  function remoteUrl(item) {
    if (!item) return '';
    if (item.imageUrl) return directCommons(item.imageUrl);
    var key = landmarkKey(item.landmarkName);
    if (LANDMARK_PHOTOS[key]) return directCommons(LANDMARK_PHOTOS[key]);
    if (COUNTRY_SCENIC[item.nameAr]) return directCommons(COUNTRY_SCENIC[item.nameAr]);
    return '';
  }

  /** محلي أولاً — نفس الدومين = سريع وموثوق في WebView */
  function landmarkUrl(item) {
    return resolveLocal(item) || remoteUrl(item);
  }

  function fallbackUrls(item, current) {
    var list = [];
    var local = resolveLocal(item);
    if (local) list.push(local);
    if (item.imageUrl) list.push(directCommons(item.imageUrl));
    var key = landmarkKey(item.landmarkName);
    if (LANDMARK_PHOTOS[key]) list.push(directCommons(LANDMARK_PHOTOS[key]));
    if (COUNTRY_SCENIC[item.nameAr]) list.push(directCommons(COUNTRY_SCENIC[item.nameAr]));
    return list.filter(function (u, i, arr) {
      return u && arr.indexOf(u) === i && u !== current;
    });
  }

  function preloadUrl(url) {
    if (!url || PRELOADED[url]) return;
    PRELOADED[url] = true;
    var img = new Image();
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.src = url;
  }

  function preloadBankItems(items, limit) {
    if (!items || !items.length) return;
    limit = limit || 12;
    var seen = Object.create(null);
    for (var i = 0; i < items.length && i < limit; i += 1) {
      var url = resolveLocal(items[i]);
      if (url && !seen[url]) {
        seen[url] = true;
        preloadUrl(url);
      }
    }
  }

  function render(viewport, item, options) {
    if (!viewport || !item) return;
    options = options || {};
    viewport.innerHTML = '';
    var stage = document.createElement('div');
    stage.className = 'media-stage';

    var img = document.createElement('img');
    img.decoding = 'async';
    img.loading = 'eager';
    img.alt = item.landmarkName || 'معلم سياحي';
    img.className = 'landmark-img';
    img.referrerPolicy = 'no-referrer';
    var url = landmarkUrl(item);
    img.src = url;
    img.onerror = function () {
      var retries = Number(this.dataset.retries || '0');
      var fallbacks = fallbackUrls(item, this.src);
      if (retries < fallbacks.length) {
        this.dataset.retries = String(retries + 1);
        this.src = fallbacks[retries];
        return;
      }
      this.src =
        'data:image/svg+xml,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260"><rect fill="#1a1030" width="100%" height="100%"/><text x="50%" y="50%" fill="#a78bfa" font-size="16" text-anchor="middle" font-family="sans-serif">صورة المعلم</text></svg>',
        );
    };

    stage.appendChild(img);

    if (options.showLandmarkName && item.landmarkName) {
      var cap = document.createElement('div');
      cap.className = 'landmark-caption';
      cap.textContent = landmarkKey(item.landmarkName);
      stage.appendChild(cap);
    }

    viewport.appendChild(stage);
    preloadUrl(resolveLocal(item));
  }

  var AR_TO_CODE = {
    'السعودية': 'SA', 'الإمارات': 'AE', 'مصر': 'EG', 'الأردن': 'JO', 'فلسطين': 'PS',
    'لبنان': 'LB', 'سوريا': 'SY', 'العراق': 'IQ', 'الكويت': 'KW', 'قطر': 'QA',
    'البحرين': 'BH', 'عُمان': 'OM', 'اليمن': 'YE', 'المغرب': 'MA', 'الجزائر': 'DZ',
    'تونس': 'TN', 'ليبيا': 'LY', 'السودان': 'SD', 'فرنسا': 'FR', 'ألمانيا': 'DE',
    'إيطاليا': 'IT', 'إسبانيا': 'ES', 'المملكة المتحدة': 'GB', 'الولايات المتحدة': 'US',
    'كندا': 'CA', 'البرازيل': 'BR', 'الأرجنتين': 'AR', 'المكسيك': 'MX', 'اليابان': 'JP',
    'الصين': 'CN', 'الهند': 'IN', 'روسيا': 'RU', 'تركيا': 'TR', 'أستراليا': 'AU',
    'اليونان': 'GR', 'سويسرا': 'CH', 'النرويج': 'NO', 'بيرو': 'PE', 'موناكو': 'MC',
    'كمبوديا': 'KH', 'إندونيسيا': 'ID', 'تايلاند': 'TH', 'فيتنام': 'VN',
  };

  function flagUrl(code, width) {
    width = width || 640;
    if (!code) return '';
    return 'https://flagcdn.com/w' + width + '/' + String(code).toLowerCase() + '.png';
  }

  function countryToCode(nameAr) {
    return AR_TO_CODE[nameAr] || 'UN';
  }

  global.FlagGuessMedia = {
    flagUrl: flagUrl,
    landmarkUrl: landmarkUrl,
    resolveLocal: resolveLocal,
    landmarkKey: landmarkKey,
    render: render,
    preloadBankItems: preloadBankItems,
    preloadUrl: preloadUrl,
    LANDMARK_PHOTOS: LANDMARK_PHOTOS,
    countryToCode: countryToCode,
  };
})(window);
