import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Globe, Users, Lock, Shield, Settings, Mic, Image as ImageIcon, Edit2, CheckCircle2, Minus, Plus, Info, Diamond, Clock, Camera } from 'lucide-react-native';
import { ImageBackground, Image } from 'expo-image';

import { Text, BackChevron } from '@/components/ui';
import { RoomBlockedUsersPanel } from '@/components/room/RoomBlockedUsersPanel';
import { lu } from '@/theme/lu-brand';
import { radius, spacing } from '@/theme';
import { COIN_CURRENCY_ICON } from '@/constants/brandAssets';
import { fetchRoomOnce, type Room, isAgencyLiveRoom, resolveRoomMaxSeatsCount, purchaseSecondHostMic, vacateSecondHostSeat } from '@/services/firebase/rooms';
import { useConfig } from '@/contexts/ConfigContext';
import { ALLOWED_SEAT_COUNTS, type AllowedSeatCount } from '@/services/firebase/roomSeats';
import { AgencyLevelTimeline } from '@/components/room/AgencyLevelTimeline';
import {
  AGENCY_THRONE_UNLOCK_LEVEL,
  isAgencyThroneUnlockedByLevel,
  resolveSupervisorCapForLevel,
} from '@/services/agencyLevels';
import {
  getAgencyEffectivePeriodLevel,
  getAgencyPeriodWeekKey,
  subscribeToAgencyById,
  updateAgencyImages,
  type Agency,
} from '@/services/agencyService';
import { invalidateAgenciesCache } from '@/services/firebase/social';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useAgencyLevelsConfig } from '@/hooks/useAgencyLevelsConfig';
import {
  updateRoomPermissions,
  updateRoomManagedSettings,
  parseRoomPermissions,
  syncAgencyMaxSeatsToRoom,
  applyAgencySeatsDirectly,
  canDirectlySetAgencySeatLimit,
} from '@/services/firebase/roomMemberRoles';
import { auth } from '@/services/firebase/index';
import { vacateRoomThrone } from '@/services/roomThrone';
import {
  submitAgencySeatRequest,
  subscribeToAgencyPendingSeatRequests,
  type AgencySeatRequest,
} from '@/services/agencySeatRequests';

type Mode = 'public' | 'friend' | 'locked';

type Props = {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  canManage: boolean;
  canManageBlocks?: boolean;
  initialPanel?: SettingsPanel;
};

type SettingsPanel = 'main' | 'blocked';

