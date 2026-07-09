/**
 * LinkUp — Posts / Moments (اللحظات) Service
 */

import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  doc,
  updateDoc,
  increment,
  where,
  setDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import { firestore, auth, functions } from './index';
import { getFollowing } from './follow';
import { uploadPostImage } from './storage';
import { resolveDisplayName } from '@/utils/displayName';
import { resolveUserDocAvatar } from '@/utils/userAvatar';
import { ensureCallableAuth, translateCallableError, subscribeWhenAuthenticated, waitForFirestoreAuth } from './authReady';
import { callCallableWithAuth } from './callableHttp';
import type { Gift } from './shop';

export type PostStatus = 'active' | 'hidden' | 'removed';
export type FeedTab = 'explore' | 'following' | 'trending';

export interface Post {
  id: string;
  uid: string;
  authorName: string;
  authorAvatar: string;
  authorCountry: string;
  authorLevel: number;
  authorIsVIP?: boolean;
  authorGender?: 'male' | 'female';
  authorAge?: number;
  text: string;
  images?: string[];
  hashtags?: string[];
  likes: number;
  comments: number;
  shares: number;
  gifts: number;
  createdAt: number;
  status?: PostStatus;
}

export interface PostComment {
  id: string;
  postId: string;
  uid: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  createdAt: number;
  /** تعليق هدية / نص / صورة */
  type?: 'text' | 'gift' | 'image';
  imageUrl?: string;
  likes?: number;
  giftId?: string;
  giftName?: string;
  giftIconName?: string;
  giftIconColor?: string;
  giftImageUrl?: string;
  giftAnimationUrl?: string;
  giftQuantity?: number;
  giftPrice?: number;
  /** رد على تعليق */
  parentCommentId?: string;
  replyToUid?: string;
  replyToName?: string;
}

export type HotTopicIcon = 'crown' | 'moon' | 'gem';

export const HOT_TOPICS: ReadonlyArray<{
  id: string;
  title: string;
  members: string;
  icon: HotTopicIcon;
  /** صورة مصغّرة اختيارية (require محلي أو رابط) — تظهر بدل الأيقونة المتدرّجة كما في التصميم */
  image?: number | string;
}> = [
  { id: 'pk', title: 'تحدي PK الملكي', members: '30 ألف منضم', icon: 'crown', image: require('../../../assets/design/topics/crown.png') },
  { id: 'nights', title: 'ليالي ساحرة', members: '18 ألف منضم', icon: 'moon' },
  { id: 'wedding', title: 'حفل الزفاف', members: '12 ألف منضم', icon: 'gem' },
];

const FEED_LIMIT = 40;
const giftSendLocks = new Map<string, number>();

function mapCommentDoc(
  id: string,
  postId: string,
  data: Record<string, unknown>,
): PostComment {
  const authorName = resolveDisplayName(
    {
      displayName: String(
        data.authorName ?? data.name ?? data.fromName ?? data.displayName ?? '',
      ),
      email: typeof data.email === 'string' ? data.email : undefined,
    },
    'مستخدم',
  );

  return {
    id,
    postId,
    uid: String(data.uid ?? ''),
    authorName,
    authorAvatar: String(data.authorAvatar ?? data.avatar ?? data.fromAvatar ?? ''),
    text: String(data.text ?? ''),
    createdAt: Number(data.createdAt ?? 0),
    type: (data.type as PostComment['type']) ?? 'text',
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : undefined,
    likes: Number(data.likes ?? 0),
    giftId: typeof data.giftId === 'string' ? data.giftId : undefined,
    giftName: typeof data.giftName === 'string' ? data.giftName : undefined,
    giftIconName: typeof data.giftIconName === 'string' ? data.giftIconName : undefined,
    giftIconColor: typeof data.giftIconColor === 'string' ? data.giftIconColor : undefined,
    giftImageUrl: typeof data.giftImageUrl === 'string' ? data.giftImageUrl : undefined,
    giftAnimationUrl: typeof data.giftAnimationUrl === 'string' ? data.giftAnimationUrl : undefined,
    giftQuantity: data.giftQuantity != null ? Number(data.giftQuantity) : undefined,
    giftPrice: data.giftPrice != null ? Number(data.giftPrice) : undefined,
    parentCommentId:
      typeof data.parentCommentId === 'string' ? data.parentCommentId : undefined,
    replyToUid: typeof data.replyToUid === 'string' ? data.replyToUid : undefined,
    replyToName: typeof data.replyToName === 'string' ? data.replyToName : undefined,
  };
}

