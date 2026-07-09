/**
 * قلب الخط الزمني — مطابق Level-1.png
 * قلب شفاف لافندر + قفل رمادي في الوسط
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const HEART_OUTLINE =
  'M12 20.5C5.5 16 3 12.4 3 9a4.6 4.6 0 0 1 9-1.6A4.6 4.6 0 0 1 21 9c0 3.4-2.5 7-9 11.5z';

/** قفل صغير — من Icons/Lock.svg */
function MiniLock({ size = 11 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7.5 9V6.5C7.5 4.01472 9.51472 2 12 2C14.4853 2 16.5 4.01472 16.5 6.5V9"
        stroke="#8B93A7"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M6 9H18C19.1046 9 20 9.89543 20 11V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V11C4 9.89543 4.89543 9 6 9Z"
        stroke="#8B93A7"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TimelineLockedHeart({ size = 34 }: { size?: number }) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d={HEART_OUTLINE}
          stroke="#E0CACA"
          strokeWidth={1.5}
          fill="rgba(250, 230, 230, 0.65)"
        />
      </Svg>
      <View style={styles.lock}>
        <MiniLock size={Math.round(size * 0.34)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lock: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 3,
  },
});
