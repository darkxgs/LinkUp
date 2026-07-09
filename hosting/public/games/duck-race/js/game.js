// game.js - UI state, bet math, sounds.
// Runs the core frontend logic of the Duck Race game.

const COIN_IMG = '/images/coin-gold.png?v=4';
const fmtCoins = (n) => Math.floor(Number(n) || 0).toLocaleString('en-US');
const coinIconHTML = (size) =>
    `<img src="${COIN_IMG}" alt="coin" style="width:${size || 16}px;height:${size || 16}px;object-fit:contain;vertical-align:middle;display:inline-block;flex-shrink:0;" />`;

const game = {
    state: {
        screen: 'bet', // bet, countdown, racing, result
        balance: 1000,
        bet: null,
        pickedDuck: null,
        positions: new Array(10).fill(0),
        soundOn: true,
        standings: null,
        place: null,
        ret: 0,
        net: 0,
        lastBet: 0,
        count: 3
    },

    colors: ['#ef4444', '#f97316', '#f59e0b', '#65a30d', '#16a34a', '#0d9488', '#0ea5e9', '#3b82f6', '#7c3aed', '#ec4899'],

    // Race variables
    finishTimes: [],
    wobAmp: [],
    wobFreq: [],
    wobPhase: [],
    winnerIdx: -1,
    maxTime: 0,
    raceStart: 0,
    raf: null,
    confRaf: null,
    cdTimers: [],
    finishTimer: null,
    actx: null,

    // DOM cache
    elements: {},

    init() {
        // Load initial state
        this.state.balance = window.api.getBalance();
        const savedSound = localStorage.getItem('duck_race_soundOn');
        this.state.soundOn = savedSound === null ? true : savedSound === 'true';

        // Cache elements
        this.elements = {
            playerBalance: document.getElementById('player-balance'),
            soundBtn: document.getElementById('sound-btn'),
            lanesContainer: document.getElementById('lanes-container'),
            countdownOverlay: document.getElementById('countdown-overlay'),
            countdownText: document.getElementById('countdown-text'),
            chipsContainer: document.getElementById('chips-container'),
            ducksGrid: document.getElementById('ducks-grid'),
            betSummary: document.getElementById('bet-summary'),
            startBtn: document.getElementById('start-btn'),
            rechargeBtn: document.getElementById('recharge-btn'),
            
            resultModal: document.getElementById('result-modal'),
            resultTitle: document.getElementById('result-title'),
            resultDuckSvg: document.getElementById('result-duck-svg'),
            resultDuckBadge: document.getElementById('result-duck-badge'),
            resultPlaceLabel: document.getElementById('result-place-label'),
            resultPickedDuckLabel: document.getElementById('result-picked-duck-label'),
            resultDesc: document.getElementById('result-desc'),
            resultPayout: document.getElementById('result-payout'),
            resultStandingsList: document.getElementById('result-standings-list'),
            replayBtn: document.getElementById('replay-btn'),
            modalRechargeBtn: document.getElementById('modal-recharge-btn'),
            confettiCanvas: document.getElementById('confetti-canvas')
        };

        // Attach event listeners
        this.elements.soundBtn.addEventListener('click', () => this.toggleSound());
        this.elements.startBtn.addEventListener('click', () => this.startRace());
        this.elements.rechargeBtn.addEventListener('click', () => this.recharge());
        this.elements.replayBtn.addEventListener('click', () => this.playAgain());
        this.elements.modalRechargeBtn.addEventListener('click', () => this.recharge());

        window.addEventListener('resize', () => this.handleResize());
        this.handleResize();

        // Render initially
        this.render();
    },

    handleResize() {
        const c = this.elements.confettiCanvas;
        if (c) {
            c.width = window.innerWidth;
            c.height = window.innerHeight;
        }
    },

    selectBet(v) {
        if (this.state.screen !== 'bet') return;
        if (v > this.state.balance) return;
        this.state.bet = v;
        this.render();
    },

    selectDuck(n) {
        if (this.state.screen !== 'bet') return;
        this.state.pickedDuck = n;
        this.render();
    },

    canStart() {
        const s = this.state;
        return s.screen === 'bet' && !!s.bet && !!s.pickedDuck && s.bet <= s.balance;
    },

    syncBridgeBalance(balance) {
        this.state.balance = Number(balance) || 0;
        this.render();
    },

    async startRace() {
        if (!this.canStart()) return;
        if (window.CasinoBridge && CasinoBridge.isEmbedded()) {
            try {
                await CasinoBridge.placeBet(this.state.bet);
                this.state.balance = CasinoBridge.getBalance();
            } catch (err) {
                alert(err.message || 'فشل الرهان');
                return;
            }
        }
        this.state.screen = 'countdown';
        this.state.count = 3;
        this.render();

        this.playBeep(680);
        this.cdTimers = [];

        this.cdTimers.push(setTimeout(() => {
            this.state.count = 2;
            this.render();
            this.playBeep(780);
        }, 800));

        this.cdTimers.push(setTimeout(() => {
            this.state.count = 1;
            this.render();
            this.playBeep(880);
        }, 1600));

        this.cdTimers.push(setTimeout(() => {
            this.state.count = 0;
            this.render();
            this.playBeep(1180);
        }, 2400));

        this.cdTimers.push(setTimeout(() => {
            this.launchRace();
        }, 3050));
    },

    launchRace() {
        const outcome = window.api.generateRace(this.state.bet, this.state.pickedDuck);
        
        this.finishTimes = outcome.finishTimes;
        this.wobAmp = outcome.wobAmp;
        this.wobFreq = outcome.wobFreq;
        this.wobPhase = outcome.wobPhase;
        
        this.winnerIdx = this.finishTimes.indexOf(Math.min(...this.finishTimes));
        this.maxTime = Math.max(...this.finishTimes) + 0.15;
        this.raceStart = performance.now();

        // Store outcome details to render at finish
        this.outcome = outcome;

        this.state.screen = 'racing';
        this.state.balance = outcome.newBalance - outcome.payout; // Deduction state before payout
        this.state.lastBet = this.state.bet;
        this.state.positions = new Array(10).fill(0);
        this.render();

        this.playWhistle();
        this.raf = requestAnimationFrame((now) => this.tick(now));
    },

    posAt(i, t) {
        const ft = this.finishTimes[i];
        let base = t / ft;
        if (base > 1) base = 1;
        const wob = this.wobAmp[i] * Math.sin(this.wobFreq[i] * t + this.wobPhase[i]) * (1 - base);
        let p = base + wob;
        if (p < 0) p = 0;
        if (p > 1) p = 1;
        return p;
    },

    tick(now) {
        if (this.state.screen !== 'racing') return;
        const t = (now - this.raceStart) / 1000;
        if (t >= this.maxTime) {
            this.finishRace();
            return;
        }

        for (let i = 0; i < 10; i++) {
            this.state.positions[i] = this.posAt(i, t);
        }
        
        // Re-render lanes only during tick for performance
        this.renderLanes();
        this.raf = requestAnimationFrame((now) => this.tick(now));
    },

    finishRace() {
        this.state.positions = new Array(10).fill(1);
        this.renderLanes();

        this.finishTimer = setTimeout(() => {
            const o = this.outcome;
            this.state.screen = 'result';
            this.state.standings = o.order;
            this.state.place = o.place;
            this.state.ret = o.payout;
            this.state.net = o.net;
            if (window.CasinoBridge && CasinoBridge.isEmbedded()) {
                const isWin = o.payout > 0;
                CasinoBridge.reportGameResult({
                    isWin: isWin,
                    stake: this.state.lastBet || this.state.bet,
                    winAmount: o.payout,
                    multiplier: isWin && this.state.lastBet ? o.payout / this.state.lastBet : 0,
                });
                this.state.balance = CasinoBridge.getBalance();
            } else {
                this.state.balance = o.newBalance;
            }

            this.render();

            if (o.place === 1) {
                this.playWin();
                setTimeout(() => this.launchConfetti(), 60);
            } else {
                this.playLose();
            }
        }, 750);
    },

    playAgain() {
        if (this.confRaf) cancelAnimationFrame(this.confRaf);
        const c = this.elements.confettiCanvas;
        if (c) {
            const x = c.getContext('2d');
            x && x.clearRect(0, 0, c.width, c.height);
        }

        this.state.screen = 'bet';
        this.state.bet = null;
        this.state.pickedDuck = null;
        this.state.positions = new Array(10).fill(0);
        this.state.standings = null;
        this.state.place = null;
        
        this.render();
    },

    recharge() {
        const newBal = window.api.rechargeBalance();
        this.state.balance = newBal;
        this.playAgain();
    },

    toggleSound() {
        this.state.soundOn = !this.state.soundOn;
        localStorage.setItem('duck_race_soundOn', this.state.soundOn);
        this.render();
    },

    // Audio synthesizer helper functions
    ac() {
        if (!this.actx) {
            this.actx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.actx;
    },

    tone(f, start, dur, type, vol) {
        const a = this.ac();
        const o = a.createOscillator();
        const g = a.createGain();
        o.type = type || 'sine';
        o.frequency.value = f;
        o.connect(g);
        g.connect(a.destination);

        const t0 = a.currentTime + start;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        
        o.start(t0);
        o.stop(t0 + dur + 0.03);
    },

    playBeep(f) {
        if (!this.state.soundOn) return;
        try {
            this.ac().resume();
            this.tone(f, 0, 0.16, 'square', 0.14);
        } catch (e) {}
    },

    playWhistle() {
        if (!this.state.soundOn) return;
        try {
            this.ac().resume();
            this.tone(880, 0, 0.1, 'square', 0.13);
            this.tone(1240, 0.08, 0.22, 'square', 0.13);
        } catch (e) {}
    },

    playWin() {
        if (!this.state.soundOn) return;
        try {
            this.ac().resume();
            [523, 659, 784, 1046].forEach((f, k) => {
                this.tone(f, k * 0.13, 0.28, 'triangle', 0.2);
            });
        } catch (e) {}
    },

    playLose() {
        if (!this.state.soundOn) return;
        try {
            this.ac().resume();
            [392, 349, 311, 246].forEach((f, k) => {
                this.tone(f, k * 0.15, 0.35, 'sawtooth', 0.1);
            });
        } catch (e) {}
    },

    // Confetti simulation falling loop
    launchConfetti() {
        const c = this.elements.confettiCanvas;
        if (!c) return;
        const ctx = c.getContext('2d');
        c.width = window.innerWidth;
        c.height = window.innerHeight;

        const parts = [];
        for (let i = 0; i < 180; i++) {
            parts.push({
                x: Math.random() * c.width,
                y: -20 - Math.random() * c.height * 0.6,
                r: 6 + Math.random() * 9,
                vx: -2.5 + Math.random() * 5,
                vy: 2 + Math.random() * 4,
                col: this.colors[i % this.colors.length],
                rot: Math.random() * 6,
                vr: -0.25 + Math.random() * 0.5
            });
        }

        const start = performance.now();
        const draw = (now) => {
            const el = now - start;
            ctx.clearRect(0, 0, c.width, c.height);
            
            parts.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.06;
                p.rot += p.vr;
                
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillStyle = p.col;
                ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.62);
                ctx.restore();
            });

            if (el < 3200) {
                this.confRaf = requestAnimationFrame(draw);
            } else {
                ctx.clearRect(0, 0, c.width, c.height);
            }
        };

        this.confRaf = requestAnimationFrame(draw);
    },

    // UI Renders mapping from state properties
    render() {
        const s = this.state;
        const isBet = s.screen === 'bet';
        const isCountdown = s.screen === 'countdown';
        const isRacing = s.screen === 'racing';
        const isResult = s.screen === 'result';

        // 1. Balance Title
        this.elements.playerBalance.innerHTML = `<span>${fmtCoins(s.balance)}</span>${coinIconHTML(20)}`;
        if (window.CasinoCoins && CasinoCoins.applyEmbedCoinUI) CasinoCoins.applyEmbedCoinUI();

        // 2. Sound Icon
        this.elements.soundBtn.textContent = s.soundOn ? '🔊' : '🔈';

        // 3. Countdown Overlay
        if (isCountdown) {
            this.elements.countdownOverlay.style.display = 'flex';
            this.elements.countdownText.textContent = s.count > 0 ? String(s.count) : 'انطلق!';
        } else {
            this.elements.countdownOverlay.style.display = 'none';
        }

        // 4. Selections
        this.renderChips();
        this.renderDuckBtns();

        // 5. Track Lanes
        this.renderLanes();

        // 6. Summary Info Label
        let summaryText = 'اختر قيمة رهان وبطة للبدء';
        if (s.bet && s.pickedDuck) {
            summaryText = `رهان ${fmtCoins(s.bet)} كوين على البطة رقم ${s.pickedDuck} ✅`;
        } else if (!s.bet && s.pickedDuck) {
            summaryText = 'اختر قيمة الرهان ⬆️';
        } else if (s.bet && !s.pickedDuck) {
            summaryText = 'اختر بطتك ⬆️';
        }
        this.elements.betSummary.textContent = summaryText;

        // 7. Start Button properties
        const can = this.canStart();
        this.elements.startBtn.disabled = !can;

        let startLabel = '🚀 ابدأ السباق';
        if (isCountdown) startLabel = '⏳ استعد...';
        else if (isRacing) startLabel = '🏁 ...السباق جارٍ';
        this.elements.startBtn.textContent = startLabel;

        let startStyle = 'background:#cbd5e1;cursor:not-allowed;box-shadow:0 8px 0 #94a3b8;';
        if (isRacing || isCountdown) {
            startStyle = 'background:#0ea5e9;cursor:default;box-shadow:0 8px 0 #0369a1;';
        } else if (can) {
            startStyle = 'background:#16a34a;cursor:pointer;box-shadow:0 8px 0 #15803d;animation:pulseGlow 1.6s ease-in-out infinite;';
        }
        this.elements.startBtn.style.cssText = `width:100%;padding:16px;border:none;border-radius:16px;color:#fff;font-family:'Baloo Bhaijaan 2';font-weight:800;font-size:22px;transition:transform .1s;outline:none;` + startStyle;

        // 8. Recharge buttons toggles
        const showRecharge = s.balance <= 0 && isBet;
        this.elements.rechargeBtn.style.display = showRecharge ? 'block' : 'none';

        // 9. Results Modal toggles
        if (isResult) {
            const pdColor = this.colors[s.pickedDuck - 1];
            
            // Set modal titles
            let title = '';
            let msg = '';
            let accent = '#ef4444';
            
            if (s.place === 1) {
                title = '🏆 فوز! المركز الأول';
                msg = `بطتك وصلت أولاً! ربحت ${fmtCoins(s.net)} كوين`;
                accent = '#16a34a';
            } else if (s.place === 2) {
                title = '🥈 المركز الثاني';
                msg = `استرجعت ${fmtCoins(s.ret)} كوين — خسارة ${fmtCoins(Math.abs(s.net))} كوين`;
                accent = '#f59e0b';
            } else if (s.place === 3) {
                title = '🥉 المركز الثالث';
                msg = `استرجعت ${fmtCoins(s.ret)} كوين — خسارة ${fmtCoins(Math.abs(s.net))} كوين`;
                accent = '#f59e0b';
            } else {
                title = `المركز ${s.place}`;
                msg = `لم يحالفك الحظ — خسرت ${fmtCoins(s.lastBet)} كوين`;
                accent = '#ef4444';
            }

            this.elements.resultTitle.textContent = title;
            this.elements.resultTitle.style.color = accent;
            this.elements.resultDesc.textContent = msg;

            // Update badge value and color
            this.elements.resultDuckBadge.textContent = s.pickedDuck;
            this.elements.resultDuckBadge.style.borderColor = pdColor;
            
            // Update modal SVGs fill
            const paths = this.elements.resultDuckSvg.querySelectorAll('path, ellipse, circle');
            paths.forEach(p => {
                if (p.classList.contains('duck-fill') || p.getAttribute('fill') === '#ef4444') {
                    p.setAttribute('fill', pdColor);
                }
            });

            this.elements.resultPlaceLabel.textContent = `المركز ${s.place}`;
            this.elements.resultPickedDuckLabel.textContent = `بطتك (رقم ${s.pickedDuck})`;

            // Payout value
            const netSign = s.net >= 0 ? '+' : '-';
            this.elements.resultPayout.innerHTML = `العائد: ${netSign}${fmtCoins(Math.abs(s.net))} ${coinIconHTML(20)}`;
            this.elements.resultPayout.style.background = accent;

            // Render standings table
            this.renderResultStandings();

            // Set modal actions recharge
            this.elements.modalRechargeBtn.style.display = (s.balance <= 0) ? 'block' : 'none';

            // Show modal backdrop
            this.elements.resultModal.style.display = 'flex';
        } else {
            this.elements.resultModal.style.display = 'none';
        }
    },

    chipValues() {
        if (window.CasinoBridge && CasinoBridge.isEmbedded() && typeof CasinoBridge.getStakeChips === 'function') {
            const chips = CasinoBridge.getStakeChips();
            if (chips && chips.length) return chips;
        }
        return [100, 500, 1000, 5000, 10000];
    },

    renderChips() {
        const container = this.elements.chipsContainer;
        container.innerHTML = '';
        this.chipValues().forEach(v => {
            const active = this.state.bet === v;
            const disabled = this.state.screen !== 'bet' || v > this.state.balance;
            
            const btn = document.createElement('button');
            btn.disabled = disabled;
            btn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:5px;">${fmtCoins(v)}${coinIconHTML(16)}</span>`;
            btn.style.cssText = `padding:12px 20px;border-radius:14px;font-family:inherit;font-weight:800;font-size:19px;transition:transform .12s;` +
                `background:${active ? '#f59e0b' : '#1e293b'};` +
                `color:${active ? '#fff' : '#fbbf24'};` +
                `border:2px solid ${active ? '#f59e0b' : '#fbbf24'};` +
                `box-shadow:${active ? '0 6px 14px rgba(245,158,11,.45)' : '0 3px 0 #fbbf24'};` +
                `opacity:${disabled ? '0.4' : '1'};` +
                `cursor:${disabled ? 'not-allowed' : 'pointer'};` +
                `transform:${active ? 'translateY(-2px)' : 'none'};` +
                `outline:none;`;
            
            btn.addEventListener('click', () => this.selectBet(v));
            container.appendChild(btn);
        });
    },

    renderDuckBtns() {
        const container = this.elements.ducksGrid;
        container.innerHTML = '';
        this.colors.forEach((c, i) => {
            const n = i + 1;
            const selected = this.state.pickedDuck === n;
            const disabled = this.state.screen !== 'bet';
            
            const btn = document.createElement('button');
            btn.disabled = disabled;
            btn.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:5px;background:transparent;border:none;font-family:inherit;padding:4px;transition:transform .12s;outline:none;` +
                `opacity:${disabled ? '0.5' : '1'};` +
                `cursor:${disabled ? 'not-allowed' : 'pointer'};` +
                `transform:${selected ? 'translateY(-3px) scale(1.06)' : 'none'};`;
            
            const chip = document.createElement('div');
            chip.style.cssText = `position:relative;width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;` +
                `background:#334155;` +
                `box-shadow:${selected ? '0 0 0 3px #1e293b,0 0 0 6px ' + c : 'inset 0 0 0 2px #475569,0 3px 6px rgba(0,0,0,.3)'};`;
            
            const svgWrap = document.createElement('div');
            svgWrap.style.cssText = `width:44px;height:38px;`;
            svgWrap.innerHTML = `<svg viewBox="0 0 100 84" style="width:100%;height:100%;display:block;overflow:visible;"><path d="M74 42 L99 28 L88 54 Z" fill="${c}"></path><ellipse cx="56" cy="52" rx="33" ry="23" fill="${c}"></ellipse><ellipse cx="54" cy="64" rx="24" ry="9" fill="rgba(255,255,255,.22)"></ellipse><ellipse cx="60" cy="50" rx="17" ry="11" fill="rgba(0,0,0,.13)"></ellipse><circle cx="31" cy="29" r="18" fill="${c}"></circle><path d="M16 32 L-3 37 L17 40 Z" fill="#d97706"></path><path d="M15 25 L-2 30 L17 31 Z" fill="#f59e0b"></path><circle cx="27" cy="24" r="5" fill="#ffffff"></circle><circle cx="26" cy="25" r="3" fill="#1f2937"></circle></svg>`;
            
            const badge = document.createElement('div');
            badge.style.cssText = `position:absolute;top:-2px;right:-2px;width:20px;height:20px;border-radius:50%;background:#1e293b;color:#f8fafc;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid ${c};`;
            badge.textContent = n;
            
            const label = document.createElement('span');
            label.style.cssText = `font-weight:700;font-size:12px;color:#cbd5e1;`;
            label.textContent = `بطة ${n}`;
            
            chip.appendChild(svgWrap);
            chip.appendChild(badge);
            btn.appendChild(chip);
            btn.appendChild(label);
            
            btn.addEventListener('click', () => this.selectDuck(n));
            container.appendChild(btn);
        });
    },

    renderLanes() {
        const container = this.elements.lanesContainer;
        container.innerHTML = '';
        const isRacing = this.state.screen === 'racing';
        this.colors.forEach((c, i) => {
            const n = i + 1;
            const p = this.state.positions[i] || 0;
            const picked = this.state.pickedDuck === n;
            
            const laneBg = i % 2 === 0 ? '#0f172a' : '#1e293b';
            const laneBorder = picked ? '2px solid ' + c : '2px solid rgba(255,255,255,0.03)';
            
            const lane = document.createElement('div');
            lane.style.cssText = `position:relative;height:48px;border-radius:11px;overflow:hidden;` +
                `background:${laneBg};` +
                `border:${laneBorder};`;
            
            const checkered = document.createElement('div');
            checkered.style.cssText = `position:absolute;left:0;top:0;bottom:0;width:15px;background:repeating-linear-gradient(45deg,#1f2937 0 6px,#fff 6px 12px);`;
            
            const badge = document.createElement('div');
            badge.style.cssText = `position:absolute;right:8px;top:50%;transform:translateY(-50%);width:24px;height:24px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;opacity:.45;` +
                `background:${c};`;
            badge.textContent = n;
            
            const rightPct = `calc(${p.toFixed(5)} * (100% - 50px) + 4px)`;
            
            const runner = document.createElement('div');
            runner.style.cssText = `position:absolute;top:0;bottom:0;display:flex;align-items:center;right:${rightPct};z-index:1;`;
            
            const duckWrap = document.createElement('div');
            duckWrap.style.cssText = `position:relative;width:46px;height:40px;`;
            
            if (isRacing) {
                const trails = document.createElement('div');
                trails.style.cssText = `position:absolute;right:100%;top:50%;transform:translateY(-50%);margin-right:3px;display:flex;flex-direction:column;gap:3px;opacity:.55;`;
                
                const t1 = document.createElement('div');
                t1.className = 'wind-trail-line';
                t1.style.width = '20px';
                const t2 = document.createElement('div');
                t2.className = 'wind-trail-line';
                t2.style.width = '13px';
                t2.style.marginRight = '5px';
                const t3 = document.createElement('div');
                t3.className = 'wind-trail-line';
                t3.style.width = '20px';
                
                trails.appendChild(t1);
                trails.appendChild(t2);
                trails.appendChild(t3);
                duckWrap.appendChild(trails);
            }
            
            const waddleAnim = isRacing ? `waddle ${(0.3 + (i % 5) * 0.03).toFixed(2)}s ease-in-out infinite` : 'none';
            const filterGlow = picked ? `drop-shadow(0 0 3px #fff) drop-shadow(0 0 5px ${c})` : 'drop-shadow(0 3px 3px rgba(0,0,0,.28))';
            
            const duckSpan = document.createElement('span');
            duckSpan.style.cssText = `display:block;width:100%;height:100%;` +
                `animation:${waddleAnim};` +
                `filter:${filterGlow};`;
            
            duckSpan.innerHTML = `<svg viewBox="0 0 100 84" style="width:100%;height:100%;display:block;overflow:visible;"><path d="M74 42 L99 28 L88 54 Z" fill="${c}"></path><ellipse cx="56" cy="52" rx="33" ry="23" fill="${c}"></ellipse><ellipse cx="54" cy="64" rx="24" ry="9" fill="rgba(255,255,255,.22)"></ellipse><ellipse cx="60" cy="50" rx="17" ry="11" fill="rgba(0,0,0,.13)"></ellipse><circle cx="31" cy="29" r="18" fill="${c}"></circle><path d="M16 32 L-3 37 L17 40 Z" fill="#d97706"></path><path d="M15 25 L-2 30 L17 31 Z" fill="#f59e0b"></path><circle cx="27" cy="24" r="5" fill="#ffffff"></circle><circle cx="26" cy="25" r="3" fill="#1f2937"></circle></svg>`;
            
            const miniBadge = document.createElement('div');
            miniBadge.style.cssText = `position:absolute;top:-6px;right:-4px;width:18px;height:18px;border-radius:50%;background:#1e293b;color:#f8fafc;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid ${c};z-index:2;`;
            miniBadge.textContent = n;
            
            duckWrap.appendChild(duckSpan);
            duckWrap.appendChild(miniBadge);
            runner.appendChild(duckWrap);
            lane.appendChild(checkered);
            lane.appendChild(badge);
            lane.appendChild(runner);
            
            container.appendChild(lane);
        });
    },

    renderResultStandings() {
        const container = this.elements.resultStandingsList;
        container.innerHTML = '';
        
        const pd = this.state.pickedDuck;
        const medals = ['🥇', '🥈', '🥉'];
        
        this.state.standings.forEach((dn, idx) => {
            const isPlayer = dn === pd;
            const c = this.colors[dn - 1];
            const rowBg = isPlayer ? '#451a03' : '#0f172a';
            const rowBorder = isPlayer ? '2px solid #fbbf24' : '2px solid rgba(255,255,255,0.05)';
            const medalText = idx < 3 ? medals[idx] : String(idx + 1);
            
            const row = document.createElement('div');
            row.style.cssText = `display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:11px;background:${rowBg};border:${rowBorder};`;
            
            const medalSpan = document.createElement('span');
            medalSpan.style.cssText = `width:26px;text-align:center;font-weight:800;font-size:16px;color:#f8fafc;`;
            medalSpan.textContent = medalText;
            
            const duckIconWrap = document.createElement('div');
            duckIconWrap.style.cssText = `position:relative;width:36px;height:31px;flex-shrink:0;`;
            duckIconWrap.innerHTML = `<svg viewBox="0 0 100 84" style="width:100%;height:100%;display:block;overflow:visible;"><path d="M74 42 L99 28 L88 54 Z" fill="${c}"></path><ellipse cx="56" cy="52" rx="33" ry="23" fill="${c}"></ellipse><ellipse cx="54" cy="64" rx="24" ry="9" fill="rgba(255,255,255,.22)"></ellipse><ellipse cx="60" cy="50" rx="17" ry="11" fill="rgba(0,0,0,.13)"></ellipse><circle cx="31" cy="29" r="18" fill="${c}"></circle><path d="M16 32 L-3 37 L17 40 Z" fill="#d97706"></path><path d="M15 25 L-2 30 L17 31 Z" fill="#f59e0b"></path><circle cx="27" cy="24" r="5" fill="#ffffff"></circle><circle cx="26" cy="25" r="3" fill="#1f2937"></circle></svg>`;
            
            const labelSpan = document.createElement('span');
            labelSpan.style.cssText = `flex:1;font-weight:700;color:#cbd5e1;font-size:14px;`;
            labelSpan.textContent = `البطة رقم ${dn}`;
            
            row.appendChild(medalSpan);
            row.appendChild(duckIconWrap);
            row.appendChild(labelSpan);
            
            if (isPlayer) {
                const playerTag = document.createElement('span');
                playerTag.style.cssText = `background:#fbbf24;color:#7c2d12;font-weight:800;font-size:12px;padding:3px 9px;border-radius:999px;`;
                playerTag.textContent = 'بطتك';
                row.appendChild(playerTag);
            }
            
            container.appendChild(row);
        });
    }
};

window.game = game;

// Start application when DOM loads
document.addEventListener('DOMContentLoaded', () => game.init());
