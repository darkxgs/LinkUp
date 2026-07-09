# ألعاب الكازينو React (من standalone-games)

مصدر ألعاب: Plinko، Crash، Dino، Spin & Win — مربوطة بمحفظة التطبيق عبر `postMessage`.

## البناء والنشر

```bash
cd linkup-functions/casino-games
npm install
npm run build
```

الناتج يُنسخ تلقائياً إلى `hosting/public/games/casino/`.

ثم من جذر `linkup-functions`:

```bash
firebase deploy --only hosting
```

## المسارات

| اللعبة | المسار | معرّف الإعداد |
|--------|--------|----------------|
| Plinko | `/games/casino/plinko` | `plinko` |
| Crash | `/games/casino/crash` | `crash-rocket` |
| Dino | `/games/casino/dino` | `dino` |
| Spin & Win | `/games/casino/spin-win` | `spin-win` |

## جسر المحفظة

`src/bridge/useLinkUpWallet.js` — يتواصل مع `webview.tsx` في التطبيق:
`INIT_GAME` → `INIT_DATA` → `PLACE_BET` → `GAME_RESULT`
