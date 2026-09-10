import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme/colors';

const GAUGE_MAX = 250;
const SEGMENTS = [
  { from: 0, to: 50, color: '#16A34A' },
  { from: 50, to: 100, color: '#D97706' },
  { from: 100, to: 150, color: '#EA580C' },
  { from: 150, to: 200, color: '#DC2626' },
  { from: 200, to: 250, color: '#9333EA' },
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = startAngle - endAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

interface AqiGaugeProps {
  value: number;
}

export function AqiGauge({ value }: AqiGaugeProps) {
  const cx = 110;
  const cy = 96;
  const r = 86;
  const clamped = Math.max(0, Math.min(value, GAUGE_MAX));
  const needleAngle = 180 - (clamped / GAUGE_MAX) * 180;
  const needlePoint = polarToCartesian(cx, cy, r, needleAngle);

  return (
    <View style={styles.wrapper}>
      <Svg viewBox="0 0 220 108" width={220} height={108}>
        {SEGMENTS.map(seg => {
          const a1 = 180 - (seg.from / GAUGE_MAX) * 180;
          const a2 = 180 - (seg.to / GAUGE_MAX) * 180;
          return (
            <Path
              key={seg.from}
              d={arcPath(cx, cy, r, a1, a2)}
              stroke={seg.color}
              strokeWidth={16}
              strokeLinecap="round"
              fill="none"
            />
          );
        })}
        <Circle
          cx={needlePoint.x}
          cy={needlePoint.y}
          r={7}
          fill="#fff"
          stroke={colors.textPrimary}
          strokeWidth={3}
        />
      </Svg>
      <View style={styles.labelBox} pointerEvents="none">
        <Text style={styles.value}>{Math.round(value)}</Text>
        <Text style={styles.unit}>AQI</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 220,
    height: 122,
    alignSelf: 'center',
  },
  labelBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 4,
    alignItems: 'center',
  },
  value: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  unit: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginTop: -2,
  },
});
