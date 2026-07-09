/**
 * إنشاء وكالة رسمية لسوبر أدمن — تظهر في الاهتمامات لسكان البلد
 */
import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';

const db = admin.firestore();
const rtdb = admin.database();

function normalizeCountry(code?: string | null): string {
  return String(code ?? '').trim().toUpperCase();
}

async function ensureAgencyLiveRoom(agencyId: string): Promise<string> {
  const agencySnap = await db.collection('agencies').doc(agencyId).get();
  if (!agencySnap.exists) {
    throw new HttpsError('not-found', 'الوكالة غير موجودة');
  }
  const agency = agencySnap.data()!;
  const ownerUid = String(agency.ownerUid ?? '');
  if (!ownerUid) {
    throw new HttpsError('failed-precondition', 'الوكالة بدون وكيل');
  }

  let roomId = agency.liveRoomId ? String(agency.liveRoomId) : '';
  if (roomId) {
    const existing = await rtdb.ref(`rooms/${roomId}`).once('value');
    if (existing.exists()) return roomId;
  }

  const ownerSnap = await db.collection('users').doc(ownerUid).get();
  const owner = ownerSnap.data() ?? {};
  const hostName = String(
    agency.ownerName ?? owner.profile?.displayName ?? owner.displayName ?? 'وكيل',
  );
  const hostAvatar = String(
    agency.ownerAvatar ?? owner.profile?.avatar ?? owner.avatar ?? agency.logo ?? '',
  );
  const banner = String(
    agency.banner ?? agency.logo ?? hostAvatar ?? `https://picsum.photos/seed/agency-${agencyId}/400/200`,
  );

  const newRef = rtdb.ref('rooms').push();
  roomId = newRef.key!;
  const seatsCount = Number(agency.maxSeatsCount) || 9;
  const seats: Record<string, unknown> = {};
  for (let i = 0; i < seatsCount; i++) {
    if (i === 0) {
      seats[`seat_${i}`] = {
        uid: ownerUid,
        displayName: hostName,
        avatar: hostAvatar || `https://picsum.photos/seed/${ownerUid}/200`,
        isMuted: false,
        joinedAt: Date.now(),
      };
    } else {
      seats[`seat_${i}`] = { uid: '' };
    }
  }

  await newRef.set({
    name: String(agency.name ?? 'وكالة'),
    hostUid: ownerUid,
    hostName,
    hostAvatar: hostAvatar || `https://picsum.photos/seed/${ownerUid}/200`,
    country: String(agency.country ?? 'PS'),
    category: 'arabic',
    banner,
    isPrivate: false,
    password: '',
    seatsCount,
    maxSeatsCount: seatsCount,
    seats,
    audienceCount: 0,
    totalGifts: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isActive: true,
    agencyId,
    isAgencyRoom: true,
  });

  await agencySnap.ref.update({
    liveRoomId: roomId,
    updatedAt: Date.now(),
  });

  return roomId;
}

export async function updateOfficialAgencyBranding(
  agencyId: string,
  countryCode: string,
  agencyName?: string,
  logoUrl?: string | null,
  bannerUrl?: string | null,
): Promise<void> {
  const ref = db.collection('agencies').doc(agencyId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const patch: Record<string, unknown> = {
    isCountryOfficialAgency: true,
    countryOfficialFor: normalizeCountry(countryCode),
    status: 'active',
    isVerified: true,
    updatedAt: Date.now(),
  };
  if (agencyName?.trim()) patch.name = agencyName.trim();
  if (logoUrl?.trim()) {
    patch.logo = logoUrl.trim();
    patch.ownerAvatar = logoUrl.trim();
  }
  if (bannerUrl?.trim()) patch.banner = bannerUrl.trim();
  await ref.set(patch, { merge: true });
}

/** إنشاء وكالة رسمية جديدة لسوبر أدمن */
export async function createOfficialAgencyForSuperAdmin(params: {
  ownerUid: string;
  ownerName: string;
  ownerAvatar: string;
  agencyName: string;
  countryCode: string;
  logoUrl?: string;
  bannerUrl?: string;
}): Promise<string> {
  const country = normalizeCountry(params.countryCode);
  const name = params.agencyName.trim();
  if (!name) {
    throw new HttpsError('invalid-argument', 'اسم الوكالة مطلوب لسوبر أدمن');
  }

  const existing = await db
    .collection('agencies')
    .where('ownerUid', '==', params.ownerUid)
    .limit(1)
    .get();

  if (!existing.empty) {
    const agencyId = existing.docs[0].id;
    await updateOfficialAgencyBranding(
      agencyId,
      country,
      name,
      params.logoUrl,
      params.bannerUrl,
    );
    await ensureAgencyLiveRoom(agencyId);
    return agencyId;
  }

  const inviteCode = Math.random().toString(36).slice(2, 8).toLowerCase();
  const agencyRef = db.collection('agencies').doc();
  const now = Date.now();
  const logo = params.logoUrl?.trim() || params.ownerAvatar?.trim() || '';
  const banner =
    params.bannerUrl?.trim() ||
    logo ||
    `https://picsum.photos/seed/${agencyRef.id}/400/200`;

  const batch = db.batch();
  batch.set(agencyRef, {
    name,
    ownerUid: params.ownerUid,
    ownerName: params.ownerName,
    ownerAvatar: logo || params.ownerAvatar || '',
    description: 'وكالة رسمية — سوبر أدمن',
    country,
    inviteCode,
    memberCount: 0,
    members: 0,
    totalEarnings: 0,
    earnings: 0,
    rank: now % 10000,
    banner,
    logo,
    rating: 5,
    isHiring: true,
    isVerified: true,
    status: 'active',
    isCountryOfficialAgency: true,
    countryOfficialFor: country,
    isStaffOfficialAgency: true,
    createdAt: now,
    updatedAt: now,
  });

  batch.update(db.collection('users').doc(params.ownerUid), {
    agencyId: agencyRef.id,
    agencyName: name,
    agencyRole: 'owner',
    isAgent: true,
    accountKind: 'agent',
    staffAgencyId: agencyRef.id,
    updatedAt: now,
  });

  await batch.commit();
  await ensureAgencyLiveRoom(agencyRef.id);
  return agencyRef.id;
}
