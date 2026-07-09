import {
  DEFAULT_GAMES,
  getGameConfig,
  type GameConfig,
  type GamesGlobalEconomy,
  type GameSectionId,
} from '@/services/firebase/gamesConfig';

export type { GameSectionId };

export interface GamesSectionsConfig {
  challenges: boolean;
  intelligence: boolean;
  casino: boolean;
  lottery: boolean;
}

export const DEFAULT_GAMES_SECTIONS = {
  challenges: true,
  intelligence: true,
  casino: true,
  lottery: true,
} as const;

export const SECTION_GAME_IDS: Record<GameSectionId, readonly string[]> = {
  challenges: ['challenges', 'penalty-kicks', 'coin-challenge', 'pool'],
  intelligence: ['flag-guess', 'memory-match', 'sequence-memory'],
  casino: [
    'lucky-777',
    'dice',
    'duck-race',
    'rock-paper-scissors',
    'hilo',
    'limbo',
    'roulette',
    'blackjack',
    'chicken-cross',
    'crash-rocket',
    'plinko',
    'dino',
    'spin-win',
    'mines',
    'dragon-tower',
  ],
  lottery: ['lottery'],
};

const GAME_TO_SECTION: Record<string, GameSectionId> = {};
for (const [section, ids] of Object.entries(SECTION_GAME_IDS) as [GameSectionId, readonly string[]][]) {
  for (const id of ids) GAME_TO_SECTION[id] = section;
}
GAME_TO_SECTION['weekly-lottery'] = 'lottery';

export function getGameSection(gameId: string): GameSectionId | null {
  return GAME_TO_SECTION[gameId] ?? null;
}

export function isGameSectionEnabled(
  global: GamesGlobalEconomy,
  section: GameSectionId,
): boolean {
  return global.sections?.[section] !== false;
}

export function isGameEnabled(
  games: GameConfig[],
  global: GamesGlobalEconomy,
  gameId: string,
): boolean {
  const configId = gameId === 'weekly-lottery' ? 'lottery' : gameId;
  const section = getGameSection(configId);
  if (section && !isGameSectionEnabled(global, section)) return false;
  const cfg = games.find((g) => g.id === configId);
  return cfg ? cfg.enabled : true;
}

export function isSectionVisible(
  games: GameConfig[],
  global: GamesGlobalEconomy,
  section: GameSectionId,
): boolean {
  if (!isGameSectionEnabled(global, section)) return false;

  const ids = SECTION_GAME_IDS[section];
  if (section === 'challenges') {
    const hub = getGameConfig(games, 'challenges');
    if (hub.enabled) return true;
    return ids
      .filter((id) => id !== 'challenges')
      .some((id) => getGameConfig(games, id).enabled);
  }

  return ids.some((id) => getGameConfig(games, id).enabled);
}

export function countVisibleSections(
  games: GameConfig[],
  global: GamesGlobalEconomy,
): number {
  return (Object.keys(SECTION_GAME_IDS) as GameSectionId[]).filter((s) =>
    isSectionVisible(games, global, s),
  ).length;
}
