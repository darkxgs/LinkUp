/**
 * LinkUp — جسر ألعاب الروم المجانية (WebView ↔ غرفة صوتية)
 * يقرأ معاملات الرابط ويرسل INIT_DATA من التطبيق.
 */
(function (global) {
  function parseQuery() {
    var q = {};
    try {
      var sp = new URLSearchParams(global.location.search);
      sp.forEach(function (v, k) {
        q[k] = v;
      });
    } catch (e) {}
    return q;
  }

  function getGameServerWsBase() {
    var q = parseQuery();
    if (q.gs) return String(q.gs).replace(/\/$/, '');
    if (global.__LINKUP_GAME_SERVER__) return String(global.__LINKUP_GAME_SERVER__).replace(/\/$/, '');
    var proto = global.location.protocol === 'https:' ? 'wss' : 'ws';
    return proto + '://' + global.location.host;
  }

  /** يُفعّل مستمعي WebSocket على Cloud Functions قبل أول اتصال WS */
  function primeGameServer() {
    var wsBase = getGameServerWsBase();
    var httpBase = wsBase.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
    return fetch(httpBase + '/health', { mode: 'cors', cache: 'no-store' }).catch(function () {});
  }

  function wsPath(game) {
    var map = {
      ludo: '/ws/ludo',
      uno: '/ws/uno',
      'mask-chat': '/ws/mask-chat',
      domino: '/ws/domino',
      carrom: '/ws/carrom',
      jackaroo: '/ws/jackaroo',
      xo: '/ws/xo',
    };
    return getGameServerWsBase() + (map[game] || '/ws/' + game);
  }

  function parse() {
    var q = parseQuery();
    return {
      sessionId: q.session || q.sessionId || '',
      roomId: q.roomId || '',
      playerName: q.name || q.playerName || '',
      joinCode: q.code || q.joinCode || q.lobby || '',
      autoCreate: q.autoCreate === '1' || q.autoCreate === 'true',
      autoJoin: q.autoJoin === '1' || q.autoJoin === 'true' || !!q.code,
      gameId: q.game || q.gameId || '',
      uid: q.uid || '',
      gameServer: getGameServerWsBase(),
    };
  }

  function isEmbedded() {
    return !!(global.ReactNativeWebView || (global.parent && global.parent !== global));
  }

  function postToApp(data) {
    var payload = JSON.stringify(data);
    if (global.ReactNativeWebView && global.ReactNativeWebView.postMessage) {
      global.ReactNativeWebView.postMessage(payload);
      return;
    }
    if (global.parent && global.parent !== global) {
      global.parent.postMessage(payload, '*');
    }
  }

  function applyRtlShell() {
    try {
      document.documentElement.lang = 'ar';
      document.documentElement.dir = 'rtl';
      if (isEmbedded()) {
        document.body.classList.add('linkup-embedded');
      }
    } catch (e) {}
  }

  function listenAppMessages(handler) {
    global.addEventListener('message', function (ev) {
      var data = ev.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          return;
        }
      }
      if (data && data.type) handler(data);
    });
  }

  global.LinkUpRoomBoot = {
    parse: parse,
    parseQuery: parseQuery,
    wsPath: wsPath,
    getGameServerWsBase: getGameServerWsBase,
    primeGameServer: primeGameServer,
    isEmbedded: isEmbedded,
    postToApp: postToApp,
    applyRtlShell: applyRtlShell,
    listenAppMessages: listenAppMessages,
  };
})(typeof window !== 'undefined' ? window : globalThis);
