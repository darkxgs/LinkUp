import React from 'react';
import { View, StyleSheet } from 'react-native';

import { Text } from '@/components/ui';
import { CoinAmount } from '@/components/wallet/CoinAmount';
import { radius } from '@/theme';

type Props = {
  label: string;
  amount: number;
  dark?: boolean;
};

export function CoinBalanceBar({ label, amount, dark }: Props) {
  return (
    <View style={[styles.bar, dark && styles.barDark]}>
      <Text style={[styles.label, dark && styles.labelDark]}>{label}</Text>
      <CoinAmount amount={amount} size="lg" />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.18)',
    marginBottom: 12,
  },
  barDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(26, 10, 12, 0.55)',
  },
  labelDark: {
    color: 'rgba(255, 255, 255, 0.55)',
  },
});
