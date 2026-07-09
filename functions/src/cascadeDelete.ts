/**
 * حذف متسلسل كامل من Firestore / RTDB / Storage عند الحذف من لوحة التحكم.
 */
import * as admin from 'firebase-admin';

function getDb() {
  return admin.firestore();
}

function getRtdb() {
  return admin.database();
}

export const USER_AGENCY_UNLINK_PATCH = {
  agencyRole: admin.firestore.FieldValue.delete(),
  agencyId: admin.firestore.FieldValue.delete(),
  agencyName: admin.firestore.FieldValue.delete(),
  isFemaleHost: admin.firestore.FieldValue.delete(),
  isAgent: false,
  accountKind: 'user',
};

const USER_SUBCOLLECTIONS = ['blocked', 'favoriteRooms', 'recentRooms'] as const;
const POST_SUBCOLLECTIONS = ['comments', 'likes', 'shares'] as const;

const AGENCY_ANALYTICS_PERIODS = ['week', 'last_week', '4weeks_day', '4weeks_week'] as const;
const AGENCY_ANALYTICS_DATA_TYPES = ['income', 'people'] as const;
const AGENCY_ANALYTICS_INCOME_FILTERS = ['all', 'chat', 'gifts', 'calls', 'refund', 'other'] as const;

/** حذف مستندات Firestore بشرط equality — مع ترقيم الصفحات */
export async function deleteFirestoreWhere(
  collectionName: string,
  field: string,
  value: string,
): Promise<number> {
  let deleted = 0;
  for (;;) {
    const snap = await getDb().collection(collectionName).where(field, '==', value).limit(400).get();
    if (snap.empty) break;
    const batch = getDb().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < 400) break;
  }
  return deleted;
}

async function deleteSubcollection(
  docRef: FirebaseFirestore.DocumentReference,
  subName: string,
): Promise<void> {
  for (;;) {
    const snap = await docRef.collection(subName).limit(400).get();
    if (snap.empty) break;
    const batch = getDb().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < 400) break;
  }
}

async function deleteStoragePrefix(prefix: string): Promise<void> {
  try {
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({ prefix });
    await Promise.all(files.map((f) => f.delete().catch(() => {})));
  } catch {
    // ignore
  }
}

async function deleteUserStorage(uid: string): Promise<void> {
  const prefixes = [
    `avatars/${uid}/`,
    `posts/${uid}/`,
    `albums/${uid}/`,
    `banners/${uid}/`,
    `kyc/${uid}/`,
    `report_attachments/${uid}/`,
  ];
  await Promise.all(prefixes.map((p) => deleteStoragePrefix(p)));
}

async function deleteAgencyAnalyticsCache(agencyId: string): Promise<void> {
  const batch = getDb().batch();
  let count = 0;
  for (const period of AGENCY_ANALYTICS_PERIODS) {
    for (const dataType of AGENCY_ANALYTICS_DATA_TYPES) {
      for (const incomeType of AGENCY_ANALYTICS_INCOME_FILTERS) {
        batch.delete(getDb().collection('agencyAnalyticsCache').doc(`${agencyId}__${period}__${dataType}__${incomeType}`));
        count += 1;
        if (count >= 400) {
          await batch.commit();
          count = 0;
        }
      }
    }
  }
  if (count > 0) await batch.commit();
}

async function deleteRtdbRoom(roomId: string): Promise<void> {
  await Promise.all([
    getRtdb().ref(`rooms/${roomId}`).remove().catch(() => {}),
    getRtdb().ref(`roomMessages/${roomId}`).remove().catch(() => {}),
    getRtdb().ref(`roomAudience/${roomId}`).remove().catch(() => {}),
    getRtdb().ref(`roomSeatHold/${roomId}`).remove().catch(() => {}),
  ]);
}

async function deleteUserHostedRtdbRooms(uid: string): Promise<void> {
  const snap = await getRtdb().ref('rooms').once('value');
  const rooms = snap.val() as Record<string, { hostUid?: string }> | null;
  if (!rooms) return;
  await Promise.all(
    Object.entries(rooms)
      .filter(([, data]) => String(data?.hostUid ?? '') === uid)
      .map(([roomId]) => deleteRtdbRoom(roomId)),
  );
}

