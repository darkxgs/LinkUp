import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Text as SvgText } from 'react-native-svg';
import { Text } from '@/components/ui';
import { lu } from '@/theme/lu-brand';

type Point = { label: string; value: number };

type Props = {
  data: Point[];
  height?: number;
  valueSuffix?: string;
};

function formatAxis(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

export function SimpleLineChart({ data, height = 180, valueSuffix = '' }: Props) {
  const chart = useMemo(() => {
    const padL = 42;
    const padR = 12;
    const padT = 12;
    const padB = 28;
    const width = 320;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;
    const values = data.map((d) => d.value);
    const maxVal = Math.max(1, ...values);
    const yMax = maxVal * 1.15;

    const coords = data.map((d, i) => {
      const x = padL + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
      const y = padT + innerH - (d.value / yMax) * innerH;
      return { x, y, ...d };
    });

    const linePath = coords
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');
    const areaPath = coords.length
      ? `${linePath} L ${coords[coords.length - 1]!.x} ${padT + innerH} L ${coords[0]!.x} ${padT + innerH} Z`
      : '';

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      y: padT + innerH - t * innerH,
      label: formatAxis(yMax * t),
    }));

    return { width, coords, linePath, areaPath, yTicks, padL, padT, innerH };
  }, [data, height]);

  if (!data.length) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text variant="caption" color={lu.colors.ink2} align="center">
          لا توجد بيانات لهذه الفترة
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${chart.width} ${height}`}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#E11414" stopOpacity="0.35" />
            <Stop offset="100%" stopColor="#E11414" stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {chart.yTicks.map((t, i) => (
          <React.Fragment key={`y-tick-${i}`}>
            <Line
              x1={chart.padL}
              y1={t.y}
              x2={chart.width - 12}
              y2={t.y}
              stroke="#FEE2E2"
              strokeWidth={1}
            />
            <SvgText x={4} y={t.y + 4} fontSize={10} fill="#9CA3AF">
              {t.label}
            </SvgText>
          </React.Fragment>
        ))}

        {chart.areaPath ? <Path d={chart.areaPath} fill="url(#areaGrad)" /> : null}
        {chart.linePath ? (
          <Path d={chart.linePath} stroke="#E11414" strokeWidth={2.5} fill="none" />
        ) : null}

        {chart.coords.map((p, i) => (
          <React.Fragment key={`point-${i}`}>
            <SvgText
              x={p.x}
              y={height - 6}
              fontSize={10}
              fill="#9CA3AF"
              textAnchor="middle"
            >
              {p.label}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
      {valueSuffix ? (
        <Text variant="caption" color={lu.colors.ink2} style={styles.suffix}>
          {valueSuffix}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF9F5',
    borderRadius: 12,
  },
  suffix: { textAlign: 'center', marginTop: 4 },
});