const commentAuthorCache = new Map<string, { authorName: string; authorAvatar: string }>();

async function enrichCommentAuthors(comments: PostComment[]): Promise<PostComment[]> {
  const uids = [
    ...new Set(
      comments
        .filter((c) => c.uid && (!c.authorName.trim() || c.authorName === 'مستخدم'))
        .map((c) => c.uid),
    ),
  ].filter((uid) => !commentAuthorCache.has(uid));

  await Promise.all(
    uids.map(async (uid) => {
      try {
        const snap = await getDoc(doc(firestore, 'users', uid));
        if (!snap.exists()) return;
        const d = snap.data() as Record<string, unknown>;
        commentAuthorCache.set(uid, {
          authorName: resolveDisplayName(
            {
              displayName: String(d.displayName ?? ''),
              email: typeof d.email === 'string' ? d.email : undefined,
            },
            'مستخدم',
          ),
          authorAvatar: resolveUserDocAvatar(d, uid) || '',
        });
      } catch {}
    }),
  );

  return comments.map((c) => {
    const cached = commentAuthorCache.get(c.uid);
    if (!cached) return c;
    return {
      ...c,
      authorName:
        c.authorName.trim() && c.authorName !== 'مستخدم' ? c.authorName : cached.authorName,
      authorAvatar: c.authorAvatar.trim() ? c.authorAvatar : cached.authorAvatar,
    };
  });
}

function mapPostDoc(id: string, data: Record<string, unknown>): Post {
  return {
    id,
    uid: String(data.uid ?? ''),
    authorName: String(data.authorName ?? 'مستخدم'),
    authorAvatar: String(data.authorAvatar ?? ''),
    authorCountry: String(data.authorCountry ?? 'PS'),
    authorLevel: Number(data.authorLevel ?? 1),
    authorIsVIP: Boolean(data.authorIsVIP),
    authorGender: data.authorGender === 'male' ? 'male' : data.authorGender === 'female' ? 'female' : undefined,
    authorAge: Number(data.authorAge ?? 0),
    text: String(data.text ?? ''),
    images: Array.isArray(data.images) ? (data.images as string[]) : [],
    hashtags: Array.isArray(data.hashtags) ? (data.hashtags as string[]) : [],
    likes: Number(data.likes ?? 0),
    comments: Number(data.comments ?? 0),
    shares: Number(data.shares ?? 0),
    gifts: Number(data.gifts ?? 0),
    createdAt: Number(data.createdAt ?? 0),
    status: (data.status as PostStatus) ?? 'active',
  };
}

/**
 * إثراء المنشورات القديمة التي لا تحمل الجنس/العمر (أُنشئت قبل denormalization)
 * بجلبها من ملف صاحب المنشور — طلب واحد فقط لكل مستخدم، وللمنشورات الناقصة فقط.
 */
// كاش دائم لميتاداتا المؤلف (جنس/عمر) — يُملأ مرة واحدة لكل مستخدم ويُعاد استخدامه
// عبر كل تحديثات الـ feed الحيّة. بدونه كان كل snapshot يُعيد جلب نفس الملفات من Firestore.
const authorMetaCache = new Map<string, { gender?: 'male' | 'female'; age: number }>();

