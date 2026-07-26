/**
 * بلاغات المستخدمين — قراءة وتحديث الحالة (أدمن)
 */
import { v2, v2Qs } from '@/lib/v2Api';
import { getUserById } from '@/services/admin';
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

/** One report as the server lists it — no screenshots, no captured evidence.
 *  Those come from the single-record read only, so scanning the queue does not
 *  put every attachment on screen. */
interface ServerReportRow {
  id: string;
  reporterUid: string | null;
  reporterName: string;
  targetUid: string | null;
  targetName: string;
  targetType: string;
  source: string;
  reason: string;
  status: string;
  createdAt: string;
}

type ServerReportDetail = ServerReportRow & {
  targetAvatar: string | null;
  details: string;
  photoUrls: string[];
  evidence: Record<string, unknown>;
  adminNote: string;
  updatedAt: string;
};

/** v2 status vocabulary → v1's. `actioned` and `dismissed` both mean "closed",
 *  and the panel already draws those two differently. */
function reportStatusOf(status: string): ReportStatus {
  switch (status) {
    case 'reviewed':
      return 'reviewing';
    case 'actioned':
      return 'resolved';
    case 'dismissed':
      return 'dismissed';
    default:
      return 'pending';
  }
}

/** …and back, because the decide endpoint speaks v2's vocabulary. */
function serverStatusOf(status: ReportStatus): string {
  switch (status) {
    case 'reviewing':
      return 'reviewed';
    case 'resolved':
      return 'actioned';
    case 'dismissed':
      return 'dismissed';
    default:
      return 'pending';
  }
}

function toUserReport(row: ServerReportRow, detail?: Partial<ServerReportDetail>): UserReport {
  const evidence = (detail?.evidence ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
  return {
    id: row.id,
    reporterUid: row.reporterUid ?? '',
    reporterDisplayName: row.reporterName || undefined,
    reason: (row.reason as ReportReason) ?? 'other',
    details: detail?.details ?? '',
    photoUrls: detail?.photoUrls ?? [],
    targetUid: row.targetUid,
    targetDisplayName: row.targetName || null,
    targetAvatar: detail?.targetAvatar ?? null,
    targetType: row.targetType || 'general',
    source: row.source || 'app',
    // The captured evidence the reporter's client attached — kept as one jsonb on
    // the server rather than a dozen columns, unpacked here for the same UI.
    postId: str(evidence.postId),
    postText: str(evidence.postText),
    postImageUrl: str(evidence.postImageUrl),
    messageId: str(evidence.messageId),
    conversationId: str(evidence.conversationId),
    messageText: str(evidence.messageText),
    messageType: str(evidence.messageType),
    messageVoiceUrl: str(evidence.messageVoiceUrl),
    messageImageUrl: str(evidence.messageImageUrl),
    messageVideoUrl: str(evidence.messageVideoUrl),
    messageVoiceDuration:
      typeof evidence.messageVoiceDuration === 'number' ? evidence.messageVoiceDuration : null,
    status: reportStatusOf(row.status),
    createdAt: Date.parse(row.createdAt) || 0,
    updatedAt: detail?.updatedAt ? Date.parse(detail.updatedAt) || undefined : undefined,
    adminNote: detail?.adminNote || undefined,
  };
}

export async function getPendingReportsCount(): Promise<number> {
  try {
    // `total` from a 1-row page = the count, without fetching the rows.
    const res = await v2.get<{ total: number }>(
      `/admin/reports${v2Qs({ status: 'pending', limit: 1 })}`,
    );
    return res?.total ?? 0;
  } catch {
    return 0;
  }
}

export async function getReports(limitCount = 200): Promise<UserReport[]> {
  try {
    const res = await v2.get<{ items: ServerReportRow[] }>(
      `/admin/reports${v2Qs({ limit: Math.min(limitCount, 100) })}`,
    );
    const rows = (res?.items ?? []).map((row) => toUserReport(row));
    if (isSuperCountryScope()) return rows;
    await preloadUserCountries(rows.map((r) => r.reporterUid));
    return rows.filter((r) => isInAdminCountryScope(getCachedUserCountry(r.reporterUid)));
  } catch (e) {
    console.error('getReports:', e);
    return [];
  }
}

/** تفاصيل بلاغ — the only read that returns the attachments and the evidence. */
export async function getReportDetail(reportId: string): Promise<UserReport | null> {
  try {
    const row = await v2.get<ServerReportDetail>(`/admin/reports/${reportId}`);
    return row?.id ? toUserReport(row, row) : null;
  } catch {
    return null;
  }
}

/** How often the reports page refreshes while it is open. */
const REPORTS_POLL_MS = 15_000;

/**
 * v1 kept a Firestore listener open. Our API is request/response, so this polls
 * and only calls back when the list actually CHANGED — no re-render per tick.
 */
export function subscribeReports(
  callback: (reports: UserReport[]) => void,
  limitCount = 200,
): () => void {
  let stopped = false;
  let lastJson = '';

  const tick = async () => {
    if (stopped) return;
    const rows = await getReports(limitCount);
    if (stopped) return;
    const json = JSON.stringify(rows);
    if (json !== lastJson) {
      lastJson = json;
      callback(rows);
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), REPORTS_POLL_MS);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
  adminNote?: string,
): Promise<void> {
  await v2.post(`/admin/reports/${reportId}/decide`, {
    status: serverStatusOf(status),
    ...(adminNote !== undefined ? { note: adminNote.trim() } : {}),
  });
}

/**
 * ⚠️ استخراج وسائط رسالة مُبلَّغ عنها غير متاح على v2 — بعد.
 *
 * v1 read the reported message straight out of the `messages` collection. In v2
 * private messages are per-conversation rows with no admin read path, and adding
 * one means deciding how far a moderator may read into people's chats — an owner
 * decision, not a migration one. What the reporter's client ATTACHED to the report
 * is already returned by the report detail above.
 */
export async function fetchReportMessageMedia(messageId: string): Promise<{
  messageText: string | null;
  messageVoiceUrl: string | null;
  messageImageUrl: string | null;
  messageVideoUrl: string | null;
  messageVoiceDuration: number | null;
  messageType: string | null;
} | null> {
  void messageId;
  return null;
}

export async function fetchReporterDisplayName(uid: string): Promise<string> {
  if (!uid) return '';
  const user = await getUserById(uid);
  return user?.displayName ?? '';
}
