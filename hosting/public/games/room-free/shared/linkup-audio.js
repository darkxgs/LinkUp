/**
 * مؤثرات صوتية خفيفة — Web Audio API
 */
(function (global) {
  let ctx = null;

  function getCtx() {
    if (!ctx) {
      try {
        ctx = new (global.AudioContext || global.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol) {
    const ac = getCtx();
    if (!ac) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.value = vol ?? 0.08;
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.connect(g);
    g.connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + dur);
  }

  const sfx = {
    tap: () => tone(520, 0.06, 'triangle', 0.06),
    join: () => {
      tone(440, 0.08, 'sine', 0.07);
      setTimeout(() => tone(660, 0.1, 'sine', 0.07), 70);
    },
    play: () => tone(320, 0.1, 'square', 0.05),
    win: () => {
      [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.15, 'sine', 0.08), i * 90));
    },
    error: () => tone(180, 0.2, 'sawtooth', 0.05),
    turn: () => tone(740, 0.05, 'triangle', 0.05),
    strike: () => tone(120, 0.12, 'sine', 0.09),
    pocket: () => {
      tone(880, 0.06, 'sine', 0.07);
      setTimeout(() => tone(1100, 0.08, 'sine', 0.06), 50);
    },
    card: () => tone(400, 0.05, 'triangle', 0.05),
    xoX: () => {
      tone(620, 0.08, 'square', 0.06);
      setTimeout(() => tone(780, 0.06, 'sine', 0.05), 60);
    },
    xoO: () => {
      tone(480, 0.1, 'sine', 0.07);
      setTimeout(() => tone(360, 0.08, 'triangle', 0.06), 80);
    },
    xoDraw: () => {
      tone(300, 0.12, 'triangle', 0.05);
      setTimeout(() => tone(300, 0.12, 'triangle', 0.05), 120);
    },
  };

  global.LinkUpAudio = sfx;
})(typeof window !== 'undefined' ? window : globalThis);
