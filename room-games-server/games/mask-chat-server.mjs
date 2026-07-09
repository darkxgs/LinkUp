import { WebSocketServer } from 'ws';

const rooms = new Map();

function getRoom(code) {
  if (!rooms.has(code)) {
    rooms.set(code, {
      code,
      players: new Map(),
      messages: [],
      startedAt: null,
      durationMs: 5 * 60 * 1000,
      revealed: false,
    });
  }
  return rooms.get(code);
}

function broadcast(room, payload, exceptWs = null) {
  for (const [, p] of room.players) {
    if (p.ws && p.ws !== exceptWs && p.ws.readyState === 1) {
      p.ws.send(JSON.stringify(payload));
    }
  }
}

function roomState(room) {
  return {
    code: room.code,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      mask: p.mask,
      realName: room.revealed ? p.realName : undefined,
      uid: room.revealed ? p.uid : undefined,
    })),
    messages: room.messages.slice(-80),
    startedAt: room.startedAt,
    durationMs: room.durationMs,
    revealed: room.revealed,
    remainingMs: room.startedAt
      ? Math.max(0, room.durationMs - (Date.now() - room.startedAt))
      : room.durationMs,
  };
}

const MASKS = ['🎭', '🦊', '🐼', '🦁', '🐯', '🦄', '🐸', '👻', '🤖', '🎃'];

function randomMask() {
  return MASKS[Math.floor(Math.random() * MASKS.length)];
}

export function attachMaskChatServer(server, { path = '/ws/mask-chat', noServer = false } = {}) {
  const wss = new WebSocketServer(
    noServer || !server
      ? { noServer: true, path, perMessageDeflate: false }
      : { server, path, perMessageDeflate: false },
  );

  wss.on('connection', (ws) => {
    let playerId = null;
    let roomCode = null;

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }

      if (msg.type === 'join') {
        const code = String(msg.payload?.code || '').toUpperCase().slice(0, 8);
        if (!code) return;
        const room = getRoom(code);
        if (room.players.size >= 2 && !room.players.has(playerId)) {
          ws.send(JSON.stringify({ type: 'error', payload: { message: 'الغرفة ممتلئة (لاعبان فقط)' } }));
          return;
        }
        playerId = msg.payload?.playerId || `p_${Math.random().toString(36).slice(2, 9)}`;
        roomCode = code;
        room.players.set(playerId, {
          id: playerId,
          ws,
          mask: msg.payload?.mask || randomMask(),
          realName: String(msg.payload?.realName || 'لاعب'),
          uid: String(msg.payload?.uid || ''),
        });
        if (room.players.size === 2 && !room.startedAt) {
          room.startedAt = Date.now();
        }
        ws.send(JSON.stringify({ type: 'joined', payload: { playerId, state: roomState(room) } }));
        broadcast(room, { type: 'state', payload: roomState(room) }, ws);
        return;
      }

      if (!roomCode || !playerId) return;
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.get(playerId);
      if (!player) return;

      if (msg.type === 'chat' && !room.revealed) {
        const text = String(msg.payload?.text || '').trim().slice(0, 500);
        if (!text) return;
        const entry = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          from: playerId,
          mask: player.mask,
          text,
          at: Date.now(),
        };
        room.messages.push(entry);
        broadcast(room, { type: 'message', payload: entry });
        return;
      }

      if (msg.type === 'tick') {
        if (!room.startedAt) return;
        const remaining = room.durationMs - (Date.now() - room.startedAt);
        if (remaining <= 0 && !room.revealed) {
          room.revealed = true;
          broadcast(room, { type: 'reveal', payload: roomState(room) });
        } else {
          ws.send(JSON.stringify({ type: 'tick', payload: { remainingMs: Math.max(0, remaining) } }));
        }
      }
    });

    ws.on('close', () => {
      if (!roomCode || !playerId) return;
      const room = rooms.get(roomCode);
      if (!room) return;
      room.players.delete(playerId);
      if (room.players.size === 0) rooms.delete(roomCode);
      else broadcast(room, { type: 'state', payload: roomState(room) });
    });
  });

  return wss;
}
