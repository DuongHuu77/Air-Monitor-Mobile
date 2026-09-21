import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Stop,
  Circle,
  Line as SvgLine,
  Text as SvgText,
} from 'react-native-svg';
import { colors } from '../theme/colors';
import { HistoryPoint } from '../types';

interface HistoryChartProps {
  data: HistoryPoint[];
  color: string;
  height?: number;
}

type Point = { x: number; y: number; value: number };

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

const Y_AXIS_WIDTH = 38;
const Y_TICK_COUNT = 5;
// top tăng lên để chừa chỗ cho nhãn giá trị phía trên mỗi điểm, không bị cắt
const CHART_PADDING = { top: 26, right: 16, bottom: 8, left: 10 };

export function HistoryChart({ data, color, height = 240 }: HistoryChartProps) {
  const [width, setWidth] = useState(0);

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  const { segments, dots, yTicks, baseline, innerW } = useMemo(() => {
    const empty = {
      segments: [] as Point[][],
      dots: [] as Point[],
      yTicks: [] as { value: number; y: number }[],
      baseline: 0,
      innerW: 0,
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
    // giá trị đó để đường line nằm GIỮA biểu đồ thay vì bị dồn về đáy.
    // Khi dữ liệu có biến động thật, vẫn thêm 25% đệm trên/dưới để đường
    // line và nhãn giá trị phía trên không chạm sát viền.
    const padding =
      rawSpan > 0.0001 ? rawSpan * 0.25 : Math.max(Math.abs(rawMax) * 0.15, 0.5);
    const min = rawMin - padding;
    const max = rawMax + padding;
    const span = max - min || 1;

    const chartInnerW = width - CHART_PADDING.left - CHART_PADDING.right;
    const innerH = height - CHART_PADDING.top - CHART_PADDING.bottom;
    const baselineY = CHART_PADDING.top + innerH;

    function valueToY(v: number) {
      return CHART_PADDING.top + innerH - ((v - min) / span) * innerH;
    }

    const rawPoints: (Point | null)[] = data.map((d, i) => {
      const x =
        CHART_PADDING.left +
        (data.length === 1 ? chartInnerW / 2 : (i / (data.length - 1)) * chartInnerW);
      if (d.value === null || d.value === undefined) return null;
      return { x, y: valueToY(d.value), value: d.value };
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

    // 5 vạch chia đều từ max (trên cùng) xuống min (dưới cùng) để người dùng
    // dễ ước lượng giá trị theo chiều cao, thay vì chỉ có 2 mốc cao/thấp.
    const ticks = Array.from({ length: Y_TICK_COUNT }, (_, i) => {
      const value = max - (i / (Y_TICK_COUNT - 1)) * span;
      return { value, y: valueToY(value) };
    });

    return {
      segments: segs,
      dots: rawPoints.filter((p): p is Point => p !== null),
      yTicks: ticks,
      baseline: baselineY,
      innerW: chartInnerW,
    };
  }, [data, width, height]);

  const hasAnyData = dots.length > 0;
  const lastDot = dots[dots.length - 1];

  return (
    <View>
      <View style={{ height, flexDirection: 'row' }}>
        {hasAnyData && (
          <View style={styles.yAxisColumn}>
            {yTicks.map((t, i) => (
              <Text
                key={i}
                style={[styles.axisLabel, { position: 'absolute', top: t.y - 7, right: 6 }]}
              >
                {formatValue(t.value)}
              </Text>
            ))}
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
              {yTicks.map((t, i) => (
                <SvgLine
                  key={i}
                  x1={CHART_PADDING.left}
                  x2={width - CHART_PADDING.right}
                  y1={t.y}
                  y2={t.y}
                  stroke={colors.border}
                  strokeWidth={1}
                />
              ))}
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
              {dots.map((p, i) => (
                <SvgText
                  key={`v-${i}`}
                  x={p.x}
                  y={Math.max(10, p.y - 10)}
                  fontSize={9}
                  fill={colors.textSecondary}
                  textAnchor="middle"
                >
                  {formatValue(p.value)}
                </SvgText>
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
          {data.map((d, i) => (
            <Text key={i} style={styles.xAxisLabel} numberOfLines={1}>
              {d.label}
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

const styles = StyleSheet.create({
  yAxisColumn: {
    width: Y_AXIS_WIDTH,
  },
  xLabels: {
    flexDirection: 'row',
    marginTop: 6,
  },
  axisLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  xAxisLabel: {
    flex: 1,
    fontSize: 9,
    color: colors.textSecondary,
    textAlign: 'center',
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
