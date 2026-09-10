import React, { useMemo } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop, Circle, Line as SvgLine } from 'react-native-svg';
import { colors } from '../theme/colors';
import { HistoryPoint } from '../types';

interface HistoryChartProps {
  data: HistoryPoint[];
  color: string;
  height?: number;
}

const CHART_PADDING = { top: 12, right: 8, bottom: 4, left: 8 };

export function HistoryChart({ data, color, height = 190 }: HistoryChartProps) {
  const [width, setWidth] = React.useState(0);

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  const { linePath, areaPath, points, minLabel, maxLabel } = useMemo(() => {
    if (!width || data.length === 0) {
      return { linePath: '', areaPath: '', points: [] as { x: number; y: number }[], minLabel: '', maxLabel: '' };
    }
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;

    const innerW = width - CHART_PADDING.left - CHART_PADDING.right;
    const innerH = height - CHART_PADDING.top - CHART_PADDING.bottom;

    const pts = data.map((d, i) => {
      const x =
        CHART_PADDING.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
      const y = CHART_PADDING.top + innerH - ((d.value - min) / span) * innerH;
      return { x, y };
    });

    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const baseline = CHART_PADDING.top + innerH;
    const area =
      `${line} L ${pts[pts.length - 1].x} ${baseline} L ${pts[0].x} ${baseline} Z`;

    return {
      linePath: line,
      areaPath: area,
      points: pts,
      minLabel: formatValue(min),
      maxLabel: formatValue(max),
    };
  }, [data, width, height]);

  const labelIndices = useMemo(() => pickLabelIndices(data.length), [data.length]);

  return (
    <View>
      <View style={{ height }} onLayout={onLayout}>
        {width > 0 && data.length > 0 && (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <Stop offset="100%" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <SvgLine
              x1={CHART_PADDING.left}
              x2={width - CHART_PADDING.right}
              y1={height - CHART_PADDING.bottom}
              y2={height - CHART_PADDING.bottom}
              stroke={colors.border}
              strokeWidth={1}
            />
            <Path d={areaPath} fill="url(#areaFill)" />
            <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" />
            {points.map((p, i) => (
              <Circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={i === points.length - 1 ? 4 : 2.5}
                fill="#fff"
                stroke={color}
                strokeWidth={2}
              />
            ))}
          </Svg>
        )}
        {width > 0 && data.length > 0 && (
          <View style={styles.yLabels} pointerEvents="none">
            <Text style={styles.axisLabel}>{maxLabel}</Text>
            <Text style={styles.axisLabel}>{minLabel}</Text>
          </View>
        )}
      </View>
      {data.length > 0 && (
        <View style={styles.xLabels}>
          {labelIndices.map(i => (
            <Text key={i} style={styles.axisLabel}>
              {data[i]?.label}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function formatValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Chọn tối đa 6 vị trí nhãn trục X trải đều để tránh chữ chồng lên nhau. */
function pickLabelIndices(length: number): number[] {
  if (length <= 1) return length === 1 ? [0] : [];
  const maxLabels = Math.min(6, length);
  const step = (length - 1) / (maxLabels - 1);
  const result: number[] = [];
  for (let i = 0; i < maxLabels; i++) {
    result.push(Math.round(i * step));
  }
  return Array.from(new Set(result));
}

const styles = StyleSheet.create({
  yLabels: {
    position: 'absolute',
    left: 0,
    top: CHART_PADDING.top - 6,
    bottom: CHART_PADDING.bottom,
    justifyContent: 'space-between',
  },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: CHART_PADDING.left,
  },
  axisLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
});
