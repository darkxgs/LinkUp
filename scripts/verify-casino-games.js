#!/usr/bin/env node
/**
 * Verify HTML casino games are deployed with bridge scripts.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../hosting/public/games');

const GAMES = [
  { id: 'duck-race', files: ['index.html', 'js/api.js', 'js/game.js'] },
  { id: 'dice', files: ['index.html', 'api.js', 'game.js'] },
  { id: 'lucky-777', files: ['index.html'] },
  { id: 'rock-paper-scissors', files: ['index.html', 'js/wallet.js', 'js/main.js'] },
  { id: 'penalty-kick-casino', files: ['index.html', 'js/state.js', 'js/main.js'] },
  { id: 'hilo', files: ['index.html', 'js/api.js', 'js/app.js'] },
  { id: 'limbo', files: ['index.html', 'js/api.js', 'js/app.js'] },
];

const SHARED = [
  'casino-app-bridge.js',
  'casino-i18n.js',
  'casino-mobile.css',
  'games-casino-boot.js',
];

let passed = 0;
let failed = 0;

function ok(msg) {
  console.log('✓', msg);
  passed++;
}

function fail(msg) {
  console.error('✗', msg);
  failed++;
}

SHARED.forEach((f) => {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) ok(`shared: ${f}`);
  else fail(`missing shared: ${f}`);
});

GAMES.forEach((g) => {
  g.files.forEach((rel) => {
    const p = path.join(ROOT, g.id, rel);
    if (!fs.existsSync(p)) {
      fail(`${g.id}: missing ${rel}`);
      return;
    }
    ok(`${g.id}: ${rel}`);
    if (rel.endsWith('.html')) {
      const html = fs.readFileSync(p, 'utf8');
      if (!html.includes('games-casino-boot') && !html.includes('casino-app-bridge')) {
        fail(`${g.id}: index.html missing bridge boot`);
      } else {
        ok(`${g.id}: bridge wired in HTML`);
      }
    }
    if (rel.includes('api.js') || rel.includes('wallet') || rel.includes('state') || rel.includes('game.js')) {
      const src = fs.readFileSync(p, 'utf8');
      const needsBridge = !(g.id === 'dice' && rel === 'game.js');
      if (needsBridge && src.includes('CasinoBridge')) ok(`${g.id}: CasinoBridge referenced in ${rel}`);
      else if (needsBridge) fail(`${g.id}: no CasinoBridge in ${rel}`);
    }
  });
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
