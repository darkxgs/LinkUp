export type ProfileGender = 'male' | 'female';

/**
 * صور بروفايل افتراضية **كرتونية رسمية** حسب الجنس (DiceBear · نمط avataaars).
 * لا صور لأشخاص حقيقيين — كل صورة مولّدة بشكل حتمي من seed فيُمكن إعادة إنتاجها.
 */
const DICEBEAR_BASE = 'https://api.dicebear.com/9.x/avataaars/png';

/** خيارات تُعطي مظهراً أنثوياً مرتّباً: شعر طويل + بلا لحية + خلفيات فاتحة */
const FEMALE_OPTIONS =
  'top=bob,bun,curly,curvy,longButNotTooLong,straight01,straight02,straightAndStrand,bigHair,miaWallace' +
  '&facialHairProbability=0' +
  '&backgroundColor=ffd5dc,ffdfbf,d1d4f9,c0aede';

/** خيارات تُعطي مظهراً ذكورياً مرتّباً: شعر قصير + احتمال لحية خفيفة + خلفيات هادئة */
const MALE_OPTIONS =
  'top=shortFlat,shortRound,shortWaved,shortCurly,theCaesar,theCaesarAndSidePart,sides' +
  '&facialHairProbability=35' +
  '&backgroundColor=b6e3f4,c0aede,bde3c0,d1d4f9';

/** ثوابت مشتركة لكل الصور: دائرية + حجم مناسب للبروفايل */
const COMMON_OPTIONS = 'radius=50&size=256';

function optionsFor(gender: ProfileGender): string {
  return gender === 'male' ? MALE_OPTIONS : FEMALE_OPTIONS;
}

/** يبني رابط أفتار كرتوني حتمي من seed معيّن */
function avatarUrl(gender: ProfileGender, seed: string): string {
  const seedParam = encodeURIComponent(seed);
  return `${DICEBEAR_BASE}?seed=${seedParam}&${optionsFor(gender)}&${COMMON_OPTIONS}`;
}

/** seed عشوائي قصير لتنويع الصورة بين المستخدمين */
function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** صورة الملف الشخصي الافتراضية (كرتونية) حسب الجنس */
export function getDefaultAvatar(gender: ProfileGender, seed?: string): string {
  return avatarUrl(gender, seed ?? randomSeed());
}

/** صور الألبوم الافتراضية عند التسجيل (مختلفة عن الصورة الرئيسية) */
export function getDefaultProfilePhotos(gender: ProfileGender, count = 3): string[] {
  const photos: string[] = [];
  for (let i = 0; i < count; i++) {
    photos.push(avatarUrl(gender, `${randomSeed()}-${i}`));
  }
  return photos;
}

/** حزمة كاملة: صورة رئيسية كرتونية فقط — الألبوم يبقى فارغاً ليملأه المستخدم بنفسه */
export function getDefaultProfileMedia(gender: ProfileGender): { avatar: string; photos: string[] } {
  return { avatar: avatarUrl(gender, randomSeed()), photos: [] };
}

/** أفاتار الشبح الرسمي حسب الجنس — نفس أيقونات تبويب البروفايل */
export const GHOST_AVATAR_ASSETS: Record<ProfileGender, number> = {
  male: require('../../assets/images/tab_profile_male.png'),
  female: require('../../assets/images/tab_profile_female.png'),
};

/**
 * يرفع صورة الشبح المدمجة إلى التخزين ويعيد رابطها — تُستخدم كصورة افتراضية
 * عند التسجيل. عند أي فشل نعود لأفاتار كرتوني (dicebear) كي لا يتعطّل التسجيل.
 */
export async function getGhostAvatarUrl(gender: ProfileGender): Promise<string> {
  try {
    const { Asset } = await import('expo-asset');
    const { uploadImage } = await import('@/services/firebase/storage');
    const asset = Asset.fromModule(GHOST_AVATAR_ASSETS[gender]);
    await asset.downloadAsync();
    const localUri = asset.localUri ?? asset.uri;
    if (!localUri) throw new Error('ghost asset uri missing');
    // بلا ضغط — PNG شفاف يبقى شفافاً
    return await uploadImage(localUri, 'avatars', undefined, true);
  } catch {
    return getDefaultAvatar(gender);
  }
}
