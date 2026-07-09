/**
 * LinkUp Games Pro FX — مؤثرات خفيفة وسريعة لألعاب WebView
 */
(function (global) {
  var audioCtx = null;
  var confettiCanvas = null;
  var confettiCtx = null;
  var confettiParticles = [];
  var confettiRaf = null;
  var booted = false;
  var perfMode = true;
  var lastSfxAt = {};
  var noiseBuffer = null;

  function boot() {
    if (booted) return;
    booted = true;
    if (document.body) document.body.classList.add('gpf-perf');

    if (!document.getElementById('gpf-confetti-canvas')) {
      confettiCanvas = document.createElement('canvas');
      confettiCanvas.id = 'gpf-confetti-canvas';
      document.body.appendChild(confettiCanvas);
      confettiCtx = confettiCanvas.getContext('2d', { alpha: true, desynchronized: true });
      resizeConfetti();
      window.addEventListener('resize', resizeConfetti, { passive: true });
    }

    if (!document.getElementById('gpf-flash-overlay')) {
      var flash = document.createElement('div');
      flash.id = 'gpf-flash-overlay';
      flash.className = 'gpf-flash-overlay';
      document.body.appendChild(flash);
    }
  }

  function setPerfMode(on) {
    perfMode = on !== false;
    if (document.body) {
      document.body.classList.toggle('gpf-perf', perfMode);
    }
  }

  function resizeConfetti() {
    if (!confettiCanvas) return;
    var dpr = perfMode ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    confettiCanvas.width = Math.floor(window.innerWidth * dpr);
    confettiCanvas.height = Math.floor(window.innerHeight * dpr);
    confettiCanvas.style.width = window.innerWidth + 'px';
    confettiCanvas.style.height = window.innerHeight + 'px';
    if (confettiCtx) confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resumeAudio() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
  }

  function haptic(style) {
    if (perfMode) return;
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'HAPTIC', style: style || 'light' }));
      }
      if (navigator.vibrate) navigator.vibrate(style === 'heavy' ? 40 : style === 'medium' ? 25 : 12);
    } catch (e) {}
  }

  function playTone(freqs, type, duration, volume) {
    if (!audioCtx) resumeAudio();
    if (!audioCtx) return;
    var now = audioCtx.currentTime;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    volume = volume == null ? 0.2 : volume;

    if (Array.isArray(freqs)) {
      freqs.forEach(function (f, i) {
        osc.frequency.setValueAtTime(f.freq, now + (f.at || i * 0.08));
      });
    } else {
      osc.frequency.setValueAtTime(freqs, now);
    }

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playNoise(duration, volume) {
    if (!audioCtx) resumeAudio();
    if (!audioCtx) return;
    if (!noiseBuffer || noiseBuffer.duration < duration) {
      var bufferSize = Math.ceil(audioCtx.sampleRate * 0.12);
      noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      var data = noiseBuffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    }
    var src = audioCtx.createBufferSource();
    var gain = audioCtx.createGain();
    src.buffer = noiseBuffer;
    src.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(volume || 0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    src.start();
  }

  var SFX = {
    start: function () {
      playTone([
        { freq: 320, at: 0 },
        { freq: 520, at: 0.12 },
        { freq: 720, at: 0.24 },
      ], 'triangle', 0.38, 0.18);
    },
    tick: function () {
      playTone(1100, 'sine', 0.05, 0.07);
    },
    click: function () {
      playTone(560, 'triangle', 0.08, 0.1);
    },
    flip: function () {
      playTone(440, 'sine', 0.06, 0.09);
    },
    match: function () {
      playTone([
        { freq: 523, at: 0 },
        { freq: 659, at: 0.08 },
        { freq: 784, at: 0.16 },
      ], 'triangle', 0.3, 0.18);
      haptic('light');
    },
    win: function () {
      playTone([
        { freq: 523, at: 0 },
        { freq: 659, at: 0.1 },
        { freq: 784, at: 0.2 },
        { freq: 1046, at: 0.32 },
      ], 'triangle', 0.6, 0.24);
      haptic('medium');
    },
    loss: function () {
      playTone([
        { freq: 300, at: 0 },
        { freq: 200, at: 0.15 },
        { freq: 140, at: 0.3 },
      ], 'sawtooth', 0.55, 0.16);
      haptic('heavy');
    },
    whistle: function () {
      playTone([
        { freq: 1800, at: 0 },
        { freq: 2200, at: 0.08 },
        { freq: 1800, at: 0.2 },
      ], 'square', 0.3, 0.07);
    },
    kick: function () {
      playNoise(0.06, 0.28);
      playTone(90, 'sine', 0.12, 0.28);
      haptic('heavy');
    },
    goal: function () {
      playTone([
        { freq: 440, at: 0 },
        { freq: 554, at: 0.08 },
        { freq: 659, at: 0.16 },
        { freq: 880, at: 0.26 },
      ], 'triangle', 0.55, 0.26);
      playNoise(0.08, 0.14);
      haptic('medium');
    },
    save: function () {
      playTone([{ freq: 200, at: 0 }, { freq: 140, at: 0.1 }], 'square', 0.18, 0.15);
      haptic('medium');
    },
    spin: function () {
      playTone([
        { freq: 320, at: 0 },
        { freq: 520, at: 0.12 },
        { freq: 760, at: 0.28 },
      ], 'sine', 0.42, 0.1);
    },
    catch: function () {
      playTone(820, 'triangle', 0.1, 0.13);
    },
    hit: function () {
      playNoise(0.04, 0.16);
      playTone(180, 'sine', 0.07, 0.2);
    },
    bounce: function () {
      playTone(280, 'sine', 0.05, 0.08);
    },
    pocket: function () {
      playTone([{ freq: 600, at: 0 }, { freq: 900, at: 0.05 }], 'triangle', 0.16, 0.15);
    },
  };

  function playSfx(name) {
    boot();
    resumeAudio();
    var now = Date.now();
    var gap = name === 'tick' ? 900 : name === 'bounce' ? 120 : 55;
    if (lastSfxAt[name] && now - lastSfxAt[name] < gap) return;
    lastSfxAt[name] = now;
    var fn = SFX[name];
    if (fn) fn();
  }

  function flash(type) {
    boot();
    var el = document.getElementById('gpf-flash-overlay');
    if (!el) return;
    el.className = 'gpf-flash-overlay ' + (type === 'lose' ? 'lose' : 'win');
    setTimeout(function () {
      el.className = 'gpf-flash-overlay';
    }, perfMode ? 420 : 600);
  }

  function shake(el, strong) {
    if (!el || perfMode) return;
    el.classList.remove('gpf-shake', 'gpf-shake-strong');
    void el.offsetWidth;
    el.classList.add(strong ? 'gpf-shake-strong' : 'gpf-shake');
    setTimeout(function () {
      el.classList.remove('gpf-shake', 'gpf-shake-strong');
    }, strong ? 500 : 400);
  }

  function toast(text, type) {
    boot();
    var old = document.querySelector('.gpf-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'gpf-toast ' + (type || 'info');
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(function () {
      if (t.parentNode) t.remove();
    }, perfMode ? 1400 : 1800);
  }

  function spawnConfetti(count, colors) {
    if (perfMode && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    boot();
    if (!confettiCanvas) return;
    colors = colors || ['#fbbf24', '#10b981', '#3b82f6', '#ec4899', '#a855f7', '#ef4444'];
    count = count || (perfMode ? 12 : 80);
    var maxParticles = perfMode ? 24 : 120;
    if (confettiParticles.length > maxParticles) confettiParticles.length = maxParticles;
    for (var i = 0; i < count; i++) {
      confettiParticles.push({
        x: Math.random() * window.innerWidth,
        y: -10 - Math.random() * 30,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 3,
        rot: Math.random() * 360,
        vr: (Math.random() - 0.5) * 10,
        size: 4 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
      });
    }
    if (!confettiRaf) confettiLoop();
  }

  function confettiLoop() {
    if (!confettiCtx || !confettiCanvas) return;
    var w = window.innerWidth;
    var h = window.innerHeight;
    confettiCtx.clearRect(0, 0, w, h);
    var next = [];
    for (var i = 0; i < confettiParticles.length; i++) {
      var p = confettiParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.rot += p.vr;
      p.life -= 0.01;
      if (p.life <= 0 || p.y > h + 20) continue;
      confettiCtx.globalAlpha = Math.min(1, p.life + 0.15);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(p.x - p.size / 2, p.y - p.size / 4, p.size, p.size / 2);
      next.push(p);
    }
    confettiParticles = next;
    confettiCtx.globalAlpha = 1;
    if (confettiParticles.length > 0) {
      confettiRaf = requestAnimationFrame(confettiLoop);
    } else {
      confettiRaf = null;
      confettiCtx.clearRect(0, 0, w, h);
    }
  }

  function celebrateWin(cardEl, message) {
    if (perfMode) {
      toast(message || '🎉 فوز رائع!', 'win');
      playSfx('win');
      spawnConfetti(10);
      return;
    }
    flash('win');
    shake(cardEl, true);
    spawnConfetti(90);
    toast(message || '🎉 فوز رائع!', 'win');
    playSfx('win');
  }

  function celebrateLoss(cardEl, message) {
    if (perfMode) {
      toast(message || '💔 حظ أوفر!', 'lose');
      playSfx('loss');
      return;
    }
    flash('lose');
    shake(cardEl, false);
    toast(message || '💔 حظ أوفر!', 'lose');
    playSfx('loss');
  }

  function countdown(seconds, onComplete) {
    boot();
    resumeAudio();
    var layer = document.createElement('div');
    layer.className = 'gpf-countdown-layer';
    document.body.appendChild(layer);
    var left = seconds;
    function tick() {
      if (left <= 0) {
        layer.remove();
        if (onComplete) onComplete();
        return;
      }
      layer.innerHTML = '<div class="gpf-countdown-num">' + (left === 0 ? 'انطلق!' : left) + '</div>';
      playSfx('tick');
      left--;
      setTimeout(tick, left === 0 ? 350 : 800);
    }
    tick();
  }

  function scatterThenGatherCards(gridEl, onMid, onComplete) {
    if (!gridEl) {
      if (onComplete) onComplete();
      return;
    }
    if (perfMode) {
      playSfx('flip');
      if (onMid) onMid();
      if (onComplete) setTimeout(onComplete, 40);
      return;
    }
    var items = Array.from(gridEl.querySelectorAll('.card-item'));
    var dist = perfMode ? 14 : 22;
    items.forEach(function (item, i) {
      var angle = (i / items.length) * Math.PI * 2;
      var d = dist + Math.random() * (perfMode ? 10 : 18);
      item.style.setProperty('--sx', Math.cos(angle) * d + 'px');
      item.style.setProperty('--sy', Math.sin(angle) * d + 'px');
      item.classList.add('scatter-anim');
    });
    playSfx('flip');

    setTimeout(function () {
      if (onMid) onMid();
      items.forEach(function (item) {
        item.classList.remove('scatter-anim');
        item.classList.add('gather-anim');
      });
      setTimeout(function () {
        items.forEach(function (item) {
          item.classList.remove('gather-anim');
          item.style.removeProperty('--sx');
          item.style.removeProperty('--sy');
        });
        if (onComplete) onComplete();
      }, perfMode ? 620 : 750);
    }, perfMode ? 720 : 900);
  }

  global.GameProFX = {
    boot: boot,
    setPerfMode: setPerfMode,
    sfx: { play: playSfx, resume: resumeAudio },
    vfx: {
      flash: flash,
      shake: shake,
      toast: toast,
      confetti: spawnConfetti,
      celebrateWin: celebrateWin,
      celebrateLoss: celebrateLoss,
      countdown: countdown,
      scatterThenGatherCards: scatterThenGatherCards,
    },
    haptic: haptic,
  };
})(window);