async function enrichAuthorMeta(posts: Post[]): Promise<Post[]> {
  const need = posts.filter((p) => !p.authorGender && p.uid);
  if (need.length === 0) return posts;
  // اجلب فقط المستخدمين غير الموجودين في الكاش
  const uids = [...new Set(need.map((p) => p.uid))].filter((uid) => !authorMetaCache.has(uid));
  await Promise.all(
    uids.map(async (uid) => {
      try {
        const snap = await getDoc(doc(firestore, 'users', uid));
        if (!snap.exists()) return;
        const d = snap.data();
        authorMetaCache.set(uid, {
          gender: d.gender === 'male' ? 'male' : d.gender === 'female' ? 'female' : undefined,
          age: Number(d.age ?? 0),
        });
      } catch {}
    }),
  );
  return posts.map((p) => {
    if (p.authorGender) return p;
    const m = authorMetaCache.get(p.uid);
    if (!m) return p;
    return { ...p, authorGender: m.gender, authorAge: p.authorAge || m.age };
  });
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u0600-\u06FF_]+/g);
  if (!matches) return [];
  return [...new Set(matches.map((t) => t.slice(1)))];
}

function isFirestoreIndexError(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  const msg = err?.message ?? '';
  return (
    err?.code === 'failed-precondition' ||
    msg.includes('index') ||
    msg.includes('building')
  );
}

