/**
 * Support Account Service — حسابات LinkUp الرسمية
 *
 * - linkup_support  — دعم عام / وكالات
 * - linkup_assistant — المساعد (ترحيب + إرشاد)
 * - linkup_feedback  — الفيدباك والاقتراحات
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  increment,
} from 'firebase/firestore';
import { firestore, auth } from './firebase/index';
import { getOrCreateConversation, sendChatMessage } from './firebase/chat';

export const SUPPORT_UID = 'linkup_support';
/** الاسم في لوحة التحكم والرسائل الداخلية */
export const SUPPORT_NAME = 'إدارة LinkUp';
/** الاسم المعروض للمستخدم في قائمة الشات وشاشة الدعم */
export const SUPPORT_CHAT_DISPLAY_NAME = 'مركز الدعم';
export const SUPPORT_AVATAR = '';

export const ASSISTANT_UID = 'linkup_assistant';
export const ASSISTANT_NAME = 'مساعد LinkUp';

export const FEEDBACK_UID = 'linkup_feedback';
export const FEEDBACK_NAME = 'الفيدباك';

export { RECHARGE_BOT_UID, RECHARGE_BOT_DISPLAY_NAME } from './rechargeBot';

/** حسابات رسمية لا تظهر في قائمة المحادثات (محادثة واحدة = مركز الدعم) */
export const OFFICIAL_HIDDEN_IN_CHAT_LIST: readonly OfficialAccountUid[] = [
  ASSISTANT_UID,
  FEEDBACK_UID,
] as const;

export type OfficialAccountUid =
  | typeof SUPPORT_UID
  | typeof ASSISTANT_UID
  | typeof FEEDBACK_UID
  | 'linkup_recharge_bot';

type OfficialAccountConfig = {
  uid: OfficialAccountUid;
  name: string;
  bio: string;
  welcomeMessage: string;
  welcomeFlag: string;
  lastMessagePreview: string;
};

const OFFICIAL_ACCOUNTS: Record<
  Exclude<OfficialAccountUid, 'linkup_recharge_bot'>,
  OfficialAccountConfig
> = {
  [SUPPORT_UID]: {
    uid: SUPPORT_UID,
    name: SUPPORT_NAME,
    bio: 'الحساب الرسمي لدعم تطبيق LinkUp',
    welcomeMessage:
      'أهلاً وسهلاً بك في LinkUp\n\n' +
      'يسعدنا انضمامك لمجتمعنا. هنا يمكنك:\n' +
      '• الدردشة الصوتية في الغرف\n' +
      '• إرسال واستقبال الهدايا\n' +
      '• الترقّي في المستويات والشارات\n' +
      '• التواصل مع أصدقاء جدد\n\n' +
      'إذا احتجت أي مساعدة، نحن هنا دائماً. استمتع بتجربتك.',
    welcomeFlag: 'welcomeSent',
    lastMessagePreview: 'أهلاً وسهلاً بك في LinkUp',
  },
  [ASSISTANT_UID]: {
    uid: ASSISTANT_UID,
    name: ASSISTANT_NAME,
    bio: 'مساعد LinkUp — إرشاد وترحيب',
    welcomeMessage:
      'مرحباً بك في LinkUp\n\n' +
      'LinkUp يهدف لخلق أفضل بيئة اجتماعية للجميع. يمكنك الدخول للغرف والتحدث مع الآخرين، أو إنشاء غرفتك الخاصة.\n\n' +
      'إذا واجهت أي مشكلة أو لديك سؤال، تواصل معنا عبر الفيدباك أو الدعم.',
    welcomeFlag: 'assistantWelcomeSent',
    lastMessagePreview: 'مرحباً بك في LinkUp',
  },
  [FEEDBACK_UID]: {
    uid: FEEDBACK_UID,
    name: FEEDBACK_NAME,
    bio: 'قناة الفيدباك — اقتراحاتك وملاحظاتك',
    welcomeMessage:
      'مرحباً!\n\n' +
      'شاركنا ملاحظاتك أو اقتراحاتك أو أي مشكلة واجهتك. فريقنا يراجع جميع الرسائل ويرد عليك في أقرب وقت.\n\n' +
      'اكتب رسالتك أدناه وسنعود إليك قريباً.',
    welcomeFlag: 'feedbackWelcomeSent',
    lastMessagePreview: 'شاركنا ملاحظاتك',
  },
};

