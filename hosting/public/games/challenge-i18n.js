/**
 * ترجمة ألعاب التحدي داخل WebView — ar / en
 */
(function (global) {
  var lang = 'ar';

  var STR = {
    ar: {
      pot: 'POT',
      round: 'الجولة {{n}}',
      roundOf: 'الجولة {{round}} من {{total}}',
      suddenDeath: 'الموت المفاجئ',
      shootPrompt: '🎯 {{name}}، اختر مكان التسديد',
      divePrompt: '🧤 {{name}}، اختر مكان الصد',
      coinInit: 'جاري تهيئة التحدي...',
      coinPickTurn: 'دورك للاختيار ({{sec}} ثواني)',
      coinWaiting: 'بانتظار حركة الخصم...',
      coinTiebreak: 'الجولة الحاسمة عشوائية...',
      coinHeads: 'وجه',
      coinTails: 'كتابة',
      coinTitle: 'تحدي رمي قطعة نقدية',
      coinSubtitle: '{{rounds}} جولات - الفائز من يصيب جولتين',
      player1: 'لاعب 1',
      player2: 'لاعب 2',
      balance: 'الرصيد:',
      coinAlt: 'كوين',
      goalToast: 'هدف! ⚽',
      savedToast: 'تصدي! 🧤',
      playerWins: '{{name}} فاز!',
      payoutWin: '{{name}} ربح +{{amount}}',
      payoutLose: '{{name}} خسر −{{amount}}',
      passDeviceTo: 'مرّر الجهاز إلى',
      handoffSub: 'لا تنظر لاختيار الطرف الآخر!',
      handoffReady: 'جاهز',
      billYourTurn: 'دورك!',
      billKeepShooting: 'استمر بالتسديد!',
      billBallInHand: 'كرة حرة',
      billCallPocket: 'اختر الجيب للكرة 8',
      billSinkEight: 'أدخل الكرة 8 (اختر الجيب)',
      billYouAreSolids: 'أنت الكرات الصلبة!',
      billYouAreStripes: 'أنت الكرات المخططة!',
      billScratch: 'خطأ! دخلت الكرة البيضاء',
      billFoul: 'خطأ! {{reason}}',
      billBreaks: '{{name}} يبدأ الكسر!',
      billMatchEnded: 'انتهت المباراة',
      billTimeExpired: 'انتهى الوقت الكلي لأحد اللاعبين',
      billEightEarly: 'دخلت الكرة 8 مبكراً — خسارة',
      billNoPocketCalled: 'لم يُحدد جيب للكرة 8 — خسارة',
      billWrongPocket: 'الكرة 8 في جيب خاطئ — خسارة',
      billScratchEight: 'خطأ أثناء إدخال الكرة 8 — خسارة',
      billEightWin: 'الكرة 8 في الجيب المحدد — فوز!',
      billPlayerSolids: '{{player}} الكرات الصلبة',
      billPlayerStripes: '{{player}} الكرات المخططة',
      billFoulBallInHand: 'خطأ — {{reason}} كرة حرة للخصم',
      billLegalPot: 'كرة صحيحة — أعد التسديد',
      foulNoBallHit: 'لم تُصب أي كرة',
      foulEightFirst: 'أصبت الكرة 8 قبل إنهاء مجموعتك',
      foulWrongGroup: 'أصبت مجموعة خاطئة',
      foulCueScratch: 'دخلت الكرة البيضاء',
      solids: 'صلبة',
      stripes: 'مخططة',
    },
    en: {
      pot: 'POT',
      round: 'Round {{n}}',
      roundOf: 'Round {{round}} of {{total}}',
      suddenDeath: 'SUDDEN DEATH',
      shootPrompt: '🎯 {{name}}, pick where to SHOOT',
      divePrompt: '🧤 {{name}}, pick where to DIVE',
      coinInit: 'Setting up challenge...',
      coinPickTurn: 'Your turn to pick ({{sec}} sec)',
      coinWaiting: 'Waiting for opponent...',
      coinTiebreak: 'Deciding tiebreak round...',
      coinHeads: 'Heads',
      coinTails: 'Tails',
      coinTitle: 'Coin Flip Challenge',
      coinSubtitle: '{{rounds}} rounds — first to 2 wins',
      player1: 'Player 1',
      player2: 'Player 2',
      balance: 'Balance:',
      coinAlt: 'Coin',
      goalToast: 'GOAL! ⚽',
      savedToast: 'SAVED! 🧤',
      playerWins: '{{name}} Wins!',
      payoutWin: '{{name}} won +{{amount}}',
      payoutLose: '{{name}} lost −{{amount}}',
      passDeviceTo: 'Pass the device to',
      handoffSub: "Don't peek at the previous pick!",
      handoffReady: "I'm Ready",
      billYourTurn: 'Your Turn!',
      billKeepShooting: 'Keep shooting!',
      billBallInHand: 'Ball in Hand',
      billCallPocket: 'Call your pocket for the 8-ball',
      billSinkEight: 'Sink the 8-ball (call a pocket)',
      billYouAreSolids: 'You are Solids!',
      billYouAreStripes: 'You are Stripes!',
      billScratch: 'Scratch! White ball potted.',
      billFoul: 'Foul! {{reason}}',
      billBreaks: '{{name}} breaks!',
      billMatchEnded: 'Match ended',
      billTimeExpired: 'A player ran out of match time',
      billEightEarly: '8-ball pocketed too early — loss.',
      billNoPocketCalled: 'No pocket was called for the 8-ball — loss.',
      billWrongPocket: '8-ball fell in the wrong pocket — loss.',
      billScratchEight: 'Scratched while sinking the 8-ball — loss.',
      billEightWin: '8-ball sunk in the called pocket — win!',
      billPlayerSolids: '{{player}} is SOLIDS',
      billPlayerStripes: '{{player}} is STRIPES',
      billFoulBallInHand: 'Foul — {{reason}} Ball in hand.',
      billLegalPot: 'Legal pot — shoot again.',
      foulNoBallHit: 'No ball was hit.',
      foulEightFirst: 'Hit the 8-ball first before clearing your group.',
      foulWrongGroup: 'Hit the wrong group first.',
      foulCueScratch: 'Cue ball scratched.',
      solids: 'Solids',
      stripes: 'Stripes',
    },
  };

  function applyVars(text, vars) {
    if (!vars) return text;
    return text.replace(/\{\{(\w+)\}\}/g, function (_, key) {
      return vars[key] != null ? String(vars[key]) : '';
    });
  }

  function setLang(l) {
    lang = l === 'en' ? 'en' : 'ar';
    try {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    } catch (e) {}
  }

  function t(key, vars) {
    var bucket = STR[lang] || STR.ar;
    var text = bucket[key] || STR.ar[key] || key;
    return applyVars(text, vars);
  }

  function trFoulReason(code) {
    return t(code) !== code ? t(code) : code;
  }

  function trRuleMessage(msg, ctx) {
    if (!msg || typeof msg !== 'string') return msg;
    if (msg.indexOf('i18n:') !== 0) return msg;
    var body = msg.slice(5);
    var pipe = body.indexOf('|');
    if (pipe > -1) {
      var key = body.slice(0, pipe);
      var arg = body.slice(pipe + 1);
      if (key === 'billPlayerSolids' || key === 'billPlayerStripes') {
        var names = (ctx && ctx.names) || {};
        var playerName = names[arg] || names[Number(arg)] || t(arg === '0' || arg === 0 ? 'player1' : 'player2');
        return t(key, { player: playerName });
      }
      if (key === 'billFoulBallInHand') {
        return t(key, { reason: trFoulReason(arg) });
      }
    }
    return t(body);
  }

  function readLangFromUrl() {
    try {
      var q = new URLSearchParams(global.location.search || '');
      var l = q.get('lang') || q.get('locale') || '';
      if (l) setLang(l);
    } catch (e) {}
  }

  readLangFromUrl();

  global.ChallengeI18n = {
    setLang: setLang,
    t: t,
    trFoulReason: trFoulReason,
    trRuleMessage: trRuleMessage,
    getLang: function () { return lang; },
  };
})(window);