/** استعلام كامل — يحتاج فهرس status + createdAt (يُنشأ تلقائياً عند deploy) */
async function queryActivePostsSorted(max: number): Promise<Post[]> {
  const q = query(
    collection(firestore, 'posts'),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc'),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapPostDoc(d.id, d.data() as Record<string, unknown>));
}

/**
 * تحميل المنشورات النشطة.
 * إذا كان الفهرس المركّب ما زال يُبنى بعد deploy، نستخدم استعلاماً بسيطاً ثم ترتيباً محلياً.
 */
async function loadActivePosts(max = FEED_LIMIT): Promise<Post[]> {
  try {
    return await queryActivePostsSorted(max);
  } catch (e) {
    if (!isFirestoreIndexError(e)) throw e;
    console.warn('posts: الفهرس قيد البناء — استعلام احتياطي');
    const q = query(
      collection(firestore, 'posts'),
      where('status', '==', 'active'),
      limit(max * 3),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => mapPostDoc(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, max);
  }
}

/** منشورات حسب التبويب */
export const getFeedPosts = async (tab: FeedTab = 'explore'): Promise<Post[]> => {
  try {
    const all = await enrichAuthorMeta(await loadActivePosts());

    if (tab === 'trending') {
      return [...all].sort((a, b) => b.likes - a.likes || b.createdAt - a.createdAt);
    }

    if (tab === 'following') {
      const me = auth.currentUser?.uid;
      if (!me) return [];
      const following = new Set(await getFollowing(me));
      return all.filter((p) => following.has(p.uid));
    }

    return all;
  } catch (e) {
    console.error('getFeedPosts:', e);
    return [];
  }
};

/**
 * اشتراك حيّ بمنشورات التغذية — تظهر المنشورات الجديدة فوراً
 * يبدأ الاستماع بعد اكتمال جلسة Auth لتجنّب permission-denied لبعض المستخدمين.
 */
export function subscribeToFeedPosts(
  tab: FeedTab,
  followingUids: Set<string> | null,
  callback: (posts: Post[]) => void,
): () => void {
  let unsubSnapshot: (() => void) | undefined;

  const emit = async (raw: Post[]) => {
    let list = await enrichAuthorMeta(raw);
    if (tab === 'following') {
      if (!followingUids || followingUids.size === 0) {
        callback([]);
        return;
      }
      list = list.filter((p) => followingUids.has(p.uid));
    } else if (tab === 'trending') {
      list = [...list].sort((a, b) => b.likes - a.likes || b.createdAt - a.createdAt);
    }
    callback(list);
  };

  const attach = () => {
    unsubSnapshot?.();
    const q = query(
      collection(firestore, 'posts'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(FEED_LIMIT),
    );
    unsubSnapshot = onSnapshot(
      q,
      (snap) => {
        const raw = snap.docs.map((d) => mapPostDoc(d.id, d.data() as Record<string, unknown>));
        void emit(raw);
      },
      (err) => {
        console.error('subscribeToFeedPosts:', err);
        // لو فشل البديل أيضاً نُبلغ بقائمة فارغة كي لا يبقى مؤشر التحميل للأبد
        void loadActivePosts()
          .then((fallback) => emit(fallback))
          .catch(() => emit([]));
      },
    );
  };

  const unsubAuth = subscribeWhenAuthenticated(
    () => attach(),
    () => {
      unsubSnapshot?.();
      unsubSnapshot = undefined;
      callback([]);
    },
  );

  return () => {
    unsubAuth();
    unsubSnapshot?.();
  };
}

/** اشتراك حيّ بمنشور واحد — عدّادات الإعجابات/التعليقات تتحدّث فوراً */
export function subscribeToPost(
  postId: string,
  callback: (post: Post | null) => void,
): () => void {
  let unsubDoc: (() => void) | undefined;

  const attach = () => {
    unsubDoc?.();
    unsubDoc = onSnapshot(
      doc(firestore, 'posts', postId),
      (snap) => {
        if (!snap.exists()) {
          callback(null);
          return;
        }
        const post = mapPostDoc(snap.id, snap.data() as Record<string, unknown>);
        const me = auth.currentUser?.uid;
        if ((post.status === 'hidden' || post.status === 'removed') && post.uid !== me) {
          callback(null);
          return;
        }
        void enrichAuthorMeta([post]).then((arr) => callback(arr[0] ?? post));
      },
      (err) => {
        console.error('subscribeToPost:', err);
        callback(null);
      },
    );
  };

  const unsubAuth = subscribeWhenAuthenticated(
    () => attach(),
    () => {
      unsubDoc?.();
      unsubDoc = undefined;
      callback(null);
    },
  );

  return () => {
    unsubAuth();
    unsubDoc?.();
  };
}

/** اشتراك حيّ بتعليقات منشور — بعد اكتمال Auth */
export function subscribeToPostComments(
  postId: string,
  callback: (comments: PostComment[]) => void,
  max = 80,
): () => void {
  let unsubSnapshot: (() => void) | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retries = 0;
  const MAX_RETRIES = 4;

  const attach = () => {
    unsubSnapshot?.();
    clearTimeout(retryTimer);

    void (async () => {
      const user = await waitForFirestoreAuth(12_000);
      if (!user) {
        callback([]);
        return;
      }

      const q = query(
        collection(firestore, `posts/${postId}/comments`),
        orderBy('createdAt', 'desc'),
        limit(max),
      );
      unsubSnapshot = onSnapshot(
        q,
        (snap) => {
          retries = 0;
          const mapped = snap.docs
            .map((d) => mapCommentDoc(d.id, postId, d.data() as Record<string, unknown>))
            .filter((c) => c.type !== 'gift')
            .reverse();
          void enrichCommentAuthors(mapped).then(callback);
        },
        (err) => {
          console.error('subscribeToPostComments:', err);
          const code = (err as { code?: string }).code;
          if (code === 'permission-denied' && retries < MAX_RETRIES) {
            retries += 1;
            retryTimer = setTimeout(() => attach(), 800 * retries);
            return;
          }
          if (auth.currentUser) callback([]);
        },
      );
    })();
  };

  const unsubAuth = subscribeWhenAuthenticated(
    () => attach(),
    () => {
      unsubSnapshot?.();
      unsubSnapshot = undefined;
      clearTimeout(retryTimer);
      callback([]);
    },
  );

  return () => {
    unsubAuth();
    unsubSnapshot?.();
    clearTimeout(retryTimer);
  };
}

export const getPostById = async (postId: string): Promise<Post | null> => {
  try {
    await waitForFirestoreAuth(12_000);
    if (!auth.currentUser) return null;
    const snap = await getDoc(doc(firestore, 'posts', postId));
    if (!snap.exists()) return null;
    const post = mapPostDoc(snap.id, snap.data() as Record<string, unknown>);
    const me = auth.currentUser?.uid;
    if ((post.status === 'hidden' || post.status === 'removed') && post.uid !== me) {
      return null;
    }
    return (await enrichAuthorMeta([post]))[0] ?? post;
  } catch {
    return null;
  }
};

export const getPostsByUser = async (uid: string, max = 30): Promise<Post[]> => {
  try {
    const me = auth.currentUser?.uid;
    const q =
      me === uid
        ? query(
            collection(firestore, 'posts'),
            where('uid', '==', uid),
            orderBy('createdAt', 'desc'),
            limit(max),
          )
        : query(
            collection(firestore, 'posts'),
            where('uid', '==', uid),
            where('status', '==', 'active'),
            orderBy('createdAt', 'desc'),
            limit(max),
          );
    const snap = await getDocs(q);
    const list = snap.docs
      .map((d) => mapPostDoc(d.id, d.data() as Record<string, unknown>))
      .filter((p) => p.status !== 'hidden' && p.status !== 'removed');
    return await enrichAuthorMeta(list);
  } catch (e) {
    console.error('getPostsByUser:', e);
    return [];
  }
};

/** أي منشورات أعجب بها المستخدم الحالي */
export const getLikedPostIds = async (postIds: string[]): Promise<Set<string>> => {
  const user = auth.currentUser;
  if (!user || postIds.length === 0) return new Set();

  const liked = await Promise.all(
    postIds.map(async (postId) => {
      const snap = await getDoc(doc(firestore, `posts/${postId}/likes/${user.uid}`));
      return snap.exists() ? postId : null;
    }),
  );
  return new Set(liked.filter(Boolean) as string[]);
};

export const toggleLike = async (postId: string): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');

  const likeRef = doc(firestore, `posts/${postId}/likes/${user.uid}`);
  const postRef = doc(firestore, 'posts', postId);

  const likeSnap = await getDoc(likeRef);
  if (likeSnap.exists()) {
    await deleteDoc(likeRef);
    await updateDoc(postRef, { likes: increment(-1) });
    return false;
  }

  await setDoc(likeRef, { uid: user.uid, createdAt: Date.now() });
  await updateDoc(postRef, { likes: increment(1) });

  const postSnap = await getDoc(postRef);
  const authorUid = postSnap.data()?.uid as string | undefined;
  if (authorUid) {
    const { notifyPostLike } = await import('./activityNotifications');
    void notifyPostLike(postId, authorUid);
  }

  return true;
};

/** تسجيل مشاركة واحدة لكل مستخدم — لا يُزاد العدّاد عند نسخ الرابط مرة أخرى */
export const incrementShare = async (postId: string): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) return false;

  const shareRef = doc(firestore, `posts/${postId}/shares/${user.uid}`);
  const postRef = doc(firestore, 'posts', postId);

  try {
    return await runTransaction(firestore, async (tx) => {
      const shareSnap = await tx.get(shareRef);
      if (shareSnap.exists()) return false;
      tx.set(shareRef, { uid: user.uid, createdAt: Date.now() });
      tx.update(postRef, { shares: increment(1) });
      return true;
    });
  } catch {
    return false;
  }
};

