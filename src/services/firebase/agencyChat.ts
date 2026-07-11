/**
 * LinkUp App — Agency Group Chat (دردشة الوكالة الخاصة)
 *
 * دردشة جماعية خاصة بأعضاء كل وكالة — رسائل + صور + تسجيلات صوتية (بدون مكالمات).
 * - الفتح/الإنشاء وإدارة الأعضاء عبر Cloud Functions (المدير فقط يضيف/يحذف).
 * - الرسائل تُكتب مباشرة في agencyChatMessages (كباقي الشات).
 */

import {
  collection, query, where, limit, onSnapshot, doc, addDoc, updateDoc, getDoc, getDocs,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestore, auth, functions } from './index';

export interface AgencyChatMeta {
  id: string;
  agencyId: string;
  name: string;
  avatar: string;
  ownerUid: string;
  members: string[];
  memberNames: Record<string, string>;
  memberAvatars: Record<string, string>;
  lastMessage: string;
  lastMessageAt: number;
}

export interface AgencyChatMessage {
  id: string;
  chatId: string;
  fromUid: string;
  fromName: string;
  fromAvatar: string;
  text: string;
  type: 'text' | 'image' | 'voice';
  imageUrl?: string;
  voiceUrl?: string;
  voiceDuration?: number;
  createdAt: number;
}

// ==================== فتح/إدارة (Cloud Functions) ====================

export const openAgencyChat = async (
  agencyId: string,
): Promise<{ chat: AgencyChatMeta; isManager: boolean }> => {
  const fn = httpsCallable<{ agencyId: string }, { chat: AgencyChatMeta; isManager: boolean }>(
    functions, 'openAgencyChat',
  );
  const res = await fn({ agencyId });
  return res.data;
};

export const addAgencyChatMemberById = async (
  agencyId: string,
  memberId: string,
): Promise<{ ok: boolean; uid: string; name: string; avatar: string }> => {
  const fn = httpsCallable<{ agencyId: string; memberId: string }, any>(functions, 'addAgencyChatMember');
  const res = await fn({ agencyId, memberId });
  return res.data;
};

export const removeAgencyChatMember = async (
  agencyId: string,
  targetUid: string,
): Promise<void> => {
  const fn = httpsCallable<{ agencyId: string; targetUid: string }, any>(functions, 'removeAgencyChatMember');
  await fn({ agencyId, targetUid });
};

/** تغيير اسم عشيرة الوكالة — يظهر للجميع في قائمة الدردشة */
export const updateAgencyChatName = async (
  agencyId: string,
  name: string,
): Promise<{ ok: boolean; name: string }> => {
  const fn = httpsCallable<{ agencyId: string; name: string }, { ok: boolean; name: string }>(
    functions,
    'updateAgencyChatName',
  );
  try {
    const res = await fn({ agencyId, name });
    return res.data;
  } catch (e: unknown) {
    // إذا كانت دردشة الوكالة غير موجودة بعد، أنشئها ثم أعد المحاولة.
    const msg = e instanceof Error ? e.message : String(e ?? '');
    const code = (e as { code?: string } | null)?.code ?? '';
    const isNotFound =
      code === 'functions/not-found' ||
      code === 'not-found' ||
      msg.includes('not-found');
    if (!isNotFound) throw e;

    await openAgencyChat(agencyId);
    const retry = await fn({ agencyId, name });
    return retry.data;
  }
};

/** يصحّح agencyId القديم في ملف المستخدم دون حذف دردشة الوكالة */
export const syncMyAgencyChats = async (): Promise<void> => {
  const fn = httpsCallable<Record<string, never>, { ok: boolean }>(functions, 'syncMyAgencyChats');
  await fn({});
};

export const deleteAgencyChatCompletely = async (agencyId: string): Promise<{ deleted: boolean }> => {
  const fn = httpsCallable<{ agencyId: string }, { ok: boolean; deleted: boolean }>(
    functions,
    'deleteAgencyChatCompletely',
  );
  const res = await fn({ agencyId });
  return { deleted: res.data.deleted };
};

/**
 * يضمن وجود دردشة الوكالة وإضافة المستخدم الحالي إليها إن كان عضواً/مالكاً.
 * يُستدعى من تاب الشات حتى تظهر الدردشة لكل أعضاء الوكالة (حتى من انضم لاحقاً).
 */
export const ensureMyAgencyChat = async (): Promise<void> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const agencyIds = new Set<string>();

  try {
    const userSnap = await getDoc(doc(firestore, 'users', uid));
    const agencyId = userSnap.data()?.agencyId;
    if (agencyId) agencyIds.add(String(agencyId));
  } catch {
    /* ignore */
  }

  try {
    const owned = await getDocs(
      query(collection(firestore, 'agencies'), where('ownerUid', '==', uid), limit(1)),
    );
    owned.docs.forEach((d) => agencyIds.add(d.id));
  } catch {
    /* ignore */
  }

  try {
    const member = await getDocs(
      query(collection(firestore, 'agencyMembers'), where('uid', '==', uid), limit(3)),
    );
    member.docs.forEach((d) => {
      const aid = d.data()?.agencyId;
      if (aid) agencyIds.add(String(aid));
    });
  } catch {
    /* ignore */
  }

  for (const agencyId of agencyIds) {
    try {
      await openAgencyChat(agencyId);
    } catch {
      /* تجاهل (مثلاً ليس عضواً) */
    }
  }

  try {
    await syncMyAgencyChats();
  } catch {
    /* non-blocking — يصحّح agencyId القديم فقط */
  }
};

