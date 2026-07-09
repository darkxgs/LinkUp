const boot = window.LinkUpRoomBoot?.parse() || {};
window.LinkUpRoomBoot?.applyRtlShell();

const els = {
  lobby: document.getElementById('lobby'),
  game: document.getElementById('game'),
  name: document.getElementById('name'),
  code: document.getElementById('code'),
  join: document.getElementById('join'),
  lobbyInfo: document.getElementById('lobby-info'),
  lobbyCode: document.getElementById('lobby-code'),
  players: document.getElementById('players'),
  ready: document.getElementById('ready'),
  status: document.getElementById('status'),
  chain: document.getElementById('chain'),
  hand: document.getElementById('hand'),
  draw: document.getElementById('draw'),
  pass: document.getElementById('pass'),
  winner: document.getElementById('winner'),
};

let ws;
let state = null;
let pendingTile = null;

function send(action, extra = {}) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ action, ...extra }));
}

function connect() {
  const url = window.LinkUpRoomBoot?.wsPath('domino') || 'ws://localhost:8080/ws/domino';
  const prime = window.LinkUpRoomBoot?.primeGameServer?.() || Promise.resolve();
  return prime.then(
    () =>
      new Promise((resolve, reject) => {
        ws = new WebSocket(url);
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error('فشل الاتصال'));
        ws.onmessage = (ev) => {
          const msg = JSON.parse(ev.data);
          if (msg.action === 'error') {
            window.LinkUpAudio?.error();
            alert(msg.message);
            return;
          }
          if (msg.action === 'state') {
            state = msg;
            render();
          }
        };
      }),
  );
}

function tileEl(t, playable, onClick) {
  const d = document.createElement('button');
  d.type = 'button';
  d.className = 'tile' + (playable ? ' playable' : '');
  d.innerHTML = `<span class="pip">${t.a}</span><span class="pip">${t.b}</span>`;
  d.onclick = onClick;
  return d;
}

function canPlay(tile) {
  if (!state?.chain?.length) return true;
  const { leftEnd, rightEnd } = state;
  return tile.a === leftEnd || tile.b === leftEnd || tile.a === rightEnd || tile.b === rightEnd;
}

function pickEnd(tile, cb) {
  const wrap = document.createElement('div');
  wrap.className = 'pick-end';
  wrap.innerHTML = '<div class="box"><p>أين تضع القطعة؟</p></div>';
  const box = wrap.querySelector('.box');
  const left = document.createElement('button');
  left.className = 'btn';
  left.textContent = 'يسار';
  left.onclick = () => {
        wrap.remove();
        cb('left');
      };
  const right = document.createElement('button');
  right.className = 'btn secondary';
  right.textContent = 'يمين';
  right.onclick = () => {
        wrap.remove();
        cb('right');
      };
  box.appendChild(left);
  box.appendChild(right);
  document.body.appendChild(wrap);
}

function render() {
  if (!state) return;
  if (!state.started) {
    els.lobbyInfo.classList.remove('hidden');
    els.lobbyCode.textContent = state.lobbyId;
    els.players.innerHTML = state.players
      .map((p) => `<li class="${p.ready ? 'ready' : ''}">${p.name} ${p.ready ? '✓' : ''}</li>`)
      .join('');
    return;
  }

  els.lobby.classList.add('hidden');
  els.game.classList.remove('hidden');

  const myTurn = state.turnPlayerId === state.myId;
  els.status.textContent = myTurn
    ? '🎯 دورك — اختر قطعة'
    : `دور ${state.players.find((p) => p.id === state.turnPlayerId)?.name || '...'}`;
  els.status.classList.toggle('my-turn', myTurn);

  els.chain.innerHTML = '';
  (state.chain || []).forEach((t) => {
    const n = document.createElement('div');
    n.className = 'tile';
    n.style.cursor = 'default';
    n.innerHTML = `<span class="pip">${t.a}</span><span class="pip">${t.b}</span>`;
    els.chain.appendChild(n);
  });

  els.hand.innerHTML = '';
  (state.myHand || []).forEach((t) => {
    const playable = myTurn && canPlay(t);
    els.hand.appendChild(
      tileEl(t, playable, () => {
        if (!playable) return;
        window.LinkUpAudio?.play();
        if (!state.chain.length) {
          send('play', { tileId: t.id, end: 'right' });
          return;
        }
        pickEnd(t, (end) => send('play', { tileId: t.id, end }));
      }),
    );
  });

  const hasPlay = (state.myHand || []).some((t) => canPlay(t));
  els.draw.classList.toggle('hidden', !myTurn || hasPlay || !state.boneyardCount);
  els.pass.classList.toggle('hidden', !myTurn || hasPlay || state.boneyardCount > 0);

  if (state.winner) {
    const w = state.players.find((p) => p.id === state.winner);
    els.winner.classList.remove('hidden');
    els.winner.textContent = state.winner === state.myId ? '🏆 فزت!' : `🏆 الفائز: ${w?.name || ''}`;
    if (state.winner === state.myId) window.LinkUpAudio?.win();
  }
}

els.join.onclick = async () => {
  const name = els.name.value.trim() || boot.playerName || 'لاعب';
  if (!name) return;
  try {
    await connect();
    window.LinkUpAudio?.join();
    send('join', { name, lobbyId: els.code.value.trim() || boot.joinCode || undefined });
    els.lobbyInfo.classList.remove('hidden');
  } catch (e) {
    alert(e.message || 'تعذّر الاتصال');
  }
};

els.ready.onclick = () => {
  window.LinkUpAudio?.tap();
  send('ready');
};

els.draw.onclick = () => {
  window.LinkUpAudio?.card();
  send('draw');
};

els.pass.onclick = () => {
  window.LinkUpAudio?.tap();
  send('pass');
};

if (boot.playerName) els.name.value = boot.playerName;
if (boot.joinCode) els.code.value = boot.joinCode;

if (boot.autoCreate || boot.autoJoin) {
  els.name.value = boot.playerName || els.name.value;
  if (boot.joinCode) els.code.value = boot.joinCode;
  void connect().then(() => {
    send('join', {
      name: els.name.value.trim() || 'لاعب',
      lobbyId: boot.joinCode || undefined,
    });
    if (boot.autoJoin) setTimeout(() => send('ready'), 600);
    else setTimeout(() => send('ready'), 600);
  });
}
