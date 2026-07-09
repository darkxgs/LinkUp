/**
 * بوت وكالة الشحن — بديل وكالات المنافس
 * محادثة حقيقية مع حساب رسمي + طلب شحن يصل للوحة التحكم
 */
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, increment } from 'firebase/firestore';
import { firestore, auth } from './firebase/index';
import { getOrCreateConversation, sendChatMessage } from './firebase/chat';

export const RECHARGE_BOT_UID = 'linkup_recharge_bot';
export const RECHARGE_BOT_DISPLAY_NAME = 'بوت الشحن';
export const RECHARGE_BOT_PUBLIC_ID = 'LINKUP_BOT';

export type RechargeBotPackage = {
  id: string;
  coins: number;
  bonus?: number;
  priceUSD: number;
};

const BOT_WELCOME =
  'مرحباً بك في **بوت شحن LinkUp**\n\n' +
  'اختر باقة الشحن أو اكتب المبلغ المطلوب، وسيقوم فريقنا بمعالجة طلبك بأسرع وقت.\n\n' +
  '• أرسل معرّف حسابك إن لم يُرسل تلقائياً\n' +
  '• يمكنك إرفاق إيصال الدفع\n' +
  '• للمشاكل: المحفظة ← شحن ← تقديم مشكلة';

/** يُنشأ من الأدمن/السيرفر فقط — لا نوقف الطلب إن فشل من العميل */
async function ensureRechargeBotAccount(): Promise<void> {
  try {
    const ref = doc(firestore, 'users', RECHARGE_BOT_UID);
    const snap = await getDoc(ref);
    if (snap.exists()) return;
    await setDoc(ref, {
      uid: RECHARGE_BOT_UID,
      publicAccountId: RECHARGE_BOT_PUBLIC_ID,
      displayName: RECHARGE_BOT_DISPLAY_NAME,
      profile: {
        displayName: RECHARGE_BOT_DISPLAY_NAME,
        avatar: '',
        bio: 'وكالة شحن LinkUp الرسمية — بوت آلي',
      },
      isOfficial: true,
      isVerified: true,
      isSupport: true,
      isRechargeBot: true,
      stats: {
        coins: 9_999_999,
        pearls: 0,
        followers: 0,
        following: 0,
        rechargeOrdersCompleted: 0,
      },
      createdAt: Date.now(),
    });
  } catch {
    /* حساب البوت يُنشأ من لوحة التحكم — المحادثة تعمل بدونه */
  }
}

async function logRechargeRequest(payload: Record<string, unknown>): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await addDoc(collection(firestore, 'rechargeRequests'), {
      ...payload,
      uid: user.uid,
      status: 'pending',
      createdAt: Date.now(),
    });
  } catch {
    /* اختياري — لا يعطّل إرسال الرسالة */
  }
}

/** يفتح محادثة البوت ويرسل طلب شحن بباقة محددة */
export const sendRechargeBotPackageRequest = async (opts: {
  publicAccountId: string;
  displayName?: string;
  currentCoins?: number;
  countryCode?: string;
  countryName?: string;
  pkg: RechargeBotPackage;
}): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  await ensureRechargeBotAccount();

  const accountId = opts.publicAccountId.trim();
  const totalCoins = opts.pkg.coins + (opts.pkg.bonus ?? 0);
  const userName = opts.displayName?.trim() || 'مستخدم';
  const coins = Math.max(0, Math.floor(Number(opts.currentCoins) || 0));

  const countryLine =
    opts.countryCode || opts.countryName
      ? `الدولة: ${opts.countryName ?? opts.countryCode}\n`
      : '';

  const text =
    `💳 طلب شحن عبر بوت LinkUp\n\n` +
    `معرّف الحساب: ${accountId}\n` +
    `الاسم: ${userName}\n` +
    countryLine +
    `الرصيد الحالي: ${coins.toLocaleString('en-US')} عملة\n\n` +
    `الباقة: ${opts.pkg.coins.toLocaleString('en-US')} عملة` +
    (opts.pkg.bonus ? ` (+${opts.pkg.bonus.toLocaleString('en-US')} بونص)` : '') +
    `\nالمبلغ: $${opts.pkg.priceUSD}\n` +
    `معرّف الباقة: ${opts.pkg.id}\n\n` +
    `بانتظار تأكيد الدفع والشحن من الإدارة.`;

  await logRechargeRequest({
    publicAccountId: accountId,
    displayName: userName,
    currentCoins: coins,
    countryCode: opts.countryCode ?? '',
    countryName: opts.countryName ?? '',
    packageId: opts.pkg.id,
    coins: opts.pkg.coins,
    bonus: opts.pkg.bonus ?? 0,
    priceUSD: opts.pkg.priceUSD,
    totalCoins,
    source: 'recharge_bot',
  });

  const convId = await getOrCreateConversation(
    RECHARGE_BOT_UID,
    RECHARGE_BOT_DISPLAY_NAME,
    '',
  );

  try {
    await updateDoc(doc(firestore, 'conversations', convId), {
      isOfficialChat: true,
      supportTopic: 'recharge',
      rechargeBot: true,
      userPublicAccountId: accountId,
      lastPackageId: opts.pkg.id,
    });
  } catch {
    /* حقول إضافية اختيارية */
  }

  await sendChatMessage(convId, RECHARGE_BOT_UID, text);
  return convId;
};

/** فتح محادثة البوت بدون باقة (تبويب وكالة الشحن) */
export const openRechargeBotChat = async (opts: {
  publicAccountId: string;
  displayName?: string;
}): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  await ensureRechargeBotAccount();

  const convId = await getOrCreateConversation(
    RECHARGE_BOT_UID,
    RECHARGE_BOT_DISPLAY_NAME,
    '',
  );

  const userRef = doc(firestore, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  const welcomed = userSnap.exists() && userSnap.data().rechargeBotWelcomed === true;

  if (!welcomed) {
    try {
      await addDoc(collection(firestore, 'messages'), {
        conversationId: convId,
        fromUid: RECHARGE_BOT_UID,
        toUid: user.uid,
        text: BOT_WELCOME,
        type: 'text',
        createdAt: Date.now(),
        isRead: false,
        isOfficial: true,
      });
      await updateDoc(doc(firestore, 'conversations', convId), {
        lastMessage: BOT_WELCOME.split('\n')[0],
        lastMessageAt: Date.now(),
        [`unreadBy.${user.uid}`]: increment(1),
      });
      await updateDoc(userRef, { rechargeBotWelcomed: true });
    } catch {
      /* ترحيب البوت يحتاج قواعد Firebase محدّثة */
    }
  }

  try {
    await updateDoc(doc(firestore, 'conversations', convId), {
      isOfficialChat: true,
      supportTopic: 'recharge',
      rechargeBot: true,
      userPublicAccountId: opts.publicAccountId.trim(),
    });
  } catch {
    /* optional metadata */
  }

  return convId;
};

/** إرسال مشكلة شحن من شاشة تقديم المشكلة */
export const sendRechargeProblemToBot = async (opts: {
  publicAccountId: string;
  category: string;
  details?: string;
}): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  await ensureRechargeBotAccount();
  const convId = await openRechargeBotChat({
    publicAccountId: opts.publicAccountId,
  });

  const text =
    `⚠️ بلاغ: ${opts.category}\n` +
    `معرّف الحساب: ${opts.publicAccountId}\n` +
    (opts.details?.trim() ? `\nالتفاصيل:\n${opts.details.trim()}` : '');

  await sendChatMessage(convId, RECHARGE_BOT_UID, text);
  return convId;
};