export const createPost = async (
  text: string,
  localImageUris?: string[],
  remoteImageUrls?: string[],
): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');

  const trimmed = text.trim();
  if (!trimmed && (!localImageUris?.length) && (!remoteImageUrls?.length)) {
    throw new Error('اكتب نصاً أو أضف صورة');
  }

  let uploadedUrls: string[] = remoteImageUrls ?? [];
  if (localImageUris && localImageUris.length > 0) {
    for (const uri of localImageUris) {
      try {
        uploadedUrls.push(await uploadPostImage(uri));
      } catch (e) {
        console.error('فشل رفع الصورة:', e);
      }
    }
  }

  const userSnap = await getDoc(doc(firestore, 'users', user.uid));
  const userData = userSnap.exists() ? userSnap.data() : {};
  const authorName = resolveDisplayName(
    { displayName: userData.displayName ?? user.displayName, email: userData.email ?? user.email },
    'مستخدم',
  );

  const hashtags = extractHashtags(trimmed);
  const ref = await addDoc(collection(firestore, 'posts'), {
    uid: user.uid,
    authorName,
    authorAvatar: userData.avatar ?? user.photoURL ?? '',
    authorCountry: userData.country ?? 'PS',
    authorLevel: userData.level ?? 1,
    authorIsVIP: userData.isVIP ?? false,
    authorGender: userData.gender ?? 'female',
    authorAge: userData.age ?? 0,
    text: trimmed,
    images: uploadedUrls,
    hashtags,
    likes: 0,
    comments: 0,
    shares: 0,
    gifts: 0,
    status: 'active',
    createdAt: Date.now(),
  });

  const { notifyFollowersOfNewPost } = await import('./activityNotifications');
  void notifyFollowersOfNewPost(ref.id, trimmed);

  return ref.id;
};

