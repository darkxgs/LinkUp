import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Alert,
  I18nManager,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Settings,
  Copy,
  Coins,
  ChevronLeft,
  User,
  Info,
  Crown,
  Users,
  MapPin,
  Target,
  Shield,
  Mic,
} from 'lucide-react-native';

import { Text, BackChevron } from '@/components/ui';
import { FramedAvatar } from '@/components/ui/FramedAvatar';
import { lu } from '@/theme/lu-brand';
import { colors, radius, spacing } from '@/theme';
import { copyToClipboard } from '@/utils/copyToClipboard';
import { countFilledSeats, type Room } from '@/services/firebase/rooms';
import {
  subscribeToAgencyMembers,
  subscribeToAgencyById,
  getAgencyPeriodWeekKey,
  type Agency,
  type AgencyMember,
} from '@/services/agencyService';
import { getAgencyLevelProgress } from '@/services/agencyLevels';
import { useAgencyLevelsConfig } from '@/hooks/useAgencyLevelsConfig';
import { AgencyLevelProgressRow } from '@/components/room/AgencyLevelProgressRow';
import { RoomBlockedUsersPanel } from '@/components/room/RoomBlockedUsersPanel';
import {
  subscribeToRoomMemberRoles,
  setRoomAgencyMemberRole,
  roleColor,
  roleLabel,
  canAgencyManageTarget,
  isAgencyRoomAgent,
  type RoomAgencyMemberRole,
  canUserManageRoomSettings,
} from '@/services/firebase/roomMemberRoles';
import { getUser, type UserDoc } from '@/services/firebase/users';
import { resolveDisplayName } from '@/utils/displayName';
import { resolveAgencyLogoImage } from '@/utils/agencyBubbleImage';

const SCREEN_H = Dimensions.get('window').height;

export type RoomInfoMemberRow = {
  uid: string;
  memberDocId: string;
  name: string;
  avatar?: string;
  role?: RoomAgencyMemberRole;
  level: number;
  isVIP: boolean;
  vipLevel?: number;
  gender?: 'male' | 'female';
  age?: number | null;
  publicAccountId?: string;
  onSeat?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  room: Room | null;
  roomId: string;
  agencyId?: string;
  presenceCount: number;
  canManage: boolean;
  canManageBlocks?: boolean;
  myUid?: string;
  frameByUid: Record<string, string>;
  onOpenSettings: () => void;
  onPressMember: (row: RoomInfoMemberRow) => void;
};

function ageFromBirthYear(y?: number): number | null {
  if (!y || y < 1900) return null;
  const age = new Date().getFullYear() - y;
  return age > 0 && age < 120 ? age : null;
}

function modeLabel(mode: Room['mode'] | undefined, isPrivate: boolean, isAr: boolean): string {
  const m = mode ?? (isPrivate ? 'locked' : 'public');
  if (m === 'friend') return isAr ? 'صديق' : 'Friends';
  if (m === 'locked') return isAr ? 'مغلق' : 'Locked';
  return isAr ? 'عام' : 'Public';
}

type RoleFilter = 'all' | RoomAgencyMemberRole;
type InfoPanel = 'main' | 'blocked';

