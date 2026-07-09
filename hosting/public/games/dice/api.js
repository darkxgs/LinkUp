/* =========================================================================
 * Linkup Dice — Data / API layer  (the database seam)
 * -------------------------------------------------------------------------
 * THIS is the only file you replace when you go live with a real backend.
 *
 * Right now everything runs in the browser:
 *   - "balance" lives in localStorage (a fake database)
 *   - the dice roll is generated locally with a provably-fair HMAC
 *
 * To go live, keep the SAME method names and return shapes, but change the
 * bodies of `getState()` and `placeBet()` to call your server, e.g.:
 *
 *     async placeBet(bet) {
 *       const res = await fetch('/api/dice/bet', {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify(bet),
 *       });
 *       if (!res.ok) throw new Error((await res.json()).message);
 *       return res.json(); // { roll, won, payout, profit, balance, nonce, ... }
 *     }
 *
 * The UI (game.js) never touches storage or RNG directly — it only ever
 * calls LinkupAPI. That keeps the swap to a real DB a one-file change.
 * ========================================================================= */

const LinkupAPI = (() => {
  const STORAGE_KEY = 'linkup_dice_state_v1';
  const HOUSE_EDGE = 0.01;
  const STARTING_BALANCE = 1000;

  function isEmbedded() {
    return !!(globalThis.CasinoBridge && CasinoBridge.isEmbedded());
  }

  /* ----- fake "database" (localStorage) -------------------------------- */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* ignore corrupt state */ }
    return {
      balance: STARTING_BALANCE,
      nonce: 0,
      clientSeed: randomHex(8),
      serverSeed: randomHex(32),      // kept "hidden" until rotated, like a real casino
      history: [],
    };
  }

  let db = load();
  function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }

  /* ----- provably-fair RNG -------------------------------------------- *
   * result = floor( f(HMAC_SHA256(serverSeed, clientSeed:nonce)) * 10001 ) / 100
   * Gives a value in [0.00, 100.00]. Swap for a server computation in prod.
   * -------------------------------------------------------------------- */
  async function rollFor(serverSeed, clientSeed, nonce) {
    const message = `${clientSeed}:${nonce}`;
    try {
      const keyBytes = hexToBytes(serverSeed);
      const key = await crypto.subtle.importKey(
        'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const sig = new Uint8Array(
        await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
      );
      // first 4 bytes -> uint32 -> [0,1)
      const int = ((sig[0] << 24) | (sig[1] << 16) | (sig[2] << 8) | sig[3]) >>> 0;
      const f = int / 0x100000000;
      return Math.floor(f * 10001) / 100;
    } catch (_) {
      // Fallback for any environment without Web Crypto. Demo-only.
      return Math.floor(Math.random() * 10001) / 100;
    }
  }

  async function sha256Hex(str) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return bytesToHex(new Uint8Array(buf));
    } catch (_) {
      return '(hash unavailable)';
    }
  }

  /* ----- helpers ------------------------------------------------------- */
  function randomHex(bytes) {
    const a = new Uint8Array(bytes);
    (crypto.getRandomValues ? crypto : { getRandomValues: fakeRandom }).getRandomValues(a);
    return bytesToHex(a);
  }
  function fakeRandom(a) { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; }
  function bytesToHex(a) { return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join(''); }
  function hexToBytes(hex) {
    const a = new Uint8Array(hex.length / 2);
    for (let i = 0; i < a.length; i++) a[i] = parseInt(hex.substr(i * 2, 2), 16);
    return a;
  }

  /* ----- public API ---------------------------------------------------- */
  return {
    HOUSE_EDGE,

    /** Current account snapshot (balance, nonce, seed info). */
    async getState() {
      const balance = isEmbedded() ? CasinoBridge.getBalance() : db.balance;
      return {
        balance: balance,
        nonce: db.nonce,
        clientSeed: db.clientSeed,
        serverSeedHash: await sha256Hex(db.serverSeed),
        history: db.history.slice(0, 50),
      };
    },

    /** Reset the demo bankroll. (Local-only convenience; remove in prod.) */
    resetBalance(amount = STARTING_BALANCE) {
      db.balance = amount;
      persist();
      return db.balance;
    },

    /** Let the player set their client seed (part of provably-fair). */
    setClientSeed(seed) {
      db.clientSeed = String(seed || randomHex(8)).slice(0, 64);
      persist();
      return db.clientSeed;
    },

    /** Reveal the current server seed and rotate to a fresh one. */
    async rotateServerSeed() {
      const revealed = db.serverSeed;
      db.serverSeed = randomHex(32);
      db.nonce = 0;
      persist();
      return { revealedServerSeed: revealed, newServerSeedHash: await sha256Hex(db.serverSeed) };
    },

    /**
     * Place a bet.
     * @param {{amount:number, condition:'above'|'below', target:number, multiplier:number}}
     * @returns {Promise<{roll,won,payout,profit,balance,nonce,target,condition}>}
     */
    async placeBet({ amount, condition, target, multiplier }) {
      amount = Number(amount) || 0;
      if (amount <= 0) throw new Error('Enter a bet amount greater than 0');
      const embedded = isEmbedded();
      const balance = embedded ? CasinoBridge.getBalance() : db.balance;
      if (amount > balance + 1e-9) throw new Error('Insufficient balance');

      if (embedded) {
        await CasinoBridge.placeBet(amount);
      }

      const nonce = db.nonce + 1;
      const roll = await rollFor(db.serverSeed, db.clientSeed, nonce);
      const won = condition === 'above' ? roll > target : roll < target;
      const payout = won ? amount * multiplier : 0;
      const profit = payout - amount;

      db.nonce = nonce;
      if (embedded) {
        CasinoBridge.reportGameResult({
          isWin: won,
          stake: amount,
          winAmount: payout,
          multiplier: multiplier,
        });
        db.balance = CasinoBridge.getBalance();
      } else {
        db.balance = db.balance - amount + payout;
        persist();
      }
      db.history.unshift({ roll, won, amount, payout, profit, condition, target, nonce, ts: Date.now() });
      db.history = db.history.slice(0, 50);
      if (!embedded) persist();

      return { roll, won, payout, profit, balance: embedded ? CasinoBridge.getBalance() : db.balance, nonce, target, condition };
    },
  };
})();
