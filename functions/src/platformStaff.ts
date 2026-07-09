/**
 * موظفو التطبيق — إنشاء/تعديل من لوحة التحكم
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getDefaultProfileMedia } from './defaultAvatars';
import {
  createOfficialAgencyForSuperAdmin,
  updateOfficialAgencyBranding,
} from './staffAgency';

const db = admin.firestore();

function generatePublicAccountId(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) {
    h = (Math.imul(31, h) + uid.charCodeAt(i)) >>> 0;
  }
  return String(h % 100_000_000).padStart(8, '0');
}

async function syncPublicAccountIndexForUid(publicId: string, uid: string): Promise<void> {
  await db.collection('publicAccountIndex').doc(publicId).set({ uid, updatedAt: Date.now() });
}

type StaffRole = 'manager' | 'super_admin' | 'admin';

function normalizeCountry(code?: string | null): string {
  return String(code ?? '').trim().toUpperCase();
}

async function assertAdmin(uid: string): Promise<FirebaseFirestore.DocumentData> {
  const snap = await db.collection('admins').doc(uid).get();
  if (!snap.exists) throw new HttpsError('permission-denied', 'صلاحية أدمن مطلوبة');
  return snap.data()!;
}

async function assertSuperAdmin(uid: string): Promise<void> {
  const data = await assertAdmin(uid);
  const role = data.role;
  if (role && role !== 'super') {
    throw new HttpsError('permission-denied', 'هذه العملية لمدير النظام فقط');
  }
}

async function assertCanManageStaff(
  adminUid: string,
  targetRole: StaffRole,
  targetCountries: string[],
): Promise<FirebaseFirestore.DocumentData> {
  const adminData = await assertAdmin(adminUid);
  if (adminData.role === 'super') return adminData;

  if (targetRole === 'manager') {
    throw new HttpsError('permission-denied', 'إنشاء المانيجر لمدير النظام فقط');
  }

  const perms = (adminData.permissions ?? {}) as Record<string, boolean>;
  if (perms.users !== true) {
    throw new HttpsError('permission-denied', 'لا تملك صلاحية إدارة المستخدمين');
  }

  const allowed = ((adminData.countries as string[]) ?? []).map(normalizeCountry);
  for (const c of targetCountries) {
    if (c && !allowed.includes(c)) {
      throw new HttpsError('permission-denied', `الدولة ${c} خارج نطاقك`);
    }
  }
  return adminData;
}

async function syncCountryOfficialAgency(
  agencyId: string | null | undefined,
  countryCode: string,
  enabled: boolean,
): Promise<void> {
  if (!agencyId?.trim()) return;
  const ref = db.collection('agencies').doc(agencyId.trim());
  const snap = await ref.get();
  if (!snap.exists) return;
  if (enabled) {
    await ref.set(
      {
        isCountryOfficialAgency: true,
        countryOfficialFor: normalizeCountry(countryCode),
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  } else {
    const data = snap.data() ?? {};
    if (data.countryOfficialFor === normalizeCountry(countryCode)) {
      await ref.set(
        {
          isCountryOfficialAgency: false,
          countryOfficialFor: admin.firestore.FieldValue.delete(),
          updatedAt: Date.now(),
        },
        { merge: true },
      );
    }
  }
}

/** إنشاء حساب موظف تطبيق */
export const adminCreateStaffUser = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const {
    email,
    password,
    displayName,
    gender = 'female',
    country = 'PS',
    staffRole,
    staffCountries = [],
    avatar,
    staffFrameUrl,
    staffBadgeUrl,
    staffEntryVideoUrl,
    staffEntryVideoUrlMp4,
    staffAgencyId,
    staffAgencyName,
    staffAgencyLogo,
    staffAgencyBanner,
  } = request.data as {
    email?: string;
    password?: string;
    displayName?: string;
    gender?: 'male' | 'female';
    country?: string;
    staffRole?: StaffRole;
    staffCountries?: string[];
    avatar?: string;
    staffFrameUrl?: string;
    staffBadgeUrl?: string;
    staffEntryVideoUrl?: string;
    staffEntryVideoUrlMp4?: string;
    staffAgencyId?: string;
    staffAgencyName?: string;
    staffAgencyLogo?: string;
    staffAgencyBanner?: string;
  };

  if (!staffRole || !['manager', 'super_admin', 'admin'].includes(staffRole)) {
    throw new HttpsError('invalid-argument', 'نوع الموظف مطلوب');
  }
  if (!email?.trim() || !password || password.length < 6) {
    throw new HttpsError('invalid-argument', 'بريد وكلمة مرور (6+ أحرف) مطلوبان');
  }
  if (!displayName?.trim()) {
    throw new HttpsError('invalid-argument', 'الاسم مطلوب');
  }

  const countryCode = normalizeCountry(country);
  const countries =
    staffRole === 'manager'
      ? []
      : (Array.isArray(staffCountries) ? staffCountries : [countryCode])
          .map(normalizeCountry)
          .filter(Boolean);

  if (staffRole !== 'manager' && countries.length === 0) {
    throw new HttpsError('invalid-argument', 'حدّد دولة واحدة على الأقل');
  }
  if (staffRole === 'super_admin' && !staffAgencyName?.trim() && !staffAgencyId?.trim()) {
    throw new HttpsError('invalid-argument', 'سوبر أدمن يحتاج اسم وكالة أو ربط وكالة موجودة');
  }

  await assertCanManageStaff(adminUid, staffRole, countries);

  let newUid: string;
  try {
    const u = await admin.auth().createUser({
      email: email.trim().toLowerCase(),
      password,
      displayName: displayName.trim(),
    });
    newUid = u.uid;
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message ?? 'تعذّر إنشاء حساب Auth';
    throw new HttpsError('invalid-argument', msg);
  }

  const publicAccountId = generatePublicAccountId(newUid);
  const { avatar: defaultAvatar, photos } = getDefaultProfileMedia(gender);
  const avatarUrl = avatar?.trim() || defaultAvatar;

  await db.collection('users').doc(newUid).set({
    uid: newUid,
    publicAccountId,
    email: email.trim().toLowerCase(),
    displayName: displayName.trim(),
    avatar: avatarUrl,
    bio: 'موظف منصة LinkUp',
    gender,
    country: countryCode,
    photos,
    stats: { coins: 0, pearls: 0, casinoCoins: 0, level: 1, xp: 0, followers: 0, following: 0, visitors: 0, totalRoomsCreated: 0 },
    coins: 0,
    pearls: 0,
    casinoCoins: 0,
    level: 1,
    isVerified: true,
    staffRole,
    staffCountries: countries,
    staffFrameUrl: staffFrameUrl?.trim() || null,
    staffBadgeUrl: staffBadgeUrl?.trim() || null,
    staffEntryVideoUrl: staffEntryVideoUrl?.trim() || null,
    staffEntryVideoUrlMp4: staffEntryVideoUrlMp4?.trim() || null,
    staffAgencyId: staffAgencyId?.trim() || null,
    staffActive: true,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    createdByAdmin: adminUid,
    createdAsStaff: true,
  });

  await syncPublicAccountIndexForUid(publicAccountId, newUid);

  let linkedAgencyId = staffAgencyId?.trim() || null;
  const staffCountry = countries[0] ?? countryCode;

  if (staffRole === 'super_admin' && staffAgencyName?.trim()) {
    linkedAgencyId = await createOfficialAgencyForSuperAdmin({
      ownerUid: newUid,
      ownerName: displayName.trim(),
      ownerAvatar: avatarUrl,
      agencyName: staffAgencyName.trim(),
      countryCode: staffCountry,
      logoUrl: staffAgencyLogo?.trim(),
      bannerUrl: staffAgencyBanner?.trim(),
    });
    await db.collection('users').doc(newUid).update({
      staffAgencyId: linkedAgencyId,
      staffAgencyName: staffAgencyName.trim(),
      updatedAt: Date.now(),
    });
  } else if (staffRole === 'super_admin' && linkedAgencyId) {
    await syncCountryOfficialAgency(linkedAgencyId, staffCountry, true);
    await db.collection('users').doc(newUid).update({
      staffAgencyId: linkedAgencyId,
      updatedAt: Date.now(),
    });
  }

  return {
    ok: true,
    uid: newUid,
    publicAccountId,
    displayName: displayName.trim(),
    agencyId: linkedAgencyId ?? undefined,
  };
});

