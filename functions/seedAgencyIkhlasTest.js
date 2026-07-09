/**
 * بذر بيانات اختبار لوكالة اخلاص:
 * - 8 مضيفات بأرباح + مهام + معاملات
 * - روم الوكالة: حضور أونلاين + مقاعد على المايك
 *
 * الاستخدام:
 *   node seedAgencyIkhlasTest.js
 *   node seedAgencyIkhlasTest.js --room-only  # تحديث الروم والمشاهدين فقط
 */
const admin = require('firebase-admin');

const PROJECT_ID = 'linkup-dc45f';
const RTDB_URL = 'https://linkup-dc45f-default-rtdb.firebaseio.com';
const OWNER_UID = 'CFeeqcEzUoQ3rUbkIIWhiYrk9ih2';
const AGENCY_ID = 'wrjcn2FRGE7Qt8BIxn7b';
const AGENCY_NAME = 'وكالة اخلاص';
const PREFIX = 'test_ikhlas_host_';

admin.initializeApp({ projectId: PROJECT_ID, databaseURL: RTDB_URL });
const db = admin.firestore();
const rtdb = admin.database();

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const TEST_HOSTS = [
  { suffix: '01', name: 'سارة', publicId: '59100001', pearlsEarned: 185000, img: 11, milestones: 3, voicePaid: true, videoPaid: false, voiceComp: 2, pearls: 42000 },
  { suffix: '02', name: 'نور', publicId: '59100002', pearlsEarned: 92000, img: 12, milestones: 1, voicePaid: true, videoPaid: true, voiceComp: 1, pearls: 28000 },
  { suffix: '03', name: 'ليان', publicId: '59100003', pearlsEarned: 256000, img: 13, milestones: 4, voicePaid: true, videoPaid: true, voiceComp: 3, pearls: 65000 },
  { suffix: '04', name: 'مira', publicId: '59100004', pearlsEarned: 45000, img: 14, milestones: 0, voicePaid: false, videoPaid: false, voiceComp: 0, pearls: 12000 },
  { suffix: '05', name: 'رنا', publicId: '59100005', pearlsEarned: 310000, img: 15, milestones: 5, voicePaid: true, videoPaid: true, voiceComp: 2, pearls: 88000 },
  { suffix: '06', name: 'تالا', publicId: '59100006', pearlsEarned: 72000, img: 16, milestones: 2, voicePaid: false, videoPaid: true, voiceComp: 1, pearls: 19000 },
  { suffix: '07', name: 'دانا', publicId: '59100007', pearlsEarned: 128000, img: 17, milestones: 2, voicePaid: true, videoPaid: false, voiceComp: 0, pearls: 35000 },
  { suffix: '08', name: 'ياسمين', publicId: '59100008', pearlsEarned: 54000, img: 18, milestones: 1, voicePaid: false, videoPaid: false, voiceComp: 1, pearls: 9000 },
];

const SPECTATOR_PREFIX = 'test_ikhlas_spectator_';

