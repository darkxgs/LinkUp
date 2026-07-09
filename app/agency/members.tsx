/**
 * إدارة المضيفين في وكالتي
 *  - جدول كل الأعضاء مع رواتبهم (pearlsEarned)
 *  - بحث + فلاتر
 *  - تابات: الراتب الإجمالي / الراتب لكل مرة
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Search, Users, Download, MoreVertical, X, Eye } from 'lucide-react-native';
import { ChevronRight } from '@/components/ui/RtlIcons';
import { auth } from '@/services/firebase';

import { Text, useAlert } from '@/components/ui';
import {
  subscribeToMyAgency,
  subscribeToAgencyMembers,
  removeAgencyMember,
  updateMemberPermissions,
  DEFAULT_MEMBER_PERMISSIONS,
  type Agency,
  type AgencyMember,
  type AgencyMemberPermissions,
} from '@/services/agencyService';
import { lu } from '@/theme/lu-brand';
import { spacing, radius, shadows } from '@/theme';

type Tab = 'total' | 'per_time';

export default function AgencyMembersScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert, showActionSheet } = useAlert();
  const isAr = i18n.language?.startsWith('ar') === true;

  const [permissionsModalVisible, setPermissionsModalVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<AgencyMember | null>(null);
  const [tempPermissions, setTempPermissions] = useState<AgencyMemberPermissions>(DEFAULT_MEMBER_PERMISSIONS);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const [agency, setAgency] = useState<Agency | null>(null);
  const [members, setMembers] = useState<AgencyMember[]>([]);
  const [tab, setTab] = useState<Tab>('total');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (selectedMember) {
      setTempPermissions(selectedMember.permissions || DEFAULT_MEMBER_PERMISSIONS);
    }
  }, [selectedMember]);

  useEffect(() => {
    const u1 = subscribeToMyAgency(setAgency);
    return u1;
  }, []);

  useEffect(() => {
    if (!agency) return;
    const u = subscribeToAgencyMembers(agency.id, setMembers);
    return u;
  }, [agency?.id]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members;
    return members.filter(
      (m) =>
        m.uidName.toLowerCase().includes(term) ||
        m.uid.toLowerCase().includes(term),
    );
  }, [members, search]);

  const totalEarnings = useMemo(
    () => members.reduce((sum, m) => sum + (m.pearlsEarned ?? 0), 0),
    [members],
  );

  // #3: تنفيذ مباشر بدون نافذة تأكيد — رسالة نتيجة فقط (يمكن إعادة الدعوة لاحقاً)
  const handleRemove = useCallback(async (member: AgencyMember) => {
    try {
      await removeAgencyMember(member.id);
      showAlert({ type: 'success', title: t('common.done'), message: t('agency.text91212') });
    } catch (e: any) {
      showAlert({ type: 'error', title: t('room.actionFailed'), message: e?.message ?? t('roomSettings.text32386') });
    }
  }, [showAlert, t]);

  const handleMenuPress = useCallback((member: AgencyMember) => {
    showActionSheet({
      title: member.uidName,
      message: 'خيارات إدارة المضيف',
      buttons: [
        {
          text: 'تعديل صلاحيات المضيف',
          onPress: () => {
            setSelectedMember(member);
            setPermissionsModalVisible(true);
          },
        },
        {
          text: 'إنهاء العضوية',
          style: 'destructive',
          onPress: () => handleRemove(member),
        },
        {
          text: 'إلغاء',
          style: 'cancel',
        },
      ],
    });
  }, [showActionSheet, handleRemove]);

  const handleSavePermissions = async () => {
    if (!selectedMember) return;
    setSavingPermissions(true);
    try {
      await updateMemberPermissions(selectedMember.id, tempPermissions);
      setPermissionsModalVisible(false);
      showAlert({
        type: 'success',
        title: 'تم الحفظ',
        message: `تم تحديث صلاحيات المضيف "${selectedMember.uidName}" بنجاح`,
      });
    } catch (e: any) {
      showAlert({
        type: 'error',
        title: 'خطأ',
        message: e?.message ?? 'فشل حفظ التحديثات',
      });
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleExport = useCallback(() => {
    showAlert({
      type: 'info',
      title: t('agency.text68162'),
      message: t('agency.text49672'),
    });
  }, [showAlert, t]);

  const isOwner = agency?.ownerUid === auth.currentUser?.uid;

  const renderItem = useCallback(
    ({ item }: { item: AgencyMember }) => (
      <MemberRow member={item} onPress={handleMenuPress} isAr={isAr} showMenu={isOwner} />
    ),
    [handleMenuPress, isAr, isOwner],
  );

  const keyExtractor = useCallback((m: AgencyMember) => m.id, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[lu.colors.pinkSoft, lu.colors.purple]}
        style={[styles.hero, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.push('/agency/track' as any)} style={styles.headerBtn}>
            <Eye size={18} color="#fff" />
          </Pressable>
          <Text variant="h3" color="#fff" weight="bold">
            {t('agency.text55204')}
          </Text>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <ChevronRight size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Counter */}
        <View style={styles.counter}>
          <Users size={24} color="#fff" />
          <Text variant="h1" color="#fff" weight="bold" style={{ marginRight: 8 }}>
            {members.length}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.8)">
            {t('agency.text91605')}
          </Text>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable onPress={() => setTab('total')} style={styles.tabBtn}>
          <Text
            variant="button"
            color={tab === 'total' ? lu.colors.pink : '#9CA3AF'}
            weight={tab === 'total' ? 'bold' : 'regular'}
          >
            {t('agency.text45770')}
          </Text>
          {tab === 'total' && <View style={styles.tabUnderline} />}
        </Pressable>
        <Pressable onPress={() => setTab('per_time')} style={styles.tabBtn}>
          <Text
            variant="button"
            color={tab === 'per_time' ? lu.colors.pink : '#9CA3AF'}
            weight={tab === 'per_time' ? 'bold' : 'regular'}
          >
            {t('agency.text66687')}
          </Text>
          {tab === 'per_time' && <View style={styles.tabUnderline} />}
        </Pressable>
      </View>

      {/* Search + Actions */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Search size={16} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={isAr ? 'أدخل أيدي المضيف' : 'Enter host ID'}
            placeholderTextColor="#9CA3AF"
            style={[styles.searchInput, { textAlign: isAr ? 'right' : 'left' }]}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <X size={16} color="#9CA3AF" />
            </Pressable>
          )}
        </View>
        <Pressable onPress={handleExport} style={styles.exportBtn}>
          <Text variant="caption" color="#fff" weight="bold">{t('agency.text14545')}</Text>
        </Pressable>
      </View>

      {/* Header row */}
      <View style={styles.tableHeader}>
        <Text variant="caption" color="#6B7280" weight="bold" style={{ flex: 1 }}>
          {t('agency.text90501')}
        </Text>
        <Text variant="caption" color="#6B7280" weight="bold" style={{ width: 100, textAlign: isAr ? 'right' : 'left' }}>
          {t('agency.text80970')}
        </Text>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => setRefreshing(false)}
            tintColor={lu.colors.pink}
          />
        }
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Users size={48} color="#D1D5DB" />
            <Text variant="button" color="#9CA3AF" align="center" style={{ marginTop: 12 }}>
              {search ? t('agency.text1094') : t('agency.text5582')}
            </Text>
          </View>
        }
        ListFooterComponent={
          filtered.length > 0 ? (
            <View style={styles.totalCard}>
              <Text variant="caption" color="#6B7280">{t('agency.text40847')}</Text>
              <Text style={styles.totalNumber}>{totalEarnings.toLocaleString()}.00</Text>
              <Text variant="caption" color={lu.colors.pink} weight="bold">{t('profile.pearlsLabel')}</Text>
            </View>
          ) : null
        }
      />

      {/* Permissions Modal */}
      <Modal
        visible={permissionsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPermissionsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setPermissionsModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={20} color={lu.colors.ink} />
              </Pressable>
              <Text variant="h3" weight="bold" color={lu.colors.ink}>
                تعديل صلاحيات المضيف
              </Text>
            </View>

            {selectedMember && (
              <View style={styles.memberInfoMini}>
                <Image
                  source={selectedMember.uidAvatar ? { uri: selectedMember.uidAvatar } : undefined}
                  style={styles.miniAvatar}
                />
                <View style={{ flex: 1, alignItems: 'flex-start' }}>
                  <Text variant="button" weight="bold">{selectedMember.uidName}</Text>
                  <Text variant="caption" color="#9CA3AF">ID: {selectedMember.uid.slice(0, 12)}</Text>
                </View>
              </View>
            )}

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              {/* Permission Item 1: Self Withdraw */}
              <View style={styles.permissionItem}>
                <View style={styles.permissionTextCol}>
                  <Text variant="body" weight="bold" color={lu.colors.ink}>
                    السحب الذاتي
                  </Text>
                  <Text variant="caption" color={lu.colors.muted} style={styles.permissionDesc}>
                    السماح للمضيف بطلب سحب ماساته بشكل ذاتي من المحفظة.
                  </Text>
                </View>
                <Switch
                  value={tempPermissions.allowSelfWithdraw}
                  onValueChange={(val) =>
                    setTempPermissions((prev) => ({ ...prev, allowSelfWithdraw: val }))
                  }
                  trackColor={{ false: '#D1D5DB', true: lu.colors.purple }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.divider} />

              {/* Permission Item 2: Agent Withdraw */}
              <View style={styles.permissionItem}>
                <View style={styles.permissionTextCol}>
                  <Text variant="body" weight="bold" color={lu.colors.ink}>
                    السحب بالنيابة
                  </Text>
                  <Text variant="caption" color={lu.colors.muted} style={styles.permissionDesc}>
                    السماح للمضيف بطلب السحب نقداً بالنيابة عن طريق الوكيل.
                  </Text>
                </View>
                <Switch
                  value={tempPermissions.allowAgentWithdraw}
                  onValueChange={(val) =>
                    setTempPermissions((prev) => ({ ...prev, allowAgentWithdraw: val }))
                  }
                  trackColor={{ false: '#D1D5DB', true: lu.colors.purple }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.divider} />

              {/* Permission Item 3: Transfer to Agent */}
              <View style={styles.permissionItem}>
                <View style={styles.permissionTextCol}>
                  <Text variant="body" weight="bold" color={lu.colors.ink}>
                    التحويل للوكيل
                  </Text>
                  <Text variant="caption" color={lu.colors.muted} style={styles.permissionDesc}>
                    السماح للمضيف بنقل الماسات مباشرة إلى حساب الوكيل.
                  </Text>
                </View>
                <Switch
                  value={tempPermissions.allowTransferToAgent}
                  onValueChange={(val) =>
                    setTempPermissions((prev) => ({ ...prev, allowTransferToAgent: val }))
                  }
                  trackColor={{ false: '#D1D5DB', true: lu.colors.purple }}
                  thumbColor="#fff"
                />
              </View>
            </ScrollView>

            <Pressable
              onPress={handleSavePermissions}
              disabled={savingPermissions}
              style={[styles.saveBtn, savingPermissions && { opacity: 0.7 }]}
            >
              {savingPermissions ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text variant="button" color="#fff" weight="bold">
                  حفظ التغييرات
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const MemberRow = React.memo(function MemberRow({
  member,
  onPress,
  isAr,
  showMenu,
}: {
  member: AgencyMember;
  onPress: (member: AgencyMember) => void;
  isAr: boolean;
  showMenu: boolean;
}) {
  const { t } = useTranslation();
  const handlePress = useCallback(() => onPress(member), [onPress, member]);
  return (
    <View style={[styles.memberRow, { flexDirection: 'row' }]}>
      {member.uidAvatar ? (
        <Image
          source={{ uri: member.uidAvatar }}
          style={styles.avatar}
          cachePolicy="memory-disk"
          recyclingKey={member.id}
        />
      ) : (
        <View style={[styles.avatar, { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }]}>
          <Users size={18} color="#9CA3AF" />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text variant="button" weight="bold" numberOfLines={1} align={isAr ? 'right' : 'left'}>{member.uidName}</Text>
        <Text variant="caption" color="#9CA3AF" align={isAr ? 'right' : 'left'}>ID: {member.uid.slice(0, 10)}</Text>
      </View>
      <View style={{ width: 100, alignItems: isAr ? 'flex-start' : 'flex-end' }}>
        <Text variant="button" weight="bold" color={lu.colors.pink}>
          {(member.pearlsEarned ?? 0).toLocaleString()}.00
        </Text>
        <Text variant="caption" color="#9CA3AF">{t('profile.pearlsLabel')}</Text>
      </View>
      {showMenu && (
        <Pressable onPress={handlePress} style={styles.menuBtn}>
          <MoreVertical size={16} color="#9CA3AF" />
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  hero: { paddingBottom: 16 },
  header: {
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    position: 'relative',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    width: 80,
    height: 3,
    borderRadius: 2,
    backgroundColor: lu.colors.pink,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.md,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 99,
    ...shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111',
    textAlign: 'right',
  },
  exportBtn: {
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 99,
    backgroundColor: lu.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  menuBtn: {
    padding: 4,
  },
  empty: {
    padding: 60,
    alignItems: 'center',
  },
  totalCard: {
    margin: spacing.md,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  totalNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: lu.colors.purpleDark,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 10, 12, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalCloseBtn: {
    padding: 4,
  },
  memberInfoMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  miniAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  modalForm: {
    marginVertical: 12,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 16,
  },
  permissionTextCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  permissionDesc: {
    marginTop: 4,
    lineHeight: 18,
    textAlign: 'left',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  saveBtn: {
    backgroundColor: lu.colors.purple,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
});
