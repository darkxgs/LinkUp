import { WebSocketServer } from 'ws';

const clients = new Map();
const lobbies = new Map();

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function genLobbyId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function buildDeck() {
  const deck = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      deck.push({ id: `${a}-${b}`, a, b });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function createLobby(id) {
  return {
    id,
    players: [],
    hands: {},
    boneyard: [],
    chain: [],
    leftEnd: null,
    rightEnd: null,
    turnIndex: 0,
    started: false,
    winner: null,
    passesInRow: 0,
  };
}

function lobbyState(lobby, forPlayerId) {
  return {
    lobbyId: lobby.id,
    players: lobby.players.map((p) => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      handCount: (lobby.hands[p.id] || []).length,
    })),
    started: lobby.started,
    turnPlayerId: lobby.players[lobby.turnIndex]?.id ?? null,
    chain: lobby.chain,
    leftEnd: lobby.leftEnd,
    rightEnd: lobby.rightEnd,
    boneyardCount: lobby.boneyard.length,
    myHand: forPlayerId ? lobby.hands[forPlayerId] || [] : [],
    winner: lobby.winner,
    myId: forPlayerId,
  };
}

function canPlayTile(tile, leftEnd, rightEnd) {
  if (leftEnd === null) return true;
  return tile.a === leftEnd || tile.b === leftEnd || tile.a === rightEnd || tile.b === rightEnd;
}

function placeTile(lobby, tile, end) {
  if (!lobby.chain.length) {
    lobby.chain.push(tile);
    lobby.leftEnd = tile.a;
    lobby.rightEnd = tile.b;
    return true;
  }
  if (end === 'left') {
    if (tile.b === lobby.leftEnd) {
      lobby.chain.unshift(tile);
      lobby.leftEnd = tile.a;
      return true;
    }
    if (tile.a === lobby.leftEnd) {
      lobby.chain.unshift({ id: tile.id, a: tile.b, b: tile.a });
      lobby.leftEnd = tile.b;
      return true;
    }
    return false;
  }
  if (tile.a === lobby.rightEnd) {
    lobby.chain.push(tile);
    lobby.rightEnd = tile.b;
    return true;
  }
  if (tile.b === lobby.rightEnd) {
    lobby.chain.push({ id: tile.id, a: tile.b, b: tile.a });
    lobby.rightEnd = tile.a;
    return true;
  }
  return false;
}

function startGame(lobby) {
  const n = lobby.players.length;
  if (n < 2) return;
  const deck = buildDeck();
  const perHand = n === 2 ? 7 : n === 3 ? 7 : 6;
  lobby.players.forEach((p) => {
    lobby.hands[p.id] = deck.splice(0, perHand);
  });
  lobby.boneyard = deck;
  lobby.chain = [];
  lobby.leftEnd = null;
  lobby.rightEnd = null;
  lobby.started = true;
  lobby.winner = null;
  lobby.passesInRow = 0;

  let bestIdx = 0;
  let bestScore = -1;
  lobby.players.forEach((p, idx) => {
    const hand = lobby.hands[p.id];
    for (const t of hand) {
      const score = t.a === t.b ? t.a * 10 + t.b : t.a + t.b;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    }
  });
  lobby.turnIndex = bestIdx;
  sendState(lobby);
}

function nextTurn(lobby) {
  lobby.turnIndex = (lobby.turnIndex + 1) % lobby.players.length;
}

function checkWinner(lobby) {
  for (const p of lobby.players) {
    if ((lobby.hands[p.id] || []).length === 0) {
      lobby.winner = p.id;
      return true;
    }
  }
  return false;
}

function sendState(lobby) {
  for (const [ws, meta] of clients) {
    if (meta.lobbyId !== lobby.id) continue;
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ action: 'state', ...lobbyState(lobby, meta.id) }));
    }
  }
}

