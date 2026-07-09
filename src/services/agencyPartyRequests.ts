/**
 * طلبات/فعاليات الحفلات داخل الوكالة
 */
import {
  addDoc,
  collection,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { firestore, auth } from './firebase/index';

export type AgencyPartyRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type AgencyPartyEventType =
  | 'dating'
  | 'music'
  | 'games'
  | 'talk'
  | 'celebration'
  | 'other';

export const AGENCY_PARTY_EVENT_TYPES: {
  id: AgencyPartyEventType;
  labelAr: string;
  labelEn: string;
}[] = [
  { id: 'dating', labelAr: 'تعارف وعلاقات', labelEn: 'Dating & relationships' },
  { id: 'music', labelAr: 'موسيقى', labelEn: 'Music' },
  { id: 'games', labelAr: 'ألعاب', labelEn: 'Games' },
  { id: 'talk', labelAr: 'حوار ونقاش', labelEn: 'Talk show' },
  { id: 'celebration', labelAr: 'احتفالات', labelEn: 'Celebrations' },
  { id: 'other', labelAr: 'أخرى', labelEn: 'Other' },
];

export const AGENCY_PARTY_DURATIONS = [30, 60, 90, 120, 180] as const;

export interface AgencyPartyRequest {
  id: string;
  agencyId: string;
  agencyName?: string;
  roomId: string;
  requesterUid: string;
  requesterName: string;
  description: string;
  coverUrl?: string;
  eventType: AgencyPartyEventType;
  startAt: number;
  durationMinutes: number;
  allowPublicPromotion: boolean;
  status: AgencyPartyRequestStatus;
  createdAt: number;
  updatedAt: number;
  rejectionReason?: string;
  stoppedAt?: number;
  stoppedBy?: string;
  stopReason?: string;
}

export function partyEventEndAt(
  item: Pick<AgencyPartyRequest, 'startAt' | 'durationMinutes' | 'stoppedAt'>,
): number {
  const naturalEnd = item.startAt + item.durationMinutes * 60_000;
  if (item.stoppedAt && item.stoppedAt >= item.startAt && item.stoppedAt < naturalEnd) {
    return item.stoppedAt;
  }
  return naturalEnd;
}

export function isPartyUpcoming(item: Pick<AgencyPartyRequest, 'startAt' | 'durationMinutes' | 'status' | 'stoppedAt'>, now = Date.now()): boolean {
  if (item.status !== 'approved') return false;
  return item.startAt > now;
}

export function isPartyOngoing(item: Pick<AgencyPartyRequest, 'startAt' | 'durationMinutes' | 'status' | 'stoppedAt'>, now = Date.now()): boolean {
  if (item.status !== 'approved') return false;
  return item.startAt <= now && partyEventEndAt(item) > now;
}

export function partyEventTypeLabel(type: AgencyPartyEventType, isAr: boolean): string {
  const row = AGENCY_PARTY_EVENT_TYPES.find((t) => t.id === type);
  if (!row) return type;
  return isAr ? row.labelAr : row.labelEn;
}

export async function submitAgencyPartyRequest(input: {
  agencyId: string;
  agencyName?: string;
  roomId: string;
  description: string;
  coverUrl?: string;
  eventType: AgencyPartyEventType;
  startAt: number;
  durationMinutes: number;
  allowPublicPromotion: boolean;
  requesterName?: string;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const description = input.description.trim();
  if (!description) throw new Error('وصف الحدث مطلوب');
  if (description.length > 100) throw new Error('الوصف 100 حرف كحد أقصى');
  if (!AGENCY_PARTY_EVENT_TYPES.some((t) => t.id === input.eventType)) {
    throw new Error('نوع الحدث غير مدعوم');
  }
  if (!AGENCY_PARTY_DURATIONS.includes(input.durationMinutes as (typeof AGENCY_PARTY_DURATIONS)[number])) {
    throw new Error('مدة الحدث غير مدعومة');
  }
  if (input.startAt < Date.now() - 60_000) {
    throw new Error('وقت البدء يجب أن يكون في المستقبل');
  }

  // استعلام مقيّد بطلبات المستخدم نفسه — متوافق مع Firestore rules
  const pendingQ = query(
    collection(firestore, 'agencyPartyRequests'),
    where('agencyId', '==', input.agencyId),
    where('requesterUid', '==', user.uid),
    where('status', '==', 'pending'),
    limit(1),
  );
  const pendingSnap = await getDocs(pendingQ);
  if (!pendingSnap.empty) {
    throw new Error('لديك طلب حفلة معلّق — انتظر مراجعته');
  }

  const docRef = await addDoc(collection(firestore, 'agencyPartyRequests'), {
    agencyId: input.agencyId,
    agencyName: input.agencyName?.trim() || '',
    roomId: input.roomId,
    requesterUid: user.uid,
    requesterName: input.requesterName?.trim() || user.displayName || 'وكيل',
    description,
    coverUrl: input.coverUrl?.trim() || '',
    eventType: input.eventType,
    startAt: input.startAt,
    durationMinutes: input.durationMinutes,
    allowPublicPromotion: input.allowPublicPromotion === true,
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return docRef.id;
}

export function subscribeToAgencyPartyRequests(
  agencyId: string,
  callback: (requests: AgencyPartyRequest[]) => void,
): () => void {
  const uid = auth.currentUser?.uid;
  if (!agencyId || !uid) {
    callback([]);
    return () => {};
  }

  const mineQ = query(
    collection(firestore, 'agencyPartyRequests'),
    where('agencyId', '==', agencyId),
    where('requesterUid', '==', uid),
    limit(30),
  );
  const approvedQ = query(
    collection(firestore, 'agencyPartyRequests'),
    where('agencyId', '==', agencyId),
    where('status', '==', 'approved'),
    limit(30),
  );

  let mine: AgencyPartyRequest[] = [];
  let approved: AgencyPartyRequest[] = [];

  const emit = () => {
    const map = new Map<string, AgencyPartyRequest>();
    for (const item of [...mine, ...approved]) map.set(item.id, item);
    const list = [...map.values()].sort((a, b) => b.createdAt - a.createdAt);
    callback(list);
  };

  const unsubMine = onSnapshot(
    mineQ,
    (snap) => {
      mine = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AgencyPartyRequest));
      emit();
    },
    () => {
      mine = [];
      emit();
    },
  );

  const unsubApproved = onSnapshot(
    approvedQ,
    (snap) => {
      approved = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AgencyPartyRequest));
      emit();
    },
    () => {
      approved = [];
      emit();
    },
  );

  return () => {
    unsubMine();
    unsubApproved();
  };
}