export const AGENCY_SUPPORT_HINT =
  '🏢 **طلب فتح وكالة**\n\n' +
  'لتقديم طلب وكالة رسمي:\n' +
  '1) افتح **مركز الوكالة** ← **تقديم طلب**\n' +
  '2) أدخل اسم الوكالة، الدولة، ورقم **واتساب** صحيح\n' +
  '3) بعد الموافقة (خلال 12 ساعة) تحصل على **كود دعوة** لجمع 10 مضيفات إناث خلال 7 أيام\n\n' +
  'اضغط الزر أدناه لفتح نموذج الطلب مباشرة.';

export function getOfficialAccountConfig(uid: string): OfficialAccountConfig | null {
  if (uid === 'linkup_recharge_bot') {
    return {
      uid: 'linkup_recharge_bot',
      name: 'بوت الشحن',
      bio: 'وكالة شحن LinkUp الرسمية',
      welcomeMessage:
        'مرحباً بك في بوت شحن LinkUp\n\n' +
        'اختر باقة أو اكتب تفاصيل طلبك. سيُعالَج الطلب من الإدارة ويصلك إشعار عند اكتمال الشحن.',
      welcomeFlag: 'rechargeBotWelcomed',
      lastMessagePreview: 'بوت شحن LinkUp',
    };
  }
  return (OFFICIAL_ACCOUNTS as any)[uid] ?? null;
}

/** الاسم المعروض في قائمة الشات — مركز الدعم لحساب linkup_support */
export function resolveOfficialChatDisplayName(uid: string): string | null {
  if (uid === SUPPORT_UID) return SUPPORT_CHAT_DISPLAY_NAME;
  const cfg = getOfficialAccountConfig(uid);
  return cfg?.name ?? null;
}

export function isOfficialHiddenInChatList(uid: string): boolean {
  return (OFFICIAL_HIDDEN_IN_CHAT_LIST as readonly string[]).includes(uid);
}

export function isOfficialSystemAccount(uid: string): uid is OfficialAccountUid {
  return uid === SUPPORT_UID || uid === ASSISTANT_UID || uid === FEEDBACK_UID || uid === 'linkup_recharge_bot';
}

/** @deprecated استخدم isOfficialSystemAccount — يبقى للتوافق */
export const isSupportAccount = (uid: string): boolean => uid === SUPPORT_UID;

const ensureOfficialAccount = async (uid: OfficialAccountUid): Promise<void> => {
  const cfg = getOfficialAccountConfig(uid);
  if (!cfg) return;
  const ref = doc(firestore, 'users', uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid,
        displayName: cfg.name,
        profile: {
          displayName: cfg.name,
          avatar: '',
          bio: cfg.bio,
        },
        isOfficial: true,
        isVerified: true,
        isSupport: true,
        stats: { coins: 0, pearls: 0, followers: 0, following: 0 },
        createdAt: Date.now(),
      });
    }
  } catch {
    // الحساب الرسمي يُنشأ من الأدمن/السيرفر — لا نوقف المحادثة إن فشل
  }
};

/**
 * يفتح محادثة رسمية ويرسل رسالة ترحيب (مرة واحدة لكل حساب)
 */
export const sendOfficialWelcomeIfNeeded = async (
  officialUid: OfficialAccountUid,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) return;

  const cfg = getOfficialAccountConfig(officialUid);
  if (!cfg) return;

  try {
    const userRef = doc(firestore, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists() && userSnap.data()[cfg.welcomeFlag] === true) {
      return;
    }

    await ensureOfficialAccount(officialUid);

    const sortedUids = [user.uid, officialUid].sort();
    const convId = `${sortedUids[0]}_${sortedUids[1]}`;

    const userName = userSnap.exists()
      ? (userSnap.data().profile?.displayName ?? userSnap.data().displayName ?? 'مستخدم')
      : 'مستخدم';
    const userAvatar = userSnap.exists()
      ? (userSnap.data().profile?.avatar ?? userSnap.data().avatar ?? '')
      : '';

    await setDoc(
      doc(firestore, 'conversations', convId),
      {
        participants: sortedUids,
        participantNames: {
          [user.uid]: userName,
          [officialUid]: resolveOfficialChatDisplayName(officialUid) ?? cfg.name,
        },
        participantAvatars: {
          [user.uid]: userAvatar,
          [officialUid]: '',
        },
        lastMessage: cfg.lastMessagePreview,
        lastMessageAt: Date.now(),
        unreadBy: { [user.uid]: 1, [officialUid]: 0 },
        isOfficialChat: true,
      },
      { merge: true },
    );

    await addDoc(collection(firestore, 'messages'), {
      conversationId: convId,
      fromUid: officialUid,
      toUid: user.uid,
      text: cfg.welcomeMessage,
      type: 'text',
      createdAt: Date.now(),
      isRead: false,
      isOfficial: true,
    });

    await updateDoc(userRef, { [cfg.welcomeFlag]: true });
  } catch (e) {
    console.warn(`sendOfficialWelcomeIfNeeded(${officialUid}) failed`, e);
  }
};