/** مشاهدون فقط — في الروم أونلاين بدون مايك */
const ONLINE_SPECTATORS = [
  { uid: `${SPECTATOR_PREFIX}01`, name: 'أحمد', publicId: '59100091', img: 31, isVIP: true },
  { uid: `${SPECTATOR_PREFIX}02`, name: 'خالد', publicId: '59100092', img: 32, isVIP: false },
  { uid: `${SPECTATOR_PREFIX}03`, name: 'عمر', publicId: '59100093', img: 33, isVIP: false },
  { uid: `${SPECTATOR_PREFIX}04`, name: 'محمد', publicId: '59100094', img: 34, isVIP: true },
  { uid: `${SPECTATOR_PREFIX}05`, name: 'يوسف', publicId: '59100095', img: 35, isVIP: false },
  { uid: `${SPECTATOR_PREFIX}06`, name: 'كريم', publicId: '59100096', img: 36, isVIP: false },
  { uid: `${SPECTATOR_PREFIX}07`, name: 'طارق', publicId: '59100097', img: 37, isVIP: true },
  { uid: `${SPECTATOR_PREFIX}08`, name: 'سامي', publicId: '59100098', img: 38, isVIP: false },
  { uid: `${SPECTATOR_PREFIX}09`, name: 'رامي', publicId: '59100099', img: 39, isVIP: false },
  { uid: `${SPECTATOR_PREFIX}10`, name: 'فadi', publicId: '59100100', img: 40, isVIP: false },
  { uid: `${SPECTATOR_PREFIX}11`, name: 'وليد', publicId: '59100101', img: 41, isVIP: true },
  { uid: `${SPECTATOR_PREFIX}12`, name: 'حسين', publicId: '59100102', img: 42, isVIP: false },
  { uid: `${SPECTATOR_PREFIX}13`, name: 'مازن', publicId: '59100103', img: 43, isVIP: false },
  { uid: `${SPECTATOR_PREFIX}14`, name: 'باسل', publicId: '59100104', img: 44, isVIP: false },
  { uid: `${SPECTATOR_PREFIX}15`, name: 'جاد', publicId: '59100105', img: 45, isVIP: true },
  { uid: `${SPECTATOR_PREFIX}16`, name: 'نبيل', publicId: '59100106', img: 46, isVIP: false },
  { uid: `${SPECTATOR_PREFIX}17`, name: 'زiad', publicId: '59100107', img: 47, isVIP: false },
  { uid: `${SPECTATOR_PREFIX}18`, name: 'عادل', publicId: '59100108', img: 48, isVIP: false },
  { uid: `${SPECTATOR_PREFIX}19`, name: 'سهيل', publicId: '59100109', img: 49, isVIP: true },
  { uid: `${SPECTATOR_PREFIX}20`, name: 'فيصل', publicId: '59100110', img: 50, isVIP: false },
  { uid: `${SPECTATOR_PREFIX}21`, name: 'ليلى (مشاهدة)', publicId: '59100111', img: 51, isVIP: false },
  { uid: `${SPECTATOR_PREFIX}22`, name: 'هبة (مشاهدة)', publicId: '59100112', img: 52, isVIP: true },
  { uid: `${SPECTATOR_PREFIX}23`, name: 'مريم (مشاهدة)', publicId: '59100113', img: 53, isVIP: false },
  { uid: `${SPECTATOR_PREFIX}24`, name: 'آية (مشاهدة)', publicId: '59100114', img: 54, isVIP: false },
  { uid: `${SPECTATOR_PREFIX}25`, name: 'جنى (مشاهدة)', publicId: '59100115', img: 55, isVIP: false },
];

function hostUid(suffix) {
  return `${PREFIX}${suffix}`;
}

async function deletePreviousTestData() {
  console.log('🧹 تنظيف بيانات الاختبار السابقة...');
  const membersSnap = await db.collection('agencyMembers').where('agencyId', '==', AGENCY_ID).get();
  const batch = db.batch();
  let removed = 0;

  for (const doc of membersSnap.docs) {
    const uid = String(doc.data().uid ?? '');
    if (!uid.startsWith(PREFIX)) continue;
    batch.delete(doc.ref);
    removed++;
  }

  for (const h of TEST_HOSTS) {
    const uid = hostUid(h.suffix);
    batch.delete(db.collection('users').doc(uid));
    batch.delete(db.collection('publicAccountIndex').doc(h.publicId));
  }
  for (const s of ONLINE_SPECTATORS) {
    batch.delete(db.collection('users').doc(s.uid));
    batch.delete(db.collection('publicAccountIndex').doc(s.publicId));
  }

  await batch.commit();
  console.log(`   حُذف ${removed} عضوية + مستخدمين تجريبيين`);
}

