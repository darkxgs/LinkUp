/**
 * LinkUp Intelligence FX — مؤثرات Flash للألعاب الذكية
 */
(function (global) {
  var ambientId = null;
  var ambientRaf = null;
  var sparks = [];
  var perfLite = false;

  function isPerfLite() {
    return perfLite || (document.body && document.body.classList.contains('gpf-perf'));
  }

  function stopAmbient() {
    if (ambientRaf) {
      cancelAnimationFrame(ambientRaf);
      ambientRaf = null;
    }
    sparks = [];
    if (ambientId) ambientId.style.display = 'none';
  }

  function setPerfMode(on) {
    perfLite = on !== false;
    if (perfLite) stopAmbient();
  }

  function boot(opts) {
    opts = opts || {};
    if (opts.lite || isPerfLite()) {
      setPerfMode(true);
      return;
    }
    if (ambientId) return;
    var c = document.createElement('canvas');
    c.className = 'ifx-ambient-canvas';
    c.id = 'ifx-ambient';
    document.body.prepend(c);
    ambientId = c;
    resizeAmbient();
    window.addEventListener('resize', resizeAmbient, { passive: true });
    ambientLoop();
  }

  function resizeAmbient() {
    var c = ambientId;
    if (!c) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    c.width = window.innerWidth * dpr;
    c.height = window.innerHeight * dpr;
    c.style.width = window.innerWidth + 'px';
    c.style.height = window.innerHeight + 'px';
    var ctx = c.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function ambientLoop() {
    if (isPerfLite()) {
      stopAmbient();
      return;
    }
    var c = ambientId;
    if (!c) return;
    var ctx = c.getContext('2d');
    var w = window.innerWidth;
    var h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    if (sparks.length < 28) {
      sparks.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 1 + Math.random() * 2,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.15 - Math.random() * 0.35,
        a: 0.15 + Math.random() * 0.35,
        hue: Math.random() > 0.5 ? 280 : 45,
      });
    }
    sparks = sparks.filter(function (p) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -10) return false;
      ctx.fillStyle = 'hsla(' + p.hue + ', 80%, 70%, ' + p.a + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
    ambientRaf = requestAnimationFrame(ambientLoop);
  }

  function sfx(name) {
    if (global.GameProFX && global.GameProFX.sfx) global.GameProFX.sfx.play(name);
  }

  function simonFlash(el) {
    if (!el) return;
    el.classList.remove('ifx-simon-flash');
    void el.offsetWidth;
    el.classList.add('ifx-simon-flash');
    sfx('click');
    setTimeout(function () { el.classList.remove('ifx-simon-flash'); }, 480);
  }

  function playSimonSequence(prefix, count, gapMs) {
    gapMs = gapMs || 420;
    var i = 0;
    return new Promise(function (resolve) {
      function step() {
        if (i >= count) { resolve(); return; }
        simonFlash(document.getElementById(prefix + i));
        i++;
        setTimeout(step, gapMs);
      }
      step();
    });
  }

  function flagReveal(containerEl) {
    if (!containerEl) return;
    var img = containerEl.querySelector('img');
    if (img) {
      img.classList.remove('ifx-flag-wave');
      void img.offsetWidth;
      img.classList.add('ifx-flag-wave');
    }
    sfx('start');
  }

  function matchBurst(el) {
    if (!el) return;
    el.classList.add('ifx-match-burst');
    sfx('match');
    if (!isPerfLite() && global.GameProFX && global.GameProFX.vfx) {
      global.GameProFX.vfx.confetti(8, ['#ec4899', '#a855f7', '#fbbf24']);
    }
    setTimeout(function () { el.classList.remove('ifx-match-burst'); }, isPerfLite() ? 320 : 560);
  }

  function cardLift(el, on) {
    if (!el) return;
    el.classList.toggle('ifx-card-lift', !!on);
  }

  function streakPop(text) {
    var el = document.createElement('div');
    el.className = 'ifx-streak-pop';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 1100);
  }

  function xoPlace(cell, player) {
    if (!cell) return;
    cell.classList.remove('ifx-xo-place');
    void cell.offsetWidth;
    cell.classList.add('ifx-xo-place');
    sfx(player === 'X' ? 'click' : 'flip');
  }

  function xoWinLine(boardEl, indices) {
    if (!boardEl || !indices || indices.length < 3) return;
    var cells = indices.map(function (i) { return boardEl.querySelector('[data-index="' + i + '"]'); });
    if (cells.some(function (c) { return !c; })) return;
    var old = boardEl.querySelector('.ifx-xo-win-line');
    if (old) old.remove();
    var b = boardEl.getBoundingClientRect();
    var c0 = cells[0].getBoundingClientRect();
    var c2 = cells[2].getBoundingClientRect();
    var x1 = c0.left + c0.width / 2 - b.left;
    var y1 = c0.top + c0.height / 2 - b.top;
    var x2 = c2.left + c2.width / 2 - b.left;
    var y2 = c2.top + c2.height / 2 - b.top;
    var len = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
    var ang = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
    var line = document.createElement('div');
    line.className = 'ifx-xo-win-line';
    line.style.width = len + 'px';
    line.style.left = x1 + 'px';
    line.style.top = y1 + 'px';
    line.style.transform = 'rotate(' + ang + 'deg)';
    boardEl.style.position = 'relative';
    boardEl.appendChild(line);
    sfx('win');
  }

  global.IntelFX = {
    boot: boot,
    setPerfMode: setPerfMode,
    simonFlash: simonFlash,
    playSimonSequence: playSimonSequence,
    flagReveal: flagReveal,
    matchBurst: matchBurst,
    cardLift: cardLift,
    streakPop: streakPop,
    xoPlace: xoPlace,
    xoWinLine: xoWinLine,
  };
})(window);