/** ترقية مستخدم موجود إلى موظف أو تعديل بياناته */
export const adminUpdateStaffUser = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');

  const {
    uid,
    staffRole,
    staffCountries,
    staffFrameUrl,
    staffBadgeUrl,
    staffEntryVideoUrl,
    staffEntryVideoUrlMp4,
    staffAgencyId,
    staffAgencyName,
    staffAgencyLogo,
    staffAgencyBanner,
    staffActive,
    avatar,
    displayName,
  } = request.data as {
    uid?: string;
    staffRole?: StaffRole | null;
    staffCountries?: string[];
    staffFrameUrl?: string | null;
    staffBadgeUrl?: string | null;
    staffEntryVideoUrl?: string | null;
    staffEntryVideoUrlMp4?: string | null;
    staffAgencyId?: string | null;
    staffAgencyName?: string | null;
    staffAgencyLogo?: string | null;
    staffAgencyBanner?: string | null;
    staffActive?: boolean;
    avatar?: string;
    displayName?: string;
  };

  if (!uid?.trim()) throw new HttpsError('invalid-argument', 'uid مطلوب');

  const userRef = db.collection('users').doc(uid.trim());
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');

  const existing = userSnap.data()!;
  const nextRole = (staffRole ?? existing.staffRole) as StaffRole | null | undefined;
  const nextCountries =
    staffCountries !== undefined
      ? staffCountries.map(normalizeCountry).filter(Boolean)
      : ((existing.staffCountries as string[]) ?? []).map(normalizeCountry);

  if (nextRole && nextRole !== 'manager' && nextCountries.length === 0) {
    throw new HttpsError('invalid-argument', 'حدّد دولة واحدة على الأقل');
  }

  if (nextRole) {
    await assertCanManageStaff(adminUid, nextRole, nextCountries);
  } else {
    await assertSuperAdmin(adminUid);
  }

  const update: Record<string, unknown> = { updatedAt: Date.now() };
  if (staffRole !== undefined) {
    if (staffRole === null) {
      update.staffRole = admin.firestore.FieldValue.delete();
      update.staffCountries = admin.firestore.FieldValue.delete();
      update.staffFrameUrl = admin.firestore.FieldValue.delete();
      update.staffBadgeUrl = admin.firestore.FieldValue.delete();
      update.staffEntryVideoUrl = admin.firestore.FieldValue.delete();
      update.staffEntryVideoUrlMp4 = admin.firestore.FieldValue.delete();
      update.staffAgencyId = admin.firestore.FieldValue.delete();
      update.staffActive = admin.firestore.FieldValue.delete();
    } else {
      update.staffRole = staffRole;
      update.staffCountries = staffRole === 'manager' ? [] : nextCountries;
    }
  } else if (staffCountries !== undefined && existing.staffRole !== 'manager') {
    update.staffCountries = nextCountries;
  }
  if (staffFrameUrl !== undefined) update.staffFrameUrl = staffFrameUrl?.trim() || null;
  if (staffBadgeUrl !== undefined) update.staffBadgeUrl = staffBadgeUrl?.trim() || null;
  if (staffEntryVideoUrl !== undefined) update.staffEntryVideoUrl = staffEntryVideoUrl?.trim() || null;
  if (staffEntryVideoUrlMp4 !== undefined) {
    update.staffEntryVideoUrlMp4 = staffEntryVideoUrlMp4?.trim() || null;
  }
  if (staffAgencyId !== undefined) update.staffAgencyId = staffAgencyId?.trim() || null;
  if (staffAgencyName !== undefined) update.staffAgencyName = staffAgencyName?.trim() || null;
  if (typeof staffActive === 'boolean') update.staffActive = staffActive;
  if (avatar?.trim()) update.avatar = avatar.trim();
  if (displayName?.trim()) update.displayName = displayName.trim();

  await userRef.set(update, { merge: true });

  const role = (staffRole ?? existing.staffRole) as StaffRole | undefined;
  const cc = nextCountries[0] ?? normalizeCountry(existing.country);
  let agencyId = (staffAgencyId ?? existing.staffAgencyId) as string | undefined;

  if (role === 'super_admin') {
    if (staffAgencyName?.trim()) {
      if (agencyId) {
        await updateOfficialAgencyBranding(
          agencyId,
          cc,
          staffAgencyName.trim(),
          staffAgencyLogo ?? undefined,
          staffAgencyBanner ?? undefined,
        );
      } else {
        agencyId = await createOfficialAgencyForSuperAdmin({
          ownerUid: uid.trim(),
          ownerName: (displayName ?? existing.displayName ?? 'سوبر أدمن') as string,
          ownerAvatar: (avatar ?? existing.avatar ?? '') as string,
          agencyName: staffAgencyName.trim(),
          countryCode: cc,
          logoUrl: staffAgencyLogo?.trim() ?? undefined,
          bannerUrl: staffAgencyBanner?.trim() ?? undefined,
        });
        await userRef.set({ staffAgencyId: agencyId, staffAgencyName: staffAgencyName.trim() }, { merge: true });
      }
    } else if (agencyId) {
      await updateOfficialAgencyBranding(
        agencyId,
        cc,
        undefined,
        staffAgencyLogo ?? undefined,
        staffAgencyBanner ?? undefined,
      );
      await syncCountryOfficialAgency(agencyId, cc, staffActive !== false);
    }
  }

  return { ok: true, agencyId: agencyId ?? undefined };
});