// ==================== الاشتراك ====================

export const subscribeToAgencyChat = (
  agencyId: string,
  cb: (chat: AgencyChatMeta | null) => void,
): (() => void) =>
  onSnapshot(doc(firestore, 'agencyChats', agencyId), (snap) => {
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as AgencyChatMeta) : null);
  });

/** دردشات الوكالات التي ينتمي إليها المستخدم الحالي (للظهور في تبويب الدردشة) */
export const subscribeToMyAgencyChats = (
  cb: (chats: AgencyChatMeta[]) => void,
): (() => void) => {
  const uid = auth.currentUser?.uid;
  if (!uid) { cb([]); return () => {}; }
  const q = query(
    collection(firestore, 'agencyChats'),
    where('members', 'array-contains', uid),
    limit(20),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AgencyChatMeta);
      list.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
      cb(list);
    },
    () => cb([]),
  );
};

export const subscribeToAgencyChatMessages = (
  agencyId: string,
  cb: (msgs: AgencyChatMessage[]) => void,
): (() => void) => {
  const q = query(
    collection(firestore, 'agencyChatMessages'),
    where('chatId', '==', agencyId),
    limit(200),
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AgencyChatMessage);
    msgs.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    cb(msgs);
  });
};

// ==================== الإرسال ====================

async function myIdentity() {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  let name = user.displayName ?? 'عضو';
  let avatar = user.photoURL ?? '';
  try {
    const snap = await getDoc(doc(firestore, 'users', user.uid));
    if (snap.exists()) {
      const d = snap.data() as any;
      name = d.displayName ?? d.profile?.displayName ?? name;
      avatar = d.avatar ?? d.profile?.avatar ?? avatar;
    }
  } catch {}
  return { uid: user.uid, name, avatar };
}

async function pushMessage(
  agencyId: string,
  payload: Partial<AgencyChatMessage>,
  lastMessageLabel: string,
) {
  const me = await myIdentity();
  await addDoc(collection(firestore, 'agencyChatMessages'), {
    chatId: agencyId,
    fromUid: me.uid,
    fromName: me.name,
    fromAvatar: me.avatar,
    text: payload.text ?? '',
    type: payload.type ?? 'text',
    ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
    ...(payload.voiceUrl ? { voiceUrl: payload.voiceUrl } : {}),
    ...(payload.voiceDuration != null ? { voiceDuration: payload.voiceDuration } : {}),
    createdAt: Date.now(),
  });
  await updateDoc(doc(firestore, 'agencyChats', agencyId), {
    lastMessage: lastMessageLabel,
    lastMessageAt: Date.now(),
  }).catch(() => {});
}

export const sendAgencyText = async (agencyId: string, text: string): Promise<void> => {
  const t = text.trim();
  if (!t) return;
  // رقابة برمجية — الألفاظ المسيئة + الدعاية لتطبيقات منافسة (كانت دردشة الوكالة بلا فلترة)
  const { assertCleanText } = await import('@/utils/textModeration');
  assertCleanText(t);
  const { assertNoBannedTerms } = await import('@/utils/moderation');
  assertNoBannedTerms(t);
  await pushMessage(agencyId, { type: 'text', text: t }, t.slice(0, 60));
};

async function uploadToStorage(agencyId: string, localUri: string, folder: string, fallbackExt: string, mime: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  const { storage } = await import('./index');
  const { ref: storageRef, uploadBytes, getDownloadURL } = await import('firebase/storage');
  const response = await fetch(localUri);
  const blob = await response.blob();
  if (blob.size > 10 * 1024 * 1024) throw new Error('الملف كبير جداً (الحد 10MB)');
  const ext = localUri.split('.').pop()?.toLowerCase() ?? fallbackExt;
  const path = `${folder}/${agencyId}/${user.uid}_${Date.now()}.${ext}`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, blob, { contentType: blob.type || mime });
  return getDownloadURL(fileRef);
}

export const sendAgencyImage = async (agencyId: string, localUri: string): Promise<void> => {
  // ضغط الصورة قبل الرفع (تصغير بالعرض + JPEG) لتسريع الإرسال. أي فشل يُعيد الأصل.
  const { compressImageForUpload, COMPRESS_PRESETS } = await import('@/utils/imageCompress');
  const uploadUri = await compressImageForUpload(localUri, COMPRESS_PRESETS.chat);
  const imageUrl = await uploadToStorage(agencyId, uploadUri, 'agency_chat_images', 'jpg', 'image/jpeg');
  await pushMessage(agencyId, { type: 'image', imageUrl }, '📷 صورة');
};

export const sendAgencyVoice = async (agencyId: string, localUri: string, durationSeconds: number): Promise<void> => {
  const voiceUrl = await uploadToStorage(agencyId, localUri, 'agency_chat_voices', 'm4a', 'audio/m4a');
  await pushMessage(agencyId, { type: 'voice', voiceUrl, voiceDuration: Math.round(durationSeconds) }, '🎤 رسالة صوتية');
};