export function RoomInformationModal({
  visible,
  onClose,
  room,
  roomId,
  agencyId,
  presenceCount,
  canManage,
  canManageBlocks = false,
  myUid,
  frameByUid,
  onOpenSettings,
  onPressMember,
}: Props) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const insets = useSafeAreaInsets();
  const levelsConfig = useAgencyLevelsConfig();
  const [tab, setTab] = useState<'profile' | 'member'>('profile');
  const [agencyDoc, setAgencyDoc] = useState<Agency | null>(null);
  const [agencyMembers, setAgencyMembers] = useState<AgencyMember[]>([]);
  const [memberRoles, setMemberRoles] = useState<Record<string, RoomAgencyMemberRole>>({});
  const [profiles, setProfiles] = useState<Record<string, UserDoc | null>>({});
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [rolePickerUid, setRolePickerUid] = useState<string | null>(null);
  const [panel, setPanel] = useState<InfoPanel>('main');

  useEffect(() => {
    if (!visible) {
      setPanel('main');
      setTab('profile');
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !agencyId) return;
    return subscribeToAgencyById(agencyId, setAgencyDoc);
  }, [visible, agencyId]);

  useEffect(() => {
    if (!visible || !agencyId || !canManage) return;
    setLoadingMembers(true);
    const unsub = subscribeToAgencyMembers(agencyId, (list) => {
      setAgencyMembers(list);
      setLoadingMembers(false);
    });
    return unsub;
  }, [visible, agencyId, canManage]);

  useEffect(() => {
    if (!visible || !roomId) return;
    return subscribeToRoomMemberRoles(roomId, setMemberRoles);
  }, [visible, roomId]);

  useEffect(() => {
    if (!visible || !agencyMembers.length) return;
    let cancelled = false;
    const uids = agencyMembers.map((m) => m.uid).slice(0, 80);
    Promise.all(uids.map((uid) => getUser(uid).catch(() => null))).then((results) => {
      if (cancelled) return;
      const map: Record<string, UserDoc | null> = {};
      uids.forEach((uid, i) => {
        map[uid] = results[i] ?? null;
      });
      setProfiles(map);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, agencyMembers]);

  const memberRows = useMemo((): RoomInfoMemberRow[] => {
    const seatUids = new Set(
      Object.values(room?.seats ?? {})
        .map((s) => s?.uid)
        .filter((uid): uid is string => !!uid),
    );
    return agencyMembers.map((m) => {
      const p = profiles[m.uid];
      return {
        uid: m.uid,
        memberDocId: m.id,
        name: resolveDisplayName({ displayName: p?.displayName ?? m.uidName }),
        avatar: p?.avatar ?? m.uidAvatar,
        role: memberRoles[m.uid],
        level: p?.level ?? 1,
        isVIP: Boolean(p?.isVIP),
        vipLevel: p?.vipLevel,
        gender: p?.gender,
        age: ageFromBirthYear(p?.birthYear),
        publicAccountId: p?.publicAccountId,
        onSeat: seatUids.has(m.uid),
      };
    });
  }, [agencyMembers, profiles, memberRoles, room?.seats]);

  const filteredMembers = useMemo(() => {
    let list = memberRows;
    if (roleFilter !== 'all') {
      list = list.filter((m) => m.role === roleFilter);
    }
    const q = searchId.trim();
    if (q) {
      list = list.filter(
        (m) =>
          m.publicAccountId?.includes(q) ||
          m.uid.includes(q) ||
          m.name.toLowerCase().includes(q.toLowerCase()),
      );
    }
    return list;
  }, [memberRows, roleFilter, searchId]);

  const canOpenSettings = canManage && room && canUserManageRoomSettings(room as unknown as Record<string, unknown>, myUid);
  const canShowBlockedPanel = canManageBlocks || canManage;

  const displayRoomId =
    room?.vanityId || agencyDoc?.inviteCode || roomId.slice(-8);

  const handleCopyId = async () => {
    const ok = await copyToClipboard(displayRoomId);
    if (ok) Alert.alert(t('common.copied'));
  };

  const handleRoleSelect = async (uid: string, memberDocId: string, role: RoomAgencyMemberRole) => {
    setRolePickerUid(null);
    try {
      await setRoomAgencyMemberRole(roomId, uid, role);
      if (role === 'cancelled') {
        Alert.alert(
          t('roomInfo.roleCancelledTitle'),
          t('roomInfo.roleCancelledHint'),
        );
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message);
    }
  };

  const assignableRolesForUid = (uid: string): RoomAgencyMemberRole[] => {
    if (!room || !myUid) return [];
    const roomData = room as unknown as Record<string, unknown>;
    return (['blue_supervisor', 'yellow_supervisor', 'cancelled'] as RoomAgencyMemberRole[]).filter(
      (role) =>
        canAgencyManageTarget(roomData, myUid, uid, 'assignRole', memberRoles, undefined, undefined, role),
    );
  };

  const canOpenRolePickerFor = (uid: string): boolean => {
    if (!canManage || !myUid || !room) return false;
    if (isAgencyRoomAgent(room as unknown as Record<string, unknown>, uid)) return false;
    return assignableRolesForUid(uid).length > 0;
  };

  const periodSupportCoins = useMemo(() => {
    if (!agencyDoc) return 0;
    const weekKey = getAgencyPeriodWeekKey();
    if (String(agencyDoc.periodSupportWeekKey ?? '') !== weekKey) return 0;
    return Math.max(0, Number(agencyDoc.periodSupportCoins) || 0);
  }, [agencyDoc]);

  const agencyLevelProgress = useMemo(() => {
    const base = getAgencyLevelProgress(periodSupportCoins, levelsConfig);
    const manualLevel = Number(agencyDoc?.periodLevel) || 0;
    const roomLevel = Number(room?.agencyPeriodLevel) || 0;
    if (agencyDoc?.periodLevelManual && manualLevel >= 1) {
      return { ...base, level: manualLevel };
    }
    const computed = Math.max(base.level, roomLevel, manualLevel, 1);
    return { ...base, level: computed };
  }, [periodSupportCoins, levelsConfig, agencyDoc, room?.agencyPeriodLevel]);

  if (!room) return null;

  const filledSeats = countFilledSeats(room);
  const agencyLevel = agencyLevelProgress.level;
  const agencyName = agencyDoc?.name?.trim() || room.name;
  const agencyAvatarUri = resolveAgencyLogoImage(agencyDoc, { roomBanner: room.banner });
  const agencyDescription =
    agencyDoc?.description?.trim() ||
    room.announcement?.content?.trim() ||
    room.welcomeMessage?.trim() ||
    '';
  const agencyMemberTotal = Math.max(
    Number(agencyDoc?.memberCount) || 0,
    agencyMembers.length,
  );
  const modalTitle = canManage ? t('roomInfo.title') : t('roomInfo.agencyTitle');

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />

        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}
          onPress={(e) => e.stopPropagation()}
        >
          <LinearGradient
            colors={['rgba(65, 12, 12, 0.98)', 'rgba(20, 3, 3, 0.98)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.glassHighlight} />

          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            {panel === 'blocked' ? (
              <Pressable onPress={() => setPanel('main')} style={styles.iconBtn}>
                <BackChevron size={18} color="#FECACA" />
              </Pressable>
            ) : (
              <Pressable onPress={onClose} style={styles.iconBtn}>
                <X size={18} color="#FECACA" />
              </Pressable>
            )}
            <Text variant="h3" weight="bold" color="#FFF">
              {panel === 'blocked' ? t('room.blockedFromRoom') : modalTitle}
            </Text>
            {panel === 'main' && canOpenSettings ? (
              <Pressable onPress={onOpenSettings} style={styles.iconBtn}>
                <Settings size={18} color="#FECACA" />
              </Pressable>
            ) : panel === 'blocked' ? (
              <Pressable onPress={onClose} style={styles.iconBtn}>
                <X size={18} color="#FECACA" />
              </Pressable>
            ) : (
              <View style={styles.iconBtnGhost} />
            )}
          </View>

          {panel === 'blocked' ? (
            <RoomBlockedUsersPanel roomId={roomId} canManage={canShowBlockedPanel} />
          ) : (
            <>
              {/* Pill Segmented Tab Bar */}
              {canManage ? (
              <View style={styles.tabContainer}>
                <View style={styles.tabTrack}>
                  <Pressable
                    onPress={() => setTab('profile')}
                    style={[styles.tabBtn, tab === 'profile' && styles.tabBtnActive]}
                  >
                    <Text variant="bodySmall" weight="bold" color={tab === 'profile' ? '#FFF' : '#FCA5A5'}>
                      {t('roomInfo.profileTab')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setTab('member')}
                    style={[styles.tabBtn, tab === 'member' && styles.tabBtnActive]}
                  >
                    <Text variant="bodySmall" weight="bold" color={tab === 'member' ? '#FFF' : '#FCA5A5'}>
                      {t('roomInfo.memberTab')}
                    </Text>
                  </Pressable>
                </View>
              </View>
              ) : null}

              {tab === 'profile' || !canManage ? (
                <ScrollView style={{ maxHeight: SCREEN_H * 0.62 }} showsVerticalScrollIndicator={false}>
                  {/* Floating Avatar Section */}
                  <View style={styles.floatingAvatarWrap}>
                    <LinearGradient
                      colors={['#FF3340', '#E11414']}
                      style={styles.floatingAvatarRing}
                    >
                      {agencyAvatarUri ? (
                        <Image
                          source={{ uri: agencyAvatarUri }}
                          style={styles.floatingAvatar}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          recyclingKey={agencyAvatarUri}
                        />
                      ) : (
                        <View style={[styles.floatingAvatar, styles.avatarFallbackNew]}>
                          <Text variant="h2" weight="bold" color="#FFF">
                            {agencyName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </LinearGradient>
                    <View style={styles.floatingNameWrap}>
                      <Text variant="h3" weight="bold" color="#FFF" style={styles.profileNameNew}>
                        {agencyName}
                      </Text>
                      {agencyDoc?.isVerified ? (
                        <Text variant="caption" color="#FDE047" weight="bold" style={styles.profileAnnNew}>
                          {t('roomInfo.agencyVerified')}
                        </Text>
                      ) : null}
                      {agencyDescription ? (
                        <Text variant="caption" color="#FECACA" style={styles.profileAnnNew}>
                          {agencyDescription}
                        </Text>
                      ) : null}
                      <Pressable onPress={handleCopyId} style={styles.idChip}>
                        <Text variant="caption" color="#FDE047" weight="bold">
                          ID: {displayRoomId}
                        </Text>
                        <Copy size={12} color="#FDE047" />
                      </Pressable>
                    </View>
                  </View>

                  {agencyId ? (
                    <AgencyLevelProgressRow
                      supportCoins={periodSupportCoins}
                      manualLevel={agencyDoc?.periodLevel}
                      manual={agencyDoc?.periodLevelManual}
                      levelsConfig={levelsConfig}
                      variant="dark"
                    />
                  ) : null}

                  {/* Glass 3D Grid for Stats */}
                  <View style={styles.statsGrid}>
                    <StatCard 
                      icon={<MapPin size={20} color="#F06A6A" />} 
                      label={t('roomInfo.country')} 
                      value={(agencyDoc?.country || room.country) !== 'WW' ? (agencyDoc?.country || room.country) : '—'} 
                    />
                    <StatCard 
                      icon={<Target size={20} color="#FF6670" />} 
                      label={t('roomInfo.agencyLevel')} 
                      value={`LV.${agencyLevel}`} 
                    />
                    <StatCard 
                      icon={<Users size={20} color="#34D399" />} 
                      label={t('roomInfo.memberCount')} 
                      value={`${presenceCount}/${agencyMemberTotal || '—'}`} 
                    />
                    <StatCard 
                      icon={<Shield size={20} color="#FCA5A5" />} 
                      label={t('roomInfo.roomMode')} 
                      value={modeLabel(room.mode, room.isPrivate, isAr)}
                      chevron={canOpenSettings}
                      onPress={canOpenSettings ? onOpenSettings : undefined}
                    />
                    <StatCard 
                      icon={<Coins size={20} color="#FBBF24" />} 
                      label={t('roomInfo.membershipFee')} 
                      value={room.seatFee ? `${room.seatFee}` : '0'} 
                      chevron={canOpenSettings}
                      onPress={canOpenSettings ? onOpenSettings : undefined}
                    />
                    <StatCard 
                      icon={<Mic size={20} color="#EC4444" />} 
                      label={t('roomInfo.micCount')} 
                      value={`${filledSeats}/${room.seatsCount}`} 
                    />
                  </View>

                  {canShowBlockedPanel ? (
                    <Pressable onPress={() => setPanel('blocked')} style={styles.blockedActionBtn}>
                      <LinearGradient colors={['rgba(244, 63, 94, 0.15)', 'rgba(225, 29, 72, 0.25)']} style={StyleSheet.absoluteFill} />
                      <Text variant="bodySmall" weight="bold" color="#FDA4AF">
                        {t('room.blockedFromRoom')}
                      </Text>
                      <ChevronLeft size={16} color="#FDA4AF" />
                    </Pressable>
                  ) : null}
                </ScrollView>
              ) : (
                <>
                  <View style={styles.memberToolbarNew}>
                    <Info size={16} color="#FCA5A5" />
                    <Text variant="caption" weight="bold" color="#FECACA" style={{ flex: 1 }}>
                      {t('roomInfo.memberCount')}: {agencyMembers.length}
                    </Text>
                  </View>

                  <View style={styles.searchRowNew}>
                    <BlurView intensity={30} tint="light" style={styles.searchBlurBox}>
                      <TextInput
                        value={searchId}
                        onChangeText={setSearchId}
                        placeholder={t('roomInfo.searchPlaceholder')}
                        placeholderTextColor="#FCA5A5"
                        style={styles.searchInputNew}
                      />
                    </BlurView>
                    <Pressable style={styles.searchBtnNew}>
                      <Text variant="caption" weight="bold" color="#FFF">
                        {t('roomInfo.search')}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.roleFiltersNew}>
                    {(['all', 'blue_supervisor', 'yellow_supervisor', 'cancelled'] as RoleFilter[]).map(
                      (f) => {
                        const active = roleFilter === f;
                        const c = f === 'all' ? '#FCA5A5' : roleColor(f as RoomAgencyMemberRole);
                        const label = f === 'all' ? (isAr ? 'الكل' : 'All') : roleLabel(f as RoomAgencyMemberRole, isAr);
                        return (
                          <Pressable
                            key={f}
                            onPress={() => setRoleFilter(f)}
                            style={[
                              styles.roleFilterBtnNew,
                              { borderColor: active ? c : 'rgba(255,255,255,0.12)' },
                              active && { backgroundColor: `${c}22` },
                            ]}
                          >
                            {f === 'all' ? (
                              <Users size={14} color={active ? '#FFF' : c} />
                            ) : (
                              <User size={14} color={c} fill={active ? c : 'transparent'} />
                            )}
                            <Text variant="caption" weight="bold" color={active ? '#FFF' : c} style={{ fontSize: 11 }}>
                              {label}
                            </Text>
                          </Pressable>
                        );
                      }
                    )}
                  </View>

                  {loadingMembers ? (
                    <ActivityIndicator color="#FECACA" style={{ marginVertical: 40 }} />
                  ) : (
                    <ScrollView style={{ maxHeight: SCREEN_H * 0.48 }} showsVerticalScrollIndicator={false}>
                      {filteredMembers.length === 0 ? (
                        <Text variant="bodySmall" color="#FCA5A5" align="center" style={{ padding: 40 }}>
                          {t('room.noMembersCategory')}
                        </Text>
                      ) : (
                        filteredMembers.map((m) => {
                          const memberFrameUri = frameByUid[m.uid];
                          return (
                          <Pressable
                            key={m.uid}
                            style={styles.memberRowNew}
                            onPress={() => onPressMember(m)}
                          >
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation();
                                if (canOpenRolePickerFor(m.uid)) setRolePickerUid(m.uid);
                              }}
                              hitSlop={8}
                              disabled={!canOpenRolePickerFor(m.uid)}
                            >
                              <User size={20} color={roleColor(m.role)} fill={m.role ? roleColor(m.role) : 'transparent'} />
                            </Pressable>

                            <View style={styles.memberInfoNew}>
                              <View style={styles.memberBadgesNew}>
                                {m.age != null && (
                                  <View style={[styles.glowBadge, { backgroundColor: m.gender === 'female' ? 'rgba(225, 20, 20, 0.2)' : 'rgba(237, 68, 68, 0.2)', borderColor: m.gender === 'female' ? '#FF6670' : '#F06A6A' }]}>
                                    <Text variant="caption" color={m.gender === 'female' ? '#FBD5D5' : '#FCDDDD'} style={{ fontSize: 9, fontWeight: 'bold' }}>
                                      {m.gender === 'female' ? '♀' : '♂'} {m.age}
                                    </Text>
                                  </View>
                                )}
                                {m.isVIP && (
                                  <View style={[styles.glowBadge, { backgroundColor: 'rgba(251, 191, 36, 0.2)', borderColor: '#FBBF24' }]}>
                                    <Crown size={8} color="#FDE047" />
                                    <Text variant="caption" color="#FEF08A" style={{ fontSize: 9, fontWeight: 'bold' }}>
                                      {m.vipLevel ? `SVIP ${m.vipLevel}` : 'VIP'}
                                    </Text>
                                  </View>
                                )}
                                <View style={[styles.glowBadge, { backgroundColor: 'rgba(252, 165, 165, 0.2)', borderColor: '#FCA5A5' }]}>
                                  <Text variant="caption" color="#FEE2E2" style={{ fontSize: 9, fontWeight: 'bold' }}>
                                    LV.{m.level}
                                  </Text>
                                </View>
                                {m.role ? (
                                  <View style={[styles.glowBadge, { backgroundColor: `${roleColor(m.role)}33`, borderColor: roleColor(m.role) }]}>
                                    <Text variant="caption" color={roleColor(m.role)} style={{ fontSize: 9, fontWeight: 'bold' }}>
                                      {roleLabel(m.role, isAr)}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text variant="bodySmall" weight="bold" color="#FFF" numberOfLines={1}>
                                {m.name}
                              </Text>
                              {m.onSeat ? (
                                <Text variant="caption" color="#4ADE80" style={{ fontSize: 10 }}>
                                  ● {t('room.onMic')}
                                </Text>
                              ) : (
                                <Text variant="caption" color="#FCA5A5" style={{ fontSize: 10 }}>
                                  {t('roomInfo.activeToday')}
                                </Text>
                              )}
                            </View>

                            <View style={styles.memberAvatarContainer}>
                              {memberFrameUri ? (
                                <FramedAvatar avatarUri={m.avatar} frameUri={memberFrameUri} avatarSize={44} fallbackLetter={m.name} />
                              ) : m.avatar ? (
                                <Image source={{ uri: m.avatar }} style={styles.memberAvatarNew} contentFit="cover" cachePolicy="memory-disk" recyclingKey={m.avatar} />
                              ) : (
                                <View style={[styles.memberAvatarNew, styles.avatarFallbackNew]}>
                                  <Text variant="body" color="#FFF" weight="bold">
                                    {m.name.charAt(0)}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </Pressable>
                          );
                        })
                      )}
                    </ScrollView>
                  )}
                </>
              )}
            </>
          )}

          {/* Role picker Overlay */}
          {rolePickerUid ? (
            <Pressable style={styles.rolePickerOverlay} onPress={() => setRolePickerUid(null)}>
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.rolePickerSheet}>
                <LinearGradient colors={['#1A0A0C', '#0A0405']} style={StyleSheet.absoluteFill} />
                <Text variant="bodySmall" weight="bold" color="#FFF" style={{ marginBottom: 16 }}>
                  {t('roomInfo.assignRole')}
                </Text>
                {assignableRolesForUid(rolePickerUid).map(
                  (role) => {
                    const member = memberRows.find((m) => m.uid === rolePickerUid);
                    return (
                      <Pressable
                        key={role}
                        style={styles.roleOptionNew}
                        onPress={() =>
                          member && handleRoleSelect(rolePickerUid, member.memberDocId, role)
                        }
                      >
                        <User size={18} color={roleColor(role)} fill={roleColor(role)} />
                        <Text variant="bodySmall" weight="bold" color="#FEE2E2">
                          {roleLabel(role, isAr)}
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </View>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Reusable Grid Stat Card Component
function StatCard({ label, value, icon, chevron, onPress }: any) {
  const Card = (
    <View style={styles.statCard}>
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.statCardIconWrap}>
        {icon}
      </View>
      <View style={styles.statCardContent}>
        <Text variant="bodySmall" weight="bold" color="#FFF" style={{ fontSize: 15, marginBottom: 2 }}>{value}</Text>
        <Text variant="caption" color="#FCA5A5">{label}</Text>
      </View>
      {chevron && <ChevronLeft size={16} color="#FCA5A5" />}
    </View>
  );

  if (onPress) return <Pressable onPress={onPress} style={styles.statCardOuter}>{Card}</Pressable>;
  return <View style={styles.statCardOuter}>{Card}</View>;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    borderTopStartRadius: 32,
    borderTopEndRadius: 32,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    maxHeight: SCREEN_H * 0.88,
    overflow: 'hidden',
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: spacing.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnGhost: { width: 36, height: 36, opacity: 0 },
  tabContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  tabTrack: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 24,
    padding: 4,
    width: '80%',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(252, 165, 165, 0.25)',
  },
  floatingAvatarWrap: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  floatingAvatarRing: {
    padding: 3,
    borderRadius: 60,
    marginBottom: 12,
    shadowColor: '#FF3340',
    shadowOpacity: 0.5,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  floatingAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#100406',
  },
  floatingNameWrap: {
    alignItems: 'center',
  },
  profileNameNew: {
    fontSize: 22,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
  profileAnnNew: {
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: 10,
  },
  idChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(253, 224, 71, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(253, 224, 71, 0.3)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: spacing.lg,
  },
  statCardOuter: {
    width: '48%',
  },
  statCard: {
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  statCardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardContent: {
    flex: 1,
    alignItems: 'flex-start',
  },
  blockedActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    gap: 8,
    overflow: 'hidden',
  },
  memberToolbarNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  searchRowNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  searchBlurBox: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165, 0.3)',
  },
  searchInputNew: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#FFF',
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  searchBtnNew: {
    backgroundColor: '#E11414',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#E11414',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  roleFiltersNew: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    justifyContent: 'center',
  },
  roleFilterBtnNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  memberRowNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  memberInfoNew: {
    flex: 1,
    alignItems: 'flex-end',
  },
  memberBadgesNew: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  glowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  memberAvatarContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarNew: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallbackNew: {
    backgroundColor: '#E11414',
  },
  rolePickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  rolePickerSheet: {
    borderTopStartRadius: 24,
    borderTopEndRadius: 24,
    padding: spacing.xl,
    overflow: 'hidden',
  },
  roleOptionNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
});
