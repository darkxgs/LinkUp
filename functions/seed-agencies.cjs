/* eslint-disable no-console */
/**
 * Seed script — وكالات حقيقية + أعضاء حقيقيون + طلبات انضمام، لاختبار السيناريو كاملاً.
 *
 * يُنشئ:
 *  - حسابات Auth حقيقية (يمكن تسجيل الدخول بها) + وثائق users بأرصدة
 *  - وكالات مفعّلة وموثّقة (مالك + مضيفات موثّقات + أعضاء)
 *  - وثائق agencyMembers مطابقة لما تنشئه Cloud Functions
 *  - معاملات هدايا/مكالمات حقيقية (تُفعّل trigger راتب الوكالة creditAgencyPearlsOnGift)
 *  - سحوبات للوكالة
 *  - طلبات فتح/انضمام (agencyApplications) بحالة pending للأدمن ليجرّب الموافقة
 *
 * التشغيل:
 *   cd linkup-functions/functions
 *   # تأكد من المصادقة: gcloud auth application-default login   (أو ضع serviceAccount.json هنا)
 *   node seed-agencies.cjs            # إضافة البيانات
 *   node seed-agencies.cjs --clean    # حذف كل البيانات المزروعة
 *
 * كل وثيقة مزروعة تحمل الحقل seeded:true ليسهل حذفها. كل الحسابات على نطاق @seed.linkup.test
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const PROJECT_ID = 'linkup-dc45f';
const EMAIL_DOMAIN = 'seed.linkup.test';
const PASSWORD = 'Linkup#12345';

// ==================== التهيئة ====================
function init() {
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, 'serviceAccount.json');
  if (fs.existsSync(saPath)) {
    admin.initializeApp({ credential: admin.credential.cert(require(saPath)), projectId: PROJECT_ID });
    console.log('🔑 مصادقة عبر serviceAccount:', saPath);
  } else {
    admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT_ID });
    console.log('🔑 مصادقة عبر Application Default Credentials');
  }
}
init();
const db = admin.firestore();
const auth = admin.auth();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];
const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

let pidCounter = 90000001;
const nextPid = () => String(pidCounter++);

// ==================== الإعداد ====================
const AGENCIES = [
  {
    key: 'nova', name: 'وكالة نوفا', country: 'SA',
    owner: { key: 'nova_owner', name: 'فهد المالك' },
    femaleHosts: [
      { key: 'nova_h1', name: 'سارة' },
      { key: 'nova_h2', name: 'لمى' },
      { key: 'nova_h3', name: 'جود' },
    ],
    maleMembers: [{ key: 'nova_m1', name: 'خالد' }],
  },
  {
    key: 'luna', name: 'وكالة لونا', country: 'AE',
    owner: { key: 'luna_owner', name: 'ريان المالك' },
    femaleHosts: [
      { key: 'luna_h1', name: 'ريم' },
      { key: 'luna_h2', name: 'دانة' },
    ],
    maleMembers: [{ key: 'luna_m1', name: 'عمر' }],
  },
];

// مستخدمون شاحنون (يرسلون الهدايا/يدفعون المكالمات)
const PAYERS = [
  { key: 'payer1', name: 'مشترك شاحن ١' },
  { key: 'payer2', name: 'مشترك شاحن ٢' },
  { key: 'payer3', name: 'مشترك شاحن ٣' },
];

// طلبات فتح/انضمام قيد المراجعة (تظهر في "طلبات فتح الوكالة" بالأدمن)
const APPLICATIONS = [
  {
    key: 'zen', agencyName: 'وكالة زِن', countryCode: 'SA',
    applicant: { key: 'zen_owner', name: 'مقدم طلب زِن' },
    proposedFemales: [
      { key: 'zen_p1', name: 'هند' },
      { key: 'zen_p2', name: 'نور' },
    ],
  },
];

const email = (key) => `${key}@${EMAIL_DOMAIN}`;

// ==================== مساعدو الكتابة ====================
async function ensureAuthUser(key, displayName) {
  const e = email(key);
  try {
    const u = await auth.getUserByEmail(e);
    return u.uid;
  } catch {
    const u = await auth.createUser({ email: e, password: PASSWORD, displayName });
    return u.uid;
  }
}

async function writeUserDoc(uid, opts) {
  const {
    displayName, gender, country, coins = 0, pearls = 0,
    agencyId = null, agencyName = null, agencyRole = null,
    isAgent = false, isFemaleHost = false, accountKind = 'user',
  } = opts;
  const avatar = `https://i.pravatar.cc/200?u=${uid}`;
  await db.collection('users').doc(uid).set({
    displayName,
    avatar,
    profile: { displayName, avatar, gender, country, bio: '' },
    gender,
    country,
    email: email(opts.key),
    publicAccountId: opts.pid,
    stats: { coins, pearls, casinoCoins: 0, level: rand(1, 30), followers: rand(0, 500), following: rand(0, 200) },
    isVerified: true,
    isBanned: false,
    isVIP: false,
    agencyId: agencyId || admin.firestore.FieldValue.delete(),
    agencyName: agencyName || admin.firestore.FieldValue.delete(),
    agencyRole,
    isAgent,
    isFemaleHost,
    accountKind,
    createdAt: now - rand(10, 200) * DAY,
    lastSeen: now - rand(0, 5) * DAY,
    seeded: true,
  }, { merge: true });
}

// مستخدم بسيط (شاحن/مقدم طلب) بدون وكالة
async function makeUser(p, gender, coins, pearls) {
  const uid = await ensureAuthUser(p.key, p.name);
  await writeUserDoc(uid, { key: p.key, pid: nextPid(), displayName: p.name, gender, country: pick(['SA', 'AE', 'EG', 'PS']), coins, pearls });
  return { uid, name: p.name, key: p.key };
}

async function seedIncomeTransactions(hostUid, payers) {
  // 4-6 معاملات دخل على آخر 7 أيام → الـ trigger يحتسبها راتباً
  const count = rand(4, 6);
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const isCall = Math.random() < 0.5;
    const amount = isCall ? rand(150, 400) : rand(200, 2000);
    sum += amount;
    const payer = pick(payers);
    const createdAt = now - rand(0, 6) * DAY - rand(0, DAY);
    const id = `seed_tx_${hostUid}_${i}`;
    await db.collection('transactions').doc(id).set({
      uid: hostUid,
      type: isCall ? 'call_earning' : 'gift_received',
      amount,
      currency: 'pearls',
      ...(isCall ? { callType: pick(['voice', 'video']) } : { itemName: pick(['وردة', 'تاج', 'قلب', 'صاروخ']) }),
      fromUid: payer.uid,
      status: 'completed',
      createdAt,
      seeded: true,
    });
  }
  return sum;
}

// ==================== بناء وكالة ====================
async function buildAgency(cfg) {
  console.log(`\n🏢 إنشاء وكالة: ${cfg.name}`);
  const agencyRef = db.collection('agencies').doc(`seed_agency_${cfg.key}`);
  const agencyId = agencyRef.id;
  const inviteCode = cfg.key.toUpperCase() + rand(100, 999);

  // الشاحنون (يُنشأون مرة، يُعاد استخدامهم)
  const payers = global.__payers;

  // المالك
  const ownerUid = await ensureAuthUser(cfg.owner.key, cfg.owner.name);
  await writeUserDoc(ownerUid, {
    key: cfg.owner.key, pid: nextPid(), displayName: cfg.owner.name, gender: 'male', country: cfg.country,
    coins: rand(50000, 200000), pearls: rand(1000, 5000),
    agencyId, agencyName: cfg.name, agencyRole: 'owner', isAgent: true, accountKind: 'agent',
  });

  const memberDocs = [];
  // المالك كعضو (لإظهاره في جدول الأعضاء)
  memberDocs.push({
    id: `seed_member_${cfg.key}_owner`,
    data: {
      uid: ownerUid, uidName: cfg.owner.name, uidAvatar: `https://i.pravatar.cc/200?u=${ownerUid}`,
      agencyId, agencyName: cfg.name, role: 'owner', hostVerified: false, isFemaleHost: false,
      pearlsEarned: 0, pearlsTransferredToAgent: 0, joinedAt: now - rand(30, 120) * DAY,
    },
  });

  let totalEarned = 0;
  const reconcile = []; // [{ref, expected}]

  // المضيفات الموثّقات
  for (const h of cfg.femaleHosts) {
    const uid = await ensureAuthUser(h.key, h.name);
    const transferred = rand(0, 1500);
    await writeUserDoc(uid, {
      key: h.key, pid: nextPid(), displayName: h.name, gender: 'female', country: cfg.country,
      coins: rand(0, 5000), pearls: rand(500, 8000),
      agencyId, agencyName: cfg.name, agencyRole: 'host', isFemaleHost: true, accountKind: 'host',
    });
    const memberRef = db.collection('agencyMembers').doc(`seed_member_${cfg.key}_${h.key}`);
    await memberRef.set({
      uid, uidName: h.name, uidAvatar: `https://i.pravatar.cc/200?u=${uid}`,
      agencyId, agencyName: cfg.name, role: 'host', hostVerified: true, isFemaleHost: true,
      verifiedAt: now - rand(5, 60) * DAY, verifiedBy: 'admin',
      pearlsEarned: 0, pearlsTransferredToAgent: transferred, joinedAt: now - rand(10, 90) * DAY,
      seeded: true,
    });
    // معاملات حقيقية → الـ trigger يحتسب pearlsEarned
    const earned = await seedIncomeTransactions(uid, payers);
    totalEarned += earned;
    reconcile.push({ ref: memberRef, expected: earned });
    console.log(`   👩 مضيفة موثّقة: ${h.name}  (أرباح متوقعة ~${earned})`);
  }

  // الأعضاء الذكور
  for (const m of cfg.maleMembers) {
    const uid = await ensureAuthUser(m.key, m.name);
    await writeUserDoc(uid, {
      key: m.key, pid: nextPid(), displayName: m.name, gender: 'male', country: cfg.country,
      coins: rand(0, 10000), pearls: 0,
      agencyId, agencyName: cfg.name, agencyRole: 'member', accountKind: 'member',
    });
    memberDocs.push({
      id: `seed_member_${cfg.key}_${m.key}`,
      data: {
        uid, uidName: m.name, uidAvatar: `https://i.pravatar.cc/200?u=${uid}`,
        agencyId, agencyName: cfg.name, role: 'member', hostVerified: false, isFemaleHost: false,
        pearlsEarned: 0, pearlsTransferredToAgent: 0, joinedAt: now - rand(5, 60) * DAY,
      },
    });
    console.log(`   👨 عضو: ${m.name}`);
  }

  // كتابة أعضاء المالك/الذكور
  for (const md of memberDocs) {
    await db.collection('agencyMembers').doc(md.id).set({ ...md.data, seeded: true });
  }

  // وثيقة الوكالة (مطابقة لشكل Cloud Functions)
  const memberCount = cfg.femaleHosts.length + cfg.maleMembers.length;
  await agencyRef.set({
    name: cfg.name,
    ownerUid,
    ownerName: cfg.owner.name,
    ownerAvatar: `https://i.pravatar.cc/200?u=${ownerUid}`,
    description: 'وكالة تجريبية للاختبار',
    country: cfg.country,
    inviteCode,
    memberCount,
    members: memberCount,
    femaleHostCount: cfg.femaleHosts.length,
    minHostsRequired: 2,
    totalEarnings: totalEarned,
    earnings: totalEarned,
    rank: rand(1, 100),
    rating: 5,
    banner: `https://picsum.photos/seed/${agencyId}/400/200`,
    logo: `https://i.pravatar.cc/200?u=${ownerUid}`,
    isHiring: true,
    isVerified: true,
    status: 'active',
    createdAt: now - rand(30, 120) * DAY,
    updatedAt: now,
    seeded: true,
  });

  // سحوبات للوكالة (واحد مكتمل + واحد معلّق)
  const firstHostUid = (await db.collection('agencyMembers').doc(`seed_member_${cfg.key}_${cfg.femaleHosts[0].key}`).get()).data().uid;
  for (const [i, st] of ['completed', 'pending'].entries()) {
    const amount = rand(2000, 8000);
    await db.collection('withdrawals').doc(`seed_wd_${cfg.key}_${i}`).set({
      uid: firstHostUid,
      uidName: cfg.femaleHosts[0].name,
      uidAvatar: `https://i.pravatar.cc/200?u=${firstHostUid}`,
      agencyId,
      type: i === 0 ? 'self' : 'via_agent',
      amount,
      commission: Math.floor(amount * 0.1),
      netAmount: Math.floor(amount * 0.9),
      fiatValue: Math.floor(amount / 100),
      method: 'usdt',
      accountInfo: { wallet: 'TXxxx' },
      status: st,
      createdAt: now - rand(1, 20) * DAY,
      updatedAt: now,
      seeded: true,
    });
  }

  return { agencyId, reconcile };
}

// ==================== طلب فتح/انضمام (pending) ====================
async function buildApplication(cfg) {
  console.log(`\n📝 إنشاء طلب وكالة قيد المراجعة: ${cfg.agencyName}`);
  const applicantUid = await ensureAuthUser(cfg.applicant.key, cfg.applicant.name);
  const pid = nextPid();
  await writeUserDoc(applicantUid, {
    key: cfg.applicant.key, pid, displayName: cfg.applicant.name, gender: 'male',
    country: cfg.countryCode, coins: rand(5000, 30000), pearls: 0,
  });

  const proposedHosts = [];
  const proposedHostUids = [];
  for (const f of cfg.proposedFemales) {
    const uid = await ensureAuthUser(f.key, f.name);
    await writeUserDoc(uid, {
      key: f.key, pid: nextPid(), displayName: f.name, gender: 'female',
      country: cfg.countryCode, coins: 0, pearls: 0,
    });
    proposedHosts.push({
      uid, displayName: f.name, avatar: `https://i.pravatar.cc/200?u=${uid}`,
      profileGender: 'female', genderVerified: false,
    });
    proposedHostUids.push(uid);
  }

  await db.collection('agencyApplications').doc(`seed_app_${cfg.key}`).set({
    applicantUid,
    applicantName: cfg.applicant.name,
    applicantPublicAccountId: pid,
    applicantPhone: '+966500000000',
    whatsappNumber: '+966500000000',
    countryCode: cfg.countryCode,
    agencyName: cfg.agencyName,
    status: 'pending',
    proposedHosts,
    proposedHostUids,
    minHostsRequired: 10,
    femaleHostCount: 0,
    inviteCode: '',
    hostsDeadline: 0,
    agencyId: '',
    assignedTeam: cfg.countryCode === 'SA' || cfg.countryCode === 'AE' ? 'gcc' : 'global',
    reviewDeadline: now + 2 * DAY,
    source: 'seed',
    createdAt: now - rand(0, 3) * DAY,
    updatedAt: now,
    seeded: true,
  });
  console.log(`   ✅ طلب pending مع ${proposedHosts.length} مضيفات مقترحات`);
}

// ==================== التنظيف ====================
async function deleteSeededFrom(collName) {
  const snap = await db.collection(collName).where('seeded', '==', true).get();
  let n = 0;
  const batchSize = 400;
  for (let i = 0; i < snap.docs.length; i += batchSize) {
    const batch = db.batch();
    snap.docs.slice(i, i + batchSize).forEach((d) => batch.delete(d.ref));
    await batch.commit();
    n += Math.min(batchSize, snap.docs.length - i);
  }
  console.log(`   🗑️  ${collName}: حُذف ${n}`);
}

async function clean() {
  console.log('🧹 حذف كل البيانات المزروعة...');
  for (const c of ['agencies', 'agencyMembers', 'agencyApplications', 'transactions', 'withdrawals', 'users']) {
    await deleteSeededFrom(c);
  }
  // حذف حسابات Auth على نطاق seed
  let deleted = 0;
  let pageToken;
  do {
    const res = await auth.listUsers(1000, pageToken);
    const toDelete = res.users.filter((u) => (u.email || '').endsWith(`@${EMAIL_DOMAIN}`)).map((u) => u.uid);
    if (toDelete.length) {
      await auth.deleteUsers(toDelete);
      deleted += toDelete.length;
    }
    pageToken = res.pageToken;
  } while (pageToken);
  console.log(`   🗑️  Auth: حُذف ${deleted} حساب`);
  console.log('✅ اكتمل التنظيف');
}

// ==================== التشغيل ====================
async function main() {
  if (process.argv.includes('--clean')) {
    await clean();
    return;
  }

  console.log('🌱 بدء الزرع...\n');

  // الشاحنون أولاً (يُشار إليهم في الهدايا)
  global.__payers = [];
  for (const p of PAYERS) {
    global.__payers.push(await makeUser(p, 'male', rand(100000, 500000), 0));
  }
  console.log(`💳 أُنشئ ${global.__payers.length} مستخدمين شاحنين`);

  const allReconcile = [];
  for (const cfg of AGENCIES) {
    const { reconcile } = await buildAgency(cfg);
    allReconcile.push(...reconcile);
  }

  for (const cfg of APPLICATIONS) {
    await buildApplication(cfg);
  }

  // مهلة ليعمل الـ trigger ثم تعويض إن لم يُحتسب (بيئة بلا trigger)
  console.log('\n⏳ انتظار عمل trigger راتب الوكالة (6 ثوانٍ)...');
  await sleep(6000);
  let reconciled = 0;
  for (const { ref, expected } of allReconcile) {
    const snap = await ref.get();
    if (snap.exists && (Number(snap.data().pearlsEarned) || 0) === 0) {
      await ref.update({ pearlsEarned: expected });
      reconciled++;
    }
  }
  if (reconciled > 0) console.log(`   🔧 عُوّضت أرباح ${reconciled} مضيفة يدوياً (الـ trigger لم يُحتسب)`);
  else console.log('   ✅ الـ trigger احتسب الأرباح تلقائياً');

  console.log('\n✅ اكتمل الزرع بنجاح!');
  console.log('\n══════════ بيانات الدخول ══════════');
  console.log(`كلمة المرور لكل الحسابات: ${PASSWORD}`);
  console.log('أمثلة إيميلات للدخول:');
  console.log(`  مالك وكالة:  nova_owner@${EMAIL_DOMAIN}`);
  console.log(`  مضيفة موثّقة: nova_h1@${EMAIL_DOMAIN}`);
  console.log(`  مستخدم شاحن: payer1@${EMAIL_DOMAIN}`);
  console.log(`  مقدّم طلب:   zen_owner@${EMAIL_DOMAIN}`);
  console.log('═══════════════════════════════════');
  console.log('\nللحذف لاحقاً:  node seed-agencies.cjs --clean');
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('❌ خطأ:', e); process.exit(1); });
