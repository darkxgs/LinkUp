/**
 * شريط رسالة ترحيب ثابتة لغرف الوكالات — بديل عن الرسائل المثبتة المخصصة
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  I18nManager,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Pin, ChevronDown, ChevronUp } from 'lucide-react-native';

import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';
import { ROOM_DESIGN } from '@/theme/room-design';
import { textDirectionStyle } from '@/utils/rtl';
import {
  getAgencyRoomWelcomeBody,
  getAgencyRoomWelcomeTitle,
} from '@/constants/agencyRoomWelcome';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  agencyName: string;
};

export function AgencyWelcomeBanner({ agencyName }: Props) {
  const [expanded, setExpanded] = useState(false);
  const title = getAgencyRoomWelcomeTitle(agencyName);
  const body = getAgencyRoomWelcomeBody();
  // #14: اتجاه النص حسب محتواه — العربية تُعرض RTL حتى لو تخطيط التطبيق LTR
  const titleDir = textDirectionStyle(title);
  const bodyDir = textDirectionStyle(body);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.strip}>
        <View style={styles.accentLine} />
        <Pressable style={styles.textArea} onPress={toggleExpand}>
          <View style={styles.inlineRow}>
            <Pin size={10} color={lu.colors.pink} strokeWidth={2.4} />
            <View style={styles.textCol}>
              <Text style={[styles.titleText, titleDir]} numberOfLines={expanded ? 3 : 1}>
                {title}
              </Text>
              {expanded ? (
                <Text style={[styles.bodyText, bodyDir]}>{body}</Text>
              ) : (
                <Text style={[styles.previewText, bodyDir]} numberOfLines={1}>
                  {body}
                </Text>
              )}
            </View>
          </View>
        </Pressable>
        <Pressable onPress={toggleExpand} style={styles.tinyBtn} hitSlop={6}>
          {expanded
            ? <ChevronUp size={12} color="rgba(255,255,255,0.6)" />
            : <ChevronDown size={12} color="rgba(255,255,255,0.6)" />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 8,
    backgroundColor: 'rgba(30, 8, 10, 0.4)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    minHeight: 28,
  },
  accentLine: {
    width: 2.5,
    alignSelf: 'stretch',
    backgroundColor: lu.colors.pink,
  },
  textArea: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  textCol: {
    flex: 1,
    gap: 4,
  },
  titleText: {
    color: '#fff',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: lu.fonts.body,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  previewText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    lineHeight: 14,
    fontFamily: lu.fonts.body,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  bodyText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    lineHeight: 17,
    fontFamily: lu.fonts.body,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  tinyBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginEnd: 4,
  },
});