async function removeUidFromRtdbAudience(uid: string): Promise<void> {
  const snap = await getRtdb().ref('roomAudience').once('value');
  const all = snap.val() as Record<string, Record<string, unknown>> | null;
  if (!all) return;
  await Promise.all(
    Object.keys(all).map((roomId) => getRtdb().ref(`roomAudience/${roomId}/${uid}`).remove().catch(() => {})),
  );
}

export async function deletePostCascade(postId: string): Promise<void> {
  if (!postId) return;
  const postRef = getDb().collection('posts').doc(postId);
  for (const sub of POST_SUBCOLLECTIONS) {
    await deleteSubcollection(postRef, sub);
  }
  await deleteFirestoreWhere('shareLinks', 'targetId', postId).catch(() => {});
  await postRef.delete().catch(() => {});
}

async function deleteUserPosts(uid: string): Promise<void> {
  for (;;) {
    const snap = await getDb().collection('posts').where('uid', '==', uid).limit(50).get();
    if (snap.empty) break;
    await Promise.all(snap.docs.map((d) => deletePostCascade(d.id)));
    if (snap.size < 50) break;
  }
}

async function deleteUserConversations(uid: string): Promise<void> {
  for (;;) {
    const snap = await getDb().collection('conversations').where('participants', 'array-contains', uid).limit(50).get();
    if (snap.empty) break;
    for (const convDoc of snap.docs) {
      await deleteFirestoreWhere('messages', 'conversationId', convDoc.id);
      await convDoc.ref.delete().catch(() => {});
    }
    if (snap.size < 50) break;
  }
}

async function deleteUserProfileVisitors(uid: string): Promise<void> {
  const asProfile = getDb().collection('profileVisitors').doc(uid);
  await deleteSubcollection(asProfile, 'visits');
  await asProfile.delete().catch(() => {});
}

async function deleteIncomingCalls(uid: string): Promise<void> {
  await deleteSubcollection(getDb().collection('incomingCalls').doc(uid), 'calls');
  await getDb().collection('incomingCalls').doc(uid).delete().catch(() => {});
}

async function clearAgencyReferrals(aid: string): Promise<void> {
  for (;;) {
    const snap = await getDb().collection('agencies').where('referredByAgencyId', '==', aid).limit(100).get();
    if (snap.empty) break;
    const batch = getDb().batch();
    snap.docs.forEach((d) => {
      batch.update(d.ref, {
        referredByAgencyId: admin.firestore.FieldValue.delete(),
        referredByUid: admin.firestore.FieldValue.delete(),
        bdInviteId: admin.firestore.FieldValue.delete(),
        updatedAt: Date.now(),
      });
    });
    await batch.commit();
    if (snap.size < 100) break;
  }
}

export interface PurgeAgencyResult {
  deleted: boolean;
  agencyName: string;
  affectedUids: Set<string>;
  liveRoomId: string;
}

