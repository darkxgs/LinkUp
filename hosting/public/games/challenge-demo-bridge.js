/**
 * جسر تجريبي لألعاب التحدي 1v1 — يعمل عند فتح الرابط مباشرة بدون تطبيق أو أدمن
 */
(function (global) {
  var DEMO_CHALLENGER_ID = 'demo-challenger';
  var DEMO_OPPONENT_ID = 'demo-opponent';
  var gameId = '';
  var challenge = null;
  var standalone = false;

  function isEmbedded() {
    return !!(global.ReactNativeWebView || (global.parent && global.parent !== global));
  }

  function hasChallengeIdInUrl() {
    try {
      var search = global.location && global.location.search ? global.location.search : '';
      var q = new URLSearchParams(search);
      return !!(q.get('challengeId') || q.get('challenge'));
    } catch (e) {
      return false;
    }
  }

  function pickSpot() {
    var spots = ['left', 'center', 'right'];
    return spots[Math.floor(Math.random() * spots.length)];
  }

  function createDemoChallenge(id) {
    var base = {
      id: 'demo-' + id,
      challengerId: DEMO_CHALLENGER_ID,
      challengerName: 'أنت',
      challengerAvatar: 'https://i.pravatar.cc/100?img=11',
      challengedId: DEMO_OPPONENT_ID,
      challengedName: 'الخصم (AI)',
      challengedAvatar: 'https://i.pravatar.cc/100?img=12',
      bet: 10000,
      status: 'active',
      createdAt: Date.now(),
      turn: DEMO_CHALLENGER_ID,
    };

    if (id === 'penalty-kicks') {
      return Object.assign({}, base, {
        gameId: 'penalty',
        gameState: {
          round: 1,
          phase: 'shooting',
          challengerScore: 0,
          opponentScore: 0,
          challengerChoice: null,
          opponentChoice: null,
          turn: DEMO_CHALLENGER_ID,
        },
      });
    }

    if (id === 'pool') {
      return Object.assign({}, base, {
        gameId: 'billiards',
        gameState: {
          challengerTime: 420000,
          opponentTime: 420000,
          currentTurnStartedAt: Date.now(),
          challengerPotted: 0,
          opponentPotted: 0,
          ballsSnapshot: null,
        },
      });
    }

    return Object.assign({}, base, {
      gameId: 'coin-flip',
      gameState: {
        round: 1,
        p1Choice: null,
        p2Choice: null,
        roundResults: [],
        flipResult: null,
        turn: DEMO_CHALLENGER_ID,
      },
    });
  }

  function dispatchToGame(data) {
    global.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  function showBanner() {
    if (document.getElementById('lu-demo-banner')) return;
    var el = document.createElement('div');
    el.id = 'lu-demo-banner';
    el.className = 'lu-demo-banner';
    el.innerHTML = '🎮 <b>وضع تجريبي</b> — أنت اللاعب الأول ضد خصم ذكي • <button type="button" id="lu-demo-restart">إعادة</button>';
    document.body.appendChild(el);
    document.getElementById('lu-demo-restart').onclick = function () {
      challenge = createDemoChallenge(gameId);
      dispatchToGame({
        type: 'INIT_DATA',
        challenge: challenge,
        role: 'challenger',
        myRole: 'challenger',
      });
    };
  }

  function maybeFillPenaltyOpponent(state) {
    var phase = state.phase;
    var hasCh = state.challengerChoice != null;
    var hasOp = state.opponentChoice != null;
    if (hasCh && hasOp) return false;

    if (phase === 'shooting' && hasCh && !hasOp) {
      state.opponentChoice = pickSpot();
      return true;
    }
    if (phase === 'goalkeeping' && hasOp && !hasCh) {
      state.challengerChoice = pickSpot();
      return true;
    }
    if (phase === 'shooting' && !hasCh && hasOp) {
      state.challengerChoice = pickSpot();
      return true;
    }
    if (phase === 'goalkeeping' && !hasOp && hasCh) {
      state.opponentChoice = pickSpot();
      return true;
    }
    return false;
  }

  function handlePenaltyMove(data) {
    var incoming = data.gameState || {};
    challenge.gameState = Object.assign({}, challenge.gameState, incoming);
    var state = challenge.gameState;
    var hasCh = state.challengerChoice != null;
    var hasOp = state.opponentChoice != null;
    var onePick = (hasCh && !hasOp) || (!hasCh && hasOp);

    if (onePick && maybeFillPenaltyOpponent(state)) {
      setTimeout(function () {
        dispatchToGame({
          type: 'STATE_UPDATE',
          challenge: challenge,
          role: 'challenger',
          myRole: 'challenger',
        });
      }, 500);
      return;
    }

    if (!hasCh && !hasOp) {
      setTimeout(function () {
        dispatchToGame({
          type: 'STATE_UPDATE',
          challenge: challenge,
          role: 'challenger',
          myRole: 'challenger',
        });
      }, 100);
    }
  }

  function handleCoinMove(data) {
    var incoming = data.gameState || {};
    challenge.gameState = Object.assign({}, challenge.gameState, incoming);
    var state = challenge.gameState;

    if (state.round === 2 && state.p2Choice == null && state.flipResult == null) {
      setTimeout(function () {
        var side = Math.random() > 0.5 ? 'heads' : 'tails';
        state.p2Choice = side;
        state.p1Choice = side === 'heads' ? 'tails' : 'heads';
        state.flipResult = Math.random() > 0.5 ? 'heads' : 'tails';
        dispatchToGame({
          type: 'STATE_UPDATE',
          challenge: challenge,
          role: 'challenger',
          myRole: 'challenger',
        });
      }, 1400);
      return;
    }

    if (state.flipResult) {
      dispatchToGame({
        type: 'STATE_UPDATE',
        challenge: challenge,
        role: 'challenger',
        myRole: 'challenger',
      });
      return;
    }

    dispatchToGame({
      type: 'STATE_UPDATE',
      challenge: challenge,
      role: 'challenger',
      myRole: 'challenger',
    });
  }

  function handlePoolMove(data) {
    var incoming = data.gameState || {};
    challenge.gameState = Object.assign({}, challenge.gameState, incoming);
    if (data.nextTurn) challenge.turn = data.nextTurn;
    dispatchToGame({
      type: 'STATE_UPDATE',
      challenge: challenge,
      role: 'challenger',
      myRole: 'challenger',
    });
  }

  function handleLocal(data) {
    if (data.type === 'INIT_GAME') {
      challenge = createDemoChallenge(gameId);
      dispatchToGame({
        type: 'INIT_DATA',
        challenge: challenge,
        role: 'challenger',
        myRole: 'challenger',
      });
      return;
    }

    if (!challenge) return;

    if (data.type === 'MAKE_MOVE') {
      if (gameId === 'penalty-kicks') handlePenaltyMove(data);
      else if (gameId === 'coin-challenge') handleCoinMove(data);
      else if (gameId === 'pool') handlePoolMove(data);
      return;
    }

    if (data.type === 'GAME_OVER') {
      challenge.status = 'completed';
      challenge.winnerId = data.winnerId || null;
      var banner = document.getElementById('lu-demo-banner');
      if (banner) {
        var won = data.winnerId === DEMO_CHALLENGER_ID;
        banner.innerHTML = won
          ? '🏆 <b>فزت!</b> — <button type="button" id="lu-demo-restart">لعب مرة أخرى</button>'
          : '💔 <b>خسرت</b> — <button type="button" id="lu-demo-restart">حاول مجدداً</button>';
        document.getElementById('lu-demo-restart').onclick = function () {
          challenge = createDemoChallenge(gameId);
          showBanner();
          dispatchToGame({
            type: 'INIT_DATA',
            challenge: challenge,
            role: 'challenger',
            myRole: 'challenger',
          });
          global.location.reload();
        };
      }
    }
  }

  function postToApp(data) {
    var payload = JSON.stringify(data);
    if (global.ReactNativeWebView) {
      global.ReactNativeWebView.postMessage(payload);
    } else if (global.parent && global.parent !== global) {
      global.parent.postMessage(payload, '*');
    } else if (standalone) {
      handleLocal(data);
    }
  }

  /** استقبال رسائل React Native (iOS + Android) */
  function bindAppMessages(handler) {
    function onMsg(event) {
      try {
        var raw = event && event.data;
        if (typeof raw !== 'string' || !raw.length) return;
        handler(JSON.parse(raw));
      } catch (e) {
        console.warn('ChallengeDemoBridge message parse:', e);
      }
    }
    window.addEventListener('message', onMsg);
    document.addEventListener('message', onMsg);
  }

  function readUrlParams() {
    try {
      var q = new URLSearchParams(global.location && global.location.search ? global.location.search : '');
      return {
        challengeId: q.get('challengeId') || q.get('challenge') || '',
        role: q.get('role') || '',
        uid: q.get('uid') || '',
      };
    } catch (e) {
      return { challengeId: '', role: '', uid: '' };
    }
  }

  function install(id) {
    gameId = id;
    // وضع تجريبي فقط عند فتح الرابط في المتصفح بدون تطبيق وبدون معرّف تحدي حقيقي
    standalone = !isEmbedded() && !hasChallengeIdInUrl();
    if (standalone) {
      showBanner();
    }
  }

  global.ChallengeDemoBridge = {
    install: install,
    postToApp: postToApp,
    bindAppMessages: bindAppMessages,
    readUrlParams: readUrlParams,
    isStandalone: function () { return standalone; },
  };
})(window);
