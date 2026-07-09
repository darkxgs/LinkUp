/* ============================================================
   Linkup — Hilo Sound (Web Audio API, fully synthesized)
   ------------------------------------------------------------
   Generates game sound effects procedurally. Zero audio files.
   Resumes AudioContext on the first click.
   ============================================================ */
(function (global) {
  "use strict";

  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.45;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone({ freq, type = "sine", dur = 0.15, attack = 0.005, peak = 0.3, slideTo = null, when = 0, filter = null }) {
    const c = ensure();
    if (!c || muted) return;
    const t0 = c.currentTime + when;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);

    let node = g;
    if (filter) {
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = filter;
      osc.connect(lp);
      lp.connect(g);
    } else {
      osc.connect(g);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  const Sound = {
    get muted() { return muted; },
    setMuted(m) { muted = !!m; },
    toggle() { muted = !muted; return muted; },
    unlock() { ensure(); },

    /** subtle UI click */
    click() {
      tone({ freq: 300, type: "square", dur: 0.05, peak: 0.1 });
    },

    /** Card dealing/whoosh sound */
    flip() {
      // Swipe sound made of a rapid pitch down sweep
      tone({ freq: 800, slideTo: 150, type: "triangle", dur: 0.12, peak: 0.15, filter: 1000 });
    },

    /** Win step — pitch grows slightly with current streak */
    win(streak = 1) {
      const base = 523.25; // C5
      // Pitch goes up by steps in the pentatonic scale or simply offset by streak
      const scaleOffsets = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
      const offset = scaleOffsets[Math.min(streak - 1, scaleOffsets.length - 1)];
      const freq = base * Math.pow(2, offset / 12);

      tone({ freq: freq, type: "sine", dur: 0.22, peak: 0.22 });
      tone({ freq: freq * 1.5, type: "sine", dur: 0.22, peak: 0.11, when: 0.04 });
    },

    /** celebratory arpeggio for cashing out */
    cashout() {
      const base = 523.25; // C5
      const ratios = [1, 1.25, 1.5, 2, 2.5]; // Major chord C-E-G-C-E
      for (let i = 0; i < ratios.length; i++) {
        tone({ freq: base * ratios[i], type: "sine", dur: 0.38, peak: 0.22, when: i * 0.07 });
      }
    },

    /** short low pitch buzzy sound */
    lose() {
      tone({ freq: 180, slideTo: 60, type: "sawtooth", dur: 0.34, peak: 0.22, filter: 500 });
    }
  };

  global.Sound = Sound;
})(window);
