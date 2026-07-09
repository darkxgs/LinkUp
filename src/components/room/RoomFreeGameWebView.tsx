/**
 * WebView ألعاب الروم المجانية — بدون رهان، مع دعوات
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { X, Share2, UserPlus } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { colors, spacing } from '@/theme';
import {
  buildRoomFreeGameUrl,
  getRoomFreeGame,
  type RoomFreeGameId,
} from '@/constants/roomFreeGames';
import { sendRoomGameInviteMessage } from '@/services/firebase/rooms';
import { getRoomGameSession } from '@/services/firebase/roomGameSessions';
import { sendTargetedRoomGameInvite } from '@/services/firebase/roomGameInvites';
import { RoomGameVoiceBar } from '@/components/room/RoomGameVoiceBar';
import {
  RoomGamePlayerPickerSheet,
  type RoomGamePickerMember,
} from '@/components/room/RoomGamePlayerPickerSheet';

interface Props {
  visible: boolean;
  gameId: RoomFreeGameId;
  sessionId: string;
  roomId: string;
  playerName: string;
  uid: string;
  joinCode?: string;
  autoCreate?: boolean;
  canMic?: boolean;
  volumeMuted?: boolean;
  onToggleVolume?: () => void;
  micMuted?: boolean;
  onToggleMic?: () => void;
  roomMembers?: RoomGamePickerMember[];
  onClose: () => void;
}

export function RoomFreeGameWebView({
  visible,
  gameId,
  sessionId,
  roomId,
  playerName,
  uid,
  joinCode,
  autoCreate,
  canMic = false,
  volumeMuted = false,
  onToggleVolume,
  micMuted,
  onToggleMic,
  roomMembers = [],
  onClose,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [invitingUid, setInvitingUid] = useState<string | null>(null);

  const game = getRoomFreeGame(gameId);

  const inviteCandidates = useMemo(
    () => roomMembers.filter((m) => m.uid && m.uid !== uid),
    [roomMembers, uid],
  );

  const gameUrl = useMemo(() => {
    if (!game || game.mode !== 'webview') return '';
    return buildRoomFreeGameUrl({
      game,
      sessionId,
      roomId,
      uid,
      playerName,
      joinCode,
      autoCreate,
      autoJoin: !!joinCode && !autoCreate,
    });
  }, [game, sessionId, roomId, uid, playerName, joinCode, autoCreate]);

  const initScript = useMemo(
    () => `
      (function(){
        var payload = ${JSON.stringify({
          type: 'INIT_DATA',
          playerName,
          sessionId,
          roomId,
          uid,
          joinCode: joinCode || '',
          freePlay: true,
        })};
        window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(payload) }));
      })();
      true;
    `,
    [playerName, sessionId, roomId, uid, joinCode],
  );

  const postInviteToChat = useCallback(
    async (opts?: { targetUid?: string; targetName?: string; privateNote?: boolean }) => {
      if (!game) return;
      const session = await getRoomGameSession(sessionId);
      const code = session?.joinCode || joinCode || '';
      const gameName = t(game.nameKey);
      const preview = opts?.privateNote
        ? t('roomGameInvite.chatPrivate', { host: playerName, name: opts.targetName ?? '', game: gameName })
        : t('roomGameInvite.chatPublic', { host: playerName, game: gameName, code });

      await sendRoomGameInviteMessage(roomId, {
        sessionId,
        gameId: game.id,
        gameName,
        joinCode: code,
        targetUid: opts?.targetUid,
        targetName: opts?.targetName,
        previewText: preview,
      });
    },
    [game, sessionId, joinCode, roomId, playerName, t],
  );

  const handleShareToRoomChat = useCallback(async () => {
    try {
      await postInviteToChat();
      Alert.alert(t('roomGameInvite.sharedTitle'), t('roomGameInvite.sharedBody'));
    } catch {
      Alert.alert(t('common.error'), t('room.shareFailed'));
    }
  }, [postInviteToChat, t]);

  const handlePickPlayer = useCallback(
    async (member: RoomGamePickerMember) => {
      if (!game) return;
      setInvitingUid(member.uid);
      try {
        const session = await getRoomGameSession(sessionId);
        const code = session?.joinCode || joinCode || '';
        await sendTargetedRoomGameInvite({
          targetUid: member.uid,
          targetName: member.name,
          roomId,
          sessionId,
          gameId: game.id,
          gameName: t(game.nameKey),
          gameEmoji: game.emoji,
          joinCode: code,
          hostName: playerName,
        });
        await postInviteToChat({
          targetUid: member.uid,
          targetName: member.name,
          privateNote: true,
        });
        setPickerOpen(false);
        Alert.alert(
          t('roomGameInvite.inviteSentTitle'),
          t('roomGameInvite.inviteSentBody', { name: member.name }),
        );
      } catch (e: any) {
        Alert.alert(t('common.error'), e?.message ?? t('room.shareFailed'));
      } finally {
        setInvitingUid(null);
      }
    },
    [game, sessionId, joinCode, roomId, playerName, postInviteToChat, t],
  );

  const onMessage = useCallback(
    (ev: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(ev.nativeEvent.data);
        if (data.type === 'CLOSE_GAME') onClose();
        if (data.type === 'INVITE_ROOM_CHAT') void handleShareToRoomChat();
        if (data.type === 'INVITE_PLAYER') setPickerOpen(true);
      } catch {
        /* ignore */
      }
    },
    [onClose, handleShareToRoomChat],
  );

  useEffect(() => {
    if (visible) setLoading(true);
    if (!visible) setPickerOpen(false);
  }, [visible, gameUrl]);

  if (!game || !gameUrl) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.bar}>
          <Text variant="body" weight="bold" color={colors.white} numberOfLines={1} style={styles.title}>
            {game.emoji} {t(game.nameKey)}
          </Text>
          <RoomGameVoiceBar
            canMic={canMic}
            volumeMuted={volumeMuted}
            onToggleVolume={onToggleVolume ?? (() => {})}
            micMuted={micMuted}
            onToggleMic={onToggleMic}
          />
          <Pressable onPress={() => setPickerOpen(true)} style={styles.iconBtn} hitSlop={8}>
            <UserPlus size={20} color={colors.white} />
          </Pressable>
          <Pressable onPress={() => void handleShareToRoomChat()} style={styles.iconBtn} hitSlop={8}>
            <Share2 size={20} color={colors.white} />
          </Pressable>
          <Pressable onPress={onClose} style={styles.iconBtn} hitSlop={8}>
            <X size={22} color={colors.white} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#E11414" />
          </View>
        ) : null}

        <WebView
          ref={webRef}
          source={{ uri: gameUrl }}
          style={styles.web}
          onLoadEnd={() => setLoading(false)}
          onMessage={onMessage}
          injectedJavaScript={initScript}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          setSupportMultipleWindows={false}
          originWhitelist={['*']}
          androidLayerType="hardware"
          cacheEnabled
          decelerationRate="normal"
          contentInsetAdjustmentBehavior="never"
        />
      </View>

      <RoomGamePlayerPickerSheet
        visible={pickerOpen}
        members={inviteCandidates}
        sendingUid={invitingUid}
        onClose={() => setPickerOpen(false)}
        onPick={(m) => void handlePickPlayer(m)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0405' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  title: { flex: 1, minWidth: 0 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  web: { flex: 1, backgroundColor: '#0A0405' },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    backgroundColor: 'rgba(24, 6, 6, 0.6)',
  },
});
