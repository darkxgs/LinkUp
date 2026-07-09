/**
 * مطابقة ألعاب التحدي — يربط لاعبين يبحثون عن نفس اللعبة والرهان
 */
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
  limit,
  deleteDoc,
} from 'firebase/firestore';
import { firestore, auth } from './index';
import {
  createActiveMatchChallenge,
  type ChallengeGameId,
} from './challenges';
import { getUser } from './users';

const MATCH_ACTIVATION_WINDOW_MS = 90_000;

export type MatchQueueEntry = {
  uid: string;
  gameId: ChallengeGameId;
  bet: number;
  displayName: string;
  avatar: string;
  createdAt: number;
  status: 'waiting' | 'matched' | 'cancelled';
  matchedChallengeId?: string;
};

type JoinOptions = {
  /** عند إعادة المحاولة التلقائية — يمنع الطرفين من إنشاء تحدّيين */
  autoRetry?: boolean;
};

async function ensureWaitingInQueue(
  entry: MatchQueueEntry,
): Promise<void> {
  await setDoc(doc(firestore, 'gameMatchQueue', entry.uid), entry, { merge: true });
}

async function claimOpponentAndCreateMatch(
  gameId: ChallengeGameId,
  bet: number,
  opponent: MatchQueueEntry,
  myName: string,
  myAvatar: string,
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول أولاً');

  const myQueueRef = doc(firestore, 'gameMatchQueue', user.uid);
  const oppQueueRef = doc(firestore, 'gameMatchQueue', opponent.uid);

  const oppLive = await getDocs(
    query(
      collection(firestore, 'gameMatchQueue'),
      where('gameId', '==', gameId),
      where('bet', '==', bet),
      where('status', '==', 'waiting'),
      limit(12),
    ),
  );
  const stillWaiting = oppLive.docs.some(
    (d) => d.id === opponent.uid && d.data()?.status === 'waiting',
  );
  if (!stillWaiting) throw new Error('OPPONENT_TAKEN');

  const challengeId = await createActiveMatchChallenge(
    gameId,
    bet,
    opponent.uid,
    opponent.displayName,
    opponent.avatar,
    myName,
    myAvatar,
  );

  await runTransaction(firestore, async (tx) => {
    const oppSnap = await tx.get(oppQueueRef);
    if (oppSnap.exists() && oppSnap.data()?.status === 'waiting') {
      tx.delete(oppQueueRef);
    }
    const mySnap = await tx.get(myQueueRef);
    if (mySnap.exists()) {
      tx.delete(myQueueRef);
    }
  });

  return challengeId;
}

export async function joinChallengeMatchQueue(
  gameId: ChallengeGameId,
  bet: number,
  opts?: JoinOptions,
): Promise<{ status: 'waiting' } | { status: 'matched'; challengeId: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول أولاً');

  const meDoc = await getUser(user.uid);
  const displayName = meDoc?.displayName || user.displayName || 'متحدي';
  const avatar = meDoc?.avatar || user.photoURL || '';
  const myQueueRef = doc(firestore, 'gameMatchQueue', user.uid);

  const q = query(
    collection(firestore, 'gameMatchQueue'),
    where('gameId', '==', gameId),
    where('bet', '==', bet),
    where('status', '==', 'waiting'),
    limit(12),
  );
  const snap = await getDocs(q);
  const opponents = snap.docs
    .filter((d) => d.data().uid !== user.uid)
    .sort((a, b) => (a.data().createdAt ?? 0) - (b.data().createdAt ?? 0));

  if (opponents.length > 0) {
    const opponentDoc = opponents[0]!;
    const opp = opponentDoc.data() as MatchQueueEntry;

    if (opts?.autoRetry && user.uid > opp.uid) {
      await ensureWaitingInQueue({
        uid: user.uid,
        gameId,
        bet,
        displayName,
        avatar,
        createdAt: Date.now(),
        status: 'waiting',
      });
      return { status: 'waiting' };
    }

    try {
      const challengeId = await claimOpponentAndCreateMatch(
        gameId,
        bet,
        opp,
        displayName,
        avatar,
      );
      return { status: 'matched', challengeId };
    } catch {
      /* سبق أن تم ربط الخصم — نكمل للانتظار */
    }
  }

  const entry: MatchQueueEntry = {
    uid: user.uid,
    gameId,
    bet,
    displayName,
    avatar,
    createdAt: Date.now(),
    status: 'waiting',
  };
  await setDoc(myQueueRef, entry);
  return { status: 'waiting' };
}

