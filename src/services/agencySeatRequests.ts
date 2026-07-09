/**
 * طلبات زيادة عدد المايكات في غرفة الوكالة
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
import { ALLOWED_SEAT_COUNTS, type AllowedSeatCount } from './firebase/roomSeats';

export type AgencySeatRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AgencySeatRequest {
  id: string;
  agencyId: string;
  roomId: string;
  requesterUid: string;
  requesterName: string;
  requestedSeatsCount: AllowedSeatCount;
  currentMaxSeats: number;
  currentSeatsCount: number;
  status: AgencySeatRequestStatus;
  createdAt: number;
  updatedAt: number;
  rejectionReason?: string;
}

export async function submitAgencySeatRequest(input: {
  agencyId: string;
  roomId: string;
  requestedSeatsCount: AllowedSeatCount;
  currentMaxSeats: number;
  currentSeatsCount: number;
  requesterName?: string;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  if (!ALLOWED_SEAT_COUNTS.includes(input.requestedSeatsCount)) {
    throw new Error('عدد المايكات غير مدعوم');
  }
  if (input.requestedSeatsCount <= input.currentMaxSeats) {
    throw new Error('العدد المطلوب يجب أن يكون أكبر من الحد الحالي');
  }

  const pendingQ = query(
    collection(firestore, 'agencySeatRequests'),
    where('agencyId', '==', input.agencyId),
    where('requesterUid', '==', user.uid),
    where('status', '==', 'pending'),
    limit(20),
  );
  const pendingSnap = await getDocs(pendingQ);
  const duplicate = pendingSnap.docs.find(
    (d) => Number(d.data().requestedSeatsCount) === input.requestedSeatsCount,
  );
  if (duplicate) {
    throw new Error('يوجد طلب معلّق لهذا العدد بالفعل');
  }

  const docRef = await addDoc(collection(firestore, 'agencySeatRequests'), {
    agencyId: input.agencyId,
    roomId: input.roomId,
    requesterUid: user.uid,
    requesterName: input.requesterName?.trim() || user.displayName || 'وكيل',
    requestedSeatsCount: input.requestedSeatsCount,
    currentMaxSeats: input.currentMaxSeats,
    currentSeatsCount: input.currentSeatsCount,
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return docRef.id;
}

export function subscribeToAgencyPendingSeatRequests(
  agencyId: string,
  callback: (requests: AgencySeatRequest[]) => void,
): () => void {
  const uid = auth.currentUser?.uid;
  if (!agencyId || !uid) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(firestore, 'agencySeatRequests'),
    where('agencyId', '==', agencyId),
    where('requesterUid', '==', uid),
    where('status', '==', 'pending'),
    limit(20),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AgencySeatRequest));
      list.sort((a, b) => b.createdAt - a.createdAt);
      callback(list);
    },
    () => callback([]),
  );
}
