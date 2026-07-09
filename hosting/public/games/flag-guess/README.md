# خمّن المكان — Guess the Place (Geoguessr-style)

Game #1 of the **Intelligence Games** (ألعاب الذكاء) suite. Single-player, casino-style:
you're shown a photo of a famous **place/landmark**, type the **country** it's in within
10 seconds, and win **5× your bet** or lose it. One round per day. Arabic UI, RTL, mobile-first.

- **Currency = coins (كوين)** — a simulated virtual unit. **No real money, no credit card, no
  payment integration.** Coins, bets, multiplier, and the GeoNames username are constants in
  `js/policyConfig.js`.
- **Single (very-hard) difficulty.** Obscure, Geoguessr-style locations.
- **Live, endless places via GeoNames** (free, no key/credit card) — every round pulls a fresh
  random place worldwide. Falls back to 89 curated verified places when offline / no username.
- **No repeats:** a place a player has already seen never comes back (`seenProvider.js`).
- **Bets:** preset chips `5,000 / 10,000 / 25,000 / 50,000` **plus a custom bet** — you may pay
  *more* than the minimum but never *less* (min `5,000`).

## GeoNames setup (required for live places)

1. Register a **free** account at [geonames.org/login](https://www.geonames.org/login) and
   confirm the email.
2. **Enable web services:** [geonames.org/manageaccount](https://www.geonames.org/manageaccount)
   → under *"Free Web Services"* click **"Click here to enable."** (Easy to miss — without it
   the API returns `user does not exist`.)
3. Set `GEONAMES_USERNAME` in `js/policyConfig.js`. Until a working username is set, the game
   runs on the curated fallback list.

Each round calls GeoNames `findNearbyWikipedia` around a random land point, turns the
`countryCode` into the answer (`data/countries.js`), and pulls a photo from Wikipedia. Images
are **preloaded** before the timer starts, so a round never shows a broken image.

## Run it

Just open `index.html` in a browser — **no build step, no npm, no server**.
(Classic `<script>` tags are used instead of ES modules specifically so `file://` opening
works in Chrome/Edge/Firefox, which block module loading over `file://`. See the comment
block in `index.html`.)

> `.claude/launch.json` only exists to drive the automated preview/test harness
> (`python -m http.server`). It is **not** required to play the game.

## How it plays

1. Daily-limit check → if you already played today, a **"come back tomorrow"** screen with a
   live countdown to local midnight.
2. Otherwise choose a bet — a preset chip (**5,000 / 10,000 / 25,000 / 50,000** coins) or a
   **custom amount** (≥ 5,000; you can pay more, never less).
3. A fresh place is fetched (a brief loading screen) — one you haven't seen before — and a
   **place photo** appears; a 10-second ring starts.
4. Type the **country name** (Arabic or English) and submit (Enter or the button).
5. **Win** (correct + in time) → credited `bet × 5`. **Lose** (wrong or timeout) → bet lost and
   the correct answer is revealed automatically.
6. Either way the round is recorded — you're locked out until tomorrow.

## Architecture

```
flag/
  index.html
  style.css                 mobile-first, RTL, tested breakpoints
  js/
    policyConfig.js          SHARED  – suite-wide constants (coins, bets, multiplier, GeoNames user)
    walletProvider.js        SHARED  – BalanceProvider iface (get/debit/credit/setBalance)
    dailyLimitProvider.js    SHARED  – DailyLimitProvider iface + Local impl + reset clock
    seenProvider.js          SHARED  – SeenProvider iface (no-repeat history, per user+game)
    geoNamesProvider.js      SHARED  – ContentProvider: GeoNames (live) + Local (fallback)
    data/countries.js        SHARED  – ISO2 -> { en, ar, aliases } for answers
    triviaEngine.js          GAME #1 – pure logic (validate answer, normalize, timeout)
    state.js                 GAME #1 – single source of truth + FSM (async place loading)
    render.js                GAME #1 – view layer (no logic)
    input.js                 GAME #1 – taps, submit, custom-bet, countdown tick
    data/items.js            GAME #1 – curated fallback places ([file, ISO2])
    main.js                  GAME #1 – wiring / bootstrap
```

Two global namespaces: `window.IG` (the reusable policy layer) and `window.Game` (Game #1).

### State machine
`CHECK_DAILY_LIMIT → BLOCKED_UNTIL_TOMORROW | BET_SELECT → CHALLENGE_LOADING → CHALLENGE_ACTIVE → RESULT (WIN/LOSE)`
(`CHALLENGE_LOADING` fetches a fresh, unseen place; on failure it refunds the wager and returns to `BET_SELECT`.)

## Coins

Coins are a **simulated** unit — there is no real payment or credit card anywhere. Tune the
starting balance, bets, and reward multiplier as constants in `js/policyConfig.js`. The
`BalanceProvider` interface (`get/debit/credit/setBalance`) is the seam: swap
`LocalBalanceProvider` for a `RemoteBalanceProvider` backed by your server to go live — no
game-code changes.

## Content

With GeoNames enabled, places are **endless and live** — no fixed list to maintain. The
**fallback** (`data/items.js`) is 89 verified obscure places declared as `[wikimediaFile, ISO2]`;
country/Arabic names come from `data/countries.js`. To grow the fallback, just append rows.

- **Fallback photos** → Wikimedia Commons `Special:FilePath/<File>.jpg?width=640` (stable, no hash).
  **Verify each image's license before shipping live.**
- `triviaEngine.normalize()` folds alef/yaa/taa, diacritics, and a leading "ال", so answers match
  whether the player types Arabic or English, with or without "ال".
- The player always types the **country** (per spec "اسم الدولة"), even though the photo shows a
  specific place.

## Pre-launch requirements (NOT in this build — flagged in code)

- **Server-side enforcement.** `LocalBalanceProvider` and `LocalDailyLimitProvider` are demo
  stubs. A technical user can edit `localStorage` or change the device clock to bypass the daily
  limit and balance. A real-money build **must** enforce both server-side against a server clock.
- Real wallet/payment and real accounts.

## Adding Game #2 (the reusable-modules payoff)

Dropping in Game #2 means **adding** files, not changing the shared layer:

1. **`js/game2Engine.js`** — the new game's pure logic (its own rules/validation), the analog
   of `triviaEngine.js`.
2. **`js/data/game2Items.js`** (or equivalent) — the new game's content.

It reuses `policyConfig.js`, `walletProvider.js`, `dailyLimitProvider.js`, and `seenProvider.js`
**unchanged** — just pass a different `gameId` (e.g. `'game-2'`) so it gets its own independent
daily counter and no-repeat history. Game #2's `state.js`/`render.js`/`input.js` are
game-specific but follow the same pattern.

> A dev-only "↺ إعادة ضبط (اختبار)" button (bottom corner) clears today's lock and refills the
> demo balance for testing. Remove it for production (it lives in `render.js` + `main.js`).
