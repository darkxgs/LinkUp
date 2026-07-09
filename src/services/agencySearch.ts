/**
 * بحث الوكالات — حسب الدولة / المعرّف / كود الدعوة
 */
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { firestore } from './firebase/index';
import { getAgencyById, type Agency } from './agencyService';

const NEARBY_COUNTRIES: Record<string, string[]> = {
  PS: ['IL', 'JO', 'LB', 'EG', 'SA', 'AE', 'KW', 'QA'],
  SA: ['AE', 'KW', 'QA', 'BH', 'OM', 'EG', 'JO', 'PS'],
  AE: ['SA', 'KW', 'QA', 'BH', 'OM', 'EG', 'JO'],
  EG: ['LY', 'SD', 'PS', 'JO', 'SA', 'AE'],
  JO: ['PS', 'SA', 'AE', 'LB', 'EG', 'IQ'],
  LB: ['PS', 'JO', 'SY', 'EG'],
  IQ: ['JO', 'SA', 'KW', 'AE', 'SY'],
  MA: ['DZ', 'TN', 'LY', 'EG'],
  DZ: ['MA', 'TN', 'LY', 'EG'],
  TN: ['MA', 'DZ', 'LY', 'EG'],
};

function isJoinableAgency(agency: Agency): boolean {
  const status = String(agency.status ?? 'active');
  return !['expired', 'rejected'].includes(status);
}

function mapDoc(id: string, data: Record<string, unknown>): Agency {
  return {
    id,
    name: String(data.name ?? 'وكالة'),
    ownerUid: String(data.ownerUid ?? ''),
    ownerName: String(data.ownerName ?? ''),
    ownerAvatar: data.ownerAvatar ? String(data.ownerAvatar) : undefined,
    description: data.description ? String(data.description) : undefined,
    country: data.country ? String(data.country) : undefined,
    inviteCode: String(data.inviteCode ?? ''),
    memberCount: Number(data.memberCount ?? 0) || 0,
    totalEarnings: Number(data.totalEarnings ?? 0) || 0,
    isVerified: data.isVerified === true,
    status: (data.status as Agency['status']) ?? 'active',
    femaleHostCount: Number(data.femaleHostCount ?? 0) || 0,
    minHostsRequired: Number(data.minHostsRequired ?? 10) || 10,
    hostsDeadline: data.hostsDeadline ? Number(data.hostsDeadline) : undefined,
    createdAt: Number(data.createdAt ?? 0) || 0,
    updatedAt: Number(data.updatedAt ?? 0) || 0,
  };
}

/** قائمة الوكالات — دولتك والقريبة أولاً */
export async function listAgenciesForUser(userCountry?: string): Promise<Agency[]> {
  let snap;
  try {
    snap = await getDocs(query(collection(firestore, 'agencies'), limit(100)));
  } catch {
    return [];
  }

  const all = snap.docs
    .map((d) => mapDoc(d.id, d.data() as Record<string, unknown>))
    .filter(isJoinableAgency);

  const cc = userCountry?.trim().toUpperCase();
  if (!cc) {
    return all.sort((a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0));
  }

  const nearby = new Set([cc, ...(NEARBY_COUNTRIES[cc] ?? [])]);
  const inRegion = all.filter((a) => nearby.has(String(a.country ?? '').toUpperCase()));
  const rest = all.filter((a) => !nearby.has(String(a.country ?? '').toUpperCase()));
  return [...inRegion, ...rest];
}

/** بحث بمعرّف الوكالة أو كود الدعوة */
export async function findAgencyByIdentifier(identifier: string): Promise<Agency | null> {
  const raw = identifier.trim();
  if (!raw) return null;

  const byId = await getAgencyById(raw);
  if (byId && isJoinableAgency(byId)) return byId;

  try {
    const codeSnap = await getDocs(
      query(
        collection(firestore, 'agencies'),
        where('inviteCode', '==', raw.toLowerCase()),
        limit(1),
      ),
    );
    if (!codeSnap.empty) {
      const d = codeSnap.docs[0];
      if (!d) return null;
      const agency = mapDoc(d.id, d.data() as Record<string, unknown>);
      return isJoinableAgency(agency) ? agency : null;
    }
  } catch {
    // index may be missing — fallback scan
    const snap = await getDocs(query(collection(firestore, 'agencies'), limit(100)));
    const lower = raw.toLowerCase();
    for (const d of snap.docs) {
      const data = d.data();
      if (d.id === raw || String(data.inviteCode ?? '').toLowerCase() === lower) {
        const agency = mapDoc(d.id, data as Record<string, unknown>);
        if (isJoinableAgency(agency)) return agency;
      }
    }
  }

  return null;
}

export function filterAgenciesLocal(agencies: Agency[], searchText: string): Agency[] {
  const q = searchText.trim().toLowerCase();
  if (!q) return agencies;
  return agencies.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      String(a.inviteCode ?? '').toLowerCase().includes(q) ||
      String(a.ownerName ?? '').toLowerCase().includes(q),
  );
}