/** حذف وكالة وجميع بياناتها المرتبطة */
export async function purgeAgencyCascade(agencyId: string): Promise<PurgeAgencyResult> {
  const aid = agencyId.trim();
  const empty: PurgeAgencyResult = {
    deleted: false,
    agencyName: '',
    affectedUids: new Set(),
    liveRoomId: '',
  };
  if (!aid) return empty;

  const agencyRef = getDb().collection('agencies').doc(aid);
  const agencySnap = await agencyRef.get();
  const agency = agencySnap.exists ? agencySnap.data()! : {};
  const agencyName = String(agency.name ?? 'الوكالة');
  const ownerUid = String(agency.ownerUid ?? '').trim();
  const liveRoomId = String(agency.liveRoomId ?? '').trim();
  const affectedUids = new Set<string>();
  if (ownerUid) affectedUids.add(ownerUid);

  for (;;) {
    const snap = await getDb().collection('agencyMembers').where('agencyId', '==', aid).limit(400).get();
    if (snap.empty) break;
    const batch = getDb().batch();
    snap.docs.forEach((d) => {
      const muid = String(d.data().uid ?? '').trim();
      if (muid) affectedUids.add(muid);
      batch.delete(d.ref);
    });
    await batch.commit();
    if (snap.size < 400) break;
  }

  await Promise.all(
    Array.from(affectedUids).map(async (uid) => {
      const userRef = getDb().collection('users').doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) return;
      const userData = userSnap.data()!;
      const patch: Record<string, unknown> = { ...USER_AGENCY_UNLINK_PATCH };
      if (String(userData.staffAgencyId ?? '') === aid) {
        patch.staffAgencyId = admin.firestore.FieldValue.delete();
        patch.staffAgencyName = admin.firestore.FieldValue.delete();
      }
      await userRef.update(patch).catch(() => {});
    }),
  );

  await deleteSubcollection(agencyRef, 'removedMembers');

  const chatSnap = await getDb().collection('agencyChats').doc(aid).get();
  if (chatSnap.exists) {
    await deleteFirestoreWhere('agencyChatMessages', 'chatId', aid);
    await chatSnap.ref.delete().catch(() => {});
  }

  await deleteFirestoreWhere('agencyInvites', 'agencyId', aid);
  await deleteFirestoreWhere('agencyInvites', 'fromAgencyId', aid);
  await deleteFirestoreWhere('agencyApplications', 'agencyId', aid);
  await deleteFirestoreWhere('agencySeatRequests', 'agencyId', aid);
  await deleteFirestoreWhere('agencyPartyRequests', 'agencyId', aid);
  await deleteFirestoreWhere('agencyRefunds', 'agencyId', aid);
  await deleteFirestoreWhere('agencyEarnings', 'agencyId', aid);
  await deleteFirestoreWhere('bdInvites', 'fromAgencyId', aid);
  await deleteFirestoreWhere('bdInvites', 'agencyId', aid);
  await deleteFirestoreWhere('transactions', 'agencyId', aid);
  await deleteFirestoreWhere('shareLinks', 'targetId', aid);

  await deleteAgencyAnalyticsCache(aid);
  await clearAgencyReferrals(aid);

  if (liveRoomId) {
    await deleteRtdbRoom(liveRoomId);
  }

  if (agencySnap.exists) {
    await agencyRef.delete();
  }

  return { deleted: true, agencyName, affectedUids, liveRoomId };
}

/** حذف مستخدم التطبيق وجميع بياناته المرتبطة */
export async function purgeUserCascade(uid: string): Promise<void> {
  const trimmed = uid.trim();
  if (!trimmed) return;

  const userRef = getDb().collection('users').doc(trimmed);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data()! : null;
  const publicId = userData ? String(userData.publicAccountId ?? '').trim() : '';

  const ownedAgencies = await getDb().collection('agencies').where('ownerUid', '==', trimmed).limit(50).get();
  for (const agencyDoc of ownedAgencies.docs) {
    await purgeAgencyCascade(agencyDoc.id);
  }

  for (const sub of USER_SUBCOLLECTIONS) {
    await deleteSubcollection(userRef, sub);
  }

  await deleteUserPosts(trimmed);
  await deleteUserConversations(trimmed);
  await deleteUserProfileVisitors(trimmed);
  await deleteIncomingCalls(trimmed);
  await deleteUserHostedRtdbRooms(trimmed);
  await removeUidFromRtdbAudience(trimmed);

  const equalityDeletes: Array<[string, string]> = [
    ['agencyMembers', 'uid'],
    ['agencyInvites', 'invitedUid'],
    ['agencyInvites', 'fromUid'],
    ['agencyApplications', 'applicantUid'],
    ['matchQueue', 'uid'],
    ['notifications', 'uid'],
    ['transactions', 'uid'],
    ['gameTransactions', 'uid'],
    ['withdrawals', 'uid'],
    ['inventory', 'uid'],
    ['lotteryTickets', 'uid'],
    ['rechargeRequests', 'uid'],
    ['follows', 'follower'],
    ['follows', 'followed'],
    ['relationships', 'user1Uid'],
    ['relationships', 'user2Uid'],
    ['reports', 'reporterUid'],
    ['reports', 'targetUid'],
    ['callSessions', 'callerUid'],
    ['callSessions', 'calleeUid'],
    ['voiceBios', 'uid'],
    ['roomEntryNotifications', 'forUid'],
    ['roomEntryNotifications', 'fromUid'],
    ['shareLinks', 'createdBy'],
    ['bdInvites', 'fromUid'],
    ['bdInvites', 'invitedUid'],
    ['agencyRefunds', 'hostUid'],
    ['agencyRefunds', 'supporterUid'],
  ];
  for (const [col, field] of equalityDeletes) {
    await deleteFirestoreWhere(col, field, trimmed);
  }

  await getDb().collection('gameMatchQueue').doc(trimmed).delete().catch(() => {});

  for (const field of ['challengerId', 'challengedId'] as const) {
    await deleteFirestoreWhere('gameChallenges', field, trimmed);
  }

  for (;;) {
    const snap = await getDb().collection('matches').where('participants', 'array-contains', trimmed).limit(200).get();
    if (snap.empty) break;
    const batch = getDb().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < 200) break;
  }

  await getDb().collection('kycRequests').doc(trimmed).delete().catch(() => {});
  await getDb().collection('accountDeletionRequests').doc(trimmed).delete().catch(() => {});
  await getDb().collection('adminUserCredentials').doc(trimmed).delete().catch(() => {});

  if (publicId) {
    await getDb().collection('publicAccountIndex').doc(publicId).delete().catch(() => {});
  }

  await userRef.delete().catch(() => {});

  await Promise.all([
    getRtdb().ref(`presence/${trimmed}`).remove().catch(() => {}),
    getRtdb().ref(`userPresence/${trimmed}`).remove().catch(() => {}),
  ]);

  await deleteUserStorage(trimmed);

  await admin.auth().deleteUser(trimmed).catch((e: { code?: string }) => {
    if (e?.code !== 'auth/user-not-found') throw e;
  });
}

