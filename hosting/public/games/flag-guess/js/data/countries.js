/*
 * data/countries.js
 * -----------------------------------------------------------------------------
 * SHARED reference: ISO-3166 alpha-2 country code -> { en, ar, aliases }.
 * Used to turn a GeoNames `countryCode` (or a fallback place's code) into the
 * accepted answers (English + Arabic + common aliases). triviaEngine.normalize()
 * folds Arabic alef/yaa/taa + diacritics + a leading "ال", so the bare names
 * usually suffice; aliases cover English short-forms (usa, uk, uae...).
 * -----------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  function C(en, ar, aliases) { return { en: en, ar: ar, aliases: aliases || [] }; }

  var COUNTRIES = {
    AF: C('Afghanistan', 'أفغانستان'),
    AL: C('Albania', 'ألبانيا'),
    DZ: C('Algeria', 'الجزائر'),
    AD: C('Andorra', 'أندورا'),
    AO: C('Angola', 'أنغولا'),
    AG: C('Antigua and Barbuda', 'أنتيغوا وبربودا', ['antigua']),
    AR: C('Argentina', 'الأرجنتين'),
    AM: C('Armenia', 'أرمينيا'),
    AU: C('Australia', 'أستراليا'),
    AT: C('Austria', 'النمسا'),
    AZ: C('Azerbaijan', 'أذربيجان'),
    BS: C('Bahamas', 'الباهاما'),
    BH: C('Bahrain', 'البحرين'),
    BD: C('Bangladesh', 'بنغلاديش'),
    BB: C('Barbados', 'بربادوس'),
    BY: C('Belarus', 'بيلاروسيا', ['روسيا البيضاء']),
    BE: C('Belgium', 'بلجيكا'),
    BZ: C('Belize', 'بليز'),
    BJ: C('Benin', 'بنين'),
    BT: C('Bhutan', 'بوتان'),
    BO: C('Bolivia', 'بوليفيا'),
    BA: C('Bosnia and Herzegovina', 'البوسنة والهرسك', ['bosnia', 'البوسنه']),
    BW: C('Botswana', 'بوتسوانا'),
    BR: C('Brazil', 'البرازيل', ['brasil']),
    BN: C('Brunei', 'بروناي'),
    BG: C('Bulgaria', 'بلغاريا'),
    BF: C('Burkina Faso', 'بوركينا فاسو'),
    BI: C('Burundi', 'بوروندي'),
    KH: C('Cambodia', 'كمبوديا'),
    CM: C('Cameroon', 'الكاميرون'),
    CA: C('Canada', 'كندا'),
    CV: C('Cape Verde', 'الرأس الأخضر'),
    CF: C('Central African Republic', 'أفريقيا الوسطى'),
    TD: C('Chad', 'تشاد'),
    CL: C('Chile', 'تشيلي', ['شيلي']),
    CN: C('China', 'الصين'),
    CO: C('Colombia', 'كولومبيا'),
    KM: C('Comoros', 'جزر القمر', ['القمر']),
    CG: C('Congo', 'الكونغو'),
    CD: C('DR Congo', 'الكونغو الديمقراطية', ['democratic republic of the congo']),
    CR: C('Costa Rica', 'كوستاريكا'),
    CI: C('Ivory Coast', 'ساحل العاج', ['cote d ivoire']),
    HR: C('Croatia', 'كرواتيا'),
    CU: C('Cuba', 'كوبا'),
    CY: C('Cyprus', 'قبرص'),
    CZ: C('Czechia', 'التشيك', ['czech republic']),
    DK: C('Denmark', 'الدنمارك'),
    DJ: C('Djibouti', 'جيبوتي'),
    DM: C('Dominica', 'دومينيكا'),
    DO: C('Dominican Republic', 'جمهورية الدومينيكان', ['dominican']),
    EC: C('Ecuador', 'الإكوادور'),
    EG: C('Egypt', 'مصر'),
    SV: C('El Salvador', 'السلفادور'),
    GQ: C('Equatorial Guinea', 'غينيا الاستوائية'),
    ER: C('Eritrea', 'إريتريا'),
    EE: C('Estonia', 'إستونيا'),
    SZ: C('Eswatini', 'إسواتيني', ['swaziland', 'سوازيلاند']),
    ET: C('Ethiopia', 'إثيوبيا'),
    FJ: C('Fiji', 'فيجي'),
    FI: C('Finland', 'فنلندا'),
    FR: C('France', 'فرنسا'),
    GA: C('Gabon', 'الغابون'),
    GM: C('Gambia', 'غامبيا'),
    GE: C('Georgia', 'جورجيا'),
    DE: C('Germany', 'ألمانيا', ['deutschland']),
    GH: C('Ghana', 'غانا'),
    GR: C('Greece', 'اليونان'),
    GD: C('Grenada', 'غرينادا'),
    GT: C('Guatemala', 'غواتيمالا'),
    GN: C('Guinea', 'غينيا'),
    GY: C('Guyana', 'غيانا'),
    HT: C('Haiti', 'هايتي'),
    HN: C('Honduras', 'هندوراس'),
    HU: C('Hungary', 'المجر', ['هنغاريا']),
    IS: C('Iceland', 'آيسلندا', ['ايسلندا']),
    IN: C('India', 'الهند'),
    ID: C('Indonesia', 'إندونيسيا'),
    IR: C('Iran', 'إيران'),
    IQ: C('Iraq', 'العراق'),
    IE: C('Ireland', 'أيرلندا'),
    IL: C('Israel', 'إسرائيل'),
    IT: C('Italy', 'إيطاليا', ['italia']),
    JM: C('Jamaica', 'جامايكا'),
    JP: C('Japan', 'اليابان'),
    JO: C('Jordan', 'الأردن'),
    KZ: C('Kazakhstan', 'كازاخستان'),
    KE: C('Kenya', 'كينيا'),
    KI: C('Kiribati', 'كيريباتي'),
    KW: C('Kuwait', 'الكويت'),
    KG: C('Kyrgyzstan', 'قيرغيزستان', ['قرغيزستان']),
    LA: C('Laos', 'لاوس'),
    LV: C('Latvia', 'لاتفيا'),
    LB: C('Lebanon', 'لبنان'),
    LS: C('Lesotho', 'ليسوتو'),
    LR: C('Liberia', 'ليبيريا'),
    LY: C('Libya', 'ليبيا'),
    LI: C('Liechtenstein', 'ليختنشتاين'),
    LT: C('Lithuania', 'ليتوانيا'),
    LU: C('Luxembourg', 'لوكسمبورغ'),
    MG: C('Madagascar', 'مدغشقر'),
    MW: C('Malawi', 'مالاوي'),
    MY: C('Malaysia', 'ماليزيا'),
    MV: C('Maldives', 'المالديف'),
    ML: C('Mali', 'مالي'),
    MT: C('Malta', 'مالطا'),
    MR: C('Mauritania', 'موريتانيا'),
    MU: C('Mauritius', 'موريشيوس'),
    MX: C('Mexico', 'المكسيك'),
    FM: C('Micronesia', 'ميكرونيزيا'),
    MD: C('Moldova', 'مولدوفا'),
    MC: C('Monaco', 'موناكو'),
    MN: C('Mongolia', 'منغوليا'),
    ME: C('Montenegro', 'الجبل الأسود', ['الجبل الاسود']),
    MA: C('Morocco', 'المغرب'),
    MZ: C('Mozambique', 'موزمبيق'),
    MM: C('Myanmar', 'ميانمار', ['burma', 'بورما']),
    NA: C('Namibia', 'ناميبيا'),
    NR: C('Nauru', 'ناورو'),
    NP: C('Nepal', 'نيبال'),
    NL: C('Netherlands', 'هولندا', ['holland']),
    NZ: C('New Zealand', 'نيوزيلندا', ['نيوزيلاندا']),
    NI: C('Nicaragua', 'نيكاراغوا'),
    NE: C('Niger', 'النيجر'),
    NG: C('Nigeria', 'نيجيريا'),
    KP: C('North Korea', 'كوريا الشمالية'),
    MK: C('North Macedonia', 'مقدونيا الشمالية', ['macedonia', 'مقدونيا']),
    NO: C('Norway', 'النرويج'),
    OM: C('Oman', 'عُمان', ['عمان']),
    PK: C('Pakistan', 'باكستان'),
    PW: C('Palau', 'بالاو'),
    PS: C('Palestine', 'فلسطين'),
    PA: C('Panama', 'بنما'),
    PG: C('Papua New Guinea', 'بابوا غينيا الجديدة'),
    PY: C('Paraguay', 'باراغواي'),
    PE: C('Peru', 'بيرو'),
    PH: C('Philippines', 'الفلبين'),
    PL: C('Poland', 'بولندا'),
    PT: C('Portugal', 'البرتغال'),
    QA: C('Qatar', 'قطر'),
    RO: C('Romania', 'رومانيا'),
    RU: C('Russia', 'روسيا'),
    RW: C('Rwanda', 'رواندا'),
    KN: C('Saint Kitts and Nevis', 'سانت كيتس ونيفيس'),
    LC: C('Saint Lucia', 'سانت لوسيا'),
    WS: C('Samoa', 'ساموا'),
    SM: C('San Marino', 'سان مارينو'),
    SA: C('Saudi Arabia', 'السعودية', ['saudi', 'المملكة العربية السعودية']),
    SN: C('Senegal', 'السنغال'),
    RS: C('Serbia', 'صربيا'),
    SC: C('Seychelles', 'سيشل'),
    SL: C('Sierra Leone', 'سيراليون'),
    SG: C('Singapore', 'سنغافورة', ['سنغافوره']),
    SK: C('Slovakia', 'سلوفاكيا'),
    SI: C('Slovenia', 'سلوفينيا'),
    SB: C('Solomon Islands', 'جزر سليمان'),
    SO: C('Somalia', 'الصومال'),
    ZA: C('South Africa', 'جنوب أفريقيا', ['جنوب افريقيا']),
    KR: C('South Korea', 'كوريا الجنوبية', ['korea', 'كوريا']),
    SS: C('South Sudan', 'جنوب السودان'),
    ES: C('Spain', 'إسبانيا', ['espana']),
    LK: C('Sri Lanka', 'سريلانكا', ['سري لانكا']),
    SD: C('Sudan', 'السودان'),
    SR: C('Suriname', 'سورينام'),
    SE: C('Sweden', 'السويد'),
    CH: C('Switzerland', 'سويسرا'),
    SY: C('Syria', 'سوريا'),
    TW: C('Taiwan', 'تايوان'),
    TJ: C('Tajikistan', 'طاجيكستان'),
    TZ: C('Tanzania', 'تنزانيا'),
    TH: C('Thailand', 'تايلاند', ['تايلند']),
    TL: C('Timor-Leste', 'تيمور الشرقية'),
    TG: C('Togo', 'توغو'),
    TO: C('Tonga', 'تونغا'),
    TT: C('Trinidad and Tobago', 'ترينيداد وتوباغو'),
    TN: C('Tunisia', 'تونس'),
    TR: C('Turkey', 'تركيا', ['turkiye']),
    TM: C('Turkmenistan', 'تركمانستان'),
    TV: C('Tuvalu', 'توفالو'),
    UG: C('Uganda', 'أوغندا'),
    UA: C('Ukraine', 'أوكرانيا'),
    AE: C('United Arab Emirates', 'الإمارات', ['uae', 'emirates', 'الامارات']),
    GB: C('United Kingdom', 'المملكة المتحدة', ['uk', 'britain', 'england', 'بريطانيا', 'انجلترا']),
    US: C('United States', 'الولايات المتحدة', ['usa', 'america', 'امريكا', 'united states of america']),
    UY: C('Uruguay', 'الأوروغواي', ['اوروغواي']),
    UZ: C('Uzbekistan', 'أوزبكستان', ['اوزبكستان']),
    VU: C('Vanuatu', 'فانواتو'),
    VA: C('Vatican City', 'الفاتيكان'),
    VE: C('Venezuela', 'فنزويلا'),
    VN: C('Vietnam', 'فيتنام'),
    YE: C('Yemen', 'اليمن'),
    ZM: C('Zambia', 'زامبيا'),
    ZW: C('Zimbabwe', 'زيمبابوي')
  };

  function dedupe(arr) {
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++) { var v = arr[i]; if (v && !seen[v]) { seen[v] = 1; out.push(v); } }
    return out;
  }

  // Build the { country, answerAr, acceptedAnswers } answer block for a code.
  // Returns null for unknown codes so callers can skip that place.
  function answersForCode(code) {
    if (!code) return null;
    var c = COUNTRIES[String(code).toUpperCase()];
    if (!c) return null;
    return {
      country: c.en,
      answerAr: c.ar,
      acceptedAnswers: dedupe([c.en.toLowerCase(), c.ar].concat(c.aliases))
    };
  }

  var Game = global.Game = global.Game || {};
  Game.countries = COUNTRIES;
  Game.answersForCode = answersForCode;

  // Generate multiple choices (1 correct, rest random wrong)
  Game.generateChoices = function(correctAr, count) {
    count = count || 4;
    var keys = Object.keys(COUNTRIES);
    var wrong = [];
    while (wrong.length < count - 1) {
      var k = keys[Math.floor(Math.random() * keys.length)];
      var ar = COUNTRIES[k].ar;
      if (ar !== correctAr && wrong.indexOf(ar) === -1) {
        wrong.push(ar);
      }
    }
    var choices = wrong.concat([correctAr]);
    for (var i = choices.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = choices[i];
      choices[i] = choices[j];
      choices[j] = temp;
    }
    return choices;
  };

})(typeof window !== 'undefined' ? window : this);
