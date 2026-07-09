import type { UserDoc } from '@/services/firebase/users';

export const DISCOVER_AGE_MIN = 18;
export const DISCOVER_AGE_MAX = 38;

export type DiscoverAgeCategoryId = 'all' | '18-22' | '23-27' | '28-32' | '33-37' | '38plus';

export type DiscoverAgeCategory = {
  id: DiscoverAgeCategoryId;
  min: number;
  max: number;
  labelKey: string;
};

export const DISCOVER_AGE_CATEGORIES: DiscoverAgeCategory[] = [
  { id: 'all', min: DISCOVER_AGE_MIN, max: DISCOVER_AGE_MAX, labelKey: 'home.ageCategoryAll' },
  { id: '18-22', min: 18, max: 22, labelKey: 'home.ageCategory1822' },
  { id: '23-27', min: 23, max: 27, labelKey: 'home.ageCategory2327' },
  { id: '28-32', min: 28, max: 32, labelKey: 'home.ageCategory2832' },
  { id: '33-37', min: 33, max: 37, labelKey: 'home.ageCategory3337' },
  { id: '38plus', min: 38, max: DISCOVER_AGE_MAX, labelKey: 'home.ageCategory38plus' },
];

export function getUserAge(user: Pick<UserDoc, 'birthYear'>): number | null {
  const year = user.birthYear;
  if (!year || year < 1900 || year > new Date().getFullYear()) return null;
  const age = new Date().getFullYear() - year;
  return age >= 0 && age <= 120 ? age : null;
}

export function getDefaultAgeCategoryForUser(
  user?: Pick<UserDoc, 'birthYear'>,
): DiscoverAgeCategoryId {
  const age = user ? getUserAge(user) : null;
  if (age == null) return 'all';
  for (const cat of DISCOVER_AGE_CATEGORIES) {
    if (cat.id === 'all') continue;
    if (age >= cat.min && age <= cat.max) return cat.id;
  }
  return 'all';
}

export function userMatchesAgeCategory(
  user: Pick<UserDoc, 'birthYear'>,
  categoryId: DiscoverAgeCategoryId,
): boolean {
  if (categoryId === 'all') return true;
  const cat = DISCOVER_AGE_CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) return true;
  const age = getUserAge(user);
  if (age == null) return false;
  return age >= cat.min && age <= cat.max;
}

export function formatAgeRangeLabel(minAge: number, maxAge: number): string {
  const maxLabel = maxAge >= DISCOVER_AGE_MAX ? `${DISCOVER_AGE_MAX}+` : String(maxAge);
  return `${minAge}-${maxLabel}`;
}
