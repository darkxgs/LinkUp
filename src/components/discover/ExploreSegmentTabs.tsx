/**
 * تبويبات الاستكشاف — مطابقة home.jsx (شريط أبيض + أسهم التصميم)
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { LuArrowIcon, LuSlidersIcon } from '@/components/icons/LuDesignIcons';
import { lu } from '@/theme/lu-brand';

export type ExploreTab = 'list' | 'suggested' | 'nearby';

const TABS: ExploreTab[] = ['list', 'suggested', 'nearby'];

type Props = {
  pad: number;
  tab: ExploreTab;
  onTab: (t: ExploreTab) => void;
  onPrev: () => void;
  onNext: () => void;
  onFilter?: () => void;
  filterActive?: boolean;
};

export function ExploreSegmentTabs({
  pad,
  tab,
  onTab,
  onPrev,
  onNext,
  onFilter,
  filterActive,
}: Props) {
  const { t } = useTranslation();
  const labels: Record<ExploreTab, string> = {
    list: t('home.tabList'),
    suggested: t('home.tabSuggested'),
    nearby: t('home.tabNearby'),
  };

  const [tabsLayout, setTabsLayout] = useState<Record<string, { x: number; width: number }>>({});
  const translateX = useSharedValue(0);
  const capsuleWidth = useSharedValue(0);

  useEffect(() => {
    const layout = tabsLayout[tab];
    if (layout) {
      translateX.value = withSpring(layout.x, { damping: 20, stiffness: 130 });
      capsuleWidth.value = withSpring(layout.width, { damping: 20, stiffness: 130 });
    }
  }, [tab, tabsLayout]);

  const animatedCapsuleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: capsuleWidth.value,
    opacity: capsuleWidth.value > 0 ? 1 : 0,
  }));

  return (
    <View style={[styles.wrap, { marginHorizontal: pad }]}>
      <View style={styles.bar}>
        {/* Left Arrow (Prev) */}
        <Pressable onPress={onPrev} style={styles.arrow}>
          <LuArrowIcon size={17} color={'#1B1B22'} direction="right" />
        </Pressable>

        {onFilter && (
          <Pressable onPress={onFilter} style={styles.filterBtn}>
            <LuSlidersIcon size={15} color={filterActive ? '#B00E0E' : '#5C5C64'} />
            <Text style={[styles.filterText, filterActive && styles.filterTextActive]}>
              {t('home.filterTitle') || 'Filters'}
            </Text>
            {filterActive && <View style={styles.filterDotBadge} />}
          </Pressable>
        )}
        {onFilter && <View style={styles.barDivider} />}
        
        <View style={styles.labels}>
          {Object.keys(tabsLayout).length > 0 && (
            <Animated.View
              style={[
                styles.capsule,
                animatedCapsuleStyle,
              ]}
            />
          )}
          {TABS.map((tabName) => {
            const active = tab === tabName;
            return (
              <Pressable
                key={tabName}
                onPress={() => onTab(tabName)}
                onLayout={(e) => {
                  const { x, width } = e.nativeEvent.layout;
                  setTabsLayout((prev) => ({
                    ...prev,
                    [tabName]: { x, width },
                  }));
                }}
                style={styles.tabBtn}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {labels[tabName]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Right Arrow (Next) */}
        <Pressable onPress={onNext} style={styles.arrow}>
          <LuArrowIcon size={17} color={'#1B1B22'} direction="left" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 20, marginBottom: 6 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'nowrap',
    backgroundColor: '#fff',
    borderRadius: 99,
    paddingVertical: 7,
    paddingHorizontal: 8,
    ...lu.shadows.card,
  },
  arrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(200, 40, 40, 0.22)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  labels: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabBtn: { paddingHorizontal: 8, paddingVertical: 6, zIndex: 2 },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: lu.fonts.bodyBold,
    zIndex: 3,
  },
  tabTextActive: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: lu.fonts.bodyHeavy,
    zIndex: 3,
  },
  capsule: {
    position: 'absolute',
    left: 0,
    top: 2,
    bottom: 2,
    borderRadius: 99,
    backgroundColor: '#B00E0E',
    zIndex: 1,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingStart: 8,
    paddingEnd: 6,
    paddingVertical: 6,
  },
  filterText: {
    fontSize: 13.5,
    color: '#5C5C64',
    fontFamily: lu.fonts.bodyBold,
  },
  filterTextActive: {
    color: '#B00E0E',
  },
  barDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#FEE2E2',
  },
  filterDotBadge: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF5C7A',
    marginStart: 2,
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    end: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: lu.colors.pink,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
});
