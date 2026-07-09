import {
  Sparkles,
  CircleDot,
  Flame,
  Zap,
  Crown,
  Bomb,
  Dices,
  Swords,
  Club,
  Castle,
} from 'lucide-react-native';
import { getCasinoGameLabel, getCasinoGameDesc } from '@/utils/casinoI18n';

export const CASINO_HOST = 'https://linkup-dc45f.web.app/games/casino';
const HOST = 'https://linkup-dc45f.web.app/games';

/** ألعاب HTML خفيفة (سباق بط، نرد، حجر ورقة مقص، Hilo/Limbo) */
export const LUCK_HTML_GAME_IDS = [
  'duck-race',
  'dice',
  'rock-paper-scissors',
  'hilo',
  'limbo',
  'roulette',
  'blackjack',
  'chicken-cross',
  'dragon-tower',
] as const;

/** الألعاب الست المعتمدة في شاشة الكازينو */
export const CASINO_FEATURED_GAME_IDS = [
  'plinko',
  'crash-rocket',
  'dino',
  'spin-win',
  'mines',
  'lucky-777',
  ...LUCK_HTML_GAME_IDS,
] as const;

export type CasinoFeaturedGameId = (typeof CASINO_FEATURED_GAME_IDS)[number];

export type CasinoGameItem = {
  id: CasinoFeaturedGameId;
  name: string;
  desc: string;
  Icon: typeof Sparkles;
  colors: [string, string];
  route: string;
  image: number;
  isHot?: boolean;
  isNew?: boolean;
  minBet?: number;
  order: number;
};

export const CASINO_GAME_IMAGES: Record<CasinoFeaturedGameId, number> = {
  plinko: require('../../assets/images/game_plinko.png'),
  'crash-rocket': require('../../assets/images/game_crash.png'),
  dino: require('../../assets/images/game_chicken.png'),
  'spin-win': require('../../assets/images/game_spinwin.png'),
  mines: require('../../assets/images/game_mines.png'),
  'lucky-777': require('../../assets/images/game_slot.png'),
  'duck-race': require('../../assets/images/game_duck.png'),
  dice: require('../../assets/images/game_dice.png'),
  'rock-paper-scissors': require('../../assets/images/game_xo.png'),
  hilo: require('../../assets/images/game_coin.png'),
  limbo: require('../../assets/images/game_crash.png'),
  roulette: require('../../assets/images/game_roulette.png'),
  blackjack: require('../../assets/images/game_wheel.png'),
  'chicken-cross': require('../../assets/images/game_chicken.png'),
  'dragon-tower': require('../../assets/images/game_dragontower.png'),
};

export function getCasinoGameImage(gameId: string): number | undefined {
  return CASINO_GAME_IMAGES[gameId as CasinoFeaturedGameId];
}