/** إزالة صلاحيات الموظف */
export const adminRemoveStaffUser = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  await assertSuperAdmin(adminUid);

  const { uid } = request.data as { uid?: string };
  if (!uid?.trim()) throw new HttpsError('invalid-argument', 'uid مطلوب');

  const userRef = db.collection('users').doc(uid.trim());
  const snap = await userRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود');

  const data = snap.data()!;
  if (data.staffAgencyId && data.staffRole === 'super_admin') {
    await syncCountryOfficialAgency(
      String(data.staffAgencyId),
      normalizeCountry((data.staffCountries as string[])?.[0] ?? data.country),
      false,
    );
  }

  await userRef.set(
    {
      staffRole: admin.firestore.FieldValue.delete(),
      staffCountries: admin.firestore.FieldValue.delete(),
      staffFrameUrl: admin.firestore.FieldValue.delete(),
      staffBadgeUrl: admin.firestore.FieldValue.delete(),
      staffEntryVideoUrl: admin.firestore.FieldValue.delete(),
      staffEntryVideoUrlMp4: admin.firestore.FieldValue.delete(),
      staffAgencyId: admin.firestore.FieldValue.delete(),
      staffActive: admin.firestore.FieldValue.delete(),
      updatedAt: Date.now(),
    },
    { merge: true },
  );

  return { ok: true };
});