async function seedHost(host, now) {
  const uid = hostUid(host.suffix);
  const avatar = `https://i.pravatar.cc/200?img=${host.img}`;

  const hostTasksProgress = {
    dateKey: todayKey(),
    messagesReceived: host.milestones * 1200,
    paidMessageMilestones: host.milestones,
    callSecondsByPartner: { voice: { partner_a: host.voicePaid ? 4200 : 0 }, video: { partner_b: host.videoPaid ? 3900 : 0 } },
    voiceCallRewardPaid: host.voicePaid,
    videoCallRewardPaid: host.videoPaid,
    voiceCompetitionMinutes: host.voiceComp * 12,
    paidVoiceCompMilestones: host.voiceComp,
    videoCompetitionSessions: host.videoPaid ? 12 : 0,
    paidVideoCompMilestones: host.videoPaid ? 1 : 0,
    onlineMinutes: 320,
    hasInteraction: true,
    onlineRewardPaid: true,
    coinsEarnedToday: host.milestones * 10000 + (host.voicePaid ? 50000 : 0),
  };

  await db.collection('users').doc(uid).set({
    uid,
    publicAccountId: host.publicId,
    displayName: host.name,
    avatar,
    gender: 'female',
    profile: { displayName: host.name, avatar, gender: 'female' },
    country: 'PS',
    agencyId: AGENCY_ID,
    agencyName: AGENCY_NAME,
    agencyRole: 'member',
    accountKind: 'host',
    isFemaleHost: true,
    hostVerified: true,
    isVerified: true,
    pearls: host.pearls,
    stats: { pearls: host.pearls, coins: 50000, level: 15 + Number(host.suffix), followers: 120, following: 40 },
    hostTasksProgress,
    userTitles: {
      owned: [{ titleId: 'traveler', obtainedAt: now - 86400000, expiresAt: null }],
      equipped: ['traveler', null, null, null, null, null, null, null, null],
    },
    level: 15 + Number(host.suffix),
    createdAt: now - 30 * 86400000,
    updatedAt: now,
    lastSeen: now,
    isTestSeed: true,
  }, { merge: true });

  await db.collection('publicAccountIndex').doc(host.publicId).set({ uid, updatedAt: now }, { merge: true });

  const existingMember = await db.collection('agencyMembers')
    .where('agencyId', '==', AGENCY_ID)
    .where('uid', '==', uid)
    .limit(1)
    .get();

  if (existingMember.empty) {
    await db.collection('agencyMembers').add({
      uid,
      uidName: host.name,
      uidAvatar: avatar,
      agencyId: AGENCY_ID,
      agencyName: AGENCY_NAME,
      role: 'host',
      isFemaleHost: true,
      hostVerified: true,
      pearlsEarned: host.pearlsEarned,
      pearlsTransferredToAgent: Math.floor(host.pearlsEarned * 0.15),
      joinedAt: now - 20 * 86400000,
      permissions: {
        allowSelfWithdraw: true,
        allowAgentWithdraw: true,
        allowTransferToAgent: true,
      },
      isTestSeed: true,
    });
  } else {
    await existingMember.docs[0].ref.update({
      pearlsEarned: host.pearlsEarned,
      uidName: host.name,
      uidAvatar: avatar,
      isFemaleHost: true,
      hostVerified: true,
    });
  }

  // معاملات دخل (آخر 7 أيام)
  for (let day = 0; day < 7; day++) {
    const ts = now - day * 86400000 - 3600000;
    const giftAmt = Math.floor(host.pearlsEarned / 14) + day * 500;
    await db.collection('transactions').add({
      uid,
      type: 'gift_received',
      amount: giftAmt,
      currency: 'pearls',
      agencyId: AGENCY_ID,
      fromUid: `test_gifter_${day}`,
      itemName: 'هدية اختبار',
      createdAt: ts,
      isTestSeed: true,
    });
    if (day % 2 === 0) {
      await db.collection('transactions').add({
        uid,
        type: 'call_earning',
        amount: Math.floor(giftAmt * 0.3),
        currency: 'pearls',
        agencyId: AGENCY_ID,
        callType: 'voice',
        createdAt: ts - 1800000,
        isTestSeed: true,
      });
    }
  }

  console.log(`   ✓ ${host.name} (${host.publicId}) — ${host.pearlsEarned.toLocaleString()} ماسة`);
  return { uid, name: host.name, avatar };
}

