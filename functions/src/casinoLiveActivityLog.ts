/**
 * تسجيل شحن في نشاط الكازينو المباشر (من السيرفر)
 */
export async function logCasinoRechargeActivityServer(
  db: FirebaseFirestore.Firestore,
  uid: string,
  userData: FirebaseFirestore.DocumentData,
  amount: number,
): Promise<void> {
  const coins = Math.floor(Number(amount) || 0);
  if (coins <= 0) return;

  const profile = (userData.profile as { displayName?: string; avatar?: string } | undefined) ?? {};
  await db.collection('casinoLiveActivity').add({
    uid,
    displayName: String(profile.displayName ?? userData.displayName ?? 'مستخدم'),
    avatar: String(profile.avatar ?? userData.avatar ?? ''),
    type: 'recharge',
    stake: coins,
    createdAt: Date.now(),
  });
}
