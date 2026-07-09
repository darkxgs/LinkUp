/**
 * يحزّم سيرفر WebSocket لألعاب الروم داخل Cloud Functions
 */
import * as esbuild from 'esbuild';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../room-games-server');
const outfile = path.resolve(__dirname, '../lib/roomGamesWsBundle.cjs');

async function main() {
  await esbuild.build({
    entryPoints: [path.join(root, 'createServer.mjs')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    outfile,
    logLevel: 'info',
    external: ['ws', 'express', 'cors'],
  });
  console.log('roomGamesWsBundle.cjs ready');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
