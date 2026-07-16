/**
 * تحويل الماسة من المضيف/ة إلى الوكيل المسجّل — ماسات فقط
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  increment,
  addDoc,
} from 'firebase/firestore';
import { firestore, auth } from './firebase/index';
import { runTxWithRetry } from '@/utils/firestoreTx';
import { parseWalletRules, validateHostWithdrawAmount } from './walletRules';
import {
  buildBalanceIncrementPatch,
  statsFromFirestoreDoc,
} from '@/utils/userBalance';

export const transferPearlsToAgent = async (amount: number): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول');

  const amt = Math.floor(amount);
  if (!Number.isFinite(amt) || amt <= 0) throw new Error('المبلغ غير صحيح');

  const settingsSnap = await getDoc(doc(firestore, 'config', 'settings'));
  const rules = parseWalletRules(settingsSnap.exists() ? (settingsSnap.data() as any) : null);
  const amountErr = validateHostWithdrawAmount(amt, rules);
  if (amountErr) throw new Error(amountErr);

  const userSnap = await getDoc(doc(firestore, 'users', user.uid));
  if (!userSnap.exists()) throw new Error('حسابك غير موجود');

  const userData = userSnap.data();
  const agencyId = userData.agencyId != null ? String(userData.agencyId) : '';
  if (!agencyId) throw new Error('يجب أن تكون مسجّلة في وكالة');

  const membersSnap = await getDocs(
    query(
      collection(firestore, 'agencyMembers'),
      where('uid', '==', user.uid),
      where('agencyId', '==', agencyId),
      limit(1),
    ),
  );
  if (membersSnap.empty) throw new Error('عضويتك في الوكالة غير موجودة');

  const memberDoc = membersSnap.docs[0]!;
  const memberId = memberDoc.id;
  const memberData = memberDoc.data();
  if (memberData.permissions && memberData.permissions.allowTransferToAgent === false) {
    throw new Error('تحويل الماسة للوكيل موقوف على حسابك من قِبل الوكالة.');
  }

  const agencySnap = await getDoc(doc(firestore, 'agencies', agencyId));
  if (!agencySnap.exists()) throw new Error('الوكالة غير موجودة');
  const agentUid = String(agencySnap.data().ownerUid ?? '');
  if (!agentUid) throw new Error('الوكيل غير معرّف');

  if (agentUid === user.uid) {
    throw new Error('لا يمكن التحويل لنفسك — أنت الوكيل');
  }

  const hostRef = doc(firestore, 'users', user.uid);
  const agentRef = doc(firestore, 'users', agentUid);
  const memberRef = doc(firestore, 'agencyMembers', memberId);

  await runTxWithRetry(async (tx) => {
    const hostSnap = await tx.get(hostRef);
    if (!hostSnap.exists()) throw new Error('حسابك غير موجود');

    const balance = statsFromFirestoreDoc(hostSnap.data() as Record<string, unknown>).pearls;
    if (balance < amt) throw new Error('رصيد الماس غير كافٍ');

    tx.update(hostRef, buildBalanceIncrementPatch('pearls', -amt));
    tx.update(agentRef, buildBalanceIncrementPatch('pearls', amt));
    tx.update(memberRef, { pearlsTransferredToAgent: increment(amt) });
  });

  await addDoc(collection(firestore, 'transactions'), {
    uid: user.uid,
    type: 'transfer_to_agent',
    amount: -amt,
    received: amt,
    agentUid,
    agencyId,
    currency: 'pearls',
    status: 'completed',
    createdAt: Date.now(),
  });
};
