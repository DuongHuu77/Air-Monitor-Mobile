import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop, Circle, Line as SvgLine } from 'react-native-svg';
import { colors } from '../theme/colors';
import { HistoryPoint } from '../types';

interface HistoryChartProps {
  data: HistoryPoint[];
  color: string;
  height?: number;
}

type Point = { x: number; y: number };

/** Nối các điểm bằng đường cong mượt (Catmull-Rom chuyển sang Bezier) thay
 * vì nối thẳng — cho đường biểu đồ uốn lượn tự nhiên hơn qua từng điểm. */
function smoothLinePath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

const Y_AXIS_WIDTH = 34;
const CHART_PADDING = { top: 18, right: 16, bottom: 8, left: 6 };

export function HistoryChart({ data, color, height = 240 }: HistoryChartProps) {
  const [width, setWidth] = useState(0);

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  const { segments, dots, minLabel, maxLabel, baseline, sameValue } = useMemo(() => {
    const empty = {
      segments: [] as Point[][],
      dots: [] as Point[],
      minLabel: '',
      maxLabel: '',
      baseline: 0,
      sameValue: false,
    };
    if (!width || data.length === 0) return empty;

    const validValues = data
      .map(d => d.value)
      .filter((v): v is number => v !== null && v !== undefined);
    if (validValues.length === 0) return empty;

    const rawMin = Math.min(...validValues);
    const rawMax = Math.max(...validValues);
    const rawSpan = rawMax - rawMin;

    // Khi dữ liệu gần như không đổi (span ~ 0), tự tạo khoảng đệm xung quanh
    // giá trị đó để đường line nằm GIỮA biểu đồ thay vì bị dồn về đáy (chia
    // cho span=0 trước đây khiến mọi điểm quy về cùng 1 vị trí).
    // Khi dữ liệu có biến động thật, vẫn thêm 25% đệm trên/dưới để đường
    // line không chạm sát viền, tránh bị cắt/che ở mép trên hoặc dưới.
    const padding =
      rawSpan > 0.0001 ? rawSpan * 0.25 : Math.max(Math.abs(rawMax) * 0.15, 0.5);
    const min = rawMin - padding;
    const max = rawMax + padding;
    const span = max - min || 1;

    const innerW = width - CHART_PADDING.left - CHART_PADDING.right;
    const innerH = height - CHART_PADDING.top - CHART_PADDING.bottom;
    const baselineY = CHART_PADDING.top + innerH;

    const rawPoints: (Point | null)[] = data.map((d, i) => {
      const x =
        CHART_PADDING.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
      if (d.value === null || d.value === undefined) return null;
      const y = CHART_PADDING.top + innerH - ((d.value - min) / span) * innerH;
      return { x, y };
    });

    const segs: Point[][] = [];
    let current: Point[] = [];
    for (const p of rawPoints) {
      if (p === null) {
        if (current.length > 0) {
          segs.push(current);
          current = [];
        }
      } else {
        current.push(p);
      }
    }
    if (current.length > 0) segs.push(current);

    return {
      segments: segs,
      dots: rawPoints.filter((p): p is Point => p !== null),
      minLabel: formatValue(rawMin),
      maxLabel: formatValue(rawMax),
      baseline: baselineY,
      sameValue: rawSpan <= 0.0001,
    };
  }, [data, width, height]);

  const labelIndices = useMemo(() => pickLabelIndices(data.length), [data.length]);
  const hasAnyData = dots.length > 0;
  const lastDot = dots[dots.length - 1];

  return (
    <View>
      <View style={{ height, flexDirection: 'row' }}>
        {hasAnyData && (
          <View style={styles.yAxisColumn}>
            {sameValue ? (
              <Text style={[styles.axisLabel, styles.yLabelCentered]}>{maxLabel}</Text>
            ) : (
              <>
                <Text style={styles.axisLabel}>{maxLabel}</Text>
                <Text style={styles.axisLabel}>{minLabel}</Text>
              </>
            )}
          </View>
        )}
        <View style={{ flex: 1 }} onLayout={onLayout}>
          {width > 0 && hasAnyData && (
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
                y1={baseline}
                y2={baseline}
                stroke={colors.border}
                strokeWidth={1}
              />
              {segments.map((seg, i) => {
                const line = smoothLinePath(seg);
                const area =
                  seg.length > 1
                    ? `${line} L ${seg[seg.length - 1].x} ${baseline} L ${seg[0].x} ${baseline} Z`
                    : '';
                return (
                  <React.Fragment key={i}>
                    {area ? <Path d={area} fill="url(#areaFill)" /> : null}
                    <Path d={line} stroke={color} strokeWidth={2.5} fill="none" />
                  </React.Fragment>
                );
              })}
              {dots.map((p, i) => (
                <Circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={p === lastDot ? 4 : 2.5}
                  fill="#fff"
                  stroke={color}
                  strokeWidth={2}
                />
              ))}
            </Svg>
          )}
          {!hasAnyData && width > 0 && (
            <View style={styles.noDataBox} pointerEvents="none">
              <Text style={styles.noDataText}>Không có dữ liệu trong khoảng này</Text>
            </View>
          )}
        </View>
      </View>
      {data.length > 0 && (
        <View style={[styles.xLabels, { paddingLeft: Y_AXIS_WIDTH + CHART_PADDING.left }]}>
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
  yAxisColumn: {
    width: Y_AXIS_WIDTH,
    paddingTop: CHART_PADDING.top - 4,
    paddingBottom: CHART_PADDING.bottom,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  yLabelCentered: {
    flex: 1,
    textAlignVertical: 'center',
  },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  axisLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  noDataBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
});
