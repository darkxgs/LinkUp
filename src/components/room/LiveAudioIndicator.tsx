import React from 'react';
import { View } from 'react-native';

export function LiveAudioIndicator() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1.5, height: 8 }}>
      {[5, 8, 6].map((h) => (
        <View
          key={h}
          style={{ width: 2, height: h, backgroundColor: '#34D399', borderRadius: 1 }}
        />
      ))}
    </View>
  );
}
