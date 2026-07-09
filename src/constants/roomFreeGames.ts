/**
 * ألعاب الروم المجانية — WebView + دعوات
 */

export type RoomFreeGameId =
  | 'ludo'
  | 'pk-battle'
  | 'jackaroo'
  | 'carrom'
  | 'mask-chat'
  | 'uno'
  | 'domino'
  | 'monster-crush'
  | 'xo';

export interface RoomFreeGameDef {
  id: RoomFreeGameId;
  slug: string;
  nameKey: string;
  /** وصف السيناريو الكامل */
  descriptionKey: string;
  emoji: string;
  color: string;
  minPlayers: number;
  maxPlayers: number;
  /** يفتح WebView — PK أصلية داخل التطبيق */
  mode: 'webview' | 'native';
  /** جاهزة للعب الآن */
  ready: boolean;
  imageUrl: string;
}

const HOSTING = 'https://linkup-dc45f.web.app/games/room-free';

/** سيرفر WebSocket — Cloud Run منفصل (linkup-room-games) */
export const ROOM_GAMES_SERVER =
  process.env.EXPO_PUBLIC_ROOM_GAMES_SERVER ||
  'https://linkup-room-games-521319798732.us-central1.run.app';

export function gameServerWsBase(): string {
  const base = ROOM_GAMES_SERVER.replace(/\/$/, '');
  if (base.startsWith('https://')) return base.replace('https://', 'wss://');
  if (base.startsWith('http://')) return base.replace('http://', 'ws://');
  return base;
}

export const ROOM_FREE_GAMES: RoomFreeGameDef[] = [
  {
    id: 'ludo',
    slug: 'ludo',
    nameKey: 'roomFreeGames.ludo',
    descriptionKey: 'roomFreeGames.descriptions.ludo',
    emoji: '🎲',
    color: '#F59E0B',
    minPlayers: 2,
    maxPlayers: 4,
    mode: 'webview',
    ready: true,
    imageUrl: 'https://linkup-dc45f.web.app/games/room-free/ludo/assets/dice.png',
  },
  {
    id: 'pk-battle',
    slug: 'pk',
    nameKey: 'roomFreeGames.pk',
    descriptionKey: 'roomFreeGames.descriptions.pk',
    emoji: '🏆',
    color: '#EF4444',
    minPlayers: 2,
    maxPlayers: 99,
    mode: 'native',
    ready: true,
    imageUrl: 'https://picsum.photos/seed/linkup-pk/200/200',
  },
  {
    id: 'jackaroo',
    slug: 'jackaroo',
    nameKey: 'roomFreeGames.jackaroo',
    descriptionKey: 'roomFreeGames.descriptions.jackaroo',
    emoji: '🃏',
    color: '#E11414',
    minPlayers: 4,
    maxPlayers: 4,
    mode: 'webview',
    ready: true,
    imageUrl: 'https://picsum.photos/seed/jackaroo/200/200',
  },
  {
    id: 'carrom',
    slug: 'carrom',
    nameKey: 'roomFreeGames.carrom',
    descriptionKey: 'roomFreeGames.descriptions.carrom',
    emoji: '🎯',
    color: '#10B981',
    minPlayers: 2,
    maxPlayers: 2,
    mode: 'webview',
    ready: true,
    imageUrl: 'https://picsum.photos/seed/carrom/200/200',
  },
  {
    id: 'mask-chat',
    slug: 'mask-chat',
    nameKey: 'roomFreeGames.maskChat',
    descriptionKey: 'roomFreeGames.descriptions.maskChat',
    emoji: '🎭',
    color: '#E11414',
    minPlayers: 2,
    maxPlayers: 2,
    mode: 'webview',
    ready: true,
    imageUrl: 'https://picsum.photos/seed/maskchat/200/200',
  },
  {
    id: 'uno',
    slug: 'uno',
    nameKey: 'roomFreeGames.uno',
    descriptionKey: 'roomFreeGames.descriptions.uno',
    emoji: '🟥',
    color: '#DC2626',
    minPlayers: 2,
    maxPlayers: 10,
    mode: 'webview',
    ready: true,
    imageUrl: 'https://picsum.photos/seed/uno/200/200',
  },
  {
    id: 'domino',
    slug: 'domino',
    nameKey: 'roomFreeGames.domino',
    descriptionKey: 'roomFreeGames.descriptions.domino',
    emoji: '⚫',
    color: '#64748B',
    minPlayers: 2,
    maxPlayers: 4,
    mode: 'webview',
    ready: true,
    imageUrl: 'https://picsum.photos/seed/domino/200/200',
  },
  {
    id: 'xo',
    slug: 'xo',
    nameKey: 'roomFreeGames.xo',
    descriptionKey: 'roomFreeGames.descriptions.xo',
    emoji: '❌',
    color: '#C61414',
    minPlayers: 2,
    maxPlayers: 2,
    mode: 'webview',
    ready: true,
    imageUrl: 'https://picsum.photos/seed/linkup-xo/200/200',
  },
  {
    id: 'monster-crush',
    slug: 'monster-crush',
    nameKey: 'roomFreeGames.monsterCrush',
    descriptionKey: 'roomFreeGames.descriptions.monsterCrush',
    emoji: '🍬',
    color: '#FF6670',
    minPlayers: 1,
    maxPlayers: 4,
    mode: 'webview',
    ready: true,
    imageUrl: 'https://picsum.photos/seed/crush/200/200',
  },
];

export function getRoomFreeGame(id: string): RoomFreeGameDef | undefined {
  return ROOM_FREE_GAMES.find((g) => g.id === id);
}

export interface BuildRoomGameUrlParams {
  game: RoomFreeGameDef;
  sessionId: string;
  roomId: string;
  uid: string;
  playerName: string;
  joinCode?: string;
  autoCreate?: boolean;
  autoJoin?: boolean;
}

export function buildRoomFreeGameUrl(params: BuildRoomGameUrlParams): string {
  const q = new URLSearchParams({
    game: params.game.id,
    session: params.sessionId,
    roomId: params.roomId,
    uid: params.uid,
    name: params.playerName,
    gs: gameServerWsBase(),
  });
  if (params.joinCode) q.set('code', params.joinCode);
  if (params.autoCreate) q.set('autoCreate', '1');
  if (params.autoJoin) q.set('autoJoin', '1');
  return `${HOSTING}/${params.game.slug}/?${q.toString()}`;
}

export function buildRoomGameShareText(
  gameName: string,
  url: string,
  joinCode?: string,
): string {
  const codeLine = joinCode ? `\nرمز الانضمام: ${joinCode}` : '';
  return `🎮 دعوة لعبة: ${gameName}${codeLine}\n${url}`;
}
