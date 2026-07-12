/**
 * RoomMusicSheet — شاشة موسيقى كاملة داخل الروم (مكتبة + قائمة تشغيل + مشغّل)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Music2, X, Settings } from 'lucide-react-native';
import { Image } from 'expo-image';

import { Text, useAlert } from '@/components/ui';
import { RoomMusicAddPanel } from './RoomMusicAddPanel';
import { MusicPlayingBars } from './MusicPlayingBars';
import { RoomMusicPlaybackBar } from './RoomMusicPlaybackBar';
import { useRoomMusicPlaybackContext } from '@/contexts/RoomMusicPlaybackContext';
import {
  loadRoomMusicLibrary,
  subscribeToRoomMusicLibrary,
  pickDeviceAudioFiles,
  pinTrackToRoomBox,
  type UserMusicTrack,
} from '@/services/roomMusicLibrary';
import { RoomMusicFileTooLargeError } from '@/constants/roomMusic';
import {
  waitAfterSheetDismiss,
  addDeviceFilesToRoomMusic,
} from '@/services/roomMusicUpload';
import {
  subscribeToRoomMusicQueue,
  playOrQueueTrack,
  playTrackNowInRoom,
  playAllTracksInRoom,
  advanceRoomMusicQueue,
  removeFromRoomMusicQueue,
  isQueueItemUnavailableFor,
  type RoomMusicQueueItem,
} from '@/services/roomMusicQueue';
import type { RoomMusic } from '@/services/roomMusic';
import { auth } from '@/services/firebase';

type Tab = 'library' | 'queue';
type Panel = 'main' | 'add';

type Props = {
  visible: boolean;
  onClose: () => void;
  onReopen?: () => void;
  roomId: string;
  roomMusic: RoomMusic | null;
  canControl: boolean;
  canManageMusic?: boolean;
};

type RowItem =
  | { kind: 'now'; key: string }
  | { kind: 'library'; track: UserMusicTrack }
  | { kind: 'queue'; item: RoomMusicQueueItem };

export function RoomMusicSheet({
  visible,
  onClose,
  onReopen,
  roomId,
  roomMusic,
  canControl,
  canManageMusic = false,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { showAlert, showToast } = useAlert();
  const playback = useRoomMusicPlaybackContext();

  const [panel, setPanel] = useState<Panel>('main');
  const [tab, setTab] = useState<Tab>('library');
  const [search, setSearch] = useState('');
  const [library, setLibrary] = useState<UserMusicTrack[]>([]);
  const [queue, setQueue] = useState<RoomMusicQueueItem[]>([]);
  const [loadingLib, setLoadingLib] = useState(false);
  const [busyUrl, setBusyUrl] = useState<string | null>(null);
  const [playAllBusy, setPlayAllBusy] = useState(false);
  const [pickingFiles, setPickingFiles] = useState(false);
  const [pinningId, setPinningId] = useState<string | null>(null);

  const myUid = auth.currentUser?.uid;
  /** الـDJ الفعّال لتقييم إتاحة مقاطع القائمة — صاحب الموسيقى الحالية أو أنا */
  const activeDjUid = roomMusic?.addedBy ?? myUid;

  const refreshLibrary = useCallback(async () => {
    setLoadingLib(true);
    const list = await loadRoomMusicLibrary(roomId);
    setLibrary(list);
    setLoadingLib(false);
  }, [roomId]);

  useEffect(() => {
    if (!visible) {
      setPanel('main');
      setSearch('');
      return;
    }
    setTab(roomMusic ? 'queue' : 'library');
    void refreshLibrary();
    return subscribeToRoomMusicLibrary(roomId, setLibrary);
  }, [visible, roomId, refreshLibrary, roomMusic]);

  useEffect(() => {
    if (!visible || !roomId) return;
    return subscribeToRoomMusicQueue(roomId, setQueue);
  }, [visible, roomId]);

  const filteredLibrary = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return library;
    return library.filter(
      (tr) =>
        tr.title.toLowerCase().includes(q) ||
        (tr.artist ?? '').toLowerCase().includes(q) ||
        (tr.fileName ?? '').toLowerCase().includes(q),
    );
  }, [library, search]);

  const filteredQueue = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = queue.filter((item) => item.url !== roomMusic?.url);
    if (!q) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.fileName ?? '').toLowerCase().includes(q) ||
        item.addedByName.toLowerCase().includes(q),
    );
  }, [queue, search, roomMusic?.url]);

  const showNowPlaying =
    !!roomMusic &&
    (tab === 'queue' ||
      !search.trim() ||
      roomMusic.title.toLowerCase().includes(search.trim().toLowerCase()) ||
      roomMusic.addedByName.toLowerCase().includes(search.trim().toLowerCase()));

  const rows: RowItem[] = useMemo(() => {
    if (tab === 'queue') {
      const list: RowItem[] = [];
      if (showNowPlaying) list.push({ kind: 'now', key: 'now-playing' });
      filteredQueue.forEach((item) => list.push({ kind: 'queue', item }));
      return list;
    }
    return filteredLibrary.map((track) => ({ kind: 'library', track }));
  }, [tab, filteredLibrary, filteredQueue, showNowPlaying]);

  const queueCount = (roomMusic ? 1 : 0) + queue.filter((i) => i.url !== roomMusic?.url).length;

  const canStopMusic = canControl || (canManageMusic && !!roomMusic);

  const isCurrentlyPlaying = (url: string) => roomMusic?.url === url;

  const handlePlayTrack = async (track: Pick<UserMusicTrack, 'url' | 'title' | 'fileName'>) => {
    if (isCurrentlyPlaying(track.url)) return;
    if (!canControl && roomMusic) {
      showAlert({
        type: 'info',
        title: t('room.musicNowPlaying'),
        message: t('room.musicListening'),
      });
      return;
    }
    setBusyUrl(track.url);
    try {
      const result = await playOrQueueTrack(roomId, track, roomMusic);
      if (result === 'played') {
        setTab('queue');
        showAlert({
          type: 'success',
          title: t('room.musicLiveTitle'),
          message: t('room.musicLiveMessage'),
        });
      } else {
        showAlert({
          type: 'success',
          title: t('room.musicQueuedTitle'),
          message: t('room.musicQueuedMessage'),
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('room.musicUploadFailed');
      showAlert({ type: 'error', title: t('common.error'), message: msg });
    } finally {
      setBusyUrl(null);
    }
  };

  const pickAndAddFromDevice = useCallback(async () => {
    if (pickingFiles) return;
    setPickingFiles(true);
    onClose();
    try {
      await waitAfterSheetDismiss();
      const files = await pickDeviceAudioFiles();
      if (!files.length) return;

      // كل الملفات تدخل مكتبة الجهاز والطابور دفعة — التشغيل الفوري فقط
      // حين لا توجد موسيقى (الإضافة لا تقطع أبداً؛ للقطع زر «تشغيل الآن»)
      const result = await addDeviceFilesToRoomMusic(roomId, files, roomMusic);

      if (result.failed.length) {
        // تجميع النتائج بدل ابتلاع الأخطاء: «أُضيفت 4 من 5 — تعذّر فتح X»
        const names = result.failed
          .map((f) => `${f.name} (${f.reason})`)
          .join('، ');
        showAlert({
          type: result.added ? 'warning' : 'error',
          title: t('room.musicAddedSummary', {
            added: result.added,
            total: result.total,
          }),
          message: t('room.musicAddFailedFiles', { names }),
        });
      } else if (result.playedNow) {
        showAlert({
          type: 'success',
          title: t('room.musicLiveTitle'),
          message: t('room.musicLiveMessage'),
        });
      } else {
        showAlert({
          type: 'success',
          title: t('common.success'),
          message: t('room.musicAddedToQueue', { count: result.added }),
        });
      }
      if (result.added) setTab('queue');
    } catch (e) {
      const msg =
        e instanceof RoomMusicFileTooLargeError
          ? t('room.musicFileTooLarge', { max: e.maxMb })
          : e instanceof Error
            ? e.message
            : t('room.musicPickFailed');
      showAlert({ type: 'error', title: t('common.error'), message: msg });
    } finally {
      setPickingFiles(false);
      onReopen?.();
    }
  }, [pickingFiles, onClose, onReopen, roomId, showAlert, t, roomMusic]);

  /** «متابعة الطابور» — بعد نزول/مغادرة الـDJ: أي جالس يتابع من المقطع التالي */
  const continueQueue = useCallback(async () => {
    if (playAllBusy) return;
    setPlayAllBusy(true);
    try {
      const advanced = await advanceRoomMusicQueue(roomId);
      if (advanced) {
        setTab('queue');
        showAlert({
          type: 'success',
          title: t('room.musicLiveTitle'),
          message: t('room.musicLiveMessage'),
        });
      } else {
        // كل مقاطع الطابور ملفات محلية على أجهزة أصحابها — الصمت كان
        // يوحي أن الزر معطّل؛ رسالة صريحة بدل لا-شيء
        showAlert({
          type: 'info',
          title: t('room.musicContinueQueue'),
          message: t('room.musicQueueNonePlayable'),
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('room.musicUploadFailed');
      showAlert({ type: 'error', title: t('common.error'), message: msg });
    } finally {
      setPlayAllBusy(false);
    }
  }, [playAllBusy, roomId, showAlert, t]);

  /** «تشغيل الآن» الصريح — قطع متعمد للمقطع الحالي */
  const handlePlayNow = useCallback(
    async (track: Pick<UserMusicTrack, 'url' | 'title' | 'fileName'>) => {
      setBusyUrl(track.url);
      try {
        await playTrackNowInRoom(roomId, track);
        setTab('queue');
      } catch (e) {
        const msg = e instanceof Error ? e.message : t('room.musicUploadFailed');
        showAlert({ type: 'error', title: t('common.error'), message: msg });
      } finally {
        setBusyUrl(null);
      }
    },
    [roomId, showAlert, t],
  );

  /** «تثبيت في صندوق الروم» — رفع اختياري بالخلفية ليبقى المقطع مشتركاً */
  const handlePinTrack = useCallback(
    async (track: UserMusicTrack) => {
      if (pinningId) return;
      setPinningId(track.id);
      try {
        await pinTrackToRoomBox(roomId, track);
        showToast(t('room.musicPinnedToRoomBox'));
      } catch {
        showToast(t('room.musicPinFailed'));
      } finally {
        setPinningId(null);
      }
    },
    [pinningId, roomId, showToast, t],
  );

  const handlePlayAll = async () => {
    // append-only: المقطع الشغّال حالياً لا يُعاد إلحاقه بالقائمة (كان يتكرر)
    const source = (
      tab === 'queue'
        ? filteredQueue.map((item) => ({
            url: item.url,
            title: item.title,
            fileName: item.fileName,
          }))
        : filteredLibrary
    ).filter((trk) => trk.url !== roomMusic?.url);
    if (!source.length) return;
    if (!canControl && roomMusic) {
      showAlert({
        type: 'info',
        title: t('room.musicNowPlaying'),
        message: t('room.musicListening'),
      });
      return;
    }
    setPlayAllBusy(true);
    try {
      await playAllTracksInRoom(roomId, source, roomMusic);
      setTab('queue');
      showAlert({
        type: 'success',
        title: t('room.musicLiveTitle'),
        message: t('room.musicLiveMessage'),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('room.musicUploadFailed');
      showAlert({ type: 'error', title: t('common.error'), message: msg });
    } finally {
      setPlayAllBusy(false);
    }
  };

  const renderThumb = (uri?: string) => (
    <View style={styles.thumb}>
      {uri ? (
        <Image source={{ uri }} style={styles.thumbImg} contentFit="cover" />
      ) : (
        <Music2 size={20} color="#E11414" strokeWidth={2} />
      )}
    </View>
  );

  const renderAvatar = (uri?: string, name?: string) => (
    <View style={styles.avatar}>
      {uri ? (
        <Image source={{ uri }} style={styles.avatarImg} contentFit="cover" />
      ) : (
        <Text variant="caption" color="#fff" weight="bold">
          {(name ?? '?').slice(0, 1)}
        </Text>
      )}
    </View>
  );

  const renderNowPlayingRow = () => {
    if (!roomMusic) return null;
    const playing = roomMusic.isPlaying;
    return (
      <View style={styles.songRow}>
        {canStopMusic ? (
          <Pressable
            onPress={() => void playback?.stopBroadcast()}
            style={styles.iconBtn}
            hitSlop={8}
          >
            <X size={20} color="#FF4D4F" strokeWidth={2.5} />
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
        <MusicPlayingBars active={playing} />
        {renderAvatar(roomMusic.addedByAvatar, roomMusic.addedByName)}
        <View style={styles.songMeta}>
          <Text
            variant="body"
            color={playing ? '#FF4D4F' : '#fff'}
            numberOfLines={1}
            align="right"
          >
            {roomMusic.title}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.45)" numberOfLines={1} align="right">
            {roomMusic.addedByName || t('room.musicUnknownArtist')}
          </Text>
        </View>
        {renderThumb(roomMusic.addedByAvatar)}
      </View>
    );
  };

  const renderLibraryRow = (track: UserMusicTrack) => {
    const playing = isCurrentlyPlaying(track.url);
    const busy = busyUrl === track.url;
    // «تشغيل الآن» الصريح — للقطع المتعمد أثناء تشغيل مقطع آخر
    const showPlayNow = !!roomMusic && !playing && (canControl || canManageMusic);
    // «تثبيت في صندوق الروم» — رفع اختياري لمقاطعي المحلية (لا رفع إجباري)
    const canPin =
      track.url.startsWith('local://') && (!track.addedByUid || track.addedByUid === myUid);
    return (
      <View style={styles.songRow}>
        <Pressable
          onPress={() => void handlePlayTrack(track)}
          disabled={playing || busy}
          style={styles.iconBtn}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#FF4D4F" />
          ) : playing ? (
            <MusicPlayingBars active />
          ) : (
            <Text variant="caption" weight="bold" color="#FF4D4F">
              {t('room.musicPlay')}
            </Text>
          )}
        </Pressable>
        {showPlayNow ? (
          <Pressable
            onPress={() => void handlePlayNow(track)}
            disabled={busy}
            style={styles.playNowBtn}
            hitSlop={6}
          >
            <Text variant="caption" weight="bold" color="#FFB74D">
              {t('room.musicPlayNow')}
            </Text>
          </Pressable>
        ) : null}
        {canPin ? (
          <Pressable
            onPress={() => void handlePinTrack(track)}
            disabled={pinningId === track.id}
            style={styles.pinBtn}
            hitSlop={6}
          >
            {pinningId === track.id ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
            ) : (
              <Text variant="caption" color="rgba(255,255,255,0.6)">
                {t('room.musicPinToRoomBox')}
              </Text>
            )}
          </Pressable>
        ) : null}
        <View style={styles.songMeta}>
          <Text
            variant="body"
            color={playing ? '#FF4D4F' : '#fff'}
            numberOfLines={1}
            align="right"
          >
            {track.title}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.45)" numberOfLines={1} align="right">
            {track.artist?.trim() || t('room.musicUnknownArtist')}
          </Text>
        </View>
        {renderThumb()}
      </View>
    );
  };

  const renderQueueRow = (qItem: RoomMusicQueueItem) => {
    const playing = isCurrentlyPlaying(qItem.url);
    const busy = busyUrl === qItem.url;
    // ملف محلي على جهاز DJ سابق/عضو آخر — لا يمكن خلطه من هذا الجهاز
    const unavailable = isQueueItemUnavailableFor(qItem, activeDjUid);
    const showPlayNow =
      !!roomMusic && !playing && !unavailable && (canControl || canManageMusic);
    return (
      <View style={[styles.songRow, unavailable ? styles.rowUnavailable : null]}>
        {canControl ? (
          <Pressable
            onPress={() => void removeFromRoomMusicQueue(roomId, qItem.id)}
            style={styles.iconBtn}
            hitSlop={8}
          >
            <X size={20} color="#FF4D4F" strokeWidth={2.5} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() =>
              void handlePlayTrack({
                url: qItem.url,
                title: qItem.title,
                fileName: qItem.fileName,
              })
            }
            disabled={playing || busy || unavailable}
            style={styles.iconBtn}
          >
            {busy ? <ActivityIndicator size="small" color="#FF4D4F" /> : null}
          </Pressable>
        )}
        {showPlayNow ? (
          <Pressable
            onPress={() =>
              void handlePlayNow({
                url: qItem.url,
                title: qItem.title,
                fileName: qItem.fileName,
              })
            }
            disabled={busy}
            style={styles.playNowBtn}
            hitSlop={6}
          >
            <Text variant="caption" weight="bold" color="#FFB74D">
              {t('room.musicPlayNow')}
            </Text>
          </Pressable>
        ) : null}
        {playing ? <MusicPlayingBars active /> : <View style={styles.barsPlaceholder} />}
        {renderAvatar(undefined, qItem.addedByName)}
        <Pressable
          style={styles.songMeta}
          disabled={unavailable}
          onPress={() =>
            void handlePlayTrack({
              url: qItem.url,
              title: qItem.title,
              fileName: qItem.fileName,
            })
          }
        >
          <Text
            variant="body"
            color={playing ? '#FF4D4F' : unavailable ? 'rgba(255,255,255,0.45)' : '#fff'}
            numberOfLines={1}
            align="right"
          >
            {qItem.title}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.45)" numberOfLines={1} align="right">
            {unavailable
              ? `${qItem.addedByName} — ${t('room.musicUnavailableTrack')}`
              : qItem.addedByName}
          </Text>
        </Pressable>
        {renderThumb()}
      </View>
    );
  };

  const renderRow = ({ item }: { item: RowItem }) => {
    if (item.kind === 'now') return renderNowPlayingRow();
    if (item.kind === 'library') return renderLibraryRow(item.track);
    return renderQueueRow(item.item);
  };

  const showPlayerBar = !!roomMusic && !!playback;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.screen,
          { paddingTop: insets.top, paddingBottom: insets.bottom + (showPlayerBar ? 0 : 8) },
        ]}
      >
        {panel === 'add' ? (
          <RoomMusicAddPanel
            roomId={roomId}
            roomMusic={roomMusic}
            onBack={() => {
              setPanel('main');
              void refreshLibrary();
            }}
            onAdded={() => void refreshLibrary()}
            onPickFromDevice={() => pickAndAddFromDevice()}
            picking={pickingFiles}
          />
        ) : (
          <>
            <View style={styles.header}>
              <Pressable onPress={() => setPanel('add')} style={styles.headerIcon} hitSlop={10}>
                <Settings size={22} color="rgba(255,255,255,0.85)" />
              </Pressable>
              <Text variant="body" weight="bold" color="#fff" align="center" style={styles.headerTitle}>
                {t('room.musicLibTitle')}
              </Text>
              <Pressable onPress={onClose} style={styles.headerIcon} hitSlop={10}>
                <X size={22} color="rgba(255,255,255,0.85)" />
              </Pressable>
            </View>

            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('room.musicSearchPlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  style={styles.searchInput}
                  textAlign={I18nManager.isRTL ? 'right' : 'left'}
                />
                <Search size={18} color="rgba(255,255,255,0.45)" />
              </View>
            </View>

            <View style={styles.tabs}>
              <Pressable onPress={() => setTab('library')} style={styles.tabBtn}>
                <Text
                  variant="body"
                  weight={tab === 'library' ? 'bold' : 'regular'}
                  color={tab === 'library' ? '#fff' : 'rgba(255,255,255,0.55)'}
                >
                  {t('room.musicTabMine', { count: library.length })}
                </Text>
                {tab === 'library' ? <View style={styles.tabIndicator} /> : null}
              </Pressable>
              <Pressable onPress={() => setTab('queue')} style={styles.tabBtn}>
                <Text
                  variant="body"
                  weight={tab === 'queue' ? 'bold' : 'regular'}
                  color={tab === 'queue' ? '#fff' : 'rgba(255,255,255,0.55)'}
                >
                  {t('room.musicTabQueue', { count: queueCount })}
                </Text>
                {tab === 'queue' ? <View style={styles.tabIndicator} /> : null}
              </Pressable>
            </View>

            {loadingLib && tab === 'library' ? (
              <View style={styles.listArea}>
                <ActivityIndicator color="#FF4D4F" />
              </View>
            ) : (
              <FlatList
                data={rows}
                keyExtractor={(row) =>
                  row.kind === 'library'
                    ? row.track.id
                    : row.kind === 'queue'
                      ? row.item.id
                      : row.key
                }
                style={styles.listArea}
                contentContainerStyle={rows.length ? styles.listContent : styles.listEmpty}
                ListEmptyComponent={
                  <Text variant="body" color="rgba(255,255,255,0.45)" align="center">
                    {tab === 'queue' ? t('room.musicQueueEmpty') : t('room.musicLibraryEmpty')}
                  </Text>
                }
                renderItem={renderRow}
              />
            )}

            {!showPlayerBar ? (
              <View style={styles.footer}>
                {/* لا موسيقى والطابور غير فارغ (نزل الـDJ السابق) — أي جالس
                    يتابع الطابور فيصبح الـDJ الجديد من المقطع التالي */}
                {!roomMusic && queue.length > 0 ? (
                  <Pressable
                    style={[styles.footerBtn, styles.footerPlayAll]}
                    onPress={() => void continueQueue()}
                    disabled={playAllBusy}
                  >
                    {playAllBusy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text variant="body" weight="bold" color="#fff">
                        {t('room.musicContinueQueue')}
                      </Text>
                    )}
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.footerBtn, styles.footerPlayAll]}
                    onPress={() => void handlePlayAll()}
                    disabled={playAllBusy || !rows.length}
                  >
                    {playAllBusy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text variant="body" weight="bold" color="#fff">
                        {t('room.musicPlayAll')}
                      </Text>
                    )}
                  </Pressable>
                )}
                <Pressable
                  style={[styles.footerBtn, styles.footerAdd]}
                  onPress={() => void pickAndAddFromDevice()}
                  disabled={pickingFiles}
                >
                  {pickingFiles ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text variant="body" weight="bold" color="#fff">
                      {t('room.musicAddBtn')}
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <RoomMusicPlaybackBar roomId={roomId} playback={playback} />
            )}

            {showPlayerBar ? (
              <Pressable
                style={styles.addFloating}
                onPress={() => void pickAndAddFromDevice()}
                disabled={pickingFiles}
              >
                {pickingFiles ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text variant="caption" weight="bold" color="#fff">
                    {t('room.musicAddBtn')}
                  </Text>
                )}
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#200D0D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
  },
  searchRow: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2235',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    padding: 0,
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  tabIndicator: {
    marginTop: 6,
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FF6B35',
  },
  listArea: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 56,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 32,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  iconBtn: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playNowBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 183, 77, 0.14)',
  },
  pinBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rowUnavailable: {
    opacity: 0.55,
  },
  barsPlaceholder: {
    width: 22,
  },
  songMeta: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(225, 20, 20,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  footerBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerPlayAll: {
    backgroundColor: '#FF4D4F',
  },
  footerAdd: {
    backgroundColor: '#ED4444',
  },
  addFloating: {
    position: 'absolute',
    right: 16,
    bottom: 148,
    backgroundColor: '#FF4D4F',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
