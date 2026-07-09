/**
 * فقاعة رسالة مزينة — إطار PNG يحيط بالنص، يتمدّد مع طول النص (ريسبونس) بلا أن يؤثّر عليه.
 *
 * ملاحظة: نستخدم expo-image بـ contentFit="fill" (يظهر دائماً ومخزَّن على القرص) بدل
 * 9-slice/capInsets التي كانت تفشل على iOS مع الفقاعات الصغيرة فتختفي الفقاعة. المكوّن
 * بلا حالة (stateless) → ارتفاع ثابت بلا وميض/إزاحة، فالشات لا يتقطّع.
 */

import React from 'react';
import {
  View,
  StyleSheet,
  I18nManager,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Text } from '@/components/ui';

const prefetchedUris = new Set<string>();

/** تحميل مسبق لصور الفقاعات إلى كاش القرص → ظهور فوري بلا تأخير. */
export function prefetchMessageBubbleUris(uris: (string | undefined | null)[]): void {
  for (const raw of uris) {
    const uri = raw?.trim();
    if (!uri || !uri.startsWith('http') || prefetchedUris.has(uri)) continue;
    prefetchedUris.add(uri);
    void ExpoImage.prefetch(uri, { cachePolicy: 'memory-disk' });
  }
}

type Props = {
  bubbleUri?: string;
  /** لون احتياطي عند عدم وجود صورة فقاعة */
  fallbackColor?: string;
  children?: React.ReactNode;
  /** نص مباشر — بديل children */
  text?: string;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
};

export const FramedMessageBubble = React.memo(function FramedMessageBubble({
  bubbleUri,
  fallbackColor = 'rgba(225, 20, 20, 0.88)',
  children,
  text,
  textStyle,
  style,
}: Props) {
  const uri = bubbleUri?.trim();

  const content = children ?? (
    text ? (
      <Text style={[uri ? styles.framedText : null, textStyle, uri ? styles.textAlign : null]}>
        {text}
      </Text>
    ) : null
  );
  if (!content) return null;

  if (!uri) {
    return (
      <View style={[styles.fallback, { backgroundColor: fallbackColor }, style]}>
        {content}
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, style]}>
      <ExpoImage
        source={{ uri }}
        style={styles.bg}
        contentFit="fill"
        cachePolicy="memory-disk"
        recyclingKey={uri}
        transition={0}
      />
      <View style={styles.content} pointerEvents="none">
        {content}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minWidth: 72,
    minHeight: 38,
    justifyContent: 'center',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
  },
  // حشوة متّزنة: النص لا يلامس زخرفة الإطار، والإطار يتمدّد مع النص
  content: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    maxWidth: '100%',
    justifyContent: 'center',
  },
  fallback: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  framedText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
  },
  textAlign: {
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
  },
});
