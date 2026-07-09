/**
 * مستويات صعوبة ألعاب الذكاء — مرتبطة بترتيب الدخولية (كل دخولية أصعب)
 */
(function (global) {
  var DEFAULT_CHIPS = [5000, 10000, 25000, 50000];

  var TIERS = [
    {
      lvl: 1,
      label: 'مبتدئ',
      emoji: '🌱',
      memory: { pairs: 6, gameTime: 32, preview: 7, tapDelay: 1, gridCols: 4 },
      sequence: { length: 5, preview: 7, play: 20, simonGap: 440 },
      flag: {
        time: 14,
        optionCount: 4,
        showLandmarkName: true,
        wrongStrategy: 'random',
        typingAllowed: true,
        landmarkPool: 'famous',
      },
    },
    {
      lvl: 2,
      label: 'نشيط',
      emoji: '💧',
      memory: { pairs: 8, gameTime: 26, preview: 4, tapDelay: 2, gridCols: 4 },
      sequence: { length: 7, preview: 5, play: 16, simonGap: 360 },
      flag: {
        time: 11,
        optionCount: 4,
        showLandmarkName: false,
        wrongStrategy: 'random',
        typingAllowed: true,
        landmarkPool: 'famous',
      },
    },
    {
      lvl: 3,
      label: 'متحدي',
      emoji: '🔥',
      memory: { pairs: 10, gameTime: 20, preview: 3, tapDelay: 3, gridCols: 5 },
      sequence: { length: 9, preview: 3, play: 13, simonGap: 300 },
      flag: {
        time: 8,
        optionCount: 5,
        showLandmarkName: false,
        wrongStrategy: 'region',
        typingAllowed: false,
        landmarkPool: 'mixed',
      },
    },
    {
      lvl: 4,
      label: 'محترف',
      emoji: '⚡',
      memory: { pairs: 12, gameTime: 16, preview: 2, tapDelay: 4, gridCols: 5 },
      sequence: { length: 11, preview: 2, play: 10, simonGap: 260 },
      flag: {
        time: 6,
        optionCount: 5,
        showLandmarkName: false,
        wrongStrategy: 'region',
        typingAllowed: false,
        landmarkPool: 'obscure',
      },
    },
    {
      lvl: 5,
      label: 'أسطوري',
      emoji: '👑',
      memory: { pairs: 14, gameTime: 12, preview: 1, tapDelay: 5, gridCols: 6 },
      sequence: { length: 13, preview: 1, play: 8, simonGap: 220 },
      flag: {
        time: 4,
        optionCount: 6,
        showLandmarkName: false,
        wrongStrategy: 'region',
        typingAllowed: false,
        landmarkPool: 'obscure',
      },
    },
  ];

  var REGIONS = {
    gulf: ['السعودية', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عُمان', 'اليمن'],
    levant: ['سوريا', 'لبنان', 'الأردن', 'فلسطين', 'العراق'],
    maghreb: ['مصر', 'ليبيا', 'تونس', 'الجزائر', 'المغرب', 'السودان'],
    europe: ['فرنسا', 'ألمانيا', 'إيطاليا', 'إسبانيا', 'المملكة المتحدة', 'روسيا', 'اليونان', 'سويسرا', 'النرويج', 'موناكو'],
    americas: ['الولايات المتحدة', 'كندا', 'البرازيل', 'الأرجنتين', 'المكسيك', 'بيرو', 'تشيلي', 'كولومبيا'],
    asia: ['الصين', 'اليابان', 'الهند', 'تركيا', 'إيران', 'باكستان', 'إندونيسيا', 'ماليزيا', 'كوريا الجنوبية'],
    oceania: ['أستراليا', 'نيوزيلندا'],
  };

  var FAMOUS_LANDMARKS = {
    'برج إيفل': 1, 'تاج محل': 1, 'تمثال الحرية': 1, 'الأهرامات': 1, 'أهرامات الجيزة': 1,
    'سور الصين العظيم': 1, 'برج خليفة': 1, 'برج خليفة دبي': 1, 'الكولوسيوم': 1, 'ماتشو بيتشو': 1,
    'ساعة بيغ بن': 1, 'دار أوبرا سيدني': 1, 'الكعبة المشرفة': 1, 'قبة الصخرة': 1, 'المسجد الأقصى': 1,
    'جبل فوجي': 1, 'تمثال المسيح الفادي': 1, 'البتراء': 1, 'جامع الشيخ زايد': 1,
  };

  function normalizeChips(chips) {
    var src = Array.isArray(chips) && chips.length ? chips.slice() : DEFAULT_CHIPS.slice();
    return src.filter(function (n) { return n > 0; }).sort(function (a, b) { return a - b; });
  }

  function tierIndex(stake, chips) {
    var list = normalizeChips(chips);
    var s = Number(stake) || list[0] || 5000;
    var idx = list.indexOf(s);
    if (idx >= 0) return Math.min(idx, TIERS.length - 1);
    for (var i = list.length - 1; i >= 0; i--) {
      if (s >= list[i]) return Math.min(i, TIERS.length - 1);
    }
    return 0;
  }

  function getTier(stake, chips) {
    return TIERS[tierIndex(stake, chips)] || TIERS[0];
  }

  function getRegion(country) {
    var keys = Object.keys(REGIONS);
    for (var i = 0; i < keys.length; i++) {
      if (REGIONS[keys[i]].indexOf(country) !== -1) return keys[i];
    }
    return 'other';
  }

  function pickWrongCountries(correct, count, allCountries, strategy) {
    var wrong = [];
    var pool = [];
    if (strategy === 'region') {
      var region = getRegion(correct);
      if (REGIONS[region]) {
        pool = REGIONS[region].filter(function (c) { return c !== correct; });
      }
    }
    if (!pool.length) {
      pool = allCountries.filter(function (c) { return c !== correct; });
    }
    while (wrong.length < count && pool.length) {
      var pick = pool[Math.floor(Math.random() * pool.length)];
      if (wrong.indexOf(pick) === -1) wrong.push(pick);
    }
    var extra = allCountries.filter(function (c) {
      return c !== correct && wrong.indexOf(c) === -1;
    });
    while (wrong.length < count && extra.length) {
      var p2 = extra[Math.floor(Math.random() * extra.length)];
      if (wrong.indexOf(p2) === -1) wrong.push(p2);
    }
    return wrong;
  }

  function landmarkKey(name) {
    if (!name) return '';
    return String(name).replace(/\s*\(\d+\)\s*$/, '').trim();
  }

  function isFamousLandmark(item) {
    return !!FAMOUS_LANDMARKS[landmarkKey(item.landmarkName)];
  }

  function filterLandmarkPool(items, poolType) {
    var landmarks = items.filter(function (i) { return i.type === 'landmark'; });
    if (!landmarks.length) return items;
    if (poolType === 'famous') {
      var famous = landmarks.filter(isFamousLandmark);
      return famous.length ? famous : landmarks.slice(0, 40);
    }
    if (poolType === 'obscure') {
      var obscure = landmarks.filter(function (i) { return !isFamousLandmark(i); });
      return obscure.length ? obscure : landmarks;
    }
    return landmarks;
  }

  function describeForGame(stake, game, chips) {
    var t = getTier(stake, chips);
    if (game === 'memory') {
      return t.emoji + ' ' + t.label + ' — ' + t.memory.pairs + ' أزواج / ' + t.memory.gameTime + ' ث';
    }
    if (game === 'sequence') {
      return t.emoji + ' ' + t.label + ' — ' + t.sequence.length + ' عناصر / ' + t.sequence.play + ' ث';
    }
    if (game === 'flag') {
      return t.emoji + ' ' + t.label + ' — معلم بدون تلميح / ' + t.flag.time + ' ث / ' + t.flag.optionCount + ' خيارات';
    }
    return t.emoji + ' ' + t.label;
  }

  global.IntelligenceDifficulty = {
    getTier: getTier,
    tierIndex: tierIndex,
    describeForGame: describeForGame,
    pickWrongCountries: pickWrongCountries,
    filterLandmarkPool: filterLandmarkPool,
    landmarkKey: landmarkKey,
    isFamousLandmark: isFamousLandmark,
    TIERS: TIERS,
    REGIONS: REGIONS,
  };
})(window);
