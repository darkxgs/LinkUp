/**
 * useCall — Hook لمكالمات الصوت/الفيديو 1-to-1 عبر Agora
 * يعتمد على callSession المشتركة — تبقى المكالمة نشطة عند التصغير
 */

import { useEffect, useState, useCallback } from 'react';
import { callSession, type CallState } from '@/services/callSession';
import { auth } from '@/services/firebase';
import { isCallSessionPinned, useCallSessionStore } from '@/stores/callSessionStore';

export type { CallState };

interface UseCallOptions {
  channelName: string;
  isVideo: boolean;
  autoJoin?: boolean;
  peerUid?: string;
  billingSessionId?: string;
  callSource?: 'chat' | 'match';
  onInsufficientBalance?: () => void;
}

export function useCall({
  channelName,
  isVideo,
  autoJoin = true,
  peerUid,
  billingSessionId,
  callSource = 'chat',
  onInsufficientBalance,
}: UseCallOptions) {
  const [snapshot, setSnapshot] = useState(() => callSession.getSnapshot());

  useEffect(() => {
    setSnapshot(callSession.getSnapshot());
    return callSession.subscribe(() => {
      setSnapshot(callSession.getSnapshot());
    });
  }, []);

  useEffect(() => {
    callSession.setInsufficientBalanceHandler(onInsufficientBalance ?? null);
    return () => callSession.setInsufficientBalanceHandler(null);
  }, [onInsufficientBalance]);

  const join = useCallback(
    () => callSession.connect({ channelName, isVideo, peerUid, billingSessionId, callSource }),
    [channelName, isVideo, peerUid, billingSessionId, callSource],
  );

  const leave = useCallback(async () => {
    await callSession.leave();
    useCallSessionStore.getState().clear();
  }, []);

  useEffect(() => {
    if (!autoJoin || !channelName) return;

    let cancelled = false;

    const session = useCallSessionStore.getState();
    const resuming = session.sessionPinned && session.channelName === channelName;
    if (resuming && session.isMinimized) {
      useCallSessionStore.getState().expand();
    }

    void (async () => {
      // await ناقص سابقاً: كانت fbUser وعداً (truthy دائماً) فلا انتظار للمصادقة
      // إطلاقاً عند الرد من إشعار/إقلاع بارد — والاتصال يفشل فوراً «انتهت الجلسة»
      const fbUser =
        auth.currentUser ??
        (await (await import('@/services/firebase/authReady')).waitForFirestoreAuth(8_000));
      if (cancelled) return;
      if (!fbUser) {
        const { SESSION_EXPIRED_MSG } = await import('@/services/firebase/authReady');
        callSession.forceError(SESSION_EXPIRED_MSG);
        return;
      }
      await callSession.connect({ channelName, isVideo, peerUid, billingSessionId, callSource });
    })();

    return () => {
      cancelled = true;
      if (isCallSessionPinned(channelName)) return;
      const snap = callSession.getSnapshot();
      // لا نقطع إذا connect لا يزال جارياً لنفس القناة (React StrictMode remount)
      if (snap.channelName === channelName && snap.callState === 'connecting') return;
      // شبكة أمان: إزالة لم تمر بـbeforeRemove (reset/dismissAll) أثناء مكالمة متصلة —
      // ثبّت وأظهر الفقاعة بدل القطع؛ الإنهاء الصريح يمر عبر leave() فيصبح ended قبل الوصول هنا
      if (
        snap.channelName === channelName &&
        snap.callState === 'connected' &&
        peerUid &&
        auth.currentUser
      ) {
        useCallSessionStore.getState().minimize({
          peerUid,
          peerName: '', // الفقاعة تعرض بديل t('rooms.userFallback')
          channelName,
          isVideo,
          billingSessionId,
          source: callSource,
        });
        return;
      }
      void callSession.leave();
    };
  }, [channelName, isVideo, peerUid, billingSessionId, callSource, autoJoin]);

  return {
    callState: snapshot.callState,
    isMuted: snapshot.isMuted,
    isRemoteMuted: snapshot.isRemoteMuted,
    isVideoEnabled: snapshot.isVideoEnabled,
    isSpeakerOn: snapshot.isSpeakerOn,
    remoteJoined: snapshot.remoteJoined,
    localVideoTrack: snapshot.localVideoTrack,
    remoteVideoTrack: snapshot.remoteVideoTrack,
    channelName: snapshot.channelName,
    error: snapshot.error,
    join,
    leave,
    toggleMute: () => callSession.toggleMute(),
    setMuted: (muted: boolean) => callSession.setMuted(muted),
    toggleVideo: () => callSession.toggleVideo(),
    switchCamera: () => callSession.switchCamera(),
    toggleSpeaker: () => callSession.toggleSpeaker(),
    setSpeakerOn: (on: boolean) => callSession.setSpeakerOn(on),
  };
}
