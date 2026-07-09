import { WebSocketServer } from 'ws';

const clients = new Map();
const rooms = new Map();

const WINS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createRoom(code) {
  return {
    code,
    players: [],
    board: Array(9).fill(null),
    turnIndex: 0,
    started: false,
    winner: null,
    winningLine: null,
    draw: false,
    scores: {},
    round: 1,
  };
}

function checkResult(board) {
  for (const [a, b, c] of WINS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  if (board.every((c) => c)) return { winner: null, line: null, draw: true };
  return null;
}

function roomState(room, playerId) {
  const me = room.players.find((p) => p.id === playerId);
  return {
    code: room.code,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      mark: p.mark,
      ready: p.ready,
      score: room.scores[p.id] ?? 0,
    })),
    board: room.board,
    turnPlayerId: room.players[room.turnIndex]?.id ?? null,
    myId: playerId,
    myMark: me?.mark ?? null,
    started: room.started,
    winner: room.winner,
    winnerMark: room.winnerMark ?? null,
    winningLine: room.winningLine,
    draw: room.draw,
    round: room.round,
  };
}

function sendAll(room) {
  for (const [ws, meta] of clients) {
    if (meta.roomCode !== room.code || ws.readyState !== 1) continue;
    ws.send(JSON.stringify({ type: 'state', payload: roomState(room, meta.id) }));
  }
}

function resetBoard(room) {
  room.board = Array(9).fill(null);
  room.winner = null;
  room.winnerMark = null;
  room.winningLine = null;
  room.draw = false;
  room.turnIndex = 0;
  room.round += 1;
}

export function attachXoServer(server, { path = '/ws/xo', noServer = false } = {}) {
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
        if (room.players.length >= 2 && !room.players.find((p) => p.id === meta.id)) {
          ws.send(JSON.stringify({ type: 'error', payload: { message: 'غرفة ممتلئة (لاعبان)' } }));
          return;
        }

        if (!room.players.find((p) => p.id === meta.id)) {
          meta.roomCode = code;
          const mark = room.players.length === 0 ? 'X' : 'O';
          room.players.push({ id: meta.id, name, mark, ready: false });
          room.scores[meta.id] = room.scores[meta.id] ?? 0;
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
        if (room.players.length === 2 && room.players.every((x) => x.ready) && !room.started) {
          room.started = true;
          resetBoard(room);
        }
        sendAll(room);
        return;
      }

      if (msg.type === 'move' && room.started && !room.winner && !room.draw) {
        const current = room.players[room.turnIndex];
        if (!current || current.id !== meta.id) return;
        const cell = Number(msg.payload?.cell);
        if (!Number.isInteger(cell) || cell < 0 || cell > 8) return;
        if (room.board[cell]) {
          ws.send(JSON.stringify({ type: 'error', payload: { message: 'الخلية مشغولة' } }));
          return;
        }

        room.board[cell] = current.mark;
        const result = checkResult(room.board);
        if (result?.winner) {
          room.winner = current.id;
          room.winnerMark = result.winner;
          room.winningLine = result.line;
          room.scores[current.id] = (room.scores[current.id] ?? 0) + 1;
        } else if (result?.draw) {
          room.draw = true;
        } else {
          room.turnIndex = (room.turnIndex + 1) % 2;
        }
        sendAll(room);
        return;
      }

      if (msg.type === 'rematch' && (room.winner || room.draw)) {
        if (room.players.length < 2) return;
        room.started = true;
        resetBoard(room);
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
      delete room.scores[meta.id];
      if (!room.players.length) rooms.delete(meta.roomCode);
      else {
        room.started = false;
        room.players.forEach((p) => {
          p.ready = false;
        });
        resetBoard(room);
        sendAll(room);
      }
    });
  });

  return wss;
}
