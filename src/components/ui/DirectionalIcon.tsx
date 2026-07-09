/**
 * DirectionalIcon — يقلب الأيقونة تلقائياً حسب اتجاه التطبيق
 *
 * استخدمه للأيقونات التي تحتاج تنعكس في RTL مثل:
 *  - ChevronLeft (زر الرجوع)
 *  - ChevronRight (السهم الأمامي)
 *  - ArrowLeft / ArrowRight
 *
 * مثال:
 *   <DirectionalIcon icon={ChevronLeft} size={22} color="#000" />
 *
 * في LTR (إنجليزي): يعرض ChevronLeft كما هي → السهم لليسار = رجوع ✓
 * في RTL (عربي): يعكسها (scaleX: -1) → السهم لليمين = رجوع ✓
 */

import React from 'react';
import { View, I18nManager, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

interface Props {
  icon: LucideIcon;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
  /** اقلب أو لا (افتراضي true) */
  flipInRTL?: boolean;
}

export const DirectionalIcon: React.FC<Props> = ({
  icon: Icon,
  size = 24,
  color,
  strokeWidth,
  fill,
  flipInRTL = true,
}) => {
  const shouldFlip = flipInRTL && I18nManager.isRTL;

  if (!shouldFlip) {
    return <Icon size={size} color={color} strokeWidth={strokeWidth} fill={fill} />;
  }

  return (
    <View style={styles.flipped}>
      <Icon size={size} color={color} strokeWidth={strokeWidth} fill={fill} />
    </View>
  );
};

const styles = StyleSheet.create({
  flipped: {
    transform: [{ scaleX: -1 }],
  },
});