async function seedSpectator(spec, now) {
  const avatar = `https://i.pravatar.cc/200?img=${spec.img}`;
  await db.collection('users').doc(spec.uid).set({
    uid: spec.uid,
    publicAccountId: spec.publicId,
    displayName: spec.name,
    avatar,
    gender: spec.name.includes('مشاهدة') || spec.img >= 51 ? 'female' : 'male',
    profile: { displayName: spec.name, avatar, gender: 'male' },
    isVIP: spec.isVIP === true,
    vipLevel: spec.isVIP ? 2 : 0,
    stats: { coins: 5000 + spec.img * 100, pearls: 0, level: 3 + (spec.img % 10) },
    createdAt: now,
    updatedAt: now,
    lastSeen: now,
    isTestSeed: true,
    isSpectatorSeed: true,
  }, { merge: true });
  await db.collection('publicAccountIndex').doc(spec.publicId).set({ uid: spec.uid, updatedAt: now }, { merge: true });
  return { uid: spec.uid, name: spec.name, avatar, isVIP: spec.isVIP === true };
}

async function ensureAgencyRoom(ownerSnap, hostProfiles, now) {
  const agencyRef = db.collection('agencies').doc(AGENCY_ID);
  const agencySnap = await agencyRef.get();
  const agency = agencySnap.data() || {};
  const ownerData = ownerSnap.data() || {};

  let roomId = String(agency.liveRoomId ?? '');
  if (roomId) {
    const existing = await rtdb.ref(`rooms/${roomId}`).once('value');
    if (!existing.exists()) roomId = '';
  }

  const ownerName = String(ownerData.displayName ?? 'اخلاص');
  const ownerAvatar = String(ownerData.avatar ?? 'https://i.pravatar.cc/200?img=60');

  const seatsCount = 9;
  const seats = {};
  seats.seat_0 = {
    uid: OWNER_UID,
    displayName: ownerName,
    avatar: ownerAvatar,
    isMuted: false,
    joinedAt: now,
  };

  for (let i = 1; i < seatsCount; i++) {
    const host = hostProfiles[i - 1];
    if (host && i <= 5) {
      seats[`seat_${i}`] = {
        uid: host.uid,
        displayName: host.name,
        avatar: host.avatar,
        isMuted: i === 3,
        joinedAt: now - i * 60000,
      };
    } else {
      seats[`seat_${i}`] = { uid: '' };
    }
  }

  const roomPayload = {
    name: AGENCY_NAME,
    hostUid: OWNER_UID,
    hostName: ownerName,
    hostAvatar: ownerAvatar,
    country: 'PS',
    category: 'arabic',
    banner: ownerAvatar,
    isPrivate: false,
    password: '',
    seatsCount,
    seats,
    audienceCount: 0,
    totalGifts: 125000,
    createdAt: agency.createdAt || now,
    updatedAt: now,
    isActive: true,
    agencyId: AGENCY_ID,
    isAgencyRoom: true,
  };

  if (!roomId) {
    const newRef = rtdb.ref('rooms').push();
    roomId = newRef.key;
    await newRef.set(roomPayload);
    await agencyRef.update({ liveRoomId: roomId, updatedAt: now });
    console.log(`   🆕 روم جديد: ${roomId}`);
  } else {
    await rtdb.ref(`rooms/${roomId}`).update(roomPayload);
    console.log(`   ♻️ تحديث الروم: ${roomId}`);
  }

  // حضور أونلاين — الوكيل + كل المضيفات + مشاهدون (بدون مايك)
  const audienceUpdates = {};
  const spectatorProfiles = await Promise.all(ONLINE_SPECTATORS.map((s) => seedSpectator(s, now)));

  // على المايك فقط: seat_0..5 (الوكيل + 5 مضيفات) — الباقي مشاهدة فقط
  const micUids = new Set([
    OWNER_UID,
    ...hostProfiles.slice(0, 5).map((h) => h.uid),
  ]);

  const audienceOnlyHosts = hostProfiles.slice(5).map((h) => ({ ...h, audienceOnly: true }));

  const allOnline = [
    { uid: OWNER_UID, name: ownerName, avatar: ownerAvatar },
    ...hostProfiles,
    ...spectatorProfiles,
  ];

  let micCount = 0;
  let spectatorCount = 0;

  for (const p of allOnline) {
    const onMic = micUids.has(p.uid);
    if (!onMic) spectatorCount += 1;
    else micCount += 1;

    audienceUpdates[p.uid] = {
      uid: p.uid,
      name: p.name,
      avatar: p.avatar,
      joinedAt: now - Math.floor(Math.random() * 7200000),
      ...(p.isVIP ? { isVIP: true } : {}),
      ...(onMic ? { onMic: true } : { audienceOnly: true }),
    };
  }

  await rtdb.ref(`roomAudience/${roomId}`).set(audienceUpdates);
  await rtdb.ref(`rooms/${roomId}/audienceCount`).set(allOnline.length);

  const presenceUpdates = {};
  const userPresenceUpdates = {};
  for (const p of allOnline) {
    presenceUpdates[p.uid] = { roomId, online: true, updatedAt: now };
    userPresenceUpdates[p.uid] = {
      currentRoomId: roomId,
      roomName: AGENCY_NAME,
      since: now - Math.floor(Math.random() * 3600000),
      online: true,
    };
  }
  await rtdb.ref('presence').update(presenceUpdates);
  await rtdb.ref('userPresence').update(userPresenceUpdates);

  console.log(`   👥 أونلاين: ${allOnline.length} (${micCount} على المايك، ${spectatorCount} مشاهدة فقط)`);
  console.log(`   🎧 مضيفات مشاهدة فقط: ${audienceOnlyHosts.map((h) => h.name).join('، ') || '—'}`);

  return roomId;
}

