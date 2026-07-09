/*
 * triviaEngine.js
 * -----------------------------------------------------------------------------
 * Game #1 PURE LOGIC. No DOM, no rendering, no providers, no timers.
 *  - pickRandomItemByDifficulty(items, difficulty)
 *  - validateAnswer(item, submittedText)
 *  - normalize(text)               (exposed for testing)
 *  - isTimedOut(timeLeftSeconds)
 *
 * This is the only place that "knows" how an answer is judged, so a future
 * Game #2 would ship its OWN engine file and reuse the shared policy modules.
 * -----------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  // Arabic-aware normalization so "أمريكا"/"امريكا" or "إيطاليا"/"ايطاليا" match,
  // and Latin answers are compared case-insensitively & trimmed.
  function normalize(text) {
    if (text == null) return '';
    var s = String(text).trim().toLowerCase();

    // Remove Arabic diacritics (harakat) and tatweel.
    s = s.replace(/[ً-ْٰ]/g, ''); // fathatan..sukun + superscript alef
    s = s.replace(/ـ/g, '');                // tatweel ـ

    // Unify alef variants -> bare alef.
    s = s.replace(/[آأإٱ]/g, 'ا'); // آأإٱ -> ا
    // Unify yaa / alef-maqsura.
    s = s.replace(/ى/g, 'ي');           // ى -> ي
    // Unify taa-marbuta -> haa.
    s = s.replace(/ة/g, 'ه');           // ة -> ه
    // Unify hamza-on-waw / hamza-on-yaa.
    s = s.replace(/ؤ/g, 'و');           // ؤ -> و
    s = s.replace(/ئ/g, 'ي');           // ئ -> ي

    // Drop a leading "ال" definite article so "السعودية" == "سعودية",
    // "العراق" == "عراق", etc. Applied to BOTH stored answers and the guess,
    // so the player never has to remember whether to include "ال".
    s = s.replace(/^ال/, '');

    // Collapse internal whitespace.
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  // Single difficulty: pick a random entry from the whole pool. The bet only
  // affects the payout, not which place is shown.
  function pickRandomItem(items) {
    if (!items || items.length === 0) return null;
    return items[Math.floor(Math.random() * items.length)];
  }

  // True if the submitted text matches ANY accepted answer (after normalization).
  function validateAnswer(item, submittedText) {
    if (!item || !item.acceptedAnswers) return false;
    var guess = normalize(submittedText);
    if (!guess) return false;
    for (var i = 0; i < item.acceptedAnswers.length; i++) {
      if (normalize(item.acceptedAnswers[i]) === guess) return true;
    }
    return false;
  }

  // Timeout detection kept here so all "judging" lives in the pure engine.
  function isTimedOut(timeLeftSeconds) {
    return timeLeftSeconds <= 0;
  }

  var Game = global.Game = global.Game || {};
  Game.triviaEngine = {
    normalize: normalize,
    pickRandomItem: pickRandomItem,
    validateAnswer: validateAnswer,
    isTimedOut: isTimedOut
  };

})(typeof window !== 'undefined' ? window : this);