export function getCasinoGames(): CasinoGameItem[] {
  const games: CasinoGameItem[] = [
    {
      id: 'plinko',
      name: getCasinoGameLabel('plinko'),
      desc: getCasinoGameDesc('plinko'),
      Icon: CircleDot,
      colors: ['#8A0E0E', '#EB3636'],
      route: `/games/webview?url=${CASINO_HOST}/plinko&name=Plinko`,
      image: CASINO_GAME_IMAGES.plinko,
      minBet: 100,
      order: 1,
    },
    {
      id: 'crash-rocket',
      name: getCasinoGameLabel('crash-rocket'),
      desc: getCasinoGameDesc('crash-rocket'),
      Icon: Flame,
      colors: ['#FF8C00', '#E52D27'],
      route: `/games/webview?url=${CASINO_HOST}/crash&name=Crash%20Rocket`,
      image: CASINO_GAME_IMAGES['crash-rocket'],
      minBet: 100,
      order: 2,
    },
    {
      id: 'dino',
      name: getCasinoGameLabel('dino'),
      desc: getCasinoGameDesc('dino'),
      Icon: Zap,
      colors: ['#232526', '#414345'],
      route: `/games/webview?url=${CASINO_HOST}/dino&name=Dino%20Run`,
      image: CASINO_GAME_IMAGES.dino,
      minBet: 100,
      order: 3,
    },
    {
      id: 'spin-win',
      name: getCasinoGameLabel('spin-win'),
      desc: getCasinoGameDesc('spin-win'),
      Icon: Crown,
      colors: ['#F7971E', '#FFD200'],
      route: `/games/webview?url=${CASINO_HOST}/spin-win&name=Spin%20Win`,
      image: CASINO_GAME_IMAGES['spin-win'],
      minBet: 1000,
      order: 4,
    },
    {
      id: 'mines',
      name: getCasinoGameLabel('mines'),
      desc: getCasinoGameDesc('mines'),
      Icon: Bomb,
      colors: ['#0F2027', '#2C5364'],
      route: `/games/webview?url=${CASINO_HOST}/mines&name=Mines`,
      image: CASINO_GAME_IMAGES.mines,
      minBet: 100,
      order: 5,
    },
    {
      id: 'lucky-777',
      name: getCasinoGameLabel('lucky-777'),
      desc: getCasinoGameDesc('lucky-777'),
      Icon: Sparkles,
      colors: ['#FF2E3E', '#FF0000'],
      route: `/games/webview?url=${HOST}/lucky-777/&name=Lucky%20777`,
      image: CASINO_GAME_IMAGES['lucky-777'],
      minBet: 10,
      order: 6,
      isHot: true,
    },
    {
      id: 'duck-race',
      name: getCasinoGameLabel('duck-race'),
      desc: getCasinoGameDesc('duck-race'),
      Icon: Crown,
      colors: ['#E11616', '#EA2626'],
      route: `/games/webview?url=${HOST}/duck-race/&name=Duck%20Race`,
      image: CASINO_GAME_IMAGES['duck-race'],
      minBet: 100,
      order: 7,
      isNew: true,
    },
    {
      id: 'dice',
      name: getCasinoGameLabel('dice'),
      desc: getCasinoGameDesc('dice'),
      Icon: Dices,
      colors: ['#FF3340', '#B00E0E'],
      route: `/games/webview?url=${HOST}/dice/&name=Dice`,
      image: CASINO_GAME_IMAGES.dice,
      minBet: 100,
      order: 8,
      isNew: true,
    },
    {
      id: 'rock-paper-scissors',
      name: getCasinoGameLabel('rock-paper-scissors'),
      desc: getCasinoGameDesc('rock-paper-scissors'),
      Icon: Swords,
      colors: ['#F97316', '#EF4444'],
      route: `/games/webview?url=${HOST}/rock-paper-scissors/&name=Rock%20Paper%20Scissors`,
      image: CASINO_GAME_IMAGES['rock-paper-scissors'],
      minBet: 100,
      order: 9,
      isNew: true,
    },
    {
      id: 'hilo',
      name: getCasinoGameLabel('hilo'),
      desc: getCasinoGameDesc('hilo'),
      Icon: Sparkles,
      colors: ['#1A0A0C', '#E11414'],
      route: `/games/webview?url=${HOST}/hilo/&name=Hilo`,
      image: CASINO_GAME_IMAGES.hilo,
      minBet: 100,
      order: 10,
      isNew: true,
    },
    {
      id: 'limbo',
      name: getCasinoGameLabel('limbo'),
      desc: getCasinoGameDesc('limbo'),
      Icon: Flame,
      colors: ['#111827', '#F97316'],
      route: `/games/webview?url=${HOST}/limbo/&name=Limbo`,
      image: CASINO_GAME_IMAGES.limbo,
      minBet: 100,
      order: 11,
      isNew: true,
    },
    {
      id: 'dragon-tower',
      name: getCasinoGameLabel('dragon-tower'),
      desc: getCasinoGameDesc('dragon-tower'),
      Icon: Castle,
      colors: ['#160B26', '#7C3AED'],
      route: `/games/webview?url=${HOST}/dragon-tower/&name=Dragon%20Tower`,
      image: CASINO_GAME_IMAGES['dragon-tower'],
      minBet: 5000,
      order: 12,
      isNew: true,
    },
    {
      id: 'roulette',
      name: getCasinoGameLabel('roulette'),
      desc: getCasinoGameDesc('roulette'),
      Icon: CircleDot,
      colors: ['#7F0000', '#B8860B'],
      route: `/games/webview?url=${HOST}/roulette/&name=Roulette`,
      image: CASINO_GAME_IMAGES.roulette,
      minBet: 100,
      order: 12,
      isNew: true,
    },
    {
      id: 'blackjack',
      name: getCasinoGameLabel('blackjack'),
      desc: getCasinoGameDesc('blackjack'),
      Icon: Club,
      colors: ['#0B3D2E', '#14532D'],
      route: `/games/webview?url=${HOST}/blackjack/&name=Blackjack`,
      image: CASINO_GAME_IMAGES.blackjack,
      minBet: 100,
      order: 13,
      isNew: true,
    },
    {
      id: 'chicken-cross',
      name: getCasinoGameLabel('chicken-cross'),
      desc: getCasinoGameDesc('chicken-cross'),
      Icon: Zap,
      colors: ['#F59E0B', '#EA580C'],
      route: `/games/webview?url=${HOST}/chicken-cross/&name=Chicken%20Cross`,
      image: CASINO_GAME_IMAGES['chicken-cross'],
      minBet: 100,
      order: 14,
      isNew: true,
    },
  ];
  return [...games].sort((a, b) => a.order - b.order);
}