/** تعديل منشور — النص فقط (المالك) */
export const updatePost = async (postId: string, text: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');

  const trimmed = text.trim();
  if (!trimmed) throw new Error('النص فارغ');

  const postRef = doc(firestore, 'posts', postId);
  const snap = await getDoc(postRef);
  if (!snap.exists()) throw new Error('المنشور غير موجود');
  if (snap.data().uid !== user.uid) throw new Error('لا يمكنك تعديل هذا المنشور');

  await updateDoc(postRef, {
    text: trimmed,
    hashtags: extractHashtags(trimmed),
    updatedAt: Date.now(),
  });
};

/** إرسال هدية على منشور — إشعار لصاحب المنشور فقط (بدون تعليق عام) */
export const sendGiftOnPost = async (
  postId: string,
  gift: Gift,
  authorUid: string,
  authorName: string,
  quantity = 1,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');
  if (user.uid === authorUid) throw new Error('لا يمكنك إرسال هدية لنفسك');

  const qty = Math.max(1, Math.min(99, quantity));
  const lockKey = `${user.uid}:${postId}:${authorUid}:${gift.id}:${qty}`;
  const now = Date.now();
  const existingLockAt = giftSendLocks.get(lockKey);
  if (existingLockAt && now - existingLockAt < 2500) {
    // منع الضغط المزدوج السريع الذي قد يسبب إرسال نفس الهدية مرتين
    throw new Error('جاري إرسال الهدية، انتظر قليلاً');
  }
  giftSendLocks.set(lockKey, now);

  const unlock = () => {
    const ts = giftSendLocks.get(lockKey);
    if (ts === now) giftSendLocks.delete(lockKey);
  };

  try {
    const { buyAndSendGift } = await import('./shop');
    await buyAndSendGift(gift, authorUid, authorName, undefined, qty, { postId });

    await updateDoc(doc(firestore, 'posts', postId), {
      gifts: increment(qty),
    });
  } finally {
    // سماح بإرسال جديد بعد انتهاء الطلب الحالي مباشرة
    unlock();
  }
};

export const deletePost = async (postId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');

  const postRef = doc(firestore, 'posts', postId);
  const snap = await getDoc(postRef);
  if (!snap.exists()) return;
  if (snap.data().uid !== user.uid) throw new Error('لا يمكنك حذف هذا المنشور');

  await deleteDoc(postRef);
};

// === Comments ===