export function subscribeToDiscoverPartyEvents(
  callback: (events: AgencyPartyRequest[]) => void,
): () => void {
  const q = query(
    collection(firestore, 'agencyPartyRequests'),
    where('status', '==', 'approved'),
    limit(60),
  );
  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now();
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as AgencyPartyRequest))
        .filter((e) => e.status === 'approved' && !e.stoppedAt)
        .filter((e) => partyEventEndAt(e) > now)
        .sort((a, b) => a.startAt - b.startAt);
      callback(list);
    },
    () => callback([]),
  );
}

/** فعاليات وكالات جارية الآن (موافق عليها من الإدارة وبدأت ولم تنتهِ) */
export function subscribeToOngoingAgencyPartyEvents(
  callback: (events: AgencyPartyRequest[]) => void,
): () => void {
  return subscribeToDiscoverPartyEvents((events) => {
    callback(events.filter((e) => isPartyOngoing(e)));
  });
}

export function buildOngoingPartyLookup(events: AgencyPartyRequest[]): {
  byRoomId: Map<string, AgencyPartyRequest>;
  byAgencyId: Map<string, AgencyPartyRequest>;
} {
  const byRoomId = new Map<string, AgencyPartyRequest>();
  const byAgencyId = new Map<string, AgencyPartyRequest>();
  for (const event of events) {
    if (event.roomId) byRoomId.set(event.roomId, event);
    if (event.agencyId) byAgencyId.set(event.agencyId, event);
  }
  return { byRoomId, byAgencyId };
}
