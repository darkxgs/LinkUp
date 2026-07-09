/* ============================================================
   Linkup — Sound  (Web Audio API, fully synthesized)
   ------------------------------------------------------------
   No audio files: every sound is generated procedurally so the
   game stays self-contained and works offline / over file://.
   The AudioContext is created lazily and resumed on the first
   user gesture (browser autoplay policy).
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

  // generic plucked tone with an attack/decay envelope
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

    /** rising sweep while the multiplier counts up */
    rollStart(durationMs = 350) {
      tone({ freq: 180, slideTo: 540, type: "triangle", dur: durationMs / 1000, peak: 0.1 });
    },

    /** win chime — brighter & longer for bigger multipliers */
    win(multiplier = 2) {
      const base = 523.25; // C5
      const ratios = [1, 1.26, 1.5, 2, 2.52]; // major arpeggio
      const notes = multiplier >= 10 ? 5 : multiplier >= 3 ? 4 : 3;
      for (let i = 0; i < notes; i++) {
        tone({ freq: base * ratios[i], type: "sine", dur: 0.34, peak: 0.26, when: i * 0.06 });
      }
    },

    /** loss thud — short descending buzz */
    lose() {
      tone({ freq: 220, slideTo: 90, type: "sawtooth", dur: 0.32, peak: 0.2, filter: 700 });
    },
  };

  global.Sound = Sound;
})(window);