export const getPostComments = async (postId: string, max = 50): Promise<PostComment[]> => {
  await waitForFirestoreAuth(12_000);
  const q = query(
    collection(firestore, `posts/${postId}/comments`),
    orderBy('createdAt', 'desc'),
    limit(max),
  );
  const snap = await getDocs(q);
  const mapped = snap.docs
    .map((d) => mapCommentDoc(d.id, postId, d.data() as Record<string, unknown>))
    .filter((c) => c.type !== 'gift')
    .reverse();
  return enrichCommentAuthors(mapped);
};

export interface AddCommentOptions {
  parentCommentId?: string;
  imageUrl?: string;
}

/** جذر سلسلة الردود — التعليق الأصلي في المستوى الأول */
function resolveCommentThreadRoot(parentId: string, parent: Record<string, unknown>): string {
  const parentParentId = String(parent.parentCommentId ?? '');
  return parentParentId || parentId;
}

export const addComment = async (
  postId: string,
  text: string,
  options: AddCommentOptions = {},
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');
  const trimmed = text.trim();
  const imageUrl = options.imageUrl?.trim();
  if (!trimmed && !imageUrl) throw new Error('أضف رسالة أو صورة');

  const postSnap = await getDoc(doc(firestore, 'posts', postId));
  if (!postSnap.exists()) throw new Error('المنشور غير موجود');
  const postData = postSnap.data();
  const authorUid = postData?.uid as string | undefined;

  let threadParentId: string | undefined;
  let replyToUid: string | undefined;
  let replyToName: string | undefined;

  if (options.parentCommentId) {
    const parentSnap = await getDoc(
      doc(firestore, `posts/${postId}/comments`, options.parentCommentId),
    );
    if (!parentSnap.exists()) throw new Error('التعليق غير موجود');
    const parent = parentSnap.data() as Record<string, unknown>;
    if (parent.type === 'gift') {
      throw new Error('لا يمكن الرد على تعليق هدية');
    }
    const rootId = resolveCommentThreadRoot(options.parentCommentId, parent);
    threadParentId = rootId;
    replyToUid = String(parent.uid ?? '');
    replyToName = String(parent.authorName ?? 'مستخدم');
  }

  const userSnap = await getDoc(doc(firestore, 'users', user.uid));
  const userData = userSnap.exists() ? userSnap.data() : {};
  const authorName = resolveDisplayName(
    { displayName: userData.displayName ?? user.displayName, email: userData.email ?? user.email },
    'مستخدم',
  );

  const commentType = imageUrl ? (trimmed ? 'text' : 'image') : 'text';
  const previewText = trimmed || (imageUrl ? '📷 صورة' : '');

  await addDoc(collection(firestore, `posts/${postId}/comments`), {
    uid: user.uid,
    authorName,
    authorAvatar: userData.avatar ?? user.photoURL ?? '',
    text: trimmed,
    type: commentType,
    likes: 0,
    createdAt: Date.now(),
    ...(imageUrl ? { imageUrl } : {}),
    ...(threadParentId
      ? { parentCommentId: threadParentId, replyToUid, replyToName }
      : {}),
  });

  await updateDoc(doc(firestore, 'posts', postId), { comments: increment(1) });

  if (threadParentId && replyToUid && replyToUid !== user.uid) {
    const { notifyCommentReply } = await import('./activityNotifications');
    void notifyCommentReply(postId, replyToUid, previewText, replyToName ?? 'مستخدم');
  } else if (authorUid && authorUid !== user.uid) {
    const { notifyPostComment } = await import('./activityNotifications');
    void notifyPostComment(postId, authorUid, previewText);
  }

  if (trimmed) {
    const { resolveMentionedUids } = await import('@/utils/mentions');
    const { notifyMention } = await import('./activityNotifications');
    const mentionedUids = await resolveMentionedUids(trimmed);
    const skip = new Set([user.uid, authorUid].filter(Boolean) as string[]);
    for (const uid of mentionedUids) {
      if (skip.has(uid)) continue;
      void notifyMention(postId, uid, trimmed);
    }
  }
};

