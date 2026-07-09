const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'linkup-dc45f'
});
const db = admin.firestore();

const DEFAULT_CONFIG_VIP_SYSTEM = {
  pointPerCoin: 1,
  levels: [
    { level: 1, label: 'SVIP1', minPoints: 10000, maxPoints: 50000, maintainPoints: 5000, mode: 'svip', imageUrl: '' },
    { level: 2, label: 'SVIP2', minPoints: 50000, maxPoints: 100000, maintainPoints: 20000, mode: 'svip', imageUrl: '' },
    { level: 3, label: 'SVIP3', minPoints: 100000, maxPoints: 200000, maintainPoints: 40000, mode: 'svip', imageUrl: '' },
    { level: 4, label: 'SVIP4', minPoints: 200000, maxPoints: 500000, maintainPoints: 80000, mode: 'svip', imageUrl: '' },
    { level: 5, label: 'SVIP5', minPoints: 500000, maxPoints: 1000000, maintainPoints: 150000, mode: 'svip', imageUrl: '' },
    { level: 6, label: 'SVIP6', minPoints: 1000000, maxPoints: 2000000, maintainPoints: 300000, mode: 'svip', imageUrl: '' },
    { level: 7, label: 'SVIP7', minPoints: 2000000, maxPoints: 5000000, maintainPoints: 600000, mode: 'svip', imageUrl: '' },
    { level: 8, label: 'SVIP8', minPoints: 5000000, maxPoints: 10000000, maintainPoints: 1500000, mode: 'svip', imageUrl: '' },
    { level: 9, label: 'SVIP9', minPoints: 10000000, maxPoints: 20000000, maintainPoints: 3000000, mode: 'svip', imageUrl: '' },
    { level: 10, label: 'SVIP10', minPoints: 20000000, maxPoints: 50000000, maintainPoints: 6000000, mode: 'svip', imageUrl: '' },
    { level: 11, label: 'SVIP11', minPoints: 50000000, maxPoints: 100000000, maintainPoints: 15000000, mode: 'svip', imageUrl: '' },
    { level: 12, label: 'SVIP12', minPoints: 100000000, maxPoints: null, maintainPoints: 30000000, mode: 'svip', imageUrl: '' },
  ],
  privileges: [
    { id: 'vip-badge', assetKey: 'vipBadge', titleKey: 'vipHub.privilegeBadge', descKey: 'vipHub.privilegeBadgeDesc', unlockLevel: 1, mode: 'svip', order: 1, title: 'شعار SVIP', desc: 'شعار SVIP مميز يظهر على صورتك الشخصية وفي غرف الدردشة لتتميز بين الجميع.', imageUrl: '' },
    { id: 'vip-seat', assetKey: 'vipSeat', titleKey: 'vipHub.privilegeSeat', descKey: 'vipHub.privilegeSeatDesc', unlockLevel: 2, mode: 'svip', order: 2, title: 'مقعد SVIP المميز', desc: 'تصميم مقعد مذهل وخاص عند صعودك على المنصة في الغرف.', imageUrl: '' },
    { id: 'entry-effect', assetKey: 'entryEffect', titleKey: 'vipHub.privilegeEntry', descKey: 'vipHub.privilegeEntryDesc', unlockLevel: 4, mode: 'svip', order: 3, title: 'تأثير دخول الغرف', desc: 'تأثير دخول متحرك وجذاب عند دخولك أي غرفة دردشة ليلاحظك الجميع.', imageUrl: '' },
    { id: 'chat-bubble', assetKey: 'chatBubble', titleKey: 'vipHub.privilegeBubble', descKey: 'vipHub.privilegeBubbleDesc', unlockLevel: 6, mode: 'svip', order: 4, title: 'فقاعة الدردشة المميزة', desc: 'لون وتصميم خاص لفقاعة رسائلك داخل غرف الدردشة.', imageUrl: '' },
    { id: 'profile-card', assetKey: 'profileCard', titleKey: 'vipHub.privilegeCard', descKey: 'vipHub.privilegeCardDesc', unlockLevel: 8, mode: 'svip', order: 5, title: 'بطاقة الملف الشخصي', desc: 'خلفية وتأثيرات ساحرة لبطاقة ملفك الشخصي تبرز فخامتك.', imageUrl: '' },
    { id: 'vip-entry', assetKey: 'vipEntry', titleKey: 'vipHub.privilegeVipEntry', descKey: 'vipHub.privilegeVipEntryDesc', unlockLevel: 9, mode: 'svip', order: 6, title: 'سيارات الدخول الفاخرة', desc: 'مركبة فضائية أو سيارة فاخرة متحركة ترافق دخولك للغرفة.', imageUrl: '' },
    { id: 'photo-frame', assetKey: 'photoFrame', titleKey: 'vipHub.privilegeFrame', descKey: 'vipHub.privilegeFrameDesc', unlockLevel: 10, mode: 'svip', order: 7, title: 'إطار الصورة المميز', desc: 'إطار ذهبي وفخم يحيط بصورتك الشخصية أينما ظهرت.', imageUrl: '' },
    { id: 'honor-medal', assetKey: 'honorMedal', titleKey: 'vipHub.privilegeHonor', descKey: 'vipHub.privilegeHonorDesc', unlockLevel: 12, mode: 'svip', order: 8, title: 'قلادة الشرف الكبرى', desc: 'قلادة شرف خاصة تمنحك هيبة إضافية وتثبت في بروفايلك.', imageUrl: '' },
  ],
  updatedAt: Date.now()
};

async function run() {
  await db.collection('config').doc('vipSystem').set(DEFAULT_CONFIG_VIP_SYSTEM);
  console.log('Successfully initialized config/vipSystem in Firestore with 12 SVIP levels!');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
