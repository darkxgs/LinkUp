#!/usr/bin/env node
/**
 * فحص ألعاب الكازينو HTML — Bridge + عملات + سيناريو المحفظة
 *
 * الاستخدام:
 *   node scripts/audit-casino-games.mjs
 *   node scripts/audit-casino-games.mjs --json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../hosting/public/games');

/** ألعاب الكازينو المعتمدة في التطبيق */
const CASINO_GAMES = [
  { id: 'plinko', type: 'react', path: 'casino/plinko' },
  { id: 'crash-rocket', type: 'react', path: 'casino/crash' },
  { id: 'dino', type: 'react', path: 'casino/dino' },
  { id: 'spin-win', type: 'react', path: 'casino/spin-win' },
  { id: 'mines', type: 'react', path: 'casino/mines' },
  { id: 'lucky-777', type: 'html', path: 'lucky-777' },
  { id: 'duck-race', type: 'html', path: 'duck-race' },
  { id: 'dice', type: 'html', path: 'dice' },
  { id: 'rock-paper-scissors', type: 'html', path: 'rock-paper-scissors' },
  { id: 'hilo', type: 'html', path: 'hilo' },
  { id: 'limbo', type: 'html', path: 'limbo' },
  { id: 'roulette', type: 'html', path: 'roulette' },
  { id: 'blackjack', type: 'html', path: 'blackjack' },
  { id: 'chicken-cross', type: 'html', path: 'chicken-cross' },
];

function readSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function listFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

function scanHtmlGame(game) {
  const base = path.join(ROOT, game.path);
  const indexPath = path.join(base, 'index.html');
  const files = listFiles(base).filter((f) => /\.(js|html|css)$/i.test(f));
  const sourceFiles = files.filter((f) => !/\/assets\/index-[A-Za-z0-9_-]+\.js$/.test(f));
  const allText = files.map((f) => readSafe(f)).join('\n');
  const sourceText = sourceFiles.map((f) => readSafe(f)).join('\n');
  const indexHtml = readSafe(indexPath);

  const checks = {
    hasIndex: fs.existsSync(indexPath),
    hasBoot: /games-casino-boot\.js/.test(indexHtml),
    hasBridge: /casino-app-bridge|CasinoBridge/.test(allText),
    hasCoins: /casino-coins|CasinoCoins|coin-gold\.png|COIN_IMG|games-casino-boot/.test(allText + indexHtml),
    hasPlaceBet: /placeBet\s*\(/.test(allText),
    hasReportResult: /reportGameResult\s*\(/.test(allText),
    hasMobileCss: /casino-mobile\.css/.test(indexHtml),
    usesCoinGold: /coin-gold\.png|COIN_IMG|CasinoCoins|coinIconHTML|games-casino-boot/.test(allText + indexHtml),
    hasEmbedCoinUI: /applyEmbedCoinUI|installBridgeHooks|casino-embed-hooks|games-casino-boot/.test(allText + indexHtml),
    hasFiatClass: /class="fiat"|class='fiat'|\.fiat/.test(allText),
    dollarInJs: (sourceText.match(/fmtUsd|['"]\$['"]|\$\d+\.00/g) || []).length,
    usdcSvg: /data-ds-icon|USDC/.test(allText),
    bootVersion: (indexHtml.match(/games-casino-boot\.js\?v=(\d+)/) || [])[1] || '—',
  };

  const issues = [];
  if (!checks.hasIndex) issues.push('لا يوجد index.html');
  if (!checks.hasBoot) issues.push('بدون games-casino-boot.js');
  if (!checks.hasBridge) issues.push('بدون CasinoBridge');
  if (!checks.hasCoins) issues.push('بدون casino-coins.js');
  if (!checks.hasPlaceBet) issues.push('بدون placeBet()');
  if (!checks.hasReportResult) issues.push('بدون reportGameResult()');
  if (!checks.hasMobileCss) issues.push('بدون casino-mobile.css');
  if (!checks.usesCoinGold) issues.push('لا تستخدم أيقونة الكوينز');
  if (!checks.hasEmbedCoinUI) issues.push('بدون applyEmbedCoinUI');
  if (checks.dollarInJs > 8) issues.push(`رموز $ كثيرة في JS (${checks.dollarInJs})`);
  if (checks.usdcSvg && !checks.hasEmbedCoinUI) issues.push('تحتوي USDC SVG بدون خطاف embed');
  if (checks.usdcSvg && checks.hasEmbedCoinUI) {
    /* USDC في HTML لكن تُخفى عبر casino-mobile.css */
  }

  const score =
    (checks.hasBoot ? 1 : 0) +
    (checks.hasBridge ? 1 : 0) +
    (checks.hasCoins ? 1 : 0) +
    (checks.hasPlaceBet ? 1 : 0) +
    (checks.hasReportResult ? 1 : 0) +
    (checks.usesCoinGold ? 1 : 0) +
    (checks.hasEmbedCoinUI ? 1 : 0);

  return { ...checks, issues, score, maxScore: 7, ok: issues.length === 0 };
}

function scanReactGame(game) {
  const casinoDir = path.join(ROOT, 'casino');
  const files = listFiles(casinoDir).filter((f) => /\.(js|tsx?)$/i.test(f));
  const allText = files.map((f) => readSafe(f)).join('\n');
  const checks = {
    hasWalletBridge: /useLinkUpWallet|CasinoBridge|INIT_DATA/.test(allText),
    hasCoinGold: /coin-gold\.png/.test(allText),
    hasPlaceBet: /placeBet|PLACE_BET/.test(allText),
    hasGameResult: /GAME_RESULT|reportGameResult/.test(allText),
  };
  const issues = [];
  if (!checks.hasWalletBridge) issues.push('بدون ربط محفظة React');
  if (!checks.hasCoinGold) issues.push('بدون coin-gold.png');
  return { ...checks, issues, ok: issues.length === 0, type: 'react-bundle' };
}

function main() {
  const jsonOut = process.argv.includes('--json');
  const results = CASINO_GAMES.map((game) => {
    const data =
      game.type === 'react'
        ? scanReactGame(game)
        : scanHtmlGame(game);
    return { id: game.id, type: game.type, ...data };
  });

  if (jsonOut) {
    console.log(JSON.stringify(results, null, 2));
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }

  console.log('\n=== فحص ألعاب الكازينو — Bridge + كوينز ===\n');
  const w = 22;
  console.log(
    'اللعبة'.padEnd(w) +
      'النوع'.padEnd(8) +
      'النتيجة'.padEnd(10) +
      'boot'.padEnd(6) +
      'ملاحظات',
  );
  console.log('-'.repeat(90));

  for (const r of results) {
    const status = r.ok ? '✅ OK' : '⚠️ FIX';
    const boot = r.bootVersion || (r.type === 'react' ? 'react' : '—');
    const notes = r.issues.length ? r.issues.join('؛ ') : 'مطابق';
  console.log(
      r.id.padEnd(w) +
        (r.type || '').padEnd(8) +
        status.padEnd(10) +
        String(boot).padEnd(6) +
        notes,
    );
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n--- ملخص ---');
  console.log(`إجمالي: ${results.length} | ناجحة: ${results.length - failed.length} | تحتاج إصلاح: ${failed.length}`);

  if (failed.length) {
    console.log('\nألعاب تحتاج متابعة:');
    failed.forEach((r) => console.log(`  • ${r.id}: ${r.issues.join(', ')}`));
  }

  console.log('\nللنشر بعد الإصلاحات: cd linkup-functions && firebase deploy --only hosting\n');
  process.exit(failed.length ? 1 : 0);
}

main();
