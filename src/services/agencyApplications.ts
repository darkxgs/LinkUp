/**
 * طلبات فتح الوكالة — من التطبيق إلى Cloud Functions
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestore, auth, functions } from './firebase/index';

export type AgencyApplicationStatus =
  | 'pending'
  | 'awaiting_hosts'
  | 'ready'
  | 'active'
  | 'rejected'
  | 'expired';

export interface ProposedHost {
  uid: string;
  displayName: string;
  avatar: string;
  profileGender: string;
  genderVerified: boolean;
  verifiedAt?: number;
  verifiedBy?: 'self' | 'admin';
}

export interface AgencyApplication {
  id: string;
  applicantUid: string;
  applicantName: string;
  applicantPhone: string;
  applicantPublicAccountId?: string;
  countryCode: string;
  agencyName: string;
  status: AgencyApplicationStatus;
  proposedHosts: ProposedHost[];
  proposedHostUids: string[];
  minHostsRequired: number;
  femaleHostCount?: number;
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: number;
  agencyId?: string;
  inviteCode?: string;
  hostsDeadline?: number;
  reviewDeadline?: number;
  assignedTeam?: 'gcc' | 'global';
  createdAt: number;
  updatedAt: number;
}

const MIN_HOSTS = 10;

function mapCallableError(e: unknown): Error {
  const err = e as { message?: string; code?: string };
  const msg = err?.message ?? 'فشل إرسال الطلب';
  if (err?.code === 'functions/already-exists') return new Error(msg);
  if (err?.code === 'functions/invalid-argument') return new Error(msg);
  return new Error(msg);
}

export const submitAgencyApplication = async (input: {
  agencyName: string;
  countryCode: string;
  phone: string;
  minHostsRequired?: number;
  source?: 'app' | 'support_bot';
}): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const fn = httpsCallable<
    {
      agencyName: string;
      countryCode: string;
      phone: string;
      minHostsRequired?: number;
      source?: 'app' | 'support_bot';
    },
    { ok: boolean; applicationId: string }
  >(functions, 'submitAgencyApplication');

  try {
    const res = await fn({
      agencyName: input.agencyName.trim(),
      countryCode: input.countryCode.trim().toUpperCase(),
      phone: input.phone.trim(),
      minHostsRequired: Math.max(MIN_HOSTS, input.minHostsRequired ?? MIN_HOSTS),
      source: input.source ?? 'app',
    });
    return res.data.applicationId;
  } catch (e) {
    throw mapCallableError(e);
  }
};

export type AgencyVerificationDecision = 'approve' | 'reject' | 'uncertain';

export interface AgencyVerificationResult {
  ok: boolean;
  applicationId: string;
  /** awaiting_hosts (قُبل) | rejected | pending (مراجعة يدوية) */
  status: 'awaiting_hosts' | 'rejected' | 'pending';
  decision: AgencyVerificationDecision;
  reason?: string;
  agencyId?: string;
  inviteCode?: string;
}

/**
 * توثيق الوكالة بالذكاء الاصطناعي — يرسل بيانات الوكالة + الصور (base64) للمراجعة الآلية.
 * يعيد قرار الـ AI مباشرة: قبول (awaiting_hosts) / رفض / مراجعة يدوية (pending).
 */
export const submitAgencyVerification = async (input: {
  agencyName: string;
  countryCode: string;
  phone: string;
  minHostsRequired?: number;
  ownerName?: string;
  logoBase64: string;
  backgroundBase64?: string;
  idDocBase64: string;
  source?: 'app' | 'support_bot';
}): Promise<AgencyVerificationResult> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const fn = httpsCallable<
    {
      agencyName: string;
      countryCode: string;
      phone: string;
      minHostsRequired?: number;
      ownerName?: string;
      logoBase64: string;
      backgroundBase64?: string;
      idDocBase64: string;
      source?: 'app' | 'support_bot';
    },
    AgencyVerificationResult
  >(functions, 'submitAgencyVerification');

  try {
    const res = await fn({
      agencyName: input.agencyName.trim(),
      countryCode: input.countryCode.trim().toUpperCase(),
      phone: input.phone.trim(),
      minHostsRequired: Math.max(MIN_HOSTS, input.minHostsRequired ?? MIN_HOSTS),
      ownerName: input.ownerName?.trim() || undefined,
      logoBase64: input.logoBase64,
      backgroundBase64: input.backgroundBase64 || undefined,
      idDocBase64: input.idDocBase64,
      source: input.source ?? 'app',
    });
    return res.data;
  } catch (e) {
    throw mapCallableError(e);
  }
};

