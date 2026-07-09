const boot = window.LinkUpRoomBoot?.parse() || {};
const params = boot;
const playerId = params.uid || `p_${Math.random().toString(36).slice(2, 10)}`;
const roomCode = (params.joinCode || params.sessionId || 'MASK').toUpperCase().slice(0, 8);
const realName = params.playerName || 'لاعب';
const wsUrl = window.LinkUpRoomBoot?.wsPath('mask-chat') || 'ws://localhost:8080/ws/mask-chat';

const chatEl = document.getElementById('chat');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const timerEl = document.getElementById('timer');
const revealEl = document.getElementById('reveal');
const revealCards = document.getElementById('reveal-cards');

let ws;
let myId = playerId;
let durationMs = 5 * 60 * 1000;
let startedAt = null;
let tickTimer;

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function playPing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.value = 0.04;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.08);
  } catch (_) {}
}

function addBubble(entry, mine = false) {
  const div = document.createElement('div');
  div.className = `bubble${mine ? ' mine' : ''}`;
  div.innerHTML = `<span class="mask">${entry.mask || '🎭'}</span><div class="text"></div>`;
  div.querySelector('.text').textContent = entry.text;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  if (!mine) playPing();
}

function connect() {
  ws = new WebSocket(wsUrl);
  ws.addEventListener('open', () => {
    ws.send(
      JSON.stringify({
        type: 'join',
        payload: { code: roomCode, playerId, realName, uid: params.uid || '' },
      }),
    );
    tickTimer = setInterval(() => ws?.readyState === 1 && ws.send(JSON.stringify({ type: 'tick' })), 1000);
  });

  ws.addEventListener('message', (ev) => {
    let data;
    try {
      data = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (data.type === 'joined' || data.type === 'state') {
      const st = data.payload?.state || data.payload;
      if (st?.startedAt) startedAt = st.startedAt;
      if (st?.durationMs) durationMs = st.durationMs;
      st?.messages?.forEach((m) => addBubble(m, m.from === myId));
    }
    if (data.type === 'message') addBubble(data.payload, data.payload.from === myId);
    if (data.type === 'tick') timerEl.textContent = fmt(data.payload.remainingMs);
    if (data.type === 'reveal') showReveal(data.payload);
  });
}

function showReveal(state) {
  clearInterval(tickTimer);
  timerEl.textContent = '00:00';
  revealCards.innerHTML = '';
  (state.players || []).forEach((p) => {
    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML = `<div class="emoji">${p.mask}</div><div class="name">${p.realName || '???'}</div>`;
    revealCards.appendChild(c);
  });
  revealEl.classList.remove('hidden');
  playPing();
  window.LinkUpRoomBoot?.postToApp({ type: 'ROOM_GAME_EVENT', event: 'mask_revealed', sessionId: params.sessionId });
}

function sendChat() {
  const text = inputEl.value.trim();
  if (!text || !ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ type: 'chat', payload: { text } }));
  inputEl.value = '';
}

sendBtn.addEventListener('click', sendChat);
inputEl.addEventListener('keydown', (e) => e.key === 'Enter' && sendChat());
document.getElementById('close-reveal').addEventListener('click', () => {
  window.LinkUpRoomBoot?.postToApp({ type: 'CLOSE_GAME' });
});

window.LinkUpRoomBoot?.applyRtlShell();
window.LinkUpRoomBoot?.listenAppMessages((data) => {
  if (data.type === 'INIT_DATA' && data.playerName) {
    /* name already in URL */
  }
});

if (startedAt) {
  setInterval(() => {
    timerEl.textContent = fmt(durationMs - (Date.now() - startedAt));
  }, 500);
}

connect();
