/**
 * بلاغات المستخدمين — Firestore + Storage
 * البلاغات تظهر فوراً في لوحة التحكم (collection: reports)
 */
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  query,
  where,
  limit,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firestore, storage, auth } from './index';
import { getUser } from './users';
import { resolveDisplayName } from '@/utils/displayName';

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate'
  | 'fake'
  | 'scam'
  | 'hate'
  | 'violence'
  | 'underage'
  | 'other';

export type ReportSource = 'app' | 'support' | 'profile' | 'chat' | 'feed';

export type ReportTargetType = 'user' | 'message' | 'post' | 'room' | 'general';

export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

export interface UserReport {
  id: string;
  reporterUid: string;
  reason: ReportReason;
  details: string;
  photoUrls: string[];
  targetUid: string | null;
  targetDisplayName?: string | null;
  targetAvatar?: string | null;
  targetType: string;
  source: string;
  postId?: string | null;
  postText?: string | null;
  postImageUrl?: string | null;
  messageId?: string | null;
  conversationId?: string | null;
  messageText?: string | null;
  messageType?: string | null;
  status: ReportStatus;
  createdAt: number;
  updatedAt?: number;
  adminNote?: string;
}

function mapReportDoc(id: string, data: Record<string, unknown>): UserReport {
  return {
    id,
    reporterUid: String(data.reporterUid ?? ''),
    reason: (data.reason as ReportReason) ?? 'other',
    details: String(data.details ?? ''),
    photoUrls: Array.isArray(data.photoUrls) ? (data.photoUrls as string[]) : [],
    targetUid: (data.targetUid as string | null) ?? null,
    targetDisplayName: (data.targetDisplayName as string | null) ?? null,
    targetAvatar: (data.targetAvatar as string | null) ?? null,
    targetType: String(data.targetType ?? 'general'),
    source: String(data.source ?? 'app'),
    postId: (data.postId as string | null) ?? null,
    postText: (data.postText as string | null) ?? null,
    postImageUrl: (data.postImageUrl as string | null) ?? null,
    messageId: (data.messageId as string | null) ?? null,
    conversationId: (data.conversationId as string | null) ?? null,
    messageText: (data.messageText as string | null) ?? null,
    messageType: (data.messageType as string | null) ?? null,
    status: (data.status as ReportStatus) ?? 'pending',
    createdAt: Number(data.createdAt) || 0,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : undefined,
    adminNote: typeof data.adminNote === 'string' ? data.adminNote : undefined,
  };
}

/** بلاغاتي — للمستخدم الحالي */
export async function getMyReports(limitCount = 50): Promise<UserReport[]> {
  const user = auth.currentUser;
  if (!user) return [];

  const q = query(
    collection(firestore, 'reports'),
    where('reporterUid', '==', user.uid),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => mapReportDoc(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function subscribeMyReports(
  callback: (reports: UserReport[]) => void,
  limitCount = 50,
): () => void {
  const user = auth.currentUser;
  if (!user) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(firestore, 'reports'),
    where('reporterUid', '==', user.uid),
    limit(limitCount),
  );

  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => mapReportDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.createdAt - a.createdAt);
      callback(rows);
    },
    (err) => {
      console.error('subscribeMyReports:', err);
      callback([]);
    },
  );
}

export async function getReportById(reportId: string): Promise<UserReport | null> {
  const user = auth.currentUser;
  if (!user || !reportId.trim()) return null;

  const snap = await getDoc(doc(firestore, 'reports', reportId.trim()));
  if (!snap.exists()) return null;

  const report = mapReportDoc(snap.id, snap.data() as Record<string, unknown>);
  if (report.reporterUid !== user.uid) return null;
  return report;
}

export interface SubmitReportInput {
  reason: ReportReason;
  details: string;
  photoUris?: string[];
  targetUid?: string;
  targetType?: ReportTargetType | string;
  source?: ReportSource;
  messageId?: string;
  conversationId?: string;
  messageText?: string;
  messageType?: string;
  messageVoiceUrl?: string;
  messageImageUrl?: string;
  messageVideoUrl?: string;
  messageVoiceDuration?: number;
  postId?: string;
  postText?: string;
  postImageUrl?: string;
}

/** مسار شاشة الإبلاغ عن منشور */
export function getPostReportPath(
  postId: string,
  authorUid: string,
  source: ReportSource = 'feed',
): string {
  const params = new URLSearchParams({
    type: 'post',
    target: authorUid,
    postId,
    source,
  });
  return `/report?${params.toString()}`;
}

/** مسار شاشة الإبلاغ عن مستخدم */
export function getUserReportPath(
  targetUid: string,
  source: ReportSource = 'app',
  extra?: { conversationId?: string },
): string {
  const params = new URLSearchParams({
    type: 'user',
    target: targetUid,
    source,
  });
  if (extra?.conversationId) {
    params.set('conversationId', extra.conversationId);
  }
  return `/report?${params.toString()}`;
}

