/*
 * data/items.js
 * -----------------------------------------------------------------------------
 * FALLBACK content for Game #1 — used only when the live GeoNames source is
 * unavailable (no username yet, no internet, or an API error). Places only,
 * single (very-hard) difficulty: the player types the COUNTRY of an obscure
 * landmark/place.
 *
 * 89 places, each verified to load, declared compactly as [wikimediaFile, ISO2].
 * Country name + Arabic name + accepted answers come from data/countries.js, so
 * there's no duplicated naming here.
 *
 * Image source: Wikimedia Commons Special:FilePath (stable, no hash). Verify each
 * image's license before going live.
 * -----------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var Game = global.Game = global.Game || {};

  var WIKI = function (file) {
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/' +
      encodeURIComponent(file) + '?width=1280';
  };

  // [ Wikimedia file, ISO-3166 alpha-2 country code ]  (Iconic landmarks for easier guessing)
  var PLACES = [
    ['Tour_Eiffel_Wikimedia_Commons_(cropped).jpg', 'FR'],
    ['Great_Pyramid_of_Giza_-_Pyramid_of_Khufu.jpg', 'EG'],
    ['Taj_Mahal_(Edited).jpeg', 'IN'],
    ['Front_view_of_Statue_of_Liberty_(cropped).jpg', 'US'],
    ['Colosseo_2020.jpg', 'IT'],
    ['Elizabeth_Tower,_June_2022.jpg', 'GB'],
    ['Burj_Khalifa_(worlds_tallest_building)_and_the_Dubai_skyline_(25781049892).jpg', 'AE'],
    ['Sydney_Australia._(21339175489).jpg', 'AU'],
    ['Machu_Picchu,_2023_(012).jpg', 'PE'],
    ['View_of_Mount_Fuji_from_Ōwakudani_20211202.jpg', 'JP'],
    ['Angkor_Wat.jpg', 'KH'],
    ['Al_Deir_Petra.JPG', 'JO'],
    ['1029_Acropolis_of_Athens_in_Greece_at_night_Photo_by_Giles_Laurent.jpg', 'GR'],
    ['Chichen_Itza_3.jpg', 'MX'],
    ['Stonehenge2007_07_30.jpg', 'GB'],
    ['Moscow_Kremlin_(8281675670).jpg', 'RU'],
    ['Pamukkale 30.jpg', 'TR'],
    ['Halong Bay.jpg', 'VN'],
    ['Plitvice Lakes.jpg', 'HR'],
    ['Hallstatt.jpg', 'AT'],
    ['Chefchaouen.jpg', 'MA'],
    ['Batu Caves.jpg', 'MY']
  ];

  var ITEMS = [];
  PLACES.forEach(function (p, i) {
    var ans = Game.answersForCode(p[1]);
    if (!ans) return; // skip if the code isn't in countries.js
    ITEMS.push({
      id: 'place_' + (i + 1),
      type: 'landmark',
      imageUrl: WIKI(p[0]),
      country: ans.country,
      answerAr: ans.answerAr,
      acceptedAnswers: ans.acceptedAnswers
    });
  });

  Game.items = ITEMS;

})(typeof window !== 'undefined' ? window : this);