async function deleteFirestoreCollectionAll(collectionName: string): Promise<number> {
  let cleared = 0;
  for (;;) {
    const snap = await getDb().collection(collectionName).limit(400).get();
    if (snap.empty) break;
    const batch = getDb().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    cleared += snap.size;
    if (snap.size < 400) break;
  }
  return cleared;
}

export type PurgeAllAgenciesResult = {
  deleted: number;
  failed: number;
  orphansCleared: number;
  orphanRoomsCleared: number;
  errors: string[];
};

/** حذف كل الوكالات وبياناتها + تنظيف اليتيم المتبقي */
export async function purgeAllAgencies(): Promise<PurgeAllAgenciesResult> {
  let deleted = 0;
  let failed = 0;
  const errors: string[] = [];

  for (;;) {
    const snap = await getDb().collection('agencies').limit(25).get();
    if (snap.empty) break;
    for (const agencyDoc of snap.docs) {
      try {
        const result = await purgeAgencyCascade(agencyDoc.id);
        if (result.deleted) deleted += 1;
      } catch (e) {
        failed += 1;
        const msg = e instanceof Error ? e.message : String(e);
        if (errors.length < 20) errors.push(`${agencyDoc.id}: ${msg}`);
      }
    }
  }

  const orphanCollections = [
    'agencyMembers',
    'agencyApplications',
    'agencyInvites',
    'agencySeatRequests',
    'agencyPartyRequests',
    'agencyRefunds',
    'agencyEarnings',
    'agencyChats',
    'agencyChatMessages',
    'agencyAnalyticsCache',
    'bdInvites',
  ];

  let orphansCleared = 0;
  for (const col of orphanCollections) {
    orphansCleared += await deleteFirestoreCollectionAll(col).catch(() => 0);
  }

  let orphanRoomsCleared = 0;
  const roomsSnap = await getRtdb().ref('rooms').once('value');
  const rooms = roomsSnap.val() as Record<
    string,
    { agencyId?: string; isAgencyRoom?: boolean }
  > | null;
  if (rooms) {
    const agencyRoomIds = Object.entries(rooms)
      .filter(([, data]) => {
        if (!data) return false;
        if (data.isAgencyRoom === true) return true;
        return String(data.agencyId ?? '').trim().length > 0;
      })
      .map(([roomId]) => roomId);
    await Promise.all(
      agencyRoomIds.map((roomId) =>
        deleteRtdbRoom(roomId).then(() => {
          orphanRoomsCleared += 1;
        }),
      ),
    );
  }

  return { deleted, failed, orphansCleared, orphanRoomsCleared, errors };
}
