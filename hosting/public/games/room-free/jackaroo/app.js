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
  track: document.getElementById('track'),
  hand: document.getElementById('hand'),
  winner: document.getElementById('winner'),
};

let ws;
let state = null;
let selectedCard = null;

function send(type, payload = {}) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type, payload }));
}

function connect() {
  const url = window.LinkUpRoomBoot?.wsPath('jackaroo') || 'ws://localhost:8080/ws/jackaroo';
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
            selectedCard = null;
            render();
          }
        };
      }),
  );
}

function renderTrack() {
  els.track.innerHTML = '';
  const len = state.trackLen || 16;
  const myMarbles = state.marbles?.[state.myId] || [];
  for (let i = 0; i < len; i++) {
    const cell = document.createElement('div');
    cell.className = 'track-cell';
    const onTrack = myMarbles.filter((m) => !m.home && !m.done && m.pos === i);
    if (onTrack.length) {
      cell.classList.add('has-marble');
      cell.innerHTML = `<span class="marble-dot"></span>`;
    } else {
      cell.textContent = i + 1;
    }
    els.track.appendChild(cell);
  }
  const home = myMarbles.filter((m) => m.home).length;
  const done = myMarbles.filter((m) => m.done).length;
  const info = document.createElement('p');
  info.style.textAlign = 'center';
  info.style.fontSize = '0.8rem';
  info.style.opacity = '0.75';
  info.textContent = `في البيت: ${home} | وصل: ${done}/4`;
  els.track.appendChild(info);
}

function playCard(card, marbleIndex) {
  window.LinkUpAudio?.card();
  send('play', { cardId: card.id, marbleIndex });
  selectedCard = null;
}

function cardLabel(card) {
  if (card.value === 1) return 'A';
  if (card.value === 13) return 'K';
  if (card.value === 4) return '4←';
  return String(card.value);
}

function cardHint(card) {
  if (card.value === 4) return '٤ خطوات للخلف';
  if (card.value === 1 || card.value === 13) return 'أدخل برجية أو تقدّم';
  return `${card.value} خطوات للأمام`;
}

function renderHand() {
  els.hand.innerHTML = '';
  const myTurn = state.turnPlayerId === state.myId;
  (state.myHand || []).forEach((card) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'card' + (selectedCard?.id === card.id ? ' selected' : '');
    b.textContent = cardLabel(card);
    b.title = cardHint(card);
    b.disabled = !myTurn;
    b.onclick = () => {
      if (!myTurn) return;
      selectedCard = card;
      renderHand();
      showMarblePick(card);
    };
    els.hand.appendChild(b);
  });
}

function showMarblePick(card) {
  const existing = document.querySelector('.marble-pick');
  if (existing) existing.remove();
  const wrap = document.createElement('div');
  wrap.className = 'marble-pick';
  const marbles = state.marbles?.[state.myId] || [];
  marbles.forEach((m, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = m.home ? 'بيت' : m.done ? '✓' : m.pos + 1;
    btn.onclick = () => playCard(card, idx);
    wrap.appendChild(btn);
  });
  els.hand.before(wrap);
}

function render() {
  if (!state) return;
  if (!state.started) {
    els.lobbyInfo.classList.remove('hidden');
    els.roomCode.textContent = state.code;
    els.players.innerHTML = (state.players || [])
      .map((p) => `<li class="${p.ready ? 'ready' : ''}">${p.name}</li>`)
      .join('');
    return;
  }
  els.lobby.classList.add('hidden');
  els.game.classList.remove('hidden');
  const myTurn = state.turnPlayerId === state.myId;
  els.status.textContent = myTurn ? '🃏 اختر ورقة ثم البرجية' : 'بانتظار اللاعب الآخر...';
  els.status.classList.toggle('my-turn', myTurn);
  renderTrack();
  renderHand();
  if (state.winner) {
    els.winner.classList.remove('hidden');
    els.winner.textContent = state.winner === state.myId ? '🏆 فزت!' : '🏆 انتهت اللعبة';
    if (state.winner === state.myId) window.LinkUpAudio?.win();
  }
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

if (boot.playerName) els.name.value = boot.playerName;
if (boot.joinCode) els.code.value = boot.joinCode;
if (boot.autoCreate || boot.autoJoin) {
  void connect().then(() => {
    send('join', { name: boot.playerName || 'لاعب', code: boot.joinCode || undefined });
    setTimeout(() => send('ready'), 700);
  });
}
