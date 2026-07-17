/**
 * تثبيت جلسة المكالمة عند أي إزالة لشاشة المكالمة (زر رجوع/إيماءة/router.back)
 * أثناء مكالمة نشطة — نمط «احتفظ» في الروم: الإنهاء صريح فقط (زر الإنهاء/الفقاعة/الطرف الآخر).
 */
import { useEffect } from 'react';
import { useNavigation } from 'expo-router';
import { callSession } from '@/services/callSession';
import { useCallSessionStore } from '@/stores/callSessionStore';

export function useKeepCallAliveOnRemove(opts: {
  peerUid?: string;
  peerName: string;
  peerAvatar?: string;
  channelName: string;
  isVideo: boolean;
  billingSessionId?: string;
  source?: 'chat' | 'match';
}) {
  const navigation = useNavigation();
  const { peerUid, peerName, peerAvatar, channelName, isVideo, billingSessionId, source } = opts;
  useEffect(() => {
    return navigation.addListener('beforeRemove', () => {
      if (!peerUid || !channelName) return;
      const s = useCallSessionStore.getState();
      // مثبّتة سلفاً (زر التصغير/ترقية الفيديو) — لا شيء
      if (s.sessionPinned && s.channelName === channelName) return;
      const snap = callSession.getSnapshot();
      const active =
        snap.channelName === channelName &&
        (snap.callState === 'connected' || snap.callState === 'connecting');
      // إنهاء صريح/رفض/انتهاء رصيد: الحالة ended|error فلا تثبيت
      if (!active) return;
      useCallSessionStore.getState().minimize({
        peerUid,
        peerName,
        peerAvatar,
        channelName,
        isVideo,
        billingSessionId,
        source,
      });
    });
  }, [navigation, peerUid, peerName, peerAvatar, channelName, isVideo, billingSessionId, source]);
}
