import { WebSocketServer } from 'ws';

const clients = new Map();
const rooms = new Map();

const POCKETS = [
  { x: 20, y: 20 },
  { x: 280, y: 20 },
  { x: 20, y: 280 },
  { x: 280, y: 280 },
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function initialCoins() {
  const coins = [];
  const colors = ['white', 'black'];
  let id = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      coins.push({
        id: `c${id++}`,
        x: 120 + col * 30,
        y: 120 + row * 30,
        color: colors[(row + col) % 2],
        pocketed: false,
      });
    }
  }
  coins.push({ id: 'queen', x: 150, y: 150, color: 'queen', pocketed: false });
  return coins;
}

function createRoom(code) {
  return {
    code,
    players: [],
    coins: initialCoins(),
    turnIndex: 0,
    scores: { white: 0, black: 0 },
    striker: { x: 150, y: 260, r: 12 },
    started: false,
    winner: null,
    lastShot: null,
  };
}

function roomState(room, playerId) {
  const me = room.players.find((p) => p.id === playerId);
  return {
    code: room.code,
    players: room.players.map((p) => ({ id: p.id, name: p.name, color: p.color, ready: p.ready })),
    coins: room.coins.filter((c) => !c.pocketed),
    scores: room.scores,
    striker: room.striker,
    turnPlayerId: room.players[room.turnIndex]?.id ?? null,
    myId: playerId,
    myColor: me?.color ?? null,
    started: room.started,
    winner: room.winner,
    lastShot: room.lastShot,
  };
}

function sendAll(room) {
  for (const [ws, meta] of clients) {
    if (meta.roomCode !== room.code || ws.readyState !== 1) continue;
    ws.send(JSON.stringify({ type: 'state', payload: roomState(room, meta.id) }));
  }
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function simulateShot(room, angle, power, playerColor) {
  const rad = (angle * Math.PI) / 180;
  let sx = room.striker.x;
  let sy = room.striker.y;
  let vx = Math.cos(rad) * power * 8;
  let vy = Math.sin(rad) * power * 8;
  const pocketed = [];
  const active = room.coins.filter((c) => !c.pocketed);

  for (let step = 0; step < 40; step++) {
    sx += vx;
    sy += vy;
    vx *= 0.98;
    vy *= 0.98;

    for (const p of POCKETS) {
      if (dist({ x: sx, y: sy }, p) < 16) {
        return { pocketed, foul: false, striker: { x: sx, y: sy } };
      }
    }

    for (const coin of active) {
      if (coin.pocketed) continue;
      if (dist({ x: sx, y: sy }, coin) < 18) {
        const cvx = vx * 0.7;
        const cvy = vy * 0.7;
        let cx = coin.x + cvx;
        let cy = coin.y + cvy;
        for (let s = 0; s < 15; s++) {
          cx += cvx * 0.9;
          cy += cvy * 0.9;
          for (const p of POCKETS) {
            if (dist({ x: cx, y: cy }, p) < 14) {
              coin.pocketed = true;
              pocketed.push(coin);
              if (coin.color === 'queen') room.scores[playerColor] += 3;
              else if (coin.color === playerColor) room.scores[playerColor] += 1;
              else return { pocketed, foul: true, striker: { x: 150, y: playerColor === 'white' ? 260 : 40 } };
            }
          }
        }
        break;
      }
    }
  }
  return { pocketed, foul: false, striker: { x: sx, y: sy } };
}

export function attachCarromServer(server, { path = '/ws/carrom', noServer = false } = {}) {
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
        if (room.started && !room.players.find((p) => p.id === id)) {
          ws.send(JSON.stringify({ type: 'error', payload: { message: 'اللعبة بدأت' } }));
          return;
        }
        if (room.players.length >= 2 && !room.players.find((p) => p.id === meta.id)) {
          ws.send(JSON.stringify({ type: 'error', payload: { message: 'غرفة ممتلئة' } }));
          return;
        }
        if (!room.players.find((p) => p.ws === ws)) {
          const color = room.players.length === 0 ? 'white' : 'black';
          meta.roomCode = code;
          room.players.push({ id: meta.id, name, color, ready: false, ws });
        }
        if (room.players.length === 2 && room.players.every((p) => p.ready) && !room.started) {
          room.started = true;
          room.turnIndex = 0;
          room.striker = { x: 150, y: 260, r: 12 };
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
        if (room.players.length === 2 && room.players.every((x) => x.ready)) {
          room.started = true;
          room.turnIndex = 0;
        }
        sendAll(room);
        return;
      }

      if (msg.type === 'shoot' && room.started && !room.winner) {
        const current = room.players[room.turnIndex];
        if (!current || current.id !== meta.id) return;
        const angle = Number(msg.payload?.angle) || 0;
        const power = Math.min(1, Math.max(0.15, Number(msg.payload?.power) || 0.5));
        const result = simulateShot(room, angle, power, current.color);
        room.lastShot = { angle, power, pocketed: result.pocketed.map((c) => c.id) };
        room.striker = result.striker;
        if (result.foul) {
          room.turnIndex = (room.turnIndex + 1) % 2;
        } else if (!result.pocketed.length) {
          room.turnIndex = (room.turnIndex + 1) % 2;
        }
        const target = current.color === 'white' ? 6 : 6;
        if (room.scores[current.color] >= target) room.winner = current.id;
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
      if (!room.players.length) rooms.delete(meta.roomCode);
      else sendAll(room);
    });
  });

  return wss;
}
