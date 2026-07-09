export type ProfileGender = 'male' | 'female';

/**
 * صور بروفايل افتراضية **كرتونية رسمية** حسب الجنس (DiceBear · نمط avataaars).
 * لا صور لأشخاص حقيقيين — كل صورة مولّدة بشكل حتمي من seed.
 * يجب أن يبقى هذا الملف متطابقاً مع: sada-app 14/src/constants/defaultAvatars.ts
 */
const DICEBEAR_BASE = 'https://api.dicebear.com/9.x/avataaars/png';

const FEMALE_OPTIONS =
  'top=bob,bun,curly,curvy,longButNotTooLong,straight01,straight02,straightAndStrand,bigHair,miaWallace' +
  '&facialHairProbability=0' +
  '&backgroundColor=ffd5dc,ffdfbf,d1d4f9,c0aede';

const MALE_OPTIONS =
  'top=shortFlat,shortRound,shortWaved,shortCurly,theCaesar,theCaesarAndSidePart,sides' +
  '&facialHairProbability=35' +
  '&backgroundColor=b6e3f4,c0aede,bde3c0,d1d4f9';

const COMMON_OPTIONS = 'radius=50&size=256';

function optionsFor(gender: ProfileGender): string {
  return gender === 'male' ? MALE_OPTIONS : FEMALE_OPTIONS;
}

function avatarUrl(gender: ProfileGender, seed: string): string {
  const seedParam = encodeURIComponent(seed);
  return `${DICEBEAR_BASE}?seed=${seedParam}&${optionsFor(gender)}&${COMMON_OPTIONS}`;
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** حزمة كاملة: صورة رئيسية كرتونية فقط — الألبوم يبقى فارغاً ليملأه المستخدم بنفسه */
export function getDefaultProfileMedia(gender: ProfileGender): { avatar: string; photos: string[] } {
  return { avatar: avatarUrl(gender, randomSeed()), photos: [] };
}
