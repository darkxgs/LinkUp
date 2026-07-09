# Build Prompt: "Rock Paper Scissors" — 1v1 Casino-Style Game

## Role / Context

You are building a single-page web game called **"Rock Paper Scissors"** for a casino-style mini-games app. This is the  **foundation build** : a fully working, polished 2-player Rock/Paper/Scissors game, playable locally (both players share one device, "pass and play" style).

Critical constraint: **Do NOT integrate any real backend, real payment processor, or real network multiplayer.** The "balance," the "wager," and the second player must all be simulated locally for now. BUT the code must be cleanly separated into modules so the local pieces can later be swapped for real ones (real wallet API, real opponent over a network) with minimal changes to the core game logic.

## Tech Stack

* Plain HTML5 + CSS + JavaScript. No build step, no frameworks, no npm install. A single folder that opens directly in a browser.
* Rendering: HTML5 `<canvas>` or plain DOM/CSS (your choice — DOM+CSS is fine here since there's no physics simulation, just clean 2D UI/animation).
* No backend. No requirement to persist data between reloads, but design the balance layer behind a swappable interface (see Architecture below).

## Game Rules to Implement

1. Two players. Each round, both players pick  **Rock** ,  **Paper** , or  **Scissors** .
2. Standard resolution: Rock beats Scissors, Scissors beats Paper, Paper beats Rock. Same pick =  **tie** , and the round replays (does not count toward either player's round wins).
3. **Match format** : best-of-3 — first player to win **2 rounds** wins the match. Make this a single constant (`ROUNDS_TO_WIN = 2`) so it's trivial to change to single-throw (`ROUNDS_TO_WIN = 1`) or best-of-5 (`ROUNDS_TO_WIN = 3`).
4. Each round must be **simultaneous and hidden** — neither player's pick is revealed until both have locked one in. This is the core rule that shapes the architecture below.

## Local "Pass and Play" Flow (important — read carefully)

Since both players currently share one device, but picks must stay hidden from each other, implement this flow per round:

1. **Player 1's turn** : show Player 1's selection screen (their name/avatar, balance, the 3 pick buttons). They tap one. Immediately hide it and show a "Pass the device to Player 2" handoff screen.
2. Player 2 taps "I'm Ready," sees their own selection screen, picks one. Hide it again.
3. Once **both** picks exist, play a short countdown/shake animation ("Rock... Paper... Scissors... Shoot!"), then reveal both picks at the same time and show the round result.
4. Repeat until one player reaches `ROUNDS_TO_WIN`.

 **Why this matters for multiplayer-readiness** : treat each player's pick as an independent "submission" that gets stored, and only resolve the round once both submissions exist — exactly like two separate online clients would each submit a pick and wait for the other's to arrive. Building the local version this way means the resolution logic never has to change when you add real networking later; only how the second pick "arrives" changes.

## Casino Wager Layer (LOCAL / SIMULATED ONLY)

* Each player has a **virtual balance** (default 1000 coins, configurable constant).
* Before a match: show a wager screen — both balances, a bet input or preset chips (50/100/250/500), a "Ready" toggle per player.
* On match start: deduct the wager from both balances into a **pot** (`pot = bet × 2`). Add a `RAKE_PERCENT` constant, default `0`, so a future house cut is a one-line change.
* On match end: credit the full pot to the winner. Show a clear result screen ("You Won X coins" / "You Lost X coins") with **Rematch** and **Main Menu** buttons.
* **Architecture requirement** : wrap all balance reads/writes behind a `BalanceProvider` interface — e.g. `getBalance(playerId)`, `placeWager(playerId, amount)`, `settle(winnerId, pot)`. Ship only a `LocalBalanceProvider` (in-memory JS object) for now. Leave a clear comment showing exactly where a future `RemoteBalanceProvider` (real wallet/API) would plug in using the same interface.

## Multiplayer-Readiness Architecture

Split into separate files, no mixing of concerns:

* **`state.js`** — single source of truth: current round, each player's locked-in pick (or `null` if not yet submitted), round wins per player, wager/pot, and a finite state machine: `WAGER → P1_PICKING → HANDOFF → P2_PICKING → REVEALING → ROUND_RESULT → (next round or MATCH_OVER)`.
* **`rules.js`** — pure function: given two picks, returns `'p1' | 'p2' | 'tie'`. Also tracks match progress (rounds won, whether `ROUNDS_TO_WIN` has been reached). No rendering, no input handling, no knowledge of the handoff UI.
* **`render.js`** — draws whatever `state.js` currently holds (selection screen, handoff screen, countdown/reveal animation, scoreboard, result screen). No game logic.
* **`input.js`** — handles the 3 pick buttons. Converts a tap into a `Pick { playerId, choice }` object and passes it to `transport.js`. Nothing else.
* **`transport.js`** — **the key seam for multiplayer.** Define a `GameTransport` interface: `submitPick(playerId, pick)` and a callback `onRoundReady(p1Pick, p2Pick)` that fires once both picks exist. Ship a `LocalTransport` that stores both local picks in memory (using the pass-and-play handoff to keep them hidden from each other) and fires the callback once both are in. Later, swap in a `SocketTransport`/Firebase/WebRTC implementation, where each remote client submits its own pick and the callback fires once both arrive over the network — `state.js` and `rules.js` never need to change.
* **`wallet.js`** — the `BalanceProvider` described above.

Add one config flag near the top of the entry file, e.g. `const IS_LOCAL_HOTSEAT = true;`, with a comment explaining this is where a real `Transport` + remote player identity gets wired in for online play.

## Visuals / Design

* Casino-style dark background (felt texture or subtle neon glow), centered game card.
* Each selection screen: player name/avatar placeholder, balance, the pot, round-score indicator (e.g. 2 small chip icons showing rounds won so far), and 3 large tappable icons — Rock (fist), Paper (flat hand), Scissors (two fingers) — with a bounce/scale animation on tap.
* Handoff screen: clear "Pass the device to Player 2" message with a big "I'm Ready" button, so Player 1's pick can't be glimpsed.
* Countdown/reveal: a short "3, 2, 1, Shoot!" sequence with both hand icons "shaking" in sync, then snapping to the revealed choices simultaneously.
* Round result toast: "Player 1 wins the round!" / "Tie — replay!" etc.
* Match-end overlay: winner announcement, coins won/lost, **Rematch** and **Main Menu** buttons.
* Fully responsive for mobile and desktop, touch and mouse both supported.

## File Structure to Produce

```
rps-casino/
  index.html
  style.css
  js/
    state.js
    rules.js
    render.js
    input.js
    transport.js
    wallet.js
    main.js
```

It must run by simply opening `index.html` in a browser — no build tools, no npm install.

## Explicitly Out of Scope for This Build

* No real payment/withdrawal integration.
* No actual server, WebSocket, or matchmaking — `LocalTransport` is a stub only.
* No login/auth system — just "Player 1" / "Player 2" for now.
* No persistence required across page reloads (in-memory state is fine), but don't write anything that would make adding persistence later painful.

## Quality Bar

* Smooth, satisfying tap/reveal animations — this is a fast, snappy game, it should feel instant and fun.
* Clean, commented code, especially at the seams described above (`transport.js`, `wallet.js`) — a future developer should be able to read one comment and know exactly what to swap in for real multiplayer or real money.
* After building it, briefly explain in plain language which 2–3 files would need to change to (a) connect a real backend wallet and (b) connect real online multiplayer.