export async function leaveChallengeMatchQueue(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  await deleteDoc(doc(firestore, 'gameMatchQueue', user.uid)).catch(() => {});
}

/** يستمع لتحدّي مطابقة نشط ويوجّه اللاعبين (بما فيهم المنتظر) */
export function subscribeToMatchmakingSession(
  uid: string,
  onMatched: (challengeId: string) => void,
): () => void {
  if (!uid) return () => {};

  const seen = new Set<string>();

  const handleDocs = (docs: { id: string; data: () => Record<string, unknown> }[]) => {
    const now = Date.now();
    for (const d of docs) {
      const data = d.data();
      if (data.source !== 'matchmaking' || data.status !== 'active') continue;
      const activatedAt = Number(data.acceptedAt ?? data.createdAt ?? 0);
      if (!activatedAt || now - activatedAt > MATCH_ACTIVATION_WINDOW_MS) continue;
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      onMatched(d.id);
      return;
    }
  };

  const qChallenged = query(
    collection(firestore, 'gameChallenges'),
    where('challengedId', '==', uid),
    where('status', '==', 'active'),
    limit(8),
  );
  const qChallenger = query(
    collection(firestore, 'gameChallenges'),
    where('challengerId', '==', uid),
    where('status', '==', 'active'),
    limit(8),
  );

  const unsub1 = onSnapshot(qChallenged, (snap) => handleDocs(snap.docs));
  const unsub2 = onSnapshot(qChallenger, (snap) => handleDocs(snap.docs));

  return () => {
    unsub1();
    unsub2();
  };
}

/**
 * أثناء الانتظار: يعيد المحاولة عند ظهور خصم + يستمع لتحدّي مطابقة نشط
 */
export function subscribeWhileWaitingForMatch(
  gameId: ChallengeGameId,
  bet: number,
  onMatched: (challengeId: string) => void,
): () => void {
  const user = auth.currentUser;
  if (!user) return () => {};

  const uid = user.uid;
  let busy = false;

  const tryAutoMatch = async () => {
    if (busy) return;
    busy = true;
    try {
      const result = await joinChallengeMatchQueue(gameId, bet, { autoRetry: true });
      if (result.status === 'matched') {
        onMatched(result.challengeId);
      }
    } catch {
      /* تعارض — الطرف الآخر سينشئ المطابقة */
    } finally {
      busy = false;
    }
  };

  const queueQuery = query(
    collection(firestore, 'gameMatchQueue'),
    where('gameId', '==', gameId),
    where('bet', '==', bet),
    where('status', '==', 'waiting'),
    limit(12),
  );

  const unsubQueue = onSnapshot(queueQuery, (snap) => {
    const others = snap.docs.filter((d) => d.data().uid !== uid);
    if (others.length > 0) {
      void tryAutoMatch();
    }
  });

  const unsubSession = subscribeToMatchmakingSession(uid, onMatched);

  return () => {
    unsubQueue();
    unsubSession();
  };
}

export function subscribeToMatchQueue(
  callback: (entry: MatchQueueEntry | null) => void,
): () => void {
  const user = auth.currentUser;
  if (!user) {
    callback(null);
    return () => {};
  }

  return onSnapshot(
    doc(firestore, 'gameMatchQueue', user.uid),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(snap.data() as MatchQueueEntry);
    },
    () => callback(null),
  );
}