export const getMyAgencyApplication = async (): Promise<AgencyApplication | null> => {
  const user = auth.currentUser;
  if (!user) return null;

  const snap = await getDocs(
    query(
      collection(firestore, 'agencyApplications'),
      where('applicantUid', '==', user.uid),
      limit(10),
    ),
  );
  if (snap.empty) return null;
  const d = snap.docs.sort(
    (a, b) => (b.data().createdAt ?? 0) - (a.data().createdAt ?? 0),
  )[0];
  if (!d) return null;
  return { id: d.id, ...d.data() } as AgencyApplication;
};

export const subscribeToMyAgencyApplication = (
  callback: (app: AgencyApplication | null) => void,
): (() => void) => {
  const user = auth.currentUser;
  if (!user) {
    callback(null);
    return () => {};
  }

  const q = query(
    collection(firestore, 'agencyApplications'),
    where('applicantUid', '==', user.uid),
    limit(10),
  );

  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        callback(null);
        return;
      }
      const d = snap.docs.sort(
        (a, b) => (b.data().createdAt ?? 0) - (a.data().createdAt ?? 0),
      )[0];
      if (!d) {
        callback(null);
        return;
      }
      callback({ id: d.id, ...d.data() } as AgencyApplication);
    },
    () => callback(null),
  );
};

export const getPendingHostApplicationForMe = async (): Promise<{
  application: AgencyApplication;
  hostSlot: ProposedHost;
} | null> => {
  const user = auth.currentUser;
  if (!user) return null;

  const memberSnap = await getDocs(
    query(
      collection(firestore, 'agencyMembers'),
      where('uid', '==', user.uid),
      where('hostVerified', '==', false),
      limit(5),
    ),
  );

  for (const m of memberSnap.docs) {
    const agencyId = String(m.data().agencyId ?? '');
    if (!agencyId) continue;
    const agencySnap = await getDoc(doc(firestore, 'agencies', agencyId));
    if (!agencySnap.exists()) continue;
    const agencyStatus = String(agencySnap.data()?.status ?? '');
    if (!['pending', 'active'].includes(agencyStatus)) continue;

    return {
      application: {
        id: agencyId,
        applicantUid: '',
        applicantName: String(agencySnap.data()?.name ?? ''),
        applicantPhone: '',
        countryCode: String(agencySnap.data()?.country ?? ''),
        agencyName: String(agencySnap.data()?.name ?? ''),
        status: 'awaiting_hosts',
        proposedHosts: [],
        proposedHostUids: [],
        minHostsRequired: Number(agencySnap.data()?.minHostsRequired) || MIN_HOSTS,
        agencyId,
        createdAt: 0,
        updatedAt: 0,
      },
      hostSlot: {
        uid: user.uid,
        displayName: '',
        avatar: '',
        profileGender: '',
        genderVerified: false,
      },
    };
  }

  const snap = await getDocs(
    query(
      collection(firestore, 'agencyApplications'),
      where('proposedHostUids', 'array-contains', user.uid),
      where('status', '==', 'awaiting_hosts'),
      limit(5),
    ),
  );

  for (const d of snap.docs) {
    const app = { id: d.id, ...d.data() } as AgencyApplication;
    const hostSlot = app.proposedHosts.find((h) => h.uid === user.uid);
    if (hostSlot && !hostSlot.genderVerified) {
      return { application: app, hostSlot };
    }
  }
  return null;
};

export const confirmMyHostGender = async (): Promise<{ isFemaleHost: boolean; gender: string }> => {
  const fn = httpsCallable<Record<string, never>, { ok: boolean; isFemaleHost: boolean; gender: string }>(
    functions,
    'confirmAgencyHostGender',
  );
  const res = await fn({});
  return { isFemaleHost: res.data.isFemaleHost, gender: res.data.gender };
};
