/**
 * عندما يقبل الخصم التحدي — يوجّه المتحدي تلقائياً لشاشة اللعب
 */
import React, { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, query, where, limit } from 'firebase/firestore';
import { firestore } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';

const ACCEPT_WINDOW_MS = 45_000;

export function OutgoingChallengeGate() {
  const router = useRouter();
  const { user } = useAuth();
  const navigatedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;

    const q = query(
      collection(firestore, 'gameChallenges'),
      where('challengerId', '==', uid),
      where('status', '==', 'active'),
      limit(8),
    );

    return onSnapshot(q, (snap) => {
      const now = Date.now();
      for (const docSnap of snap.docs) {
        const id = docSnap.id;
        if (navigatedRef.current.has(id)) continue;

        const acceptedAt = Number(docSnap.data().acceptedAt ?? 0);
        if (!acceptedAt || now - acceptedAt > ACCEPT_WINDOW_MS) continue;

        navigatedRef.current.add(id);
        router.push(`/games/challenges/active?challengeId=${id}` as any);
        break;
      }
    });
  }, [user?.uid, router]);

  return null;
}
