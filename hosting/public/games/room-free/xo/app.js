const boot = window.LinkUpRoomBoot?.parse() || {};
window.LinkUpRoomBoot?.applyRtlShell();

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
  scoreboard: document.getElementById('scoreboard'),
  board: document.getElementById('board'),
  rematch: document.getElementById('rematch'),
  overlay: document.getElementById('overlay'),
  resultEmoji: document.getElementById('result-emoji'),
  resultText: document.getElementById('result-text'),
  resultRematch: document.getElementById('result-rematch'),
};

const fxCanvas = document.getElementById('fx');
const fxCtx = fxCanvas.getContext('2d');
let particles = [];
let ws;
let state = null;
let lastBoard = Array(9).fill(null);
let lastTurnId = null;

function resizeFx() {
  fxCanvas.width = window.innerWidth;
  fxCanvas.height = window.innerHeight;
}
resizeFx();
window.addEventListener('resize', resizeFx);

function send(type, payload = {}) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type, payload }));
}

function spawnParticles(x, y, color, n = 18) {
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color,
      size: 3 + Math.random() * 4,
    });
  }
}

function burstAtCell(index, mark) {
  const cell = els.board.children[index];
  if (!cell) return;
  const r = cell.getBoundingClientRect();
  const color = mark === 'X' ? '#38bdf8' : '#f472b6';
  spawnParticles(r.left + r.width / 2, r.top + r.height / 2, color, 14);
}

function spawnConfetti() {
  const colors = ['#fbbf24', '#a855f7', '#38bdf8', '#f472b6', '#4ade80'];
  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * fxCanvas.width,
      y: -10,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4,
      life: 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 5,
    });
  }
}

function tickFx() {
  fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
  particles = particles.filter((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;
    p.life -= 0.018;
    if (p.life <= 0) return false;
    fxCtx.globalAlpha = p.life;
    fxCtx.fillStyle = p.color;
    fxCtx.beginPath();
    fxCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    fxCtx.fill();
    return true;
  });
  fxCtx.globalAlpha = 1;
  requestAnimationFrame(tickFx);
}
requestAnimationFrame(tickFx);

function playMarkSound(mark) {
  if (mark === 'X') window.LinkUpAudio?.xoX?.();
  else window.LinkUpAudio?.xoO?.();
}

function connect() {
  const url = window.LinkUpRoomBoot?.wsPath('xo') || 'ws://localhost:8080/ws/xo';
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
            shakeBoard();
            return;
          }
          if (msg.type === 'joined' || msg.type === 'state') {
            const next = msg.payload || msg;
            handleStateChange(next);
            state = next;
            render();
          }
        };
      }),
  );
}

function handleStateChange(next) {
  if (!next.board) return;
  for (let i = 0; i < 9; i++) {
    if (next.board[i] && !lastBoard[i]) {
      playMarkSound(next.board[i]);
      setTimeout(() => burstAtCell(i, next.board[i]), 50);
    }
  }
  if ((next.winner || next.draw) && state && !state.winner && !state.draw) {
    if (next.winner) {
      window.LinkUpAudio?.win();
      spawnConfetti();
    } else {
      window.LinkUpAudio?.xoDraw?.();
    }
  }
  lastBoard = [...next.board];
}

function shakeBoard() {
  els.board.classList.add('shake');
  setTimeout(() => els.board.classList.remove('shake'), 400);
}

function buildBoard() {
  els.board.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cell';
    btn.dataset.idx = String(i);
    btn.setAttribute('role', 'gridcell');
    btn.onclick = () => tryMove(i);
    els.board.appendChild(btn);
  }
}
buildBoard();

function tryMove(cell) {
  if (!state?.started || state.winner || state.draw) return;
  if (state.turnPlayerId !== state.myId) {
    window.LinkUpAudio?.error();
    shakeBoard();
    return;
  }
  if (state.board[cell]) return;
  window.LinkUpAudio?.tap();
  send('move', { cell });
}

function renderScoreboard() {
  els.scoreboard.innerHTML = (state.players || [])
    .map((p) => {
      const active = state.turnPlayerId === p.id && state.started && !state.winner && !state.draw;
      return `<div class="score-card mark-${p.mark.toLowerCase()}${active ? ' active' : ''}">
        <div class="mark">${p.mark}</div>
        <div class="name">${p.name}</div>
        <div class="pts">${p.score ?? 0} نقطة</div>
      </div>`;
    })
    .join('');
}

function renderBoard() {
  const winLine = new Set(state.winningLine || []);
  for (let i = 0; i < 9; i++) {
    const btn = els.board.children[i];
    if (!btn) continue;
    const val = state.board[i];
    btn.textContent = val || '';
    btn.disabled = !!val || state.turnPlayerId !== state.myId || !!state.winner || !!state.draw;
    btn.className = 'cell';
    if (val === 'X') btn.classList.add('val-x');
    if (val === 'O') btn.classList.add('val-o');
    if (winLine.has(i)) btn.classList.add('win');
    if (val && val !== lastBoard[i]) btn.classList.add('pop');
  }
}

function showResult() {
  if (!state.winner && !state.draw) {
    els.overlay.classList.add('hidden');
    els.rematch.classList.add('hidden');
    return;
  }
  const meWon = state.winner === state.myId;
  if (state.draw) {
    els.resultEmoji.textContent = '🤝';
    els.resultText.textContent = 'تعادل!';
  } else if (meWon) {
    els.resultEmoji.textContent = '🏆';
    els.resultText.textContent = 'فزت!';
  } else {
    els.resultEmoji.textContent = '😅';
    els.resultText.textContent = 'خسرت — حظاً أوفر';
  }
  els.overlay.classList.remove('hidden');
  els.rematch.classList.remove('hidden');
}

function render() {
  if (!state) return;
  if (!state.started) {
    els.lobbyInfo.classList.remove('hidden');
    els.roomCode.textContent = state.code;
    els.players.innerHTML = (state.players || [])
      .map(
        (p) =>
          `<li class="${p.ready ? 'ready' : ''}">${p.mark} — ${p.name}${p.ready ? ' ✓' : ''}</li>`,
      )
      .join('');
    return;
  }

  els.lobby.classList.add('hidden');
  els.game.classList.remove('hidden');
  const myTurn = state.turnPlayerId === state.myId;
  if (state.winner || state.draw) {
    els.status.textContent = state.draw ? '🤝 تعادل' : state.winner === state.myId ? '🏆 فزت!' : '🏁 انتهت الجولة';
    els.status.classList.remove('my-turn');
  } else {
    const justMyTurn = myTurn && state.turnPlayerId !== lastTurnId;
    els.status.textContent = myTurn ? '✨ دورك — اختر خلية' : '⏳ بانتظار الخصم...';
    els.status.classList.toggle('my-turn', myTurn);
    if (justMyTurn) window.LinkUpAudio?.turn();
    lastTurnId = state.turnPlayerId;
  }
  renderScoreboard();
  renderBoard();
  showResult();
}

function requestRematch() {
  window.LinkUpAudio?.tap();
  send('rematch');
  els.overlay.classList.add('hidden');
  lastBoard = Array(9).fill(null);
}

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

els.rematch.onclick = requestRematch;
els.resultRematch.onclick = requestRematch;

if (boot.playerName) els.name.value = boot.playerName;
if (boot.joinCode) els.code.value = boot.joinCode;
if (boot.autoCreate || boot.autoJoin) {
  void connect().then(() => {
    send('join', { name: boot.playerName || 'لاعب', code: boot.joinCode || undefined });
    setTimeout(() => send('ready'), 700);
  });
}
