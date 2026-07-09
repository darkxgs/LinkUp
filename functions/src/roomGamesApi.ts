/**
 * Cloud Function — WebSocket ألعاب الروم (Ludo / UNO / Mask Chat)
 * الواجهات: Firebase Hosting /games/room-free/*
 */
import { onRequest } from 'firebase-functions/v2/https';
import * as path from 'path';
import type { IncomingMessage, Server, ServerResponse } from 'http';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const bundlePath = path.join(__dirname, 'roomGamesWsBundle.cjs');

/** مسار البادئة على cloudfunctions.net/roomGamesApi/... */
const WS_PATH_PREFIX = '/roomGamesApi';

let attached = false;

function attachToUnderlyingServer(server: Server) {
  if (attached) return;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { attachRoomGamesToServer } = require(bundlePath);
  attachRoomGamesToServer(server, { pathPrefix: WS_PATH_PREFIX });
  attached = true;
}

function handleHealth(req: IncomingMessage, res: ServerResponse) {
  const url = req.url?.split('?')[0] ?? '/';
  if (
    url === '/health' ||
    url === '/' ||
    url === WS_PATH_PREFIX ||
    url === `${WS_PATH_PREFIX}/health`
  ) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'linkup-room-games-ws' }));
    return true;
  }
  return false;
}

export const roomGamesApi = onRequest(
  {
    region: 'us-central1',
    cors: true,
    timeoutSeconds: 3600,
    memory: '512MiB',
    minInstances: 0,
    maxInstances: 20,
  },
  (req, res) => {
    const underlying = (req.socket as { server?: Server }).server;
    if (underlying) {
      attachToUnderlyingServer(underlying);
    }

    if (handleHealth(req, res)) return;

    // ترقية WebSocket تُعالَج عبر مستمعي upgrade على السيرفر الأساسي
    if (req.headers.upgrade?.toLowerCase() === 'websocket') {
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  },
);
