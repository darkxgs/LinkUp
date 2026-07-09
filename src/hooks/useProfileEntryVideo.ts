import { useEffect, useRef, useState } from 'react';

import { subscribeToStoreItems, type StoreItem } from '@/services/firebase/storeConfig';
import { resolveRoomEntryForUser } from '@/services/firebase/userEntrances';
import type { AristocracyConfig } from '@/services/firebase/aristocracySystem';
import type { VipSystemConfig } from '@/services/firebase/vipSystem';
import { getGiftVideoPlaybackCandidates } from '@/utils/giftVideoPlayback';
import { resolveGiftVideoUri, preloadVideoBackground } from '@/utils/videoCacheManager';

export type ProfileEntryVideo = {
  key: string;
  name: string;
  videoUrl: string;
  videoUrlMp4?: string;
};

/** فيديو دخولية الملف الشخصي — للمالك والزائر */
export function useProfileEntryVideo(opts: {
  userId: string | undefined;
  displayName: string;
  profileReady: boolean;
  vipSystem: VipSystemConfig;
  aristocracy: AristocracyConfig;
}) {
  const { userId, displayName, profileReady, vipSystem, aristocracy } = opts;
  const [entryVideo, setEntryVideo] = useState<ProfileEntryVideo | null>(null);
  const [storeEntranceCatalog, setStoreEntranceCatalog] = useState<StoreItem[]>([]);
  const [storeCatalogReady, setStoreCatalogReady] = useState(false);
  const entryPlayedForUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToStoreItems((items) => {
      setStoreEntranceCatalog(items.filter((i) => i.type === 'entrance'));
      setStoreCatalogReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    entryPlayedForUserIdRef.current = null;
    setEntryVideo(null);
  }, [userId]);

  useEffect(() => {
    if (!userId || !profileReady || !storeCatalogReady) return;
    if (entryPlayedForUserIdRef.current === userId) return;

    let cancelled = false;
    void resolveRoomEntryForUser(
      userId,
      storeEntranceCatalog,
      vipSystem.privileges,
      vipSystem,
      aristocracy,
    ).then(async (entry) => {
      if (cancelled) return;
      entryPlayedForUserIdRef.current = userId;
      if (!entry?.videoUrl) return;

      const candidates = getGiftVideoPlaybackCandidates(entry.videoUrl, entry.videoUrlMp4);
      const src = candidates[0];
      if (src) {
        preloadVideoBackground(src);
        try {
          await resolveGiftVideoUri(src);
        } catch {
          /* تشغيل من الرابط إن فشل الكاش */
        }
      }
      if (cancelled) return;

      setEntryVideo({
        key: `${userId}-${Date.now()}`,
        name: displayName,
        videoUrl: entry.videoUrl,
        videoUrlMp4: entry.videoUrlMp4,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    userId,
    profileReady,
    storeCatalogReady,
    storeEntranceCatalog,
    vipSystem,
    aristocracy,
    displayName,
  ]);

  return {
    entryVideo,
    clearEntryVideo: () => setEntryVideo(null),
  };
}
