/**
 * أسهم تنقل — أحرف Unicode ثابتة (لا تتأثر بـ swapLeftAndRightInRTL)
 *
 * في العربية (RTL): الرجوع = › (لليمين)
 * في الإنجليزية (LTR): الرجوع = ‹ (لليسار)
 */

import React from 'react';
import {
  Text,
  StyleSheet,
  I18nManager,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from '@/localization/i18n';

type ChevronProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  // مقبول للتوافق مع المستدعين؛ لا يُطبَّق حالياً (كما strokeWidth) للحفاظ على السلوك القائم
  style?: StyleProp<TextStyle>;
};

function isAppRTL(): boolean {
  return I18nManager.isRTL === true || i18n.language?.startsWith('ar') === true;
}

const GLYPH = {
  back:    { rtl: '\u203A', ltr: '\u2039' }, // \u203A \u0644\u0644\u0639\u0631\u0628\u064A\u0629 (\u0631\u062C\u0648\u0639 = \u064A\u0645\u064A\u0646) / \u2039 \u0644\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629
  forward: { rtl: '\u2039', ltr: '\u203A' }, // \u2039 \u0644\u0644\u0639\u0631\u0628\u064A\u0629 (\u062A\u0642\u062F\u0651\u0645 = \u064A\u0633\u0627\u0631) / \u203A \u0644\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629
} as const;

function RtlArrow({
  kind,
  size = 24,
  color = '#1A0A0C',
}: ChevronProps & { kind: keyof typeof GLYPH }) {
  useTranslation();
  const rtl = isAppRTL();
  const glyph = rtl ? GLYPH[kind].rtl : GLYPH[kind].ltr;

  return (
    <Text
      style={[
        styles.glyph,
        {
          fontSize: size,
          lineHeight: size + 2,
          color,
        },
      ]}
    >
      {glyph}
    </Text>
  );
}

/** سهم الرجوع */
export const BackChevron: React.FC<ChevronProps> = (props) => (
  <RtlArrow kind="back" {...props} />
);

/** سهم التقدّم (المزيد / عرض الكل) */
export const ForwardChevron: React.FC<ChevronProps> = (props) => (
  <RtlArrow kind="forward" {...props} />
);

const styles = StyleSheet.create({
  glyph: {
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
});
