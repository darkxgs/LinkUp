/* ============================================================
 * Linkup · Dragon Tower — Data layer
 * ------------------------------------------------------------
 * وضعان:
 *  - داخل التطبيق (CasinoBridge موجود ومضمّن): الرصيد والرهان
 *    والنتائج عبر جسر المنصة (INIT_DATA / PLACE_BET / GAME_RESULT)
 *    والأرقام كلها "كوين" صحيحة، وحدّا الرهان من config لوحة التحكم.
 *  - مستقل (تجريبي): localStorage كما كان.
 *
 *   GameAPI.getBalance()          -> { balance }
 *   GameAPI.setBalance(v)         -> { balance }          (demo only)
 *   GameAPI.placeBet(opts)        -> { gameId, balance }
 *   GameAPI.pick(gameId, col)     -> { result, row, multiplier,
 *                                      done, payout?, balance?, grid? }
 *   GameAPI.cashout(gameId)       -> { payout, multiplier, balance, grid }
 *   GameAPI.platform()            -> { embedded, minBet, maxBet, chips }
 * ============================================================ */

const GameAPI = (() => {
  'use strict';

  const STORAGE_KEY = 'linkup_demo_balance';
  const START_BALANCE = 1000;

  const ROWS = 9;
  const DEFAULT_HOUSE_EDGE = 0.02; // 98% RTP افتراضياً — يُستبدل بـ rtp من لوحة التحكم

  /** شرائح الرهان الافتراضية داخل التطبيق (كوين) */
  const DEFAULT_CHIPS = [5000, 10000, 25000, 50000];

  const DIFFICULTIES = {
    easy:   { cols: 4, safe: 3 },
    medium: { cols: 3, safe: 2 },
    hard:   { cols: 2, safe: 1 },
    expert: { cols: 3, safe: 1 },
    master: { cols: 4, safe: 1 },
  };

  /* ---------------- platform bridge ---------------- */

  function bridge() {
    return (typeof window !== 'undefined' && window.CasinoBridge) ? window.CasinoBridge : null;
  }

  function isEmbedded() {
    const b = bridge();
    return !!(b && b.isEmbedded && b.isEmbedded());
  }

  function bridgeConfig() {
    const b = bridge();
    const st = b && b.getState ? b.getState() : null;
    return st && st.config ? st.config : null;
  }

  /** حافة الكازينو من rtp لوحة التحكم (rtp 98 => edge 0.02) */
  function houseEdge() {
    const cfg = bridgeConfig();
    const rtp = cfg && Number(cfg.rtp);
    if (Number.isFinite(rtp) && rtp >= 80 && rtp <= 100) {
      return Math.min(0.2, Math.max(0, (100 - rtp) / 100));
    }
    return DEFAULT_HOUSE_EDGE;
  }

  function platform() {
    const embedded = isEmbedded();
    const cfg = bridgeConfig();
    const minBet = embedded && cfg && Number(cfg.minBet) > 0 ? Number(cfg.minBet) : (embedded ? 5000 : 0);
    const maxBet = embedded && cfg && Number(cfg.maxBet) > 0 ? Number(cfg.maxBet) : (embedded ? 50000 : Infinity);
    let chips = DEFAULT_CHIPS.filter((c) => c >= minBet && c <= maxBet);
    const b = bridge();
    if (embedded && b && typeof b.getStakeChips === 'function') {
      const fromBridge = b.getStakeChips();
      if (Array.isArray(fromBridge) && fromBridge.length) chips = fromBridge;
    }
    if (!chips.length) chips = [minBet];
    return { embedded, minBet, maxBet, chips };
  }

  /** multiplier after `picks` successful rows */
  function multiplierFor(difficulty, picks) {
    if (picks <= 0) return 1;
    const d = DIFFICULTIES[difficulty];
    const raw = (1 - houseEdge()) * Math.pow(d.cols / d.safe, picks);
    return Math.round(raw * 100) / 100;
  }

  /** تقريب المبالغ: كوين صحيح داخل التطبيق، سنتات في التجريبي */
  function roundMoney(v) {
    return isEmbedded() ? Math.round(v) : Math.round(v * 100) / 100;
  }

  /* ---------------- wallet ---------------- */

  function readBalance() {
    if (isEmbedded()) return bridge().getBalance();
    const v = parseFloat(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(v) ? v : START_BALANCE;
  }
  function writeBalance(v) {
    // داخل التطبيق الرصيد ملك التطبيق (UPDATE_BALANCE) — لا كتابة محلية
    if (isEmbedded()) return readBalance();
    const rounded = Math.round(v * 100) / 100;
    localStorage.setItem(STORAGE_KEY, String(rounded));
    return rounded;
  }

  /* ---------------- active games (in-memory) ---------------- */

  let nextId = 1;
  const games = new Map();

  function generateGrid(difficulty) {
    const { cols, safe } = DIFFICULTIES[difficulty];
    const grid = [];
    for (let r = 0; r < ROWS; r++) {
      const idx = [...Array(cols).keys()];
      // Fisher–Yates shuffle with crypto randomness
      for (let i = idx.length - 1; i > 0; i--) {
        const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
        [idx[i], idx[j]] = [idx[j], idx[i]];
      }
      const safeSet = new Set(idx.slice(0, safe));
      grid.push([...Array(cols).keys()].map(c => safeSet.has(c)));
    }
    return grid; // grid[row][col] === true -> egg (safe)
  }

  const latency = () => new Promise(res => setTimeout(res, 60 + Math.random() * 90));

  /** إبلاغ المنصة بنتيجة الجولة (فوز/خسارة) */
  function reportResult(g, isWin, payout, multiplier) {
    const b = bridge();
    if (!isEmbedded() || !b) return;
    try {
      b.reportGameResult({
        isWin: isWin,
        stake: g.amount,
        winAmount: isWin ? payout : 0,
        multiplier: isWin ? multiplier : 0,
        result: {
          game: 'dragon-tower',
          difficulty: g.difficulty,
          rowsClimbed: g.row,
        },
      });
    } catch (e) { /* non-fatal */ }
  }

  /* ---------------- public API ---------------- */

  async function getBalance() {
    await latency();
    return { balance: readBalance() };
  }

  async function setBalance(v) {
    await latency();
    if (isEmbedded()) return { balance: readBalance() }; // لا reset داخل التطبيق
    return { balance: writeBalance(v) };
  }

  async function placeBet({ amount, difficulty }) {
    if (!DIFFICULTIES[difficulty]) throw new Error('Invalid difficulty');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid bet amount');

    if (isEmbedded()) {
      const p = platform();
      if (amount < p.minBet) throw new Error('Bet below minimum');
      if (amount > p.maxBet) throw new Error('Bet above maximum');
      // الخصم الفعلي يتم في التطبيق — ينتظر BET_CONFIRMED
      await bridge().placeBet(Math.round(amount));
    } else {
      await latency();
      const balance = readBalance();
      if (amount > balance) throw new Error('Insufficient balance');
      writeBalance(balance - amount);
    }

    const gameId = 'g' + (nextId++);
    games.set(gameId, {
      difficulty,
      amount: roundMoney(amount),
      grid: generateGrid(difficulty),
      row: 0,          // next row to pick (0 = bottom)
      over: false,
    });
    return { gameId, balance: readBalance() };
  }

  async function pick(gameId, col) {
    await latency();
    const g = games.get(gameId);
    if (!g || g.over) throw new Error('No active game');
    const { cols } = DIFFICULTIES[g.difficulty];
    if (!Number.isInteger(col) || col < 0 || col >= cols) throw new Error('Invalid column');

    const row = g.row;
    const isSafe = g.grid[row][col];

    if (!isSafe) {
      g.over = true;
      games.delete(gameId);
      reportResult(g, false, 0, 0);
      return {
        result: 'lose', row, col,
        multiplier: 0,
        done: true,
        payout: 0,
        balance: readBalance(),
        grid: g.grid,
      };
    }

    g.row += 1;
    const multiplier = multiplierFor(g.difficulty, g.row);

    if (g.row >= ROWS) { // reached the top: auto-cashout
      g.over = true;
      games.delete(gameId);
      const payout = roundMoney(g.amount * multiplier);
      let balance;
      if (isEmbedded()) {
        reportResult(g, true, payout, multiplier);
        balance = readBalance();
      } else {
        balance = writeBalance(readBalance() + payout);
      }
      return { result: 'win', row, col, multiplier, done: true, payout, balance, grid: g.grid };
    }

    return { result: 'win', row, col, multiplier, done: false };
  }

  async function cashout(gameId) {
    await latency();
    const g = games.get(gameId);
    if (!g || g.over) throw new Error('No active game');
    if (g.row === 0) throw new Error('Nothing to cash out');
    g.over = true;
    games.delete(gameId);

    const multiplier = multiplierFor(g.difficulty, g.row);
    const payout = roundMoney(g.amount * multiplier);
    let balance;
    if (isEmbedded()) {
      reportResult(g, true, payout, multiplier);
      balance = readBalance();
    } else {
      balance = writeBalance(readBalance() + payout);
    }
    return { payout, multiplier, balance, grid: g.grid };
  }

  return {
    ROWS, DIFFICULTIES, multiplierFor, platform,
    getBalance, setBalance, placeBet, pick, cashout,
  };
})();
