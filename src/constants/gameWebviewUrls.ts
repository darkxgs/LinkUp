/**
 * روابط ألعاب WebView على Firebase Hosting — للفحص في لوحة التحكم فقط.
 * التطبيق يستخدم نفس الروابط مع جسر Firestore الحقيقي.
 */

export const GAMES_HOSTING_BASE = 'https://linkup-dc45f.web.app/games';

export type WebviewGameCategory = 'intelligence' | 'casino' | 'challenge';

export interface WebviewTestGame {
  id: string;
  name: string;
  category: WebviewGameCategory;
  /** مسار نسبي بعد GAMES_HOSTING_BASE */
  path: string;
  /** معاملات اختيارية للتحديات 1v1 */
  query?: string;
  note?: string;
}

export const WEBVIEW_TEST_GAMES: WebviewTestGame[] = [
  // ذكاء
  { id: 'flag-guess', name: 'خمّن المعلم', category: 'intelligence', path: 'flag-guess/' },
  { id: 'memory-match', name: 'تطابق الأشكال', category: 'intelligence', path: 'memory-match/' },
  { id: 'sequence-memory', name: 'تذكر التسلسل', category: 'intelligence', path: 'sequence-memory/' },
  { id: 'xo', name: 'XO (بدون رهان)', category: 'intelligence', path: 'xo/', note: 'تجريبية — بدون رهان أو Firestore' },
  // كازينو
  { id: 'lucky-777', name: 'لاكي 777 / سلوتس', category: 'casino', path: 'slot/' },
  { id: 'wheel', name: 'عجلة الحظ', category: 'casino', path: 'wheel/' },
  { id: 'dice', name: 'النرد', category: 'casino', path: 'dice/' },
  { id: 'coin-flip', name: 'رمي العملة (كازينو)', category: 'casino', path: 'coin/' },
  { id: 'crash-rocket', name: 'الصاروخ المتفجر', category: 'casino', path: 'casino/crash', note: 'نسخة React المحسّنة' },
  { id: 'plinko', name: 'بلينكو', category: 'casino', path: 'casino/plinko' },
  { id: 'dino', name: 'دينو رن', category: 'casino', path: 'casino/dino' },
  { id: 'spin-win', name: 'Spin & Win', category: 'casino', path: 'casino/spin-win' },
  { id: 'mines', name: 'الألغام', category: 'casino', path: 'casino/mines' },
  { id: 'dragon-tower', name: 'برج التنين', category: 'casino', path: 'dragon-tower/' },
  { id: 'crash-rocket-legacy', name: 'الصاروخ (قديم)', category: 'casino', path: 'crash/', note: 'HTML قديم' },
  // تحدي 1v1 — الدور يُمرَّر عبر INIT_DATA من المحاكي
  {
    id: 'penalty-kicks',
    name: 'ضربات جزاء 1v1',
    category: 'challenge',
    path: 'penalty-challenge/',
    note: 'تلعب كمتحدّي ضد لاعب ثانٍ في بيئة الفحص',
  },
  {
    id: 'pool',
    name: 'بلياردو 1v1',
    category: 'challenge',
    path: 'billiards-challenge/',
    note: 'محاكاة 1v1 — بيئة فحص فقط',
  },
  {
    id: 'coin-challenge',
    name: 'رمي العملة (تحدي 1v1)',
    category: 'challenge',
    path: 'coin-challenge/',
    note: '3 جولات — الجولة الثانية للاعب الثاني',
  },
];

export const WEBVIEW_CATEGORY_LABELS: Record<WebviewGameCategory, string> = {
  intelligence: '🧠 ألعاب الذكاء',
  casino: '🎰 ألعاب الكازينو',
  challenge: '⚔️ ألعاب التحدي',
};

export function buildWebviewGameUrl(game: WebviewTestGame): string {
  const q = game.query ? `?${game.query}` : '';
  return `${GAMES_HOSTING_BASE}/${game.path}${q}`;
}

/** يطابق معرّف إعدادات الأدمن ConfigGame */
export function getWebviewUrlForConfigId(id: string): string {
  const game = WEBVIEW_TEST_GAMES.find((g) => g.id === id);
  if (game) return buildWebviewGameUrl(game);
  if (id === 'challenges') return '';
  return '';
}
