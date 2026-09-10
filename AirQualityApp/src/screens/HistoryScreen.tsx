import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getHistorySeries, getMyDevices } from '../services/api';
import { Screen } from '../components/Screen';
import { HistoryChart } from '../components/HistoryChart';
import { StatCard } from '../components/StatCard';
import { EmptyBlock, LoadingBlock } from '../components/StateBlocks';
import { colors } from '../theme/colors';
import { Device, HistoryPoint, HistoryRangeKey, MetricKey } from '../types';

const METRICS: { key: MetricKey; label: string; unit: string; color: string }[] = [
  { key: 'aqi', label: 'AQI', unit: '', color: colors.primary },
  { key: 'temperature', label: 'Nhiệt độ', unit: '°C', color: '#EA580C' },
  { key: 'humidity', label: 'Độ ẩm', unit: '%', color: '#3B82F6' },
  { key: 'co', label: 'CO', unit: 'ppm', color: '#6B7280' },
  { key: 'pm25', label: 'PM2.5', unit: 'µg/m³', color: '#8B5CF6' },
];

const RANGE_TABS: { key: HistoryRangeKey; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: '3d', label: '3 ngày' },
  { key: '7d', label: '7 ngày' },
  { key: 'custom', label: 'Tùy chọn' },
];

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function HistoryScreen() {
  const [device, setDevice] = useState<Device | null>(null);
  const [rangeKey, setRangeKey] = useState<HistoryRangeKey>('7d');
  const [metricKey, setMetricKey] = useState<MetricKey>('aqi');
  const [customStart, setCustomStart] = useState(toISODate(new Date(Date.now() - 13 * 86400000)));
  const [customEnd, setCustomEnd] = useState(toISODate(new Date()));
  const [series, setSeries] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyDevices()
      .then(devices => setDevice(devices[0] ?? null))
      .catch(err => setError(err?.message ?? 'Không thể tải thiết bị.'));
  }, []);

  useEffect(() => {
    if (!device) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    getHistorySeries(device.id, metricKey, rangeKey, { start: customStart, end: customEnd })
      .then(data => active && setSeries(data))
      .catch(err => active && setError(err?.message ?? 'Không thể tải dữ liệu.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [device, metricKey, rangeKey, customStart, customEnd]);

  const metric = METRICS.find(m => m.key === metricKey)!;

  const stats = useMemo(() => {
    if (series.length === 0) return { avg: 0, max: 0, min: 0 };
    const values = series.map(p => p.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const decimals = metricKey === 'co' ? 2 : metricKey === 'temperature' ? 1 : 0;
    return {
      avg: Number(avg.toFixed(decimals)),
      max: Math.max(...values),
      min: Math.min(...values),
    };
  }, [series, metricKey]);

  return (
    <Screen edges={['top']}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={styles.pageTitle}>Lịch sử dữ liệu</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow}>
        {RANGE_TABS.map(tab => {
          const active = tab.key === rangeKey;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setRangeKey(tab.key)}
              style={[styles.tab, active ? styles.tabActive : styles.tabInactive]}
            >
              <Text style={[styles.tabText, { color: active ? '#fff' : colors.textSecondary }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {rangeKey === 'custom' && (
        <View style={styles.dateRow}>
          <TextInput
            style={styles.dateInput}
            value={customStart}
            onChangeText={setCustomStart}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
          />
          <Text style={{ color: colors.textSecondary }}>đến</Text>
          <TextInput
            style={styles.dateInput}
            value={customEnd}
            onChangeText={setCustomEnd}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
          />
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.metricRow}>
        {METRICS.map(m => {
          const active = m.key === metricKey;
          return (
            <TouchableOpacity
              key={m.key}
              onPress={() => setMetricKey(m.key)}
              style={[styles.metricChip, active && { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
            >
              <Text style={[styles.metricChipText, active && { color: colors.primaryDark, fontWeight: '700' }]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.chartCard}>
        {!device ? (
          <EmptyBlock title="Chưa có thiết bị" description="Thêm thiết bị trong Supabase để xem lịch sử." />
        ) : loading ? (
          <LoadingBlock />
        ) : error ? (
          <EmptyBlock title="Có lỗi xảy ra" description={error} />
        ) : series.length === 0 ? (
          <EmptyBlock
            title="Chưa có dữ liệu"
            description="Thiết bị chưa ghi nhận dữ liệu trong khoảng thời gian này."
          />
        ) : (
          <HistoryChart data={series} color={metric.color} />
        )}
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Trung bình" value={stats.avg} unit={metric.unit} />
        <StatCard label="Cao nhất" value={stats.max} unit={metric.unit} color={colors.danger} />
        <StatCard label="Thấp nhất" value={stats.min} unit={metric.unit} color={colors.primary} />
      </View>
    </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 14 },
  tabsRow: { marginBottom: 12 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, marginRight: 8 },
  tabActive: { backgroundColor: colors.primary },
  tabInactive: { backgroundColor: '#F3F4F6' },
  tabText: { fontSize: 13, fontWeight: '600' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: '#fff',
  },
  metricRow: { marginBottom: 16 },
  metricChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  metricChipText: { fontSize: 13, color: colors.textSecondary },
  chartCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    minHeight: 190,
    justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', gap: 12 },
});
