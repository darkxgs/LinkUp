#!/usr/bin/env node
/** تحميل صور المعالم محلياً + تحديث manifest.json */
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'assets', 'landmarks');
const MANIFEST = path.join(OUT, 'manifest.json');
const bank = JSON.parse(fs.readFileSync(path.join(__dirname, 'landmarks-quiz-bank.json'), 'utf8'));

fs.mkdirSync(OUT, { recursive: true });

function toThumbUrl(directUrl, width) {
  width = width || 640;
  if (!directUrl || directUrl.indexOf('upload.wikimedia.org') === -1) return directUrl;
  var s = directUrl.split('?')[0];
  if (s.indexOf('/thumb/') !== -1) return s;
  var m = s.match(/upload\.wikimedia\.org\/wikipedia\/commons\/(.+\.(jpg|jpeg|png|webp))$/i);
  if (!m) return directUrl;
  var file = m[1];
  var name = file.split('/').pop();
  return 'https://upload.wikimedia.org/wikipedia/commons/thumb/' + file + '/' + width + 'px-' + name;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkUpGames/1.0)' } },
      (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          if (redirects > 5) return reject(new Error('too many redirects'));
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          res.resume();
          return resolve(fetchBuffer(next, redirects + 1));
        }
        if (res.statusCode === 429) {
          res.resume();
          return reject(new Error('HTTP 429'));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error('HTTP ' + res.statusCode));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      },
    );
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('timeout')));
  });
}

async function downloadWithRetry(url, attempts = 5) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fetchBuffer(url);
    } catch (e) {
      lastErr = e;
      if (String(e.message).includes('429')) {
        await sleep(6000 * (i + 1));
      } else {
        await sleep(1200);
      }
    }
  }
  throw lastErr;
}

function writeManifest(slugs, files) {
  fs.writeFileSync(
    MANIFEST,
    JSON.stringify({ slugs, files: files.sort() }, null, 2) + '\n',
    'utf8',
  );
}

async function main() {
  const slugs = new Set();
  const downloaded = [];
  let ok = 0;
  let fail = 0;

  for (const item of bank.items) {
    if (!item.slug || slugs.has(item.slug)) continue;
    slugs.add(item.slug);
    const dest = path.join(OUT, item.slug + '.jpg');
    if (fs.existsSync(dest) && fs.statSync(dest).size > 8000) {
      console.log('skip', item.slug);
      downloaded.push(item.slug + '.jpg');
      ok += 1;
      continue;
    }
    try {
      let buf = null;
      const urls = [item.imageUrl, toThumbUrl(item.imageUrl, 640)];
      for (const url of urls) {
        try {
          buf = await downloadWithRetry(url, 3);
          if (buf.length >= 5000) break;
        } catch (_) {
          buf = null;
        }
      }
      if (!buf || buf.length < 5000) throw new Error('download failed');
      fs.writeFileSync(dest, buf);
      downloaded.push(item.slug + '.jpg');
      console.log('ok', item.slug, buf.length);
      ok += 1;
      writeManifest(
        Object.fromEntries(
          bank.items
            .filter((x) => x.landmarkName && x.slug)
            .map((x) => [x.landmarkName.replace(/\s*\(\d+\)\s*$/, '').trim(), x.slug]),
        ),
        downloaded,
      );
      await sleep(5000);
    } catch (e) {
      console.log('fail', item.slug, e.message);
      fail += 1;
      await sleep(2500);
    }
  }

  writeManifest(
    JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).slugs || {},
    downloaded,
  );
  console.log('done', ok, 'ok', fail, 'fail', 'files', downloaded.length);
  if (fail > 0) process.exitCode = 1;
}

main();
