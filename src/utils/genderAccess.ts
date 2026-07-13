/**
 * قواعد الجنس والتحقق — ذكر يرى إناث، أنثى ترى ذكور، مركز التحقق للإناث فقط،
 * أنثى غير موثّقة: رسائل مجانية بدون مكالمات، موثّقة: رسائل + مكالمات + مهام.
 */
import {
  canEarnHostTasksParticipant,
  type AgencyParticipant,
} from '@/services/firebase/hostTasks';

export type UserGender = 'male' | 'female';

export type GenderAccessUser = AgencyParticipant & {
  profile?: { gender?: string };
  gender?: string;
  isVerified?: boolean;
  // verificationStatus يأتي من AgencyParticipant (string | null | undefined)
};

export function readUserGender(
  data: GenderAccessUser | Record<string, unknown> | null | undefined,
): UserGender | undefined {
  if (!data) return undefined;
  const profile = (data as GenderAccessUser).profile;
  const g =
    profile?.gender
    ?? (data as GenderAccessUser).gender
    ?? (data as Record<string, unknown>).gender;
  return g === 'male' || g === 'female' ? g : undefined;
}

export function getOppositeGender(
  gender: UserGender | undefined,
): UserGender | undefined {
  if (gender === 'male') return 'female';
  if (gender === 'female') return 'male';
  return undefined;
}

/** مركز التحقق — للإناث فقط */
export function shouldShowVerificationCenter(
  user: GenderAccessUser | null | undefined,
): boolean {
  return readUserGender(user) === 'female';
}

/** رسائل نصية مجانية للإناث (موثّقة وغير موثّقة) */
export function canFemaleSendFreeText(
  user: GenderAccessUser | null | undefined,
): boolean {
  return readUserGender(user) === 'female';
}

/** مكالمات صوت/فيديو — الذكور دائماً، الإناث بعد التحقق فقط */
export function canUserMakeCalls(
  user: GenderAccessUser | null | undefined,
): boolean {
  const gender = readUserGender(user);
  if (gender === 'female') {
    // موثّقة = علم isVerified أو حالة التحقق «approved» — بعض المستخدمين
    // القدامى لديهم verificationStatus:'approved' دون رفع علم isVerified،
    // والسيرفر (isUserFullyVerified) يقبل الحالتين، فنطابقه هنا
    return user?.isVerified === true || user?.verificationStatus === 'approved';
  }
  return true;
}

/** أدنى مستوى علاقة للمكالمات من الشات — للذكور فقط */
export const CHAT_CALL_MIN_BOND_VOICE = 5;
export const CHAT_CALL_MIN_BOND_VIDEO = 10;

export function getRequiredBondLevelForChatCall(type: 'voice' | 'video'): number {
  return type === 'video' ? CHAT_CALL_MIN_BOND_VIDEO : CHAT_CALL_MIN_BOND_VOICE;
}

/**
 * شات خاص: الإناث بدون تقييد مستوى العلاقة؛ الذكور يحتاجون LV5 للصوت وLV10 للفيديو.
 */
export function canMakeRelationshipLevelCall(
  user: GenderAccessUser | null | undefined,
  callType: 'voice' | 'video',
  bondLevel: number,
): boolean {
  if (readUserGender(user) === 'female') return true;
  return bondLevel >= getRequiredBondLevelForChatCall(callType);
}

/** تجميع مهام المضيفة — أنثى موثّقة (بدون اشتراط الانضمام لوكالة) */
export function canEarnHostTasks(
  user: GenderAccessUser | null | undefined,
): boolean {
  return canEarnHostTasksParticipant(user);
}

/** فلترة الاستكشاف — كل جنس يرى الجنس المعاكس */
export function filterUsersByOppositeGender<T extends { gender?: string }>(
  users: T[],
  myGender: UserGender | undefined,
): T[] {
  const opposite = getOppositeGender(myGender);
  if (!opposite) return users;
  return users.filter((u) => u.gender === opposite);
}
