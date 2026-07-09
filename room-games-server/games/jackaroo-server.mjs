import { WebSocketServer } from 'ws';

const clients = new Map();
const rooms = new Map();

const TRACK_LEN = 16;

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function buildDeck() {
  const deck = [];
  for (let v = 1; v <= 13; v++) {
    for (let i = 0; i < 4; i++) deck.push({ value: v, id: `${v}-${i}-${Math.random().toString(36).slice(2, 6)}` });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function createRoom(code) {
  return {
    code,
    players: [],
    marbles: {},
    hands: {},
    deck: buildDeck(),
    turnIndex: 0,
    started: false,
    winner: null,
  };
}

function initMarbles(playerIds) {
  const marbles = {};
  playerIds.forEach((pid, pi) => {
    marbles[pid] = [0, 0, 0, 0].map((_, i) => ({ id: `${pid}-m${i}`, pos: -1 - i, home: true, done: false }));
  });
  return marbles;
}

function roomState(room, playerId) {
  return {
    code: room.code,
    players: room.players.map((p) => ({ id: p.id, name: p.name, ready: p.ready })),
    marbles: room.marbles,
    myHand: playerId ? room.hands[playerId] || [] : [],
    turnPlayerId: room.players[room.turnIndex]?.id ?? null,
    myId: playerId,
    started: room.started,
    winner: room.winner,
    trackLen: TRACK_LEN,
  };
}

function sendAll(room) {
  for (const [ws, meta] of clients) {
    if (meta.roomCode !== room.code || ws.readyState !== 1) continue;
    ws.send(JSON.stringify({ type: 'state', payload: roomState(room, meta.id) }));
  }
}

function drawCards(room, pid, n) {
  if (!room.hands[pid]) room.hands[pid] = [];
  for (let i = 0; i < n && room.deck.length; i++) {
    room.hands[pid].push(room.deck.pop());
  }
}

function moveSteps(marble, steps) {
  if (marble.done) return false;
  if (marble.home) return false;
  if (steps < 0) {
    marble.pos = Math.max(0, marble.pos + steps);
    return true;
  }
  marble.pos += steps;
  if (marble.pos >= TRACK_LEN) {
    marble.done = true;
    marble.pos = TRACK_LEN;
  }
  return true;
}

function canEnter(room, pid) {
  return room.marbles[pid]?.some((m) => m.home && !m.done);
}

function applyCard(room, pid, card, marbleIndex) {
  const marbles = room.marbles[pid] || [];
  const v = card.value;

  if (v === 1 || v === 13) {
    if (marbleIndex >= 0) {
      const m = marbles[marbleIndex];
      if (!m || m.done) return false;
      if (m.home) {
        m.home = false;
        m.pos = 0;
        return true;
      }
      return moveSteps(m, v === 13 ? 13 : 1);
    }
    if (canEnter(room, pid)) {
      const m = marbles.find((x) => x.home);
      if (m) {
        m.home = false;
        m.pos = 0;
        return true;
      }
    }
    return false;
  }

  if (v === 4) {
    if (marbleIndex < 0) return false;
    const m = marbles[marbleIndex];
    if (!m || m.home || m.done) return false;
    return moveSteps(m, -4);
  }

  if (marbleIndex < 0) return false;
  const m = marbles[marbleIndex];
  if (!m || m.home || m.done) return false;
  return moveSteps(m, Math.min(v, TRACK_LEN - m.pos));
}

function checkWinner(room) {
  for (const p of room.players) {
    const ms = room.marbles[p.id] || [];
    if (ms.length && ms.every((m) => m.done)) {
      room.winner = p.id;
      return true;
    }
  }
  return false;
}

export function attachJackarooServer(server, { path = '/ws/jackaroo', noServer = false } = {}) {
  const wss = new WebSocketServer(
    noServer || !server
      ? { noServer: true, path, perMessageDeflate: false }
      : { server, path, perMessageDeflate: false },
  );

  wss.on('connection', (ws) => {
    const id = uid();
    clients.set(ws, { id, roomCode: null });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      const meta = clients.get(ws);
      if (!meta) return;

      if (msg.type === 'join') {
        const code = String(msg.payload?.code || genCode()).toUpperCase().slice(0, 8);
        const name = String(msg.payload?.name || 'لاعب').slice(0, 16);
        if (!rooms.has(code)) rooms.set(code, createRoom(code));
        const room = rooms.get(code);
        if (room.started && !room.players.find((p) => p.id === meta.id)) {
          ws.send(JSON.stringify({ type: 'error', payload: { message: 'اللعبة بدأت' } }));
          return;
        }
        if (room.players.length >= 4) {
          ws.send(JSON.stringify({ type: 'error', payload: { message: 'الغرفة ممتلئة (4 لاعبين)' } }));
          return;
        }
        if (!room.players.find((p) => p.id === meta.id)) {
          meta.roomCode = code;
          room.players.push({ id: meta.id, name, ready: false });
        }
        ws.send(JSON.stringify({ type: 'joined', payload: roomState(room, meta.id) }));
        sendAll(room);
        return;
      }

      const room = meta.roomCode ? rooms.get(meta.roomCode) : null;
      if (!room) return;

      if (msg.type === 'ready') {
        const p = room.players.find((x) => x.id === meta.id);
        if (p) p.ready = !p.ready;
        const minP = room.players.length >= 2;
        if (minP && room.players.every((x) => x.ready) && !room.started) {
          room.started = true;
          room.marbles = initMarbles(room.players.map((p) => p.id));
          room.players.forEach((p) => drawCards(room, p.id, 4));
        }
        sendAll(room);
        return;
      }

      if (msg.type === 'play' && room.started && !room.winner) {
        const current = room.players[room.turnIndex];
        if (!current || current.id !== meta.id) return;
        const cardId = String(msg.payload?.cardId || '');
        const marbleIndex = Number(msg.payload?.marbleIndex ?? -1);
        const hand = room.hands[meta.id] || [];
        const ci = hand.findIndex((c) => c.id === cardId);
        if (ci < 0) return;
        const card = hand[ci];
        if (!applyCard(room, meta.id, card, marbleIndex)) {
          ws.send(JSON.stringify({ type: 'error', payload: { message: 'حركة غير صالحة' } }));
          return;
        }
        hand.splice(ci, 1);
        drawCards(room, meta.id, 1);
        if (checkWinner(room)) {
          sendAll(room);
          return;
        }
        room.turnIndex = (room.turnIndex + 1) % room.players.length;
        sendAll(room);
      }
    });

    ws.on('close', () => {
      const meta = clients.get(ws);
      clients.delete(ws);
      if (!meta?.roomCode) return;
      const room = rooms.get(meta.roomCode);
      if (!room) return;
      room.players = room.players.filter((p) => p.id !== meta.id);
      delete room.marbles[meta.id];
      delete room.hands[meta.id];
      if (!room.players.length) rooms.delete(meta.roomCode);
      else sendAll(room);
    });
  });

  return wss;
}