export const getLikedCommentIds = async (
  postId: string,
  commentIds: string[],
): Promise<Set<string>> => {
  const user = auth.currentUser;
  if (!user || commentIds.length === 0) return new Set();

  const liked = await Promise.all(
    commentIds.map(async (commentId) => {
      const snap = await getDoc(
        doc(firestore, `posts/${postId}/comments/${commentId}/likes/${user.uid}`),
      );
      return snap.exists() ? commentId : null;
    }),
  );
  return new Set(liked.filter(Boolean) as string[]);
};

export const toggleCommentLike = async (
  postId: string,
  commentId: string,
): Promise<boolean> => {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');

  const likeRef = doc(firestore, `posts/${postId}/comments/${commentId}/likes/${user.uid}`);
  const commentRef = doc(firestore, `posts/${postId}/comments`, commentId);

  const likeSnap = await getDoc(likeRef);
  if (likeSnap.exists()) {
    await deleteDoc(likeRef);
    await updateDoc(commentRef, { likes: increment(-1) });
    return false;
  }

  await setDoc(likeRef, { uid: user.uid, createdAt: Date.now() });
  await updateDoc(commentRef, { likes: increment(1) });
  return true;
};

/** بذور تجريبية — تُستدعى يدوياً من الإعدادات فقط، وليس عند كل تحميل */
export const seedDemoPosts = async (): Promise<void> => {
  const q = query(collection(firestore, 'posts'), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) return;

  const demos = [
    {
      uid: 'demo_post_1',
      name: 'مريم العتيبي',
      avatar: 'https://i.pravatar.cc/100?img=47',
      country: 'SA',
      level: 18,
      isVIP: true,
      gender: 'female' as const,
      age: 24,
      text: 'يوم جميل ومليء بالأنشطة 💜\n#تحدي_PK_الملكي #ليالي_ساحرة',
      images: ['https://picsum.photos/seed/post1/600/400'],
      likes: 124,
      comments: 23,
      shares: 5,
      gifts: 10,
      offset: 1000 * 60 * 15,
    },
    {
      uid: 'demo_post_2',
      name: 'محمد العتيبي',
      avatar: 'https://i.pravatar.cc/100?img=15',
      country: 'SA',
      level: 25,
      isVIP: true,
      gender: 'male' as const,
      age: 28,
      text: 'الفائز اليوم في يانصيب الأسبوع! 🎉\n#LinkUp',
      likes: 342,
      comments: 89,
      shares: 24,
      gifts: 31,
      offset: 1000 * 60 * 60 * 2,
    },
    {
      uid: 'demo_post_3',
      name: 'يوسف الفهد',
      avatar: 'https://i.pravatar.cc/100?img=33',
      country: 'AE',
      level: 22,
      isVIP: true,
      gender: 'male' as const,
      age: 26,
      text: 'غرفة جديدة الليلة من الساعة 9 🎤\n#غناء #سهرة',
      images: [
        'https://picsum.photos/seed/post3a/600/400',
        'https://picsum.photos/seed/post3b/600/400',
      ],
      likes: 87,
      comments: 14,
      shares: 3,
      gifts: 6,
      offset: 1000 * 60 * 60 * 5,
    },
  ];

  for (const d of demos) {
    const hashtags = extractHashtags(d.text);
    await addDoc(collection(firestore, 'posts'), {
      uid: d.uid,
      authorName: d.name,
      authorAvatar: d.avatar,
      authorCountry: d.country,
      authorLevel: d.level,
      authorIsVIP: d.isVIP,
      authorGender: d.gender,
      authorAge: d.age,
      text: d.text,
      images: d.images ?? [],
      hashtags,
      likes: d.likes,
      comments: d.comments,
      shares: d.shares,
      gifts: d.gifts,
      status: 'active',
      createdAt: Date.now() - d.offset,
    });
  }
};