/** ترحيب حساب الدعم الرئيسي — للتوافق */
export const sendWelcomeMessageIfNeeded = async (): Promise<void> => {
  await sendOfficialWelcomeIfNeeded(SUPPORT_UID);
};

const APPLICATION_SENT_MESSAGE =
  'تم استقبال طلبك لفتح وكالة بنجاح!\n\n' +
  'سيقوم فريقنا بمراجعة طلبك خلال 12 ساعة.\n' +
  'ستصلك إشعارات بأي تحديث على طلبك.\n\n' +
  'يمكنك متابعة حالة طلبك من مركز الوكالة.';

export type SupportTopic = 'recharge' | 'general';

/**
 * يرسل طلب شحن رسمي إلى حساب الدعم (linkup_support) — يظهر في لوحة التحكم
 */
export const sendRechargeSupportRequest = async (opts: {
  publicAccountId: string;
  displayName?: string;
  currentCoins?: number;
}): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const accountId = opts.publicAccountId.trim();
  if (!accountId) throw new Error('معرّف الحساب غير متوفر');

  const userRef = doc(firestore, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  const userName = opts.displayName?.trim()
    || (userSnap.exists()
      ? (userSnap.data().profile?.displayName ?? userSnap.data().displayName ?? 'مستخدم')
      : 'مستخدم');
  const coins = Math.max(0, Math.floor(Number(opts.currentCoins) || 0));

  const requestText =
    `💰 طلب شحن عملات\n\n` +
    `معرّف الحساب: ${accountId}\n` +
    `الاسم: ${userName}\n` +
    `الرصيد الحالي: ${coins.toLocaleString()} عملة\n\n` +
    `يرجى مراجعة الطلب والشحن من لوحة التحكم ← المحفظة.`;

  const convId = await getOrCreateConversation(SUPPORT_UID, SUPPORT_CHAT_DISPLAY_NAME, '');

  await updateDoc(doc(firestore, 'conversations', convId), {
    isOfficialChat: true,
    supportTopic: 'recharge',
    userPublicAccountId: accountId,
  });

  await sendChatMessage(convId, SUPPORT_UID, requestText);

  return convId;
};

/** طلب انضمام لوكالة (مضيف) — يُرسل لمحادثة الدعم */
export async function sendAgencyJoinRequestToSupport(params: {
  publicAccountId: string;
  displayName: string;
  agencyId?: string;
  agencyName?: string;
  inviteCode?: string;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const lines = [
    '🏢 طلب انضمام لوكالة',
    '',
    `معرّف الحساب: ${params.publicAccountId}`,
    `الاسم: ${params.displayName}`,
  ];
  if (params.agencyName) lines.push(`الوكالة: ${params.agencyName}`);
  if (params.agencyId) lines.push(`معرّف الوكالة: ${params.agencyId}`);
  if (params.inviteCode) lines.push(`كود الدعوة: ${params.inviteCode}`);
  lines.push('', 'يرجى مراجعة طلب الانضمام والرد في هذه المحادثة.');

  const convId = await getOrCreateConversation(SUPPORT_UID, SUPPORT_CHAT_DISPLAY_NAME, '');

  await updateDoc(doc(firestore, 'conversations', convId), {
    supportTopic: 'agency_join',
    userPublicAccountId: params.publicAccountId,
  });

  await sendChatMessage(convId, SUPPORT_UID, lines.join('\n'));
  return convId;
}

export const sendAgencyApplicationConfirmation = async (uid: string): Promise<void> => {
  try {
    await ensureOfficialAccount(SUPPORT_UID);

    const sortedUids = [uid, SUPPORT_UID].sort();
    const convId = `${sortedUids[0]}_${sortedUids[1]}`;

    await addDoc(collection(firestore, 'messages'), {
      conversationId: convId,
      fromUid: SUPPORT_UID,
      toUid: uid,
      text: APPLICATION_SENT_MESSAGE,
      type: 'text',
      createdAt: Date.now(),
      isRead: false,
      isOfficial: true,
    });

    await updateDoc(doc(firestore, 'conversations', convId), {
      lastMessage: APPLICATION_SENT_MESSAGE.split('\n')[0],
      lastMessageAt: Date.now(),
      [`unreadBy.${uid}`]: increment(1),
    });
  } catch {
    // فشل صامت
  }
};