export function attachDominoServer(server, { path = '/ws/domino', noServer = false } = {}) {
  const wss = new WebSocketServer(
    noServer || !server
      ? { noServer: true, path, perMessageDeflate: false }
      : { server, path, perMessageDeflate: false },
  );

  wss.on('connection', (ws) => {
    const id = uid();
    clients.set(ws, { id, lobbyId: null, name: '' });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      const meta = clients.get(ws);
      if (!meta) return;

      if (msg.action === 'join') {
        const name = String(msg.name || 'لاعب').slice(0, 20);
        const lobbyId = msg.lobbyId ? String(msg.lobbyId).toUpperCase() : genLobbyId();
        if (!lobbies.has(lobbyId)) lobbies.set(lobbyId, createLobby(lobbyId));
        const lobby = lobbies.get(lobbyId);
        if (lobby.started) {
          ws.send(JSON.stringify({ action: 'error', message: 'اللعبة بدأت بالفعل' }));
          return;
        }
        if (lobby.players.length >= 4) {
          ws.send(JSON.stringify({ action: 'error', message: 'الغرفة ممتلئة' }));
          return;
        }
        if (lobby.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
          ws.send(JSON.stringify({ action: 'error', message: 'الاسم مستخدم' }));
          return;
        }
        meta.name = name;
        meta.lobbyId = lobbyId;
        lobby.players.push({ id: meta.id, name, ready: false });
        sendState(lobby);
        return;
      }

      const lobby = meta.lobbyId ? lobbies.get(meta.lobbyId) : null;
      if (!lobby) return;

      if (msg.action === 'ready') {
        if (lobby.started) return;
        const p = lobby.players.find((x) => x.id === meta.id);
        if (p) p.ready = !p.ready;
        if (lobby.players.length >= 2 && lobby.players.every((x) => x.ready)) startGame(lobby);
        else sendState(lobby);
        return;
      }

      if (!lobby.started || lobby.winner) return;
      const current = lobby.players[lobby.turnIndex];
      if (!current || current.id !== meta.id) return;

      if (msg.action === 'play') {
        const tileId = String(msg.tileId || '');
        const end = msg.end === 'left' ? 'left' : 'right';
        const hand = lobby.hands[meta.id] || [];
        const idx = hand.findIndex((t) => t.id === tileId);
        if (idx < 0) {
          ws.send(JSON.stringify({ action: 'error', message: 'قطعة غير صالحة' }));
          return;
        }
        const tile = hand[idx];
        if (!canPlayTile(tile, lobby.leftEnd, lobby.rightEnd)) {
          ws.send(JSON.stringify({ action: 'error', message: 'لا يمكن لعب هذه القطعة' }));
          return;
        }
        if (!placeTile(lobby, tile, lobby.chain.length ? end : 'right')) {
          ws.send(JSON.stringify({ action: 'error', message: 'الوضع غير صالح' }));
          return;
        }
        hand.splice(idx, 1);
        lobby.passesInRow = 0;
        if (checkWinner(lobby)) {
          sendState(lobby);
          return;
        }
        nextTurn(lobby);
        sendState(lobby);
        return;
      }

      if (msg.action === 'draw') {
        if (!lobby.boneyard.length) {
          ws.send(JSON.stringify({ action: 'error', message: 'لا توجد قطع للسحب' }));
          return;
        }
        const hand = lobby.hands[meta.id] || [];
        hand.push(lobby.boneyard.pop());
        lobby.passesInRow += 1;
        if (lobby.passesInRow >= lobby.players.length) {
          lobby.winner = lobby.players.reduce((a, b) => {
            const ah = (lobby.hands[a.id] || []).reduce((s, t) => s + t.a + t.b, 0);
            const bh = (lobby.hands[b.id] || []).reduce((s, t) => s + t.a + t.b, 0);
            return ah <= bh ? a : b;
          }).id;
        } else {
          nextTurn(lobby);
        }
        sendState(lobby);
        return;
      }

      if (msg.action === 'pass') {
        const hand = lobby.hands[meta.id] || [];
        if (hand.some((t) => canPlayTile(t, lobby.leftEnd, lobby.rightEnd))) {
          ws.send(JSON.stringify({ action: 'error', message: 'لديك قطعة قابلة للعب' }));
          return;
        }
        if (lobby.boneyard.length) {
          ws.send(JSON.stringify({ action: 'error', message: 'اسحب قطعة أولاً' }));
          return;
        }
        lobby.passesInRow += 1;
        if (lobby.passesInRow >= lobby.players.length) {
          lobby.winner = lobby.players.reduce((a, b) => {
            const ah = (lobby.hands[a.id] || []).reduce((s, t) => s + t.a + t.b, 0);
            const bh = (lobby.hands[b.id] || []).reduce((s, t) => s + t.a + t.b, 0);
            return ah <= bh ? a : b;
          }).id;
        } else {
          nextTurn(lobby);
        }
        sendState(lobby);
      }
    });

    ws.on('close', () => {
      const meta = clients.get(ws);
      clients.delete(ws);
      if (!meta?.lobbyId) return;
      const lobby = lobbies.get(meta.lobbyId);
      if (!lobby) return;
      lobby.players = lobby.players.filter((p) => p.id !== meta.id);
      delete lobby.hands[meta.id];
      if (!lobby.players.length) lobbies.delete(meta.lobbyId);
      else sendState(lobby);
    });
  });

  return wss;
}
