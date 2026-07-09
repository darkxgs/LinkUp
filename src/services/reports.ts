/**
 * بلاغات المستخدمين — قراءة وتحديث الحالة (أدمن)
 */
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  doc,
  updateDoc,
  getDoc,
  onSnapshot,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import {
  isInAdminCountryScope,
  isSuperCountryScope,
  preloadUserCountries,
  getCachedUserCountry,
} from '@/services/countryScope';

export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

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

export interface UserReport {
  id: string;
  reporterUid: string;
  reporterDisplayName?: string;
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
  messageVoiceUrl?: string | null;
  messageImageUrl?: string | null;
  messageVideoUrl?: string | null;
  messageVoiceDuration?: number | null;
  status: ReportStatus;
  createdAt: number;
  updatedAt?: number;
  adminNote?: string;
}

export const REASON_LABELS: Record<ReportReason, string> = {
  spam: 'إزعاج / سبام',
  harassment: 'تحرش',
  inappropriate: 'محتوى غير لائق',
  fake: 'حساب وهمي',
  scam: 'احتيال',
  hate: 'خطاب كراهية',
  violence: 'عنف',
  underage: 'قاصر',
  other: 'أخرى',
};

export const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'قيد الانتظار',
  reviewing: 'قيد المراجعة',
  resolved: 'تم الحل',
  dismissed: 'مرفوض',
};

export const SOURCE_LABELS: Record<string, string> = {
  app: 'التطبيق',
  support: 'شات الدعم',
  profile: 'الملف',
  chat: 'محادثة',
  feed: 'المنشورات',
};

export const TARGET_TYPE_LABELS: Record<string, string> = {
  user: 'مستخدم',
  message: 'رسالة',
  post: 'منشور',
  room: 'غرفة',
  general: 'عام',
};

function mapReport(id: string, data: Record<string, unknown>): UserReport {
  return {
    id,
    reporterUid: (data.reporterUid as string) ?? '',
    reporterDisplayName: (data.reporterDisplayName as string) || undefined,
    reason: (data.reason as ReportReason) ?? 'other',
    details: (data.details as string) ?? '',
    photoUrls: (data.photoUrls as string[]) ?? [],
    targetUid: (data.targetUid as string | null) ?? null,
    targetDisplayName: (data.targetDisplayName as string | null) ?? null,
    targetAvatar: (data.targetAvatar as string | null) ?? null,
    targetType: (data.targetType as string) ?? 'general',
    source: (data.source as string) ?? 'app',
    postId: (data.postId as string | null) ?? null,
    postText: (data.postText as string | null) ?? null,
    postImageUrl: (data.postImageUrl as string | null) ?? null,
    messageId: (data.messageId as string | null) ?? null,
    conversationId: (data.conversationId as string | null) ?? null,
    messageText: (data.messageText as string | null) ?? null,
    messageType: (data.messageType as string | null) ?? null,
    messageVoiceUrl: (data.messageVoiceUrl as string | null) ?? null,
    messageImageUrl: (data.messageImageUrl as string | null) ?? null,
    messageVideoUrl: (data.messageVideoUrl as string | null) ?? null,
    messageVoiceDuration: (data.messageVoiceDuration as number | null) ?? null,
    status: (data.status as ReportStatus) ?? 'pending',
    createdAt: (data.createdAt as number) ?? 0,
    updatedAt: data.updatedAt as number | undefined,
    adminNote: data.adminNote as string | undefined,
  };
}

export async function getPendingReportsCount(): Promise<number> {
  const q = query(
    collection(firestore, 'reports'),
    where('status', '==', 'pending'),
    limit(500),
  );
  const snap = await getDocs(q);
  if (isSuperCountryScope()) return snap.size;
  const rows = snap.docs.map((d) => mapReport(d.id, d.data() as Record<string, unknown>));
  await preloadUserCountries(rows.map((r) => r.reporterUid));
  return rows.filter((r) => isInAdminCountryScope(getCachedUserCountry(r.reporterUid))).length;
}

export async function getReports(limitCount = 200): Promise<UserReport[]> {
  const q = query(
    collection(firestore, 'reports'),
    orderBy('createdAt', 'desc'),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => mapReport(d.id, d.data() as Record<string, unknown>));
  if (isSuperCountryScope()) return rows;
  await preloadUserCountries(rows.map((r) => r.reporterUid));
  return rows.filter((r) => isInAdminCountryScope(getCachedUserCountry(r.reporterUid)));
}

export function subscribeReports(
  callback: (reports: UserReport[]) => void,
  limitCount = 200,
): () => void {
  const q = query(
    collection(firestore, 'reports'),
    orderBy('createdAt', 'desc'),
    limit(limitCount),
  );
  return onSnapshot(
    q,
    async (snap) => {
      const rows = snap.docs.map((d) => mapReport(d.id, d.data() as Record<string, unknown>));
      if (isSuperCountryScope()) {
        callback(rows);
        return;
      }
      await preloadUserCountries(rows.map((r) => r.reporterUid));
      callback(rows.filter((r) => isInAdminCountryScope(getCachedUserCountry(r.reporterUid))));
    },
    (err) => {
      console.error('subscribeReports:', err);
      callback([]);
    },
  );
}

export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
  adminNote?: string,
): Promise<void> {
  const payload: Record<string, unknown> = {
    status,
    updatedAt: Date.now(),
  };
  if (adminNote !== undefined) {
    payload.adminNote = adminNote.trim();
  }
  await updateDoc(doc(firestore, 'reports', reportId), payload);
}

export async function fetchReportMessageMedia(messageId: string): Promise<{
  messageVoiceUrl?: string | null;
  messageImageUrl?: string | null;
  messageVideoUrl?: string | null;
  messageVoiceDuration?: number | null;
  messageType?: string | null;
} | null> {
  if (!messageId?.trim()) return null;
  try {
    const snap = await getDoc(doc(firestore, 'messages', messageId.trim()));
    if (!snap.exists()) return null;
    const d = snap.data() as Record<string, unknown>;
    return {
      messageVoiceUrl: (d.voiceUrl as string) ?? null,
      messageImageUrl: (d.imageUrl as string) ?? null,
      messageVideoUrl: (d.videoUrl as string) ?? null,
      messageVoiceDuration:
        typeof d.voiceDuration === 'number' ? d.voiceDuration : null,
      messageType: (d.type as string) ?? null,
    };
  } catch {
    return null;
  }
}

export async function fetchReporterDisplayName(uid: string): Promise<string> {
  if (!uid) return '—';
  try {
    const snap = await getDoc(doc(firestore, 'users', uid));
    if (!snap.exists()) return uid.slice(0, 12) + '…';
    const d = snap.data();
    return (d.displayName as string) || (d.name as string) || uid.slice(0, 12) + '…';
  } catch {
    return uid.slice(0, 12) + '…';
  }
}
