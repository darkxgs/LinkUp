import http from 'node:http';
import { LudoServer } from './games/ludo-src/server/WebSocketServer.js';
import { attachUnoServer } from './games/uno-server.mjs';
import { attachMaskChatServer } from './games/mask-chat-server.mjs';
import { attachDominoServer } from './games/domino-server.mjs';
import { attachCarromServer } from './games/carrom-server.mjs';
import { attachJackarooServer } from './games/jackaroo-server.mjs';
import { attachXoServer } from './games/xo-server.mjs';

/**
 * يربط مسارات WebSocket على سيرفر HTTP — موجّه upgrade واحد لتجنب تعارض المسارات
 */
export function attachRoomGamesToServer(server, { pathPrefix = '' } = {}) {
  const prefix = pathPrefix.replace(/\/$/, '');
  const ludo = new LudoServer({ noServer: true, path: `${prefix}/ws/ludo` });
  const unoWss = attachUnoServer(null, { path: `${prefix}/ws/uno`, noServer: true });
  const maskWss = attachMaskChatServer(null, { path: `${prefix}/ws/mask-chat`, noServer: true });
  const dominoWss = attachDominoServer(null, { path: `${prefix}/ws/domino`, noServer: true });
  const carromWss = attachCarromServer(null, { path: `${prefix}/ws/carrom`, noServer: true });
  const jackarooWss = attachJackarooServer(null, { path: `${prefix}/ws/jackaroo`, noServer: true });
  const xoWss = attachXoServer(null, { path: `${prefix}/ws/xo`, noServer: true });

  const routes = new Map([
    [`${prefix}/ws/ludo`, ludo.wss],
    [`${prefix}/ws/uno`, unoWss],
    [`${prefix}/ws/mask-chat`, maskWss],
    [`${prefix}/ws/domino`, dominoWss],
    [`${prefix}/ws/carrom`, carromWss],
    [`${prefix}/ws/jackaroo`, jackarooWss],
    [`${prefix}/ws/xo`, xoWss],
  ]);

  server.on('upgrade', (req, socket, head) => {
    const pathname = req.url?.split('?')[0] ?? '';
    const wss = routes.get(pathname);
    if (!wss) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });
}

/**
 * سيرفر WebSocket فقط — الواجهات على Firebase Hosting
 */
export function createRoomGamesServer({ pathPrefix = '' } = {}) {
  const server = http.createServer((req, res) => {
    const url = req.url?.split('?')[0] ?? '/';
    if (url === '/health' || url === '/' || url.endsWith('/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, service: 'linkup-room-games-ws' }));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  attachRoomGamesToServer(server, { pathPrefix });

  return { server };
}