/** مسار شاشة الإبلاغ عن رسالة في محادثة */
export function getMessageReportPath(
  targetUid: string,
  messageId: string,
  conversationId: string,
  extra?: { messageText?: string; messageType?: string },
): string {
  const params = new URLSearchParams({
    type: 'message',
    target: targetUid,
    source: 'chat',
    messageId,
    conversationId,
  });
  if (extra?.messageText?.trim()) {
    params.set('messagePreview', extra.messageText.trim().slice(0, 280));
  }
  if (extra?.messageType) {
    params.set('messageType', extra.messageType);
  }
  return `/report?${params.toString()}`;
}

/** جلب بيانات الوسائط من رسالة المحادثة (للبلاغات) */
async function loadMessageMediaForReport(messageId: string): Promise<{
  messageText?: string | null;
  messageType?: string | null;
  messageVoiceUrl?: string | null;
  messageImageUrl?: string | null;
  messageVideoUrl?: string | null;
  messageVoiceDuration?: number | null;
}> {
  try {
    const snap = await getDoc(doc(firestore, 'messages', messageId));
    if (!snap.exists()) return {};
    const m = snap.data() as Record<string, unknown>;
    return {
      messageText: (m.text as string) ?? null,
      messageType: (m.type as string) ?? null,
      messageVoiceUrl: (m.voiceUrl as string) ?? null,
      messageImageUrl: (m.imageUrl as string) ?? null,
      messageVideoUrl: (m.videoUrl as string) ?? null,
      messageVoiceDuration:
        typeof m.voiceDuration === 'number' ? m.voiceDuration : null,
    };
  } catch {
    return {};
  }
}

export async function submitReport(input: SubmitReportInput): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('غير مسجل');

  const targetType = (input.targetType ?? 'general') as string;
  if (targetType === 'user' && !input.targetUid?.trim()) {
    throw new Error('TARGET_USER_REQUIRED');
  }
  if (targetType === 'post' && !input.postId?.trim()) {
    throw new Error('TARGET_POST_REQUIRED');
  }

  let reporterDisplayName = resolveDisplayName({
    displayName: user.displayName ?? undefined,
    email: user.email ?? undefined,
  });

  try {
    const meDoc = await getUser(user.uid);
    if (meDoc) {
      reporterDisplayName = resolveDisplayName({
        displayName: meDoc.displayName,
        email: meDoc.email ?? user.email ?? undefined,
      });
    }
  } catch {
    /* optional enrichment */
  }

  let targetDisplayName: string | null = null;
  let targetAvatar: string | null = null;
  let postText = input.postText?.trim() ?? null;
  let postImageUrl = input.postImageUrl?.trim() ?? null;
  let targetUid = input.targetUid?.trim() ?? '';

  if (input.postId?.trim()) {
    try {
      const { getPostById } = await import('./posts');
      const post = await getPostById(input.postId.trim());
      if (post) {
        postText = postText ?? post.text?.trim().slice(0, 500) ?? null;
        postImageUrl = postImageUrl ?? post.images?.[0] ?? null;
        if (!targetUid) targetUid = post.uid;
        targetDisplayName = targetDisplayName ?? post.authorName ?? null;
        targetAvatar = targetAvatar ?? post.authorAvatar ?? null;
      }
    } catch {
      /* optional enrichment */
    }
  }

  if (targetUid) {
    try {
      const targetDoc = await getUser(targetUid);
      if (targetDoc) {
        targetDisplayName = resolveDisplayName({
          displayName: targetDoc.displayName,
          email: targetDoc.email,
        });
        targetAvatar = targetDoc.avatar ?? null;
      }
    } catch {
      /* optional enrichment */
    }
  }

  const photoUrls: string[] = [];
  const uris = input.photoUris ?? [];
  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i];
    if (!uri) continue;
    const response = await fetch(uri);
    const blob = await response.blob();
    if (blob.size > 8 * 1024 * 1024) continue;
    const path = `report_attachments/${user.uid}/${Date.now()}_${i}.jpg`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, blob, { contentType: blob.type || 'image/jpeg' });
    photoUrls.push(await getDownloadURL(fileRef));
  }

  const messageMedia = input.messageId?.trim()
    ? await loadMessageMediaForReport(input.messageId.trim())
    : {};

  const docRef = await addDoc(collection(firestore, 'reports'), {
    reporterUid: user.uid,
    reporterDisplayName,
    reason: input.reason,
    details: input.details.trim(),
    photoUrls,
    targetUid: targetUid || null,
    targetDisplayName,
    targetAvatar,
    targetType,
    source: input.source ?? 'app',
    postId: input.postId?.trim() ?? null,
    postText,
    postImageUrl,
    messageId: input.messageId ?? null,
    conversationId: input.conversationId ?? null,
    messageText:
      input.messageText?.trim().slice(0, 500) ??
      messageMedia.messageText?.trim().slice(0, 500) ??
      null,
    messageType: input.messageType ?? messageMedia.messageType ?? null,
    messageVoiceUrl: input.messageVoiceUrl ?? messageMedia.messageVoiceUrl ?? null,
    messageImageUrl: input.messageImageUrl ?? messageMedia.messageImageUrl ?? null,
    messageVideoUrl: input.messageVideoUrl ?? messageMedia.messageVideoUrl ?? null,
    messageVoiceDuration:
      input.messageVoiceDuration ?? messageMedia.messageVoiceDuration ?? null,
    status: 'pending',
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
  });

  return docRef.id;
}