export function RoomSettingsSheet({
  visible,
  onClose,
  roomId,
  canManage,
  canManageBlocks = false,
  initialPanel = 'main',
}: Props) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar') === true;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [name, setName] = useState('');
  const [welcome, setWelcome] = useState('');
  const [mode, setMode] = useState<Mode>('public');
  const [password, setPassword] = useState('');
  const [seats, setSeats] = useState<AllowedSeatCount>(9);
  const [maxSeats, setMaxSeats] = useState<number>(21);
  const [roomRtdb, setRoomRtdb] = useState<Record<string, unknown> | null>(null);
  const [seatFee, setSeatFee] = useState(0);
  const [guestMic, setGuestMic] = useState(false);
  const [guestShareVideo, setGuestShareVideo] = useState(false);
  const [guestShareMusic, setGuestShareMusic] = useState(false);
  const [guestInviteAgency, setGuestInviteAgency] = useState(false);
  const [guestSendInvite, setGuestSendInvite] = useState(false);
  const [guestInviteMic, setGuestInviteMic] = useState(false);
  const [memberMic, setMemberMic] = useState(true);
  const [memberShareVideo, setMemberShareVideo] = useState(false);
  const [memberShareMusic, setMemberShareMusic] = useState(false);
  const [memberInviteAgency, setMemberInviteAgency] = useState(false);
  const [memberSendInvite, setMemberSendInvite] = useState(true);
  const [memberInviteMic, setMemberInviteMic] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [offMicEmoji, setOffMicEmoji] = useState(true);
  const [offMicDice, setOffMicDice] = useState(true);
  const [modKickBan, setModKickBan] = useState(true);
  const [modManageMic, setModManageMic] = useState(true);
  const [modLockSeats, setModLockSeats] = useState(true);
  const [modReviewVideo, setModReviewVideo] = useState(true);
  const [modPinMessages, setModPinMessages] = useState(true);
  const [modManageRoles, setModManageRoles] = useState(true);
  const [modBlockUsers, setModBlockUsers] = useState(true);
  const [modResetMicSupport, setModResetMicSupport] = useState(true);
  const [modManageEffects, setModManageEffects] = useState(true);
  const [modCleanChat, setModCleanChat] = useState(true);
  const [modInviteMic, setModInviteMic] = useState(true);
  const [modCancelMembership, setModCancelMembership] = useState(true);
  const [modManageLuckyBags, setModManageLuckyBags] = useState(true);
  const [modSettings, setModSettings] = useState(true);
  const [modMode, setModMode] = useState(true);
  const [throneEnabled, setThroneEnabled] = useState(false);
  const [secondHostMic, setSecondHostMic] = useState(false);
  const [secondHostMicOwned, setSecondHostMicOwned] = useState(false);
  const [buyingSecondMic, setBuyingSecondMic] = useState(false);
  const [agencyPeriodLevel, setAgencyPeriodLevel] = useState(0);
  const [isAgencyRoom, setIsAgencyRoom] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [pendingSeatRequests, setPendingSeatRequests] = useState<AgencySeatRequest[]>([]);
  const [requestingSeats, setRequestingSeats] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [saving, setSaving] = useState(false);
  const [panel, setPanel] = useState<SettingsPanel>(initialPanel);
  const [roomBg, setRoomBg] = useState<string | undefined>();
  const [agencyDoc, setAgencyDoc] = useState<Agency | null>(null);
  const [agencyLogo, setAgencyLogo] = useState<string | undefined>();
  const [agencyBanner, setAgencyBanner] = useState<string | undefined>();
  const levelsConfig = useAgencyLevelsConfig();
  const { secondHostMic: secondHostMicConfig } = useConfig();
  const logoUpload = useImageUpload();
  const coverUpload = useImageUpload();

  const handleBuySecondHostMic = async () => {
    if (!roomId || buyingSecondMic) return;
    Alert.alert(
      'شراء مايك مدير ثانٍ',
      `سيتم خصم ${secondHostMicConfig.price.toLocaleString()} كوين، ويظهر مقعد مدير ثانٍ جنب مقعد المضيف.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'شراء',
          onPress: async () => {
            setBuyingSecondMic(true);
            try {
              await purchaseSecondHostMic(roomId, secondHostMicConfig.price);
              setSecondHostMic(true);
              setSecondHostMicOwned(true);
              Alert.alert('تم', 'تم تفعيل مقعد المدير الثاني 🎉');
            } catch (e: any) {
              Alert.alert('خطأ', e?.message ?? 'تعذّر الشراء');
            } finally {
              setBuyingSecondMic(false);
            }
          },
        },
      ],
    );
  };

  const handlePickAgencyLogo = async () => {
    if (!agencyId) return;
    const url = await logoUpload.pickAndUpload({ folder: 'banners', aspect: [1, 1], allowsEditing: true, quality: 0.8 });
    if (url) {
      try {
        await updateAgencyImages(agencyId, { logo: url });
        setAgencyLogo(url);
        invalidateAgenciesCache();
        Alert.alert(t('common.done'), t('roomSettings.agencyLogoUpdated'));
      } catch (e: any) {
        Alert.alert(t('common.error'), e?.message ?? t('common.error'));
      }
    }
  };

  const handlePickAgencyBanner = async () => {
    if (!agencyId) return;
    const url = await coverUpload.pickAndUpload({ folder: 'banners', aspect: [16, 9], allowsEditing: true, quality: 0.8 });
    if (url) {
      try {
        await updateAgencyImages(agencyId, { banner: url });
        setAgencyBanner(url);
        invalidateAgenciesCache();
        Alert.alert(t('common.done'), t('roomSettings.agencyCoverUpdated'));
      } catch (e: any) {
        Alert.alert(t('common.error'), e?.message ?? t('common.error'));
      }
    }
  };

  const periodSupportCoins = useMemo(() => {
    if (!agencyDoc) return 0;
    const weekKey = getAgencyPeriodWeekKey();
    if (String(agencyDoc.periodSupportWeekKey ?? '') !== weekKey) return 0;
    return Math.max(0, Number(agencyDoc.periodSupportCoins) || 0);
  }, [agencyDoc]);

  useEffect(() => {
    if (!visible) setPanel('main');
  }, [visible]);

  // قراءة واحدة عند الفتح بدل اشتراك حيّ: عقدة الروم تتغيّر باستمرار في الروم المباشر،
  // والاشتراك كان يعيد رسم الشاشة كلها مع كل تحديث (تهنيج السكرول) ويمسح ما يكتبه المستخدم.
  useEffect(() => {
    if (!visible || !roomId) return;
    let cancelled = false;
    void fetchRoomOnce(roomId).then((r) => {
      if (cancelled || !r) return;
      setName(r.name ?? '');
      setWelcome(r.welcomeMessage ?? '');
      const m = r.mode ?? (r.isPrivate ? 'locked' : 'public');
      setMode(m);
      setPassword(r.password ?? '');
      setSeats((r.seatsCount as AllowedSeatCount) ?? 9);
      setRoomRtdb(r as unknown as Record<string, unknown>);
      setSeatFee(r.seatFee ?? 0);
      setRoomBg(r.background);
      const p = r.permissions ?? parseRoomPermissions(r as unknown as Record<string, unknown>);
      setGuestMic(p.guestCanTakeMic);
      setGuestShareVideo(p.guestCanShareVideo);
      setGuestShareMusic(p.guestCanShareMusic);
      setGuestInviteAgency(p.guestCanInviteToAgency);
      setGuestSendInvite(p.guestCanSendRoomInvite);
      setGuestInviteMic(p.guestCanInviteToMic);
      setMemberMic(p.memberCanTakeMic);
      setMemberShareVideo(p.memberCanShareVideo);
      setMemberShareMusic(p.memberCanShareMusic);
      setMemberInviteAgency(p.memberCanInviteToAgency);
      setMemberSendInvite(p.memberCanSendRoomInvite);
      setMemberInviteMic(p.memberCanInviteToMic);
      setShowHistory(p.showMessageHistory);
      setOffMicEmoji(p.allowOffMicEmojis);
      setOffMicDice(p.allowOffMicDice);
      setModKickBan(p.moderatorsCanKickBan);
      setModManageMic(p.moderatorsCanManageMic);
      setModLockSeats(p.moderatorsCanLockSeats);
      setModReviewVideo(p.moderatorsCanReviewVideo);
      setModPinMessages(p.moderatorsCanPinMessages);
      setModManageRoles(p.moderatorsCanManageRoles);
      setModBlockUsers(p.moderatorsCanBlockUsers);
      setModResetMicSupport(p.moderatorsCanResetMicSupport);
      setModManageEffects(p.moderatorsCanManageEffects);
      setModCleanChat(p.moderatorsCanCleanChat);
      setModInviteMic(p.moderatorsCanInviteMic);
      setModCancelMembership(p.moderatorsCanCancelMembership);
      setModManageLuckyBags(p.moderatorsCanManageLuckyBags);
      setModSettings(p.moderatorsCanChangeSettings);
      setModMode(p.moderatorsCanChangeMode);
      setThroneEnabled(r.throneEnabled === true);
      setSecondHostMic((r as Room).secondHostMic === true);
      setSecondHostMicOwned(
        (r as Room).secondHostMicOwned === true || (r as Room).secondHostMic === true,
      );
      setAgencyPeriodLevel(Number((r as Room).agencyPeriodLevel) || 0);
      setIsAgencyRoom(isAgencyLiveRoom(r));
      setAgencyId(r.agencyId ?? null);
      setIsHost(r.hostUid === auth.currentUser?.uid);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, roomId]);

  useEffect(() => {
    if (!roomRtdb) return;
    setMaxSeats(resolveRoomMaxSeatsCount(roomRtdb, agencyDoc?.maxSeatsCount));
  }, [roomRtdb, agencyDoc?.maxSeatsCount]);

  useEffect(() => {
    if (!visible || !isAgencyRoom || !agencyId || !isHost || !roomId) return;
    void syncAgencyMaxSeatsToRoom(roomId, agencyId)
      .then(setMaxSeats)
      .catch(() => {});
  }, [visible, isAgencyRoom, agencyId, isHost, roomId, agencyDoc?.maxSeatsCount]);

  useEffect(() => {
    if (!visible || !isAgencyRoom || !agencyId) {
      setAgencyDoc(null);
      return;
    }
    return subscribeToAgencyById(agencyId, (agency) => {
      setAgencyDoc(agency);
      if (agency) {
        setAgencyLogo(agency.logo);
        setAgencyBanner(agency.banner);
      }
    });
  }, [visible, isAgencyRoom, agencyId]);

  useEffect(() => {
    if (!visible || !roomId || !isAgencyRoom || !isHost || !agencyId) return;
    void getAgencyEffectivePeriodLevel(agencyId)
      .then(setAgencyPeriodLevel)
      .catch(() => {});
  }, [visible, roomId, isAgencyRoom, isHost, agencyId, periodSupportCoins, levelsConfig]);

  useEffect(() => {
    if (!visible || !isAgencyRoom || !agencyId) {
      setPendingSeatRequests([]);
      return;
    }
    return subscribeToAgencyPendingSeatRequests(agencyId, setPendingSeatRequests);
  }, [visible, isAgencyRoom, agencyId]);

  const throneUnlockedByLevel = isAgencyThroneUnlockedByLevel(agencyPeriodLevel, levelsConfig);

  const supervisorCap = useMemo(
    () => resolveSupervisorCapForLevel(Math.max(1, agencyPeriodLevel || 1), levelsConfig),
    [agencyPeriodLevel, levelsConfig],
  );

  const pendingSeatCounts = useMemo(
    () => new Set(pendingSeatRequests.map((r) => r.requestedSeatsCount)),
    [pendingSeatRequests],
  );

  const canDirectlyRaiseSeats = useMemo(() => {
    const uid = auth.currentUser?.uid;
    if (!isAgencyRoom || !roomRtdb || !uid) return false;
    return canDirectlySetAgencySeatLimit(roomRtdb, uid);
  }, [isAgencyRoom, roomRtdb]);

  const handleSeatPress = (count: AllowedSeatCount) => {
    if (count <= maxSeats) {
      if (count === seats) return;
      const previous = seats;
      setSeats(count);
      void (async () => {
        setRequestingSeats(true);
        try {
          await updateRoomManagedSettings(roomId, { seatsCount: count });
        } catch (e: any) {
          setSeats(previous);
          Alert.alert(t('common.error'), e?.message ?? t('common.error'));
        } finally {
          setRequestingSeats(false);
        }
      })();
      return;
    }
    if (canDirectlyRaiseSeats && isAgencyRoom && agencyId && count <= 21) {
      const previous = seats;
      const previousMax = maxSeats;
      setSeats(count);
      setMaxSeats((m) => Math.max(m, count));
      void (async () => {
        setRequestingSeats(true);
        try {
          await applyAgencySeatsDirectly(roomId, agencyId, count);
        } catch (e: any) {
          setSeats(previous);
          setMaxSeats(previousMax);
          Alert.alert(t('common.error'), e?.message ?? t('common.error'));
        } finally {
          setRequestingSeats(false);
        }
      })();
      return;
    }
    if (!isAgencyRoom || !agencyId) {
      Alert.alert(t('common.error'), t('roomSettings.seatsAboveLimit', { max: maxSeats }));
      return;
    }
    if (pendingSeatCounts.has(count)) {
      Alert.alert(t('roomSettings.seatRequestTitle'), t('roomSettings.seatRequestPending', { count }));
      return;
    }
    Alert.alert(
      t('roomSettings.seatRequestTitle'),
      t('roomSettings.seatRequestConfirm', { count, max: maxSeats }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('roomSettings.seatRequestSubmit'),
          onPress: () => {
            void (async () => {
              setRequestingSeats(true);
              try {
                await submitAgencySeatRequest({
                  agencyId,
                  roomId,
                  requestedSeatsCount: count,
                  currentMaxSeats: maxSeats,
                  currentSeatsCount: seats,
                  requesterName: name.trim() || undefined,
                });
                Alert.alert(t('common.done'), t('roomSettings.seatRequestSent', { count }));
              } catch (e: any) {
                Alert.alert(t('common.error'), e?.message ?? t('common.error'));
              } finally {
                setRequestingSeats(false);
              }
            })();
          },
        },
      ],
    );
  };

  const handleSave = async () => {
    if (!roomId || !canManage) return;
    // غرفة مقفلة بلا كلمة مرور = غرفة مفتوحة فعلياً (البوابة تتجاوزها) — نمنع الحفظ
    if (mode === 'locked' && !password.trim()) {
      Alert.alert(t('roomSettings.roomMode'), t('roomSettings.passwordRequired'));
      return;
    }
    setSaving(true);
    try {
      await updateRoomManagedSettings(roomId, {
        name: name.trim(),
        welcomeMessage: welcome.trim(),
        mode,
        isPrivate: mode === 'locked',
        password: mode === 'locked' ? password.trim() || null : null,
        seatsCount: Math.min(seats, maxSeats) as AllowedSeatCount,
        seatFee: seatFee,
        ...(isAgencyRoom && isHost && throneUnlockedByLevel ? { throneEnabled } : {}),
        ...(isAgencyRoom && isHost && secondHostMicOwned ? { secondHostMic } : {}),
      });
      await updateRoomPermissions(roomId, {
        guestCanTakeMic: guestMic,
        guestCanShareVideo: guestShareVideo,
        guestCanShareMusic: guestShareMusic,
        guestCanInviteToAgency: guestInviteAgency,
        guestCanSendRoomInvite: guestSendInvite,
        guestCanInviteToMic: guestInviteMic,
        memberCanTakeMic: memberMic,
        memberCanShareVideo: memberShareVideo,
        memberCanShareMusic: memberShareMusic,
        memberCanInviteToAgency: memberInviteAgency,
        memberCanSendRoomInvite: memberSendInvite,
        memberCanInviteToMic: memberInviteMic,
        showMessageHistory: showHistory,
        allowOffMicEmojis: offMicEmoji,
        allowOffMicDice: offMicDice,
        ...(isHost
          ? {
              moderatorsCanKickBan: modKickBan,
              moderatorsCanManageMic: modManageMic,
              moderatorsCanLockSeats: modLockSeats,
              moderatorsCanReviewVideo: modReviewVideo,
              moderatorsCanPinMessages: modPinMessages,
              moderatorsCanManageRoles: modManageRoles,
              moderatorsCanBlockUsers: modBlockUsers,
              moderatorsCanResetMicSupport: modResetMicSupport,
              moderatorsCanManageEffects: modManageEffects,
              moderatorsCanCleanChat: modCleanChat,
              moderatorsCanInviteMic: modInviteMic,
              moderatorsCanCancelMembership: modCancelMembership,
              moderatorsCanManageLuckyBags: modManageLuckyBags,
              moderatorsCanChangeSettings: modSettings,
              moderatorsCanChangeMode: modMode,
            }
          : {
              moderatorsCanChangeSettings: modSettings,
              moderatorsCanChangeMode: modMode,
            }),
      });
      if (isAgencyRoom && isHost && !throneEnabled) {
        await vacateRoomThrone(roomId).catch(() => {});
      }
      if (isAgencyRoom && isHost && secondHostMicOwned && !secondHostMic) {
        await vacateSecondHostSeat(roomId).catch(() => {});
      }
      Alert.alert(t('common.done'), t('roomSettings.saved'));
      onClose();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (visible) setPanel(initialPanel);
  }, [visible, initialPanel]);

  const canAccessSheet = canManage || canManageBlocks;
  const modeLabel =
    mode === 'public'
      ? t('roomSettings.modePublic')
      : mode === 'friend'
      ? t('roomSettings.modeFriend')
      : t('roomSettings.modeLocked');

  if (!canAccessSheet) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} style={{ width: 60, alignItems: 'flex-start' }}>
            <X size={24} color={lu.colors.ink} />
          </Pressable>
          <Text variant="h3" weight="bold" color={lu.colors.ink}>
            {panel === 'blocked' ? t('room.blockedFromRoom') : t('roomSettings.title')}
          </Text>
          <Pressable
            onPress={canManage && panel !== 'blocked' ? handleSave : onClose}
            disabled={saving}
            hitSlop={10}
            style={{ width: 60, alignItems: 'flex-end' }}
          >
            {canManage && panel !== 'blocked' ? (
              saving ? (
                <ActivityIndicator size="small" color={lu.colors.purple} />
              ) : (
                <Text variant="body" weight="bold" color={lu.colors.purple}>
                  {t('common.save')}
                </Text>
              )
            ) : (
              <View style={{ width: 24 }} />
            )}
          </Pressable>
        </View>

        {panel === 'blocked' ? (
          <View style={{ flex: 1, padding: spacing.base, paddingBottom: insets.bottom + 20 }}>
            <RoomBlockedUsersPanel roomId={roomId} canManage={canManageBlocks || canManage} />
          </View>
        ) : canManage ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.base, paddingBottom: insets.bottom + 40 }}>
            
            {/* Top Hero Banner */}
            <View style={styles.heroCard}>
              <ImageBackground
                source={roomBg ? { uri: roomBg } : undefined}
                style={styles.heroBg}
                contentFit="cover"
                imageStyle={{ borderRadius: 16 }}
              >
                <View style={styles.heroOverlay}>
                  <View style={styles.heroActions}>
                    <Pressable style={styles.heroActionBtn} onPress={() => {
                      onClose();
                      router.push({
                        pathname: '/room/customize',
                        params: { id: roomId, ...(agencyId ? { agencyId } : {}) },
                      } as any);
                    }}>
                      <ImageIcon size={16} color="#fff" />
                    </Pressable>
                    <Pressable style={styles.heroActionBtn}>
                      <Edit2 size={16} color="#fff" />
                    </Pressable>
                    <Pressable style={styles.heroActionBtn} onPress={() => setPanel('blocked')}>
                      <Shield size={16} color="#fff" />
                    </Pressable>
                  </View>

                  <View style={styles.heroContent}>
                    <Text variant="h2" weight="bold" color="#fff" align="right" style={{ marginBottom: 12 }}>
                      {name || t('roomSettings.defaultAgencyName')}
                    </Text>
                    <View style={styles.heroStatsRow}>
                      <Text variant="caption" color="rgba(255,255,255,0.8)">{modeLabel}</Text>
                      <Globe size={14} color="rgba(255,255,255,0.8)" />
                    </View>
                    <View style={styles.heroStatsRow}>
                      <Text variant="caption" color="rgba(255,255,255,0.8)">{t('roomSettings.micsCountLabel', { count: seats })}</Text>
                      <Mic size={14} color="rgba(255,255,255,0.8)" />
                    </View>
                    <View style={styles.heroStatsRow}>
                      <Text variant="caption" weight="bold" color="#FFD700">{seatFee.toLocaleString()}</Text>
                      <Image source={COIN_CURRENCY_ICON} style={styles.heroCoinImg} contentFit="contain" />
                    </View>
                  </View>
                </View>
              </ImageBackground>
            </View>

            {isAgencyRoom && isHost ? (
              <AgencyLevelTimeline
                supportCoins={periodSupportCoins}
                manualLevel={agencyDoc?.periodLevel}
                manual={agencyDoc?.periodLevelManual}
                levelsConfig={levelsConfig}
              />
            ) : null}

            {/* Agency Photo & Cover */}
            {isAgencyRoom && isHost && agencyId ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Camera size={18} color={lu.colors.purple} />
                  <Text style={styles.cardTitle}>{t('roomSettings.agencyImagesTitle')}</Text>
                </View>

                {/* Cover Banner */}
                <Text style={styles.inputLabel}>{t('roomSettings.agencyCover')}</Text>
                <Pressable onPress={handlePickAgencyBanner} style={styles.agencyCoverWrap}>
                  {agencyBanner ? (
                    <Image source={{ uri: agencyBanner }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#E5E7EB' }]} />
                  )}
                  <View style={styles.agencyCoverOverlay}>
                    {coverUpload.uploading ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Camera size={20} color="#FFF" />
                        <Text variant="caption" weight="bold" color="#FFF">{t('roomSettings.changeCover')}</Text>
                      </>
                    )}
                  </View>
                </Pressable>

                {/* Agency Logo */}
                <Text style={[styles.inputLabel, { marginTop: 12 }]}>{t('roomSettings.agencyLogo')}</Text>
                <View style={styles.agencyLogoRow}>
                  <Pressable onPress={handlePickAgencyLogo} style={styles.agencyLogoWrap}>
                    {agencyLogo ? (
                      <Image source={{ uri: agencyLogo }} style={styles.agencyLogoImg} contentFit="cover" />
                    ) : (
                      <View style={[styles.agencyLogoImg, { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }]}>
                        <Camera size={24} color={lu.colors.muted} />
                      </View>
                    )}
                    <View style={styles.agencyLogoBadge}>
                      {logoUpload.uploading ? (
                        <ActivityIndicator size={10} color="#FFF" />
                      ) : (
                        <Camera size={10} color="#FFF" />
                      )}
                    </View>
                  </Pressable>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text variant="bodySmall" weight="bold" color={lu.colors.ink}>{t('roomSettings.agencyLogoHint')}</Text>
                    <Text variant="caption" color={lu.colors.muted}>{t('roomSettings.agencyLogoDesc')}</Text>
                  </View>
                </View>
              </View>
            ) : null}

            {/* Info & Background 2-Col Layout */}
            <View style={styles.twoColRow}>
              {/* Background Card */}
              <View style={[styles.card, { flex: 1 }]}>
                <View style={styles.cardHeader}>
                  <ImageIcon size={18} color={lu.colors.purple} />
                  <Text style={styles.cardTitle}>{t('roomSettings.background')}</Text>
                </View>
                <View style={styles.bgPreviewBox}>
                  <ImageBackground
                    source={roomBg ? { uri: roomBg } : undefined}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    imageStyle={{ borderRadius: 8 }}
                  />
                </View>
                <Pressable
                  style={styles.primaryBtn}
                  onPress={() => {
                    onClose();
                    router.push({
                      pathname: '/room/customize',
                      params: { id: roomId, ...(agencyId ? { agencyId } : {}) },
                    } as any);
                  }}
                >
                  <Text variant="caption" weight="bold" color="#fff">{t('roomSettings.changeBg')}</Text>
                  <ImageIcon size={14} color="#fff" />
                </Pressable>
              </View>

              {/* Info Card */}
              <View style={[styles.card, { flex: 1.2 }]}>
                <View style={styles.cardHeader}>
                  <Info size={18} color={lu.colors.purple} />
                  <Text style={styles.cardTitle}>{t('roomSettings.roomName')}</Text>
                </View>
                <Text style={styles.inputLabel}>{t('roomSettings.roomName')}</Text>
                <View style={styles.inputWrap}>
                  <Edit2 size={12} color={lu.colors.muted} />
                  <TextInput value={name} onChangeText={setName} style={styles.inputInline} placeholderTextColor={lu.colors.muted} />
                </View>
                <Text style={styles.inputLabel}>{t('roomSettings.announcement')}</Text>
                <View style={styles.inputWrap}>
                  <Edit2 size={12} color={lu.colors.muted} />
                  <TextInput value={welcome} onChangeText={setWelcome} style={styles.inputInline} placeholderTextColor={lu.colors.muted} />
                </View>
              </View>
            </View>

            {/* Membership Fee */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Diamond size={18} color={lu.colors.purple} />
                <Text style={styles.cardTitle}>{t('roomSettings.membershipFee')}</Text>
              </View>
              <View style={styles.feeRow}>
                <View style={styles.feeDisplay}>
                  <Image source={COIN_CURRENCY_ICON} style={styles.mainCoinImg} contentFit="contain" />
                  <Text variant="h3" weight="bold" color={lu.colors.ink} style={{ marginVertical: 4 }}>{seatFee.toLocaleString()}</Text>
                  <Text variant="caption" color={lu.colors.muted} style={{ fontSize: 9 }}>{t('roomSettings.feeRequired')}</Text>
                </View>
                <FeeSlider fee={seatFee} setFee={setSeatFee} />
              </View>
            </View>

            {/* Room Mode */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Shield size={18} color={lu.colors.purple} />
                <Text style={styles.cardTitle}>{t('roomSettings.roomMode')}</Text>
              </View>
              <View style={styles.modeCardsRow}>
                {([
                  { k: 'locked' as Mode, Icon: Lock, label: t('roomSettings.modeLocked'), sub: t('roomSettings.modeLockedSub') },
                  { k: 'friend' as Mode, Icon: Users, label: t('roomSettings.modeFriend'), sub: t('roomSettings.modeFriendSub') },
                  { k: 'public' as Mode, Icon: Globe, label: t('roomSettings.modePublic'), sub: t('roomSettings.modePublicSub') },
                ]).map(({ k, Icon, label, sub }) => {
                  const active = mode === k;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => setMode(k)}
                      style={[styles.modeCard, active && styles.modeCardActive]}
                    >
                      {active && (
                        <View style={styles.activeBadge}>
                          <CheckCircle2 size={14} color="#fff" fill={lu.colors.purple} />
                        </View>
                      )}
                      <Icon size={24} color={active ? lu.colors.purple : lu.colors.ink} />
                      <Text variant="caption" weight="bold" color={active ? lu.colors.purple : lu.colors.ink} style={{ marginTop: 8 }}>
                        {label}
                      </Text>
                      <Text variant="caption" color={active ? lu.colors.purple : lu.colors.muted} style={{ fontSize: 9 }}>
                        {sub}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {mode === 'locked' ? (
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('roomSettings.password')}
                  secureTextEntry
                  style={[styles.inputFill, { marginTop: 12 }]}
                  placeholderTextColor={lu.colors.muted}
                />
              ) : null}
            </View>

            {/* Mic Count */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Mic size={18} color={lu.colors.purple} />
                <Text style={styles.cardTitle}>{t('roomSettings.micCount')}</Text>
              </View>
              <View style={styles.seatsRow}>
                {[...ALLOWED_SEAT_COUNTS].reverse().map((n) => {
                  const active = seats === n;
                  const aboveLimit = isAgencyRoom && n > maxSeats && !canDirectlyRaiseSeats;
                  const pending = !canDirectlyRaiseSeats && pendingSeatCounts.has(n);
                  return (
                    <Pressable
                      key={n}
                      onPress={() => handleSeatPress(n)}
                      disabled={requestingSeats}
                      style={[
                        styles.seatPill,
                        active && styles.seatPillActive,
                        aboveLimit && !active && styles.seatPillLocked,
                        pending && styles.seatPillPending,
                      ]}
                    >
                      {active && <CheckCircle2 size={12} color="#fff" />}
                      {pending && !active ? (
                        <Clock size={11} color={lu.colors.purple} />
                      ) : null}
                      <Text
                        variant="caption"
                        weight="bold"
                        color={active ? '#fff' : aboveLimit ? lu.colors.muted : lu.colors.ink2}
                      >
                        {n}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {isAgencyRoom && maxSeats < 21 && !canDirectlyRaiseSeats ? (
                <Text variant="caption" color={lu.colors.muted} style={{ marginTop: 8 }}>
                  {t('roomSettings.seatsLimitHint', { max: maxSeats })}
                </Text>
              ) : null}
              {isAgencyRoom && canDirectlyRaiseSeats ? (
                <Text variant="caption" color={lu.colors.muted} style={{ marginTop: 8 }}>
                  {t('roomSettings.seatsDirectHint')}
                </Text>
              ) : null}
            </View>

            {/* Permissions & Features */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Settings size={18} color={lu.colors.purple} />
                <Text style={styles.cardTitle}>{t('roomSettings.agencyPermsTitle')}</Text>
              </View>
              <View style={styles.permissionsGrid}>
                {isAgencyRoom && isHost && (
                  <View style={styles.gridItem}>
                    <ToggleSwitch
                      value={throneUnlockedByLevel ? throneEnabled : false}
                      onChange={setThroneEnabled}
                      disabled={!throneUnlockedByLevel}
                    />
                    <Text style={[styles.gridText, !throneUnlockedByLevel && { opacity: 0.6 }]}>
                      {throneUnlockedByLevel
                        ? t('roomSettings.throneEnabled')
                        : t('roomSettings.throneLockedLevel', { level: AGENCY_THRONE_UNLOCK_LEVEL })}
                    </Text>
                  </View>
                )}
                {isAgencyRoom && isHost && secondHostMicOwned ? (
                  <View style={styles.gridItem}>
                    <ToggleSwitch value={secondHostMic} onChange={setSecondHostMic} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.gridText}>مايك مدير ثانٍ</Text>
                      <Text style={styles.secondMicHint}>
                        {secondHostMic
                          ? 'مُفعّل — يظهر مقعد إضافي جنب مقعد المضيف'
                          : 'مُوقّف — لن يظهر المقعد حتى تعيد التفعيل'}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {/* مايك مدير ثانٍ — شراء */}
              {isAgencyRoom && isHost && !secondHostMicOwned && (
                <View style={styles.secondMicRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.secondMicTitle}>مايك مدير ثانٍ</Text>
                    <Text style={styles.secondMicHint}>
                      مقعد مدير إضافي بصلاحيات الإدارة جنب مقعد المضيف
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleBuySecondHostMic}
                    disabled={buyingSecondMic}
                    style={[styles.secondMicBuy, buyingSecondMic && { opacity: 0.6 }]}
                  >
                    {buyingSecondMic ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Image source={COIN_CURRENCY_ICON} style={styles.secondMicCoin} contentFit="contain" />
                        <Text variant="caption" weight="bold" color="#fff" style={{ fontSize: 12 }}>
                          {secondHostMicConfig.price.toLocaleString()} شراء
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}

              <Text style={styles.permSectionTitle}>{t('roomSettings.guestPermsTitle')}</Text>
              <Text style={styles.permSectionHint}>{t('roomSettings.guestPermsHint')}</Text>
              <View style={styles.permissionsGrid}>
                <PermissionToggle label={t('roomSettings.permTakeMic')} value={guestMic} onChange={setGuestMic} />
                <PermissionToggle label={t('roomSettings.permShareVideo')} value={guestShareVideo} onChange={setGuestShareVideo} />
                <PermissionToggle label={t('roomSettings.permShareMusic')} value={guestShareMusic} onChange={setGuestShareMusic} />
                <PermissionToggle label={t('roomSettings.permInviteAgency')} value={guestInviteAgency} onChange={setGuestInviteAgency} />
                <PermissionToggle label={t('roomSettings.permSendRoomInvite')} value={guestSendInvite} onChange={setGuestSendInvite} />
                <PermissionToggle label={t('roomSettings.permInviteMic')} value={guestInviteMic} onChange={setGuestInviteMic} />
              </View>

              <Text style={styles.permSectionTitle}>{t('roomSettings.memberPermsTitle')}</Text>
              <Text style={styles.permSectionHint}>{t('roomSettings.memberPermsHint')}</Text>
              <View style={styles.permissionsGrid}>
                <PermissionToggle label={t('roomSettings.permTakeMic')} value={memberMic} onChange={setMemberMic} />
                <PermissionToggle label={t('roomSettings.permShareVideo')} value={memberShareVideo} onChange={setMemberShareVideo} />
                <PermissionToggle label={t('roomSettings.permShareMusic')} value={memberShareMusic} onChange={setMemberShareMusic} />
                <PermissionToggle label={t('roomSettings.permInviteAgency')} value={memberInviteAgency} onChange={setMemberInviteAgency} />
                <PermissionToggle label={t('roomSettings.permSendRoomInvite')} value={memberSendInvite} onChange={setMemberSendInvite} />
                <PermissionToggle label={t('roomSettings.permInviteMic')} value={memberInviteMic} onChange={setMemberInviteMic} />
              </View>

              <Text style={styles.permSectionTitle}>{t('roomSettings.roomPermsTitle')}</Text>
              <View style={styles.permissionsGrid}>
                <PermissionToggle label={t('roomSettings.showHistory')} value={showHistory} onChange={setShowHistory} />
                <PermissionToggle label={t('roomSettings.offMicEmoji')} value={offMicEmoji} onChange={setOffMicEmoji} />
                <PermissionToggle label={t('roomSettings.offMicDice')} value={offMicDice} onChange={setOffMicDice} />
              </View>

              {isHost ? (
                <>
                  <Text style={styles.permSectionTitle}>{t('roomSettings.supervisorPermsTitle')}</Text>
                  <Text style={styles.permSectionHint}>{t('roomSettings.supervisorPermsHint')}</Text>
                  <Text style={styles.permSectionHint}>
                    {isAr
                      ? `حد مشرفي الإشراف: ${supervisorCap} (مستوى الوكالة LV.${Math.max(1, agencyPeriodLevel || 1)})`
                      : `Supervisor cap: ${supervisorCap} (agency LV.${Math.max(1, agencyPeriodLevel || 1)})`}
                  </Text>
                  <View style={styles.permissionsGrid}>
                    <PermissionToggle label={t('roomSettings.modKickBan')} value={modKickBan} onChange={setModKickBan} />
                    <PermissionToggle label={t('roomSettings.modManageMic')} value={modManageMic} onChange={setModManageMic} />
                    <PermissionToggle label={t('roomSettings.modLockSeats')} value={modLockSeats} onChange={setModLockSeats} />
                    <PermissionToggle label={t('roomSettings.modReviewVideo')} value={modReviewVideo} onChange={setModReviewVideo} />
                    <PermissionToggle label={t('roomSettings.modPinMessages')} value={modPinMessages} onChange={setModPinMessages} />
                    <PermissionToggle label={t('roomSettings.modManageRoles')} value={modManageRoles} onChange={setModManageRoles} />
                    <PermissionToggle label={t('roomSettings.modBlockUsers')} value={modBlockUsers} onChange={setModBlockUsers} />
                    <PermissionToggle label={t('roomSettings.modResetMicSupport')} value={modResetMicSupport} onChange={setModResetMicSupport} />
                    <PermissionToggle label={t('roomSettings.modManageEffects')} value={modManageEffects} onChange={setModManageEffects} />
                    <PermissionToggle label={t('roomSettings.modCleanChat')} value={modCleanChat} onChange={setModCleanChat} />
                    <PermissionToggle label={t('roomSettings.modInviteMic')} value={modInviteMic} onChange={setModInviteMic} />
                    <PermissionToggle label={t('roomSettings.modCancelMembership')} value={modCancelMembership} onChange={setModCancelMembership} />
                    <PermissionToggle label={t('roomSettings.modManageLuckyBags')} value={modManageLuckyBags} onChange={setModManageLuckyBags} />
                    <PermissionToggle label={t('roomSettings.modChangeSettings')} value={modSettings} onChange={setModSettings} />
                    <PermissionToggle label={t('roomSettings.modChangeMode')} value={modMode} onChange={setModMode} />
                  </View>
                </>
              ) : (
                <View style={styles.permissionsGrid}>
                  <PermissionToggle label={t('roomSettings.modChangeSettings')} value={modSettings} onChange={setModSettings} />
                  <PermissionToggle label={t('roomSettings.modChangeMode')} value={modMode} onChange={setModMode} />
                </View>
              )}
            </View>

            {canManageBlocks ? (
            <Pressable style={styles.blockedBtn} onPress={() => setPanel('blocked')}>
              <Shield size={18} color={lu.colors.purple} />
              <Text variant="bodySmall" weight="bold" color={lu.colors.purple}>
                {t('room.blockedFromRoom')}
              </Text>
            </Pressable>
            ) : null}

          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

// Helpers

/**
 * #16: حقل إدخال رقمي لرسوم المقعد — بلا سقف منتج (كان Slider بحد 50,000).
 * الحد الوحيد حماية نوع البيانات (أقصى عدد صحيح آمن في JS/RTDB).
 */
const FEE_SAFE_MAX = Number.MAX_SAFE_INTEGER;

const FeeSlider = ({ fee, setFee }: { fee: number; setFee: (v: number) => void }) => {
  const step = 1000;
  const [text, setText] = useState(fee > 0 ? String(fee) : '');

  // مزامنة عند تغيّر القيمة من الخارج (تحميل إعدادات الغرفة)
  useEffect(() => {
    setText(fee > 0 ? String(fee) : '');
  }, [fee]);

  const commit = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '');
    const value = digits ? Math.min(FEE_SAFE_MAX, parseInt(digits, 10)) : 0;
    setText(digits);
    setFee(value);
  };

  const handleDec = () => setFee(Math.max(0, fee - step));
  const handleInc = () => setFee(Math.min(FEE_SAFE_MAX, fee + step));

  return (
    <View style={styles.feeSliderWrap}>
      <Pressable onPress={handleDec} style={styles.feeBtn}>
        <Minus size={14} color={lu.colors.muted} />
      </Pressable>
      <TextInput
        value={text}
        onChangeText={commit}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={lu.colors.muted}
        style={styles.feeInput}
        maxLength={16}
      />
      <Pressable onPress={handleInc} style={styles.feeBtn}>
        <Plus size={14} color={lu.colors.muted} />
      </Pressable>
    </View>
  );
};

const PermissionToggle = React.memo(({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <View style={styles.gridItem}>
    <ToggleSwitch value={value} onChange={onChange} />
    <Text style={styles.gridText}>{label}</Text>
  </View>
));

const SWITCH_SCALE = { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] };
const SWITCH_TRACK = { true: lu.colors.purple, false: '#E5E7EB' };

const ToggleSwitch = React.memo(({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) => (
  <Switch
    value={value}
    onValueChange={onChange}
    disabled={disabled}
    trackColor={SWITCH_TRACK}
    thumbColor="#fff"
    style={SWITCH_SCALE}
  />
));

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  heroCard: {
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.base,
    backgroundColor: lu.colors.purple, // Fallback color
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  heroBg: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.base,
  },
  heroActions: {
    gap: 12,
    justifyContent: 'center',
  },
  heroActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  heroContent: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  heroCoinImg: {
    width: 14,
    height: 14,
  },
  mainCoinImg: {
    width: 24,
    height: 24,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.base,
    marginBottom: spacing.base,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: lu.colors.ink,
  },
  bgPreviewBox: {
    height: 60,
    borderRadius: 8,
    marginBottom: spacing.sm,
    backgroundColor: lu.colors.purple, // Fallback color
  },
  primaryBtn: {
    backgroundColor: lu.colors.purple,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  inputLabel: {
    fontSize: 10,
    color: lu.colors.muted,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    marginBottom: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  inputInline: {
    flex: 1,
    fontSize: 12,
    color: lu.colors.ink,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    paddingVertical: 6,
  },
  inputFill: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: lu.colors.ink,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  feeDisplay: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F2F4F8',
    borderRadius: 16,
    padding: spacing.base,
    alignItems: 'center',
    width: '38%',
    elevation: 3,
    shadowColor: '#FFD700',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  feeSliderWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  feeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feeInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: lu.colors.ink,
  },
  sliderTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: lu.colors.purple,
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: lu.colors.purple,
    marginLeft: -8,
  },
  modeCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#F2F4F8',
    position: 'relative',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  modeCardActive: {
    borderColor: lu.colors.purple,
    backgroundColor: '#FEF2F2',
    shadowColor: lu.colors.purple,
    shadowOpacity: 0.2,
  },
  activeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
  },
  seatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  seatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 46,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FB',
  },
  seatPillActive: {
    backgroundColor: lu.colors.purple,
  },
  seatPillLocked: {
    opacity: 0.72,
    borderWidth: 1,
    borderColor: 'rgba(225, 20, 20, 0.25)',
    borderStyle: 'dashed',
  },
  seatPillPending: {
    borderWidth: 1,
    borderColor: lu.colors.purple,
  },
  permSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: lu.colors.ink,
    marginTop: 16,
    marginBottom: 4,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  permSectionHint: {
    fontSize: 10,
    color: lu.colors.muted,
    marginBottom: 10,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    lineHeight: 14,
  },
  permissionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
  },
  gridItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },
  gridText: {
    fontSize: 11,
    color: lu.colors.ink,
    flexShrink: 1,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  secondMicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: lu.colors.line,
  },
  secondMicTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: lu.colors.ink,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  secondMicHint: {
    fontSize: 10.5,
    color: lu.colors.muted,
    marginTop: 2,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  secondMicBuy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 999,
    backgroundColor: lu.colors.purple,
  },
  secondMicCoin: {
    width: 16,
    height: 16,
  },
  secondMicActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#22A06B',
  },
  blockedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
    paddingVertical: 14,
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  agencyCoverWrap: {
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  agencyCoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  agencyLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  agencyLogoWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    position: 'relative',
  },
  agencyLogoImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  agencyLogoBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: lu.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
});
