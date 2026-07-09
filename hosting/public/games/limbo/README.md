# ![1782314735117](image/README/1782314735117.png)Linkup — Limbo

A faithful HTML5/JS clone of the Stake "Limbo" casino game, rebranded as **Linkup**.
Runs entirely in the browser with **demo (fake) money**, and is structured so the
money/bet logic can be moved to a real backend + database with a one-file change.

## Run it

It's plain static files — no build step.

- **Quick:** double-click `index.html`, or
- **Served (recommended):**
  ```
  npx serve .
  ```

  then open the printed URL.

## How Limbo works

- Pick a **Target Multiplier**. Each round rolls a random crash multiplier.
- If the rolled multiplier **≥ your target**, you win `bet × target`; otherwise you lose the bet.
- **Win Chance** and **Target Multiplier** are linked: `winChance = 99 / target` (1% house edge).
- Payout/RTP verified over 200k rolls: ~0.9902 (matches the 1% edge).

## Files

| File              | Purpose                                                                     |
| ----------------- | --------------------------------------------------------------------------- |
| `index.html`    | Markup / layout                                                             |
| `css/style.css` | Styling (uses the Stake design tokens, Linkup palette)                      |
| `js/limbo.js`   | **Pure game math** — RNG, win-chance math. No DOM. Server-shareable. |
| `js/api.js`     | **Data layer** — the only file that touches storage/money.           |
| `js/sound.js`   | **Sound** — Web Audio API, all effects synthesized (no files).       |
| `js/i18n.js`    | **Localization** — English / Arabic strings + RTL handling.          |
| `js/app.js`     | UI: controls, animation, manual + auto betting, live stats.                 |

## Language (English / Arabic)

Toggle with the **العربية / English** button in the top bar. Switching to Arabic
sets `<html dir="rtl">` and mirrors the layout; numbers, multipliers and money
always stay left-to-right for readability. The choice is saved, and on a first
visit an Arabic browser locale auto-selects Arabic.

To add a language: add a block to `dict` in `js/i18n.js` and (optionally) extend
the toggle. UI text is keyed by `data-i18n` / `data-i18n-title` attributes in
`index.html`, so no markup changes are needed for new strings.

## Sound

All effects are generated procedurally with the Web Audio API (no audio files):
a rising sweep during the count-up, a win chime (brighter/longer for bigger
multipliers), a loss thud, and UI clicks. Toggle with the 🔊 button in the footer
(preference is saved). Audio unlocks on the first click, per browser autoplay rules.

## Database integration

All money/bet operations go through **`js/api.js`** (`LinkupAPI`), and every method is
`async`. Demo mode keeps state in `localStorage` and rolls client-side.

To go live, replace the body marked `>>> DB INTEGRATION POINT <<<` in
`LinkupAPI.placeBet` with a call to your backend:

```js
async placeBet({ amount, target }) {
  const res = await fetch('/api/limbo/bet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ amount, target }),
  });
  if (!res.ok) throw new Error((await res.json()).message);
  return res.json(); // { betId, result, target, amount, won, payout, profit, balance }
}
```

The **server** should:

1. Authenticate the user and read their wallet balance from the DB.
2. Validate `amount > 0` and `amount <= balance`.
3. Roll the multiplier (reuse the math in `limbo.js`) — ideally **provably fair**
   (HMAC of `serverSeed + clientSeed + nonce`) rather than `Math.random`.
4. Update the wallet and insert a `bets` row in a single transaction.
5. Return the resolved bet record (same shape `app.js` already consumes).

Suggested `bets` table:

```sql
CREATE TABLE bets (
  bet_id      BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL,
  amount      NUMERIC(20,8) NOT NULL,
  target      NUMERIC(12,2) NOT NULL,
  result      NUMERIC(12,2) NOT NULL,
  won         BOOLEAN NOT NULL,
  payout      NUMERIC(20,8) NOT NULL,
  profit      NUMERIC(20,8) NOT NULL,
  balance     NUMERIC(20,8) NOT NULL,  -- balance after this bet
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`getBalance`, `getHistory`, and `resetBalance` similarly map to simple `GET`/`POST`
endpoints. **Never trust a client-computed result or balance in production.**