async function loadExistingHostProfiles(now) {
  const profiles = [];
  for (const h of TEST_HOSTS) {
    const uid = hostUid(h.suffix);
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) continue;
    const d = snap.data();
    profiles.push({
      uid,
      name: String(d.displayName ?? h.name),
      avatar: String(d.avatar ?? `https://i.pravatar.cc/200?img=${h.img}`),
    });
  }
  return profiles;
}

async function main() {
  const reset = process.argv.includes('--reset');
  const roomOnly = process.argv.includes('--room-only');
  const now = Date.now();

  console.log('═══════════════════════════════════════');
  console.log('  بذر بيانات وكالة اخلاص للاختبار');
  console.log('═══════════════════════════════════════');

  const ownerSnap = await db.collection('users').doc(OWNER_UID).get();
  if (!ownerSnap.exists) {
    console.error('❌ الوكيل غير موجود');
    process.exit(1);
  }

  if (reset) await deletePreviousTestData();

  let hostProfiles = [];
  if (roomOnly) {
    console.log('\n👀 تحديث المشاهدين والروم فقط...');
    hostProfiles = await loadExistingHostProfiles(now);
    if (hostProfiles.length === 0) {
      console.error('❌ لا توجد مضيفات — شغّل السكربت بدون --room-only أولاً');
      process.exit(1);
    }
  } else {
    console.log('\n👩 إضافة/تحديث المضيفات...');
    for (const h of TEST_HOSTS) {
      hostProfiles.push(await seedHost(h, now));
    }

    const femaleCount = TEST_HOSTS.length;
    await db.collection('agencies').doc(AGENCY_ID).set({
      name: AGENCY_NAME,
      ownerUid: OWNER_UID,
      ownerName: 'اخلاص',
      status: 'active',
      memberCount: femaleCount,
      members: femaleCount,
      femaleHostCount: femaleCount,
      minHostsRequired: 10,
      isVerified: true,
      updatedAt: now,
    }, { merge: true });
  }

  console.log('\n🎙️ إعداد روم الوكالة...');
  const roomId = await ensureAgencyRoom(ownerSnap, hostProfiles, now);

  const spectatorTotal = ONLINE_SPECTATORS.length;
  const onlineTotal = 1 + hostProfiles.length + spectatorTotal;

  console.log('\n✅ تم بنجاح!');
  console.log(`   الوكالة: ${AGENCY_ID}`);
  console.log(`   Room ID: ${roomId}`);
  console.log(`   على المايك: 6 (وكيل + 5 مضيفات)`);
  console.log(`   مشاهدون فقط: ${3 + spectatorTotal} (3 مضيفات + ${spectatorTotal} زائر)`);
  console.log(`   إجمالي أونلاين: ${onlineTotal}`);
  console.log(`   افتح: /room/${roomId}`);
  if (!roomOnly) {
    console.log('\n   IDs المضيفات:');
    TEST_HOSTS.forEach((h) => console.log(`   - ${h.name}: ${h.publicId}`));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
