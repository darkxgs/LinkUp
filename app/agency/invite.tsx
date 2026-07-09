/**
 * دعوة المضيف — 2 تابات
 *  - كود الدعوة: عرض الكود + سجل (في انتظار/تم/مرفوض)
 *  - رابط الدعوة: البحث بـ ID + إرسال دعوة مباشرة
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Copy, Search, UserPlus, CheckCircle2, XCircle, Clock, Share2 } from 'lucide-react-native';
import { ChevronRight } from '@/components/ui/RtlIcons';
import { copyToClipboard } from '@/utils/copyToClipboard';
import { Text, useAlert } from '@/components/ui';
import {
  subscribeToMyAgency,
  inviteUserToAgencyWithNotification,
  subscribeToMyAgencyInvites,
  cancelAgencyHostInvite,
  getAgencyById,
  type Agency,
  type AgencyInvite,
} from '@/services/agencyService';
import { resolveUserIdentifier, getDisplayAccountId } from '@/services/userIdentifier';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/services/firebase';
import { lu } from '@/theme/lu-brand';
import { spacing, radius, shadows } from '@/theme';

type Tab = 'code' | 'link';
type SubTab = 'pending' | 'accepted' | 'rejected';
type AgencyRole = 'owner' | 'host' | 'member' | 'coHost' | 'unknown';

type FoundUser = {
  uid: string;
  name: string;
  avatar: string;
  hasAgency: boolean;
  publicAccountId: string;
  agencyId?: string;
  agencyName?: string;
  agencyRole: AgencyRole;
};

function normalizeAgencyRole(value: unknown): AgencyRole {
  const role = String(value ?? '').trim();
  if (role === 'owner' || role === 'host' || role === 'member' || role === 'coHost') return role;
  return 'unknown';
}

function formatAgencyRoleLabel(role: AgencyRole): string {
  if (role === 'owner') return 'إدارة';
  if (role === 'host') return 'هوست';
  if (role === 'coHost') return 'إشراف';
  if (role === 'member') return 'عضو';
  return 'غير محدد';
}

function isPendingForAdmin(invite: AgencyInvite): boolean {
  // القبول عبر الكود يعني طلب انضمام بانتظار تأكيد الإدارة.
  if (invite.inviteMethod === 'code' && invite.status === 'accepted') return true;
  return invite.status === 'pending';
}

export default function InviteScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert, showToast } = useAlert();

  const [tab, setTab] = useState<Tab>('code');
  const [subTab, setSubTab] = useState<SubTab>('pending');
  const [agency, setAgency] = useState<Agency | null>(null);
  const [invites, setInvites] = useState<AgencyInvite[]>([]);

  // For link tab
  const [searchUid, setSearchUid] = useState('');
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    const u1 = subscribeToMyAgency(setAgency);
    const u2 = subscribeToMyAgencyInvites(setInvites);
    return () => {
      u1?.();
      u2?.();
    };
  }, []);

  const filteredInvites = invites.filter((i) => {
    if (subTab === 'pending') return isPendingForAdmin(i);
    if (subTab === 'accepted') return i.status === 'accepted';
    return i.status === 'rejected' || i.status === 'cancelled';
  });

  const handleCancelInvite = async (invite: AgencyInvite) => {
    setCancellingId(invite.id);
    try {
      await cancelAgencyHostInvite(invite.id);
      setInvites((prev) =>
        prev.map((i) => (i.id === invite.id ? { ...i, status: 'cancelled' } : i)),
      );
      showToast('تم إلغاء الدعوة');
    } catch (e: any) {
      showAlert({ type: 'error', title: t('common.error'), message: e?.message ?? t('common.error') });
    } finally {
      setCancellingId(null);
    }
  };

  const handleCopyCode = async () => {
    if (!agency) return;
    await copyToClipboard(agency.inviteCode);
    showToast(t('common.copied'));
  };

  const handleSearch = async () => {
    const raw = searchUid.trim();
    if (!raw) return;
    setSearching(true);
    setFoundUser(null);
    try {
      const uid = await resolveUserIdentifier(raw);
      if (!uid) {
        showAlert({
          type: 'error',
          title: t('agency.text5865'),
          message: t('errors.userNotFound'),
        });
        return;
      }
      const snap = await getDoc(doc(firestore, 'users', uid));
      if (!snap.exists()) {
        showAlert({
          type: 'error',
          title: t('agency.text5865'),
          message: t('errors.userNotFound'),
        });
        return;
      }
      const data = snap.data();
      const agencyId = typeof data.agencyId === 'string' ? data.agencyId : undefined;
      const agencyRole = normalizeAgencyRole(data.agencyRole);
      const agencyData = agencyId ? await getAgencyById(agencyId) : null;
      setFoundUser({
        uid: snap.id,
        name: data.profile?.displayName ?? data.displayName ?? t('rooms.userFallback'),
        avatar: data.profile?.avatar ?? data.avatar ?? '',
        hasAgency: !!agencyId,
        publicAccountId: getDisplayAccountId(data.publicAccountId, snap.id),
        agencyId,
        agencyName: agencyData?.name ?? undefined,
        agencyRole,
      });
    } catch (e: any) {
      showAlert({
        type: 'error',
        title: t('roomSettings.text32386'),
        message: e?.message ?? t('wallet.text76956'),
      });
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async () => {
    if (!foundUser || !agency) return;
    setInviting(true);
    try {
      await inviteUserToAgencyWithNotification({
        invitedUid: foundUser.uid,
        agencyId: agency.id,
        agencyName: agency.name,
        agentUid: agency.ownerUid,
        agentName: agency.ownerName,
        agentAvatar: agency.ownerAvatar,
      });
      showAlert({
        type: 'success',
        title: t('roomSettings.text14103'),
        message: `أُرسلت دعوة إلى ${foundUser.name}`,
        buttons: [
          {
            text: t('roomSettings.text80678'),
            onPress: () => {
              setFoundUser(null);
              setSearchUid('');
            },
          },
        ],
      });
    } catch (e: any) {
      showAlert({ type: 'error', title: t('room.actionFailed'), message: e?.message ?? t('chat.sendFailed') });
    } finally {
      setInviting(false);
    }
  };

  if (!agency) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={lu.colors.pink} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Beige/Cream Header */}
      <View style={[styles.headerCustom, { paddingTop: insets.top + 8 }]}>
        <View style={{ width: 36 }} />
        <Text weight="bold" style={styles.headTitleCustom}>دعوة المضيف</Text>
        <Pressable onPress={() => router.back()} style={styles.headBtnCustom}>
          <ChevronRight size={20} color={lu.colors.ink} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrapCustom}>
        <Pressable onPress={() => setTab('code')} style={styles.tabBtnCustom}>
          <Text
            weight="bold"
            style={[styles.tabLabelCustom, tab === 'code' && styles.tabLabelActiveCustom]}
          >
            كود الدعوة
          </Text>
          {tab === 'code' && <View style={styles.tabUnderlineCustom} />}
        </Pressable>
        <Pressable onPress={() => setTab('link')} style={styles.tabBtnCustom}>
          <Text
            weight="bold"
            style={[styles.tabLabelCustom, tab === 'link' && styles.tabLabelActiveCustom]}
          >
            رابط الدعوة
          </Text>
          {tab === 'link' && <View style={styles.tabUnderlineCustom} />}
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== Tab: كود الدعوة ===== */}
        {tab === 'code' && (
          <>
            <View style={styles.codeCardCustom}>
              <View style={styles.codeCardTop}>
                <Pressable onPress={handleCopyCode} style={styles.copyBtnCustom}>
                  <Text weight="bold" style={styles.copyBtnText}>نسخ</Text>
                </Pressable>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.codeLabel}>كود دعوة الوكالة</Text>
                  <Text style={styles.bigCodeCustom}>{String(agency.inviteCode ?? '').toUpperCase()}</Text>
                </View>
              </View>
              
              <View style={styles.dashedDivider} />
              
              <View style={styles.codeCardBottom}>
                <Text style={styles.codeHintText}>
                  قم بالمشاركة للمجموعة، ويتمكن المضيفين من تقديم طلب إنضمام للوكالة من بإستخدام كود الدعوة
                </Text>
              </View>
            </View>

            {/* Sub-tabs */}
            <View style={styles.subTabsCustom}>
              {[
                { id: 'rejected' as SubTab, label: 'تم الرفض', count: invites.filter(i => i.status === 'rejected' || i.status === 'cancelled').length },
                { id: 'accepted' as SubTab, label: 'تم الإنضمام', count: invites.filter(i => i.status === 'accepted').length },
                { id: 'pending' as SubTab, label: 'في انتظار التأكيد', count: invites.filter((i) => isPendingForAdmin(i)).length },
              ].map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setSubTab(s.id)}
                  style={[styles.subTabBtnCustom, subTab === s.id && styles.subTabActiveCustom]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                    {s.count > 0 && (
                      <Text style={[styles.subTabLabelCustom, subTab === s.id && styles.subTabLabelActiveCustom, { opacity: 0.7 }]}>
                        ({s.count})
                      </Text>
                    )}
                    <Text
                      weight="semibold"
                      style={[styles.subTabLabelCustom, subTab === s.id && styles.subTabLabelActiveCustom]}
                    >
                      {s.label}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {/* Table logs */}
            {filteredInvites.length === 0 ? (
              <View style={styles.emptyCustom}>
                <View style={styles.emptyIconCircle}>
                  <Search size={32} color={lu.colors.pink} />
                </View>
                <Text style={styles.emptyTextCustom}>
                  لا يوجد مزيد من البيانات
                </Text>
              </View>
            ) : (
              <View style={styles.tableLogsContainer}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { width: '25%', textAlign: 'left' }]}>حالة الدعوة</Text>
                  <Text style={[styles.tableHeaderCell, { width: '30%', textAlign: 'center' }]}>وقت الدعوة</Text>
                  <Text style={[styles.tableHeaderCell, { width: '45%', textAlign: 'right' }]}>الشخص المدعو</Text>
                </View>
                {filteredInvites.map((inv) => (
                  <InviteRow
                    key={inv.id}
                    invite={inv}
                    cancelling={cancellingId === inv.id}
                    onCancel={
                      inv.status === 'pending' && inv.inviteMethod === 'direct'
                        ? () => void handleCancelInvite(inv)
                        : undefined
                    }
                  />
                ))}
              </View>
            )}
          </>
        )}

        {/* ===== Tab: رابط الدعوة ===== */}
        {tab === 'link' && (
          <>
            <View style={styles.searchCardCustom}>
              <Text style={styles.searchCardTitle}>
                * أدخل أيدي المستخدم لتقوم بدعوته ليصبح مضيف
              </Text>
              <View style={styles.searchInputRow}>
                <TextInput
                  value={searchUid}
                  onChangeText={setSearchUid}
                  placeholder="أيدي المستخدم"
                  placeholderTextColor="#9CA3AF"
                  style={styles.searchInputCustom}
                  autoCapitalize="none"
                />
                <Pressable
                  onPress={handleSearch}
                  disabled={searching || !searchUid.trim()}
                  style={[
                    styles.verifyBtnCustom,
                    !!searchUid.trim() && styles.verifyBtnCustomActive,
                  ]}
                >
                  {searching ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text
                      weight="bold"
                      style={[
                        styles.verifyBtnText,
                        !!searchUid.trim() && styles.verifyBtnTextActive,
                      ]}
                    >
                      تحقق
                    </Text>
                  )}
                </Pressable>
              </View>

              {foundUser && (
                <View style={styles.userFoundCustom}>
                  {foundUser.avatar ? (
                    <Image source={{ uri: foundUser.avatar }} style={styles.userAvatarFound} />
                  ) : (
                    <View style={styles.userAvatarFoundPlaceholder}>
                      <UserPlus size={18} color="#fff" />
                    </View>
                  )}
                  <View style={{ flex: 1, alignItems: 'flex-end', marginEnd: 12 }}>
                    <Text weight="bold" style={{ fontSize: 14, color: lu.colors.ink }}>{foundUser.name}</Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                      ID: {foundUser.publicAccountId || foundUser.uid.slice(0, 8)}
                    </Text>
                    {foundUser.hasAgency ? (
                      <>
                        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>
                          الوكالة: {foundUser.agencyName || foundUser.agencyId || '—'}
                        </Text>
                        <Text style={{ fontSize: 12, color: lu.colors.purple, marginTop: 2 }}>
                          الحالة: {formatAgencyRoleLabel(foundUser.agencyRole)}
                        </Text>
                      </>
                    ) : null}
                  </View>
                  {foundUser.hasAgency ? (
                    <Text weight="bold" style={{ fontSize: 12, color: '#EF4444' }}>
                      ينتمي للوكالة
                    </Text>
                  ) : (
                    <CheckCircle2 size={20} color="#10B981" />
                  )}
                </View>
              )}

              <Pressable
                onPress={handleInvite}
                disabled={!foundUser || foundUser.hasAgency || inviting}
                style={[
                  styles.inviteBtnCustom,
                  (!foundUser || foundUser.hasAgency || inviting) && { opacity: 0.4 },
                ]}
              >
                {inviting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text weight="bold" style={styles.inviteBtnText}>
                    قم بدعوته كمضيف
                  </Text>
                )}
              </Pressable>
            </View>

            {/* Table logs */}
            {invites.length === 0 ? (
              <View style={styles.emptyCustom}>
                <View style={styles.emptyIconCircle}>
                  <Search size={32} color={lu.colors.pink} />
                </View>
                <Text style={styles.emptyTextCustom}>
                  لا يوجد مزيد من البيانات
                </Text>
              </View>
            ) : (
              <View style={styles.tableLogsContainer}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { width: '25%', textAlign: 'left' }]}>حالة الدعوة</Text>
                  <Text style={[styles.tableHeaderCell, { width: '30%', textAlign: 'center' }]}>وقت الدعوة</Text>
                  <Text style={[styles.tableHeaderCell, { width: '45%', textAlign: 'right' }]}>الشخص المدعو</Text>
                </View>
                {invites.slice(0, 20).map((inv) => (
                  <InviteRow
                    key={inv.id}
                    invite={inv}
                    cancelling={cancellingId === inv.id}
                    onCancel={
                      inv.status === 'pending' && inv.inviteMethod === 'direct'
                        ? () => void handleCancelInvite(inv)
                        : undefined
                    }
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function InviteRow({
  invite,
  cancelling,
  onCancel,
}: {
  invite: AgencyInvite;
  cancelling?: boolean;
  onCancel?: () => void;
}) {
  const date = new Date(invite.createdAt);
  
  const dateStr = date.getFullYear() + '-' + 
    String(date.getMonth() + 1).padStart(2, '0') + '-' + 
    String(date.getDate()).padStart(2, '0');
  
  const timeStr = String(date.getHours()).padStart(2, '0') + ':' + 
    String(date.getMinutes()).padStart(2, '0') + ':' + 
    String(date.getSeconds()).padStart(2, '0');

  const pendingForAdmin = isPendingForAdmin(invite);

  const statusColors: Record<string, { color: string; label: string }> = {
    pending: { color: '#F59E0B', label: 'بانتظار الانضمام' },
    accepted: { color: '#10B981', label: 'تم الإنضمام' },
    rejected: { color: '#EF4444', label: 'تم الرفض' },
    cancelled: { color: '#9CA3AF', label: 'أُلغيت' },
  };

  const s = pendingForAdmin
    ? { color: '#F59E0B', label: 'في انتظار التأكيد' }
    : (statusColors[invite.status] ?? { color: '#9CA3AF', label: invite.status });

  return (
    <View style={styles.tableRowInvite}>
      {/* Left Column (Status + cancel) */}
      <View style={{ width: '25%', alignItems: 'flex-start', gap: 6 }}>
        <Text style={[styles.statusTextCustom, { color: s.color }]}>{s.label}</Text>
        {onCancel ? (
          <Pressable
            onPress={onCancel}
            disabled={cancelling}
            style={[styles.cancelInviteBtn, cancelling && { opacity: 0.5 }]}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Text style={styles.cancelInviteText}>إلغاء</Text>
            )}
          </Pressable>
        ) : null}
      </View>

      {/* Center Column (Time) */}
      <View style={{ width: '30%', alignItems: 'center' }}>
        <Text style={styles.timeTextCustom}>{dateStr}</Text>
        <Text style={[styles.timeTextCustom, { marginTop: 2 }]}>{timeStr}</Text>
      </View>

      {/* Right Column (Person) */}
      <View style={{ width: '45%', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        <View style={{ alignItems: 'flex-end', flex: 1 }}>
          <Text weight="bold" style={styles.userNameTextCustom} numberOfLines={1}>
            {invite.invitedName}
          </Text>
          <Text style={styles.userIdTextCustom}>
            ID: {invite.invitedUid.slice(0, 8)}
          </Text>
        </View>
        {invite.invitedAvatar ? (
          <Image source={{ uri: invite.invitedAvatar }} style={styles.userAvatarSmall} />
        ) : (
          <View style={styles.userAvatarPlaceholderSmall}>
            <UserPlus size={12} color="#9CA3AF" />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: lu.colors.bg },
  headerCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 16,
    backgroundColor: '#FFFBF5',
    borderBottomWidth: 1,
    borderBottomColor: '#F5ECE0',
  },
  headBtnCustom: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headTitleCustom: {
    fontSize: 18,
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyBold,
  },
  tabsWrapCustom: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: lu.colors.line,
    paddingHorizontal: 20,
    justifyContent: 'space-around',
  },
  tabBtnCustom: {
    paddingVertical: 14,
    alignItems: 'center',
    position: 'relative',
  },
  tabLabelCustom: {
    fontSize: 16,
    color: '#9CA3AF',
    fontFamily: lu.fonts.bodySemi,
  },
  tabLabelActiveCustom: {
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyBold,
  },
  tabUnderlineCustom: {
    position: 'absolute',
    bottom: 0,
    width: 32,
    height: 3,
    borderRadius: 99,
    backgroundColor: lu.colors.pink,
  },
  codeCardCustom: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: lu.colors.line,
    marginBottom: 16,
    overflow: 'hidden',
    ...lu.shadows.card,
  },
  codeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF5F5',
  },
  copyBtnCustom: {
    backgroundColor: '#FF6B6B',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  copyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: lu.fonts.bodyBold,
  },
  codeLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: lu.fonts.body,
  },
  bigCodeCustom: {
    fontSize: 34,
    fontFamily: undefined,
    fontWeight: '800',
    color: lu.colors.ink,
    letterSpacing: 3,
    marginTop: 6,
    writingDirection: 'ltr',
    textAlign: 'left',
    includeFontPadding: false,
  },
  dashedDivider: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    marginHorizontal: -2,
  },
  codeCardBottom: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  codeHintText: {
    fontSize: 12,
    color: '#8A93A6',
    lineHeight: 18,
    textAlign: 'right',
    fontFamily: lu.fonts.body,
  },
  subTabsCustom: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: lu.colors.line,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    ...lu.shadows.card,
  },
  subTabBtnCustom: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  subTabActiveCustom: {
    backgroundColor: '#FFE6E9',
  },
  subTabLabelCustom: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: lu.fonts.bodySemi,
  },
  subTabLabelActiveCustom: {
    color: lu.colors.pink,
    fontFamily: lu.fonts.bodyBold,
  },
  emptyCustom: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: lu.colors.line,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    ...lu.shadows.card,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFE6E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTextCustom: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: lu.fonts.bodySemi,
  },
  tableLogsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: lu.colors.line,
    padding: 12,
    ...lu.shadows.card,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: lu.colors.line,
    marginBottom: 6,
  },
  tableHeaderCell: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: lu.fonts.bodySemi,
  },
  tableRowInvite: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFF8F8',
    alignItems: 'center',
  },
  statusTextCustom: {
    fontSize: 12,
    fontFamily: lu.fonts.bodyBold,
  },
  cancelInviteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  cancelInviteText: {
    fontSize: 10,
    color: '#EF4444',
    fontFamily: lu.fonts.bodyBold,
  },
  timeTextCustom: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: lu.fonts.display,
  },
  userNameTextCustom: {
    fontSize: 13,
    color: lu.colors.ink,
    fontFamily: lu.fonts.bodyBold,
  },
  userIdTextCustom: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: lu.fonts.body,
    marginTop: 2,
  },
  userAvatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
  },
  userAvatarPlaceholderSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchCardCustom: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: lu.colors.line,
    padding: 16,
    marginBottom: 16,
    ...lu.shadows.card,
  },
  searchCardTitle: {
    fontSize: 12,
    color: '#E11414',
    fontFamily: lu.fonts.bodySemi,
    marginBottom: 10,
    textAlign: 'right',
  },
  searchInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  searchInputCustom: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: lu.colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: lu.colors.ink,
    textAlign: 'right',
    fontFamily: lu.fonts.body,
    backgroundColor: '#FAFAFA',
  },
  verifyBtnCustom: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnCustomActive: {
    backgroundColor: lu.colors.pink,
  },
  verifyBtnText: {
    color: '#6B7280',
    fontSize: 13,
    fontFamily: lu.fonts.bodyBold,
  },
  verifyBtnTextActive: {
    color: '#fff',
  },
  userFoundCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginBottom: 14,
  },
  userAvatarFound: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userAvatarFoundPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: lu.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBtnCustom: {
    backgroundColor: lu.colors.pink,
    borderRadius: 8,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: lu.fonts.bodyBold,
  },
});
