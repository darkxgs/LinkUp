const boot = window.LinkUpRoomBoot?.parse() || {};
window.LinkUpRoomBoot?.applyRtlShell();

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const els = {
  lobby: document.getElementById('lobby'),
  game: document.getElementById('game'),
  name: document.getElementById('name'),
  code: document.getElementById('code'),
  join: document.getElementById('join'),
  lobbyInfo: document.getElementById('lobby-info'),
  roomCode: document.getElementById('room-code'),
  players: document.getElementById('players'),
  ready: document.getElementById('ready'),
  status: document.getElementById('status'),
  scores: document.getElementById('scores'),
  winner: document.getElementById('winner'),
};

let ws;
let state = null;
let drag = null;

const POCKETS = [
  [20, 20],
  [280, 20],
  [20, 280],
  [280, 280],
];

function send(type, payload = {}) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type, payload }));
}

function connect() {
  const url = window.LinkUpRoomBoot?.wsPath('carrom') || 'ws://localhost:8080/ws/carrom';
  const prime = window.LinkUpRoomBoot?.primeGameServer?.() || Promise.resolve();
  return prime.then(
    () =>
      new Promise((resolve, reject) => {
        ws = new WebSocket(url);
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error('فشل الاتصال'));
        ws.onmessage = (ev) => {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'error') {
            window.LinkUpAudio?.error();
            alert(msg.payload?.message);
            return;
          }
          if (msg.type === 'joined' || msg.type === 'state') {
            state = msg.payload || msg;
            render();
          }
        };
      }),
  );
}

function coinColor(c) {
  if (c === 'queen') return '#ec4899';
  if (c === 'white') return '#f8fafc';
  return '#1e293b';
}

function draw() {
  if (!state) return;
  ctx.fillStyle = '#c2762a';
  ctx.fillRect(0, 0, 300, 300);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 30, 240, 240);
  POCKETS.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
  });
  (state.coins || []).forEach((c) => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = coinColor(c.color);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.stroke();
  });
  const s = state.striker || { x: 150, y: 260, r: 12 };
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.r || 12, 0, Math.PI * 2);
  ctx.fillStyle = '#fde047';
  ctx.fill();
  ctx.strokeStyle = '#ca8a04';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (drag) {
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(drag.x, drag.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function render() {
  if (!state) return;
  if (!state.started) {
    els.lobbyInfo.classList.remove('hidden');
    els.roomCode.textContent = state.code;
    els.players.innerHTML = (state.players || [])
      .map((p) => `<li class="${p.ready ? 'ready' : ''}">${p.name} (${p.color === 'white' ? 'أبيض' : 'أسود'})</li>`)
      .join('');
    return;
  }
  els.lobby.classList.add('hidden');
  els.game.classList.remove('hidden');
  const myTurn = state.turnPlayerId === state.myId;
  els.status.textContent = myTurn ? '🎯 اسحب للتصويب والضرب' : 'بانتظار الخصم...';
  els.status.classList.toggle('my-turn', myTurn);
  els.scores.innerHTML = `أبيض: ${state.scores?.white ?? 0} | أسود: ${state.scores?.black ?? 0}`;
  if (state.winner) {
    els.winner.classList.remove('hidden');
    els.winner.textContent = state.winner === state.myId ? '🏆 فزت!' : '🏆 انتهت اللعبة';
    if (state.winner === state.myId) window.LinkUpAudio?.win();
  }
  draw();
}

function pointerPos(e) {
  const r = canvas.getBoundingClientRect();
  const scaleX = canvas.width / r.width;
  const scaleY = canvas.height / r.height;
  const cx = ('touches' in e ? e.touches[0].clientX : e.clientX) - r.left;
  const cy = ('touches' in e ? e.touches[0].clientY : e.clientY) - r.top;
  return { x: cx * scaleX, y: cy * scaleY };
}

canvas.addEventListener('pointerdown', (e) => {
  if (!state?.started || state.turnPlayerId !== state.myId || state.winner) return;
  drag = pointerPos(e);
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  drag = pointerPos(e);
  draw();
});

canvas.addEventListener('pointerup', (e) => {
  if (!drag || !state?.striker) return;
  const end = pointerPos(e);
  const dx = state.striker.x - end.x;
  const dy = state.striker.y - end.y;
  const power = Math.min(1, Math.hypot(dx, dy) / 120);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  drag = null;
  if (power < 0.12) return;
  window.LinkUpAudio?.strike();
  send('shoot', { angle, power });
});

els.join.onclick = async () => {
  const name = els.name.value.trim() || boot.playerName || 'لاعب';
  try {
    await connect();
    window.LinkUpAudio?.join();
    send('join', {
      name,
      code: (els.code.value.trim() || boot.joinCode || '').toUpperCase() || undefined,
    });
  } catch (e) {
    alert(e.message);
  }
};

els.ready.onclick = () => {
  window.LinkUpAudio?.tap();
  send('ready');
};

if (boot.playerName) els.name.value = boot.playerName;
if (boot.joinCode) els.code.value = boot.joinCode;
if (boot.autoCreate || boot.autoJoin) {
  void connect().then(() => {
    send('join', { name: boot.playerName || 'لاعب', code: boot.joinCode || undefined });
    setTimeout(() => send('ready'), 700);
  });
}
