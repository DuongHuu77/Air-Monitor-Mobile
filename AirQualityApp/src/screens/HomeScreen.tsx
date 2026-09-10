import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Bell,
  CloudFog,
  Droplets,
  Smartphone,
  Thermometer,
  Wind,
} from 'lucide-react-native';
import { AqiGauge } from '../components/AqiGauge';
import { Screen } from '../components/Screen';
import { SensorCard } from '../components/SensorCard';
import { EmptyBlock, LoadingBlock } from '../components/StateBlocks';
import { colors, getAqiInfo } from '../theme/colors';
import {
  computeStatus,
  getForecast,
  getLatestReading,
  getMyDevices,
  getUnreadNotificationCount,
  subscribeToDeviceReadings,
} from '../services/api';
import { AirQualityReading, Device, ForecastPoint } from '../types';
import { MainTabScreenProps } from '../navigation/types';

export function HomeScreen({ navigation }: MainTabScreenProps<'Home'>) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [device, setDevice] = useState<Device | null>(null);
  const [reading, setReading] = useState<AirQualityReading | null>(null);
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const devices = await getMyDevices();
      const activeDevice = devices[0] ?? null;
      setDevice(activeDevice);

      if (activeDevice) {
        // Dùng allSettled thay vì all: nếu 1 trong 2 API lỗi (ví dụ chưa có
        // dự báo), cái còn lại (chỉ số hiện tại) vẫn hiển thị bình thường
        // thay vì cả hai cùng bị huỷ theo.
        const [readingResult, forecastResult] = await Promise.allSettled([
          getLatestReading(activeDevice.id),
          getForecast(activeDevice.id),
        ]);
        setReading(readingResult.status === 'fulfilled' ? readingResult.value : null);
        setForecast(forecastResult.status === 'fulfilled' ? forecastResult.value : []);
      } else {
        setReading(null);
        setForecast([]);
      }
      setUnreadCount(await getUnreadNotificationCount());
    } catch (err: any) {
      setError(err?.message ?? 'Không thể tải dữ liệu.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      load().finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [load]),
  );

  // Realtime: tự cập nhật ngay khi ESP32 gửi dòng dữ liệu mới, không cần
  // người dùng tự kéo refresh. Yêu cầu đã bật Realtime cho bảng
  // air_quality_readings (xem supabase/migration_realtime.sql).
  useEffect(() => {
    if (!device) return;
    const unsubscribe = subscribeToDeviceReadings(device.id, newReading => {
      setReading(newReading);
      setDevice(prev => (prev ? { ...prev, status: 'online', lastSeenAt: newReading.recordedAt } : prev));
    });
    return unsubscribe;
  }, [device?.id]);

  // Vì không còn heartbeat, việc chuyển sang "offline" chỉ có thể phát hiện
  // được bằng cách kiểm tra định kỳ xem đã quá lâu chưa nhận được dữ liệu
  // mới hay chưa (không cần gọi lại API, chỉ tính lại từ lastSeenAt đã có).
  useEffect(() => {
    const interval = setInterval(() => {
      setDevice(prev => {
        if (!prev) return prev;
        const nextStatus = computeStatus(prev.lastSeenAt);
        return nextStatus === prev.status ? prev : { ...prev, status: nextStatus };
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const info = reading ? getAqiInfo(reading.aqi) : null;

  return (
    <Screen edges={['top']}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.deviceName}>{device?.name ?? 'Nhà của bạn'}</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>
              {device ? (device.status === 'online' ? 'Thiết bị online' : 'Thiết bị offline') : 'Chưa có thiết bị'}
            </Text>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: device?.status === 'online' ? colors.primary : colors.textTertiary },
              ]}
            />
          </View>
        </View>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => navigation.navigate('Notifications')}
          hitSlop={8}
        >
          <Bell size={22} color={colors.textPrimary} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: 16 }}>
          <LoadingBlock height={260} />
        </View>
      ) : error ? (
        <View style={{ paddingHorizontal: 16 }}>
          <EmptyBlock title="Có lỗi xảy ra" description={error} height={200} />
        </View>
      ) : !device ? (
        <View style={{ paddingHorizontal: 16 }}>
          <EmptyBlock
            icon={Smartphone}
            title="Chưa có thiết bị nào"
            description="Thêm thiết bị AirGuard đầu tiên của bạn trong Supabase (bảng devices) để bắt đầu theo dõi."
            height={240}
          />
        </View>
      ) : (
        <View style={{ paddingHorizontal: 16 }}>
          <View style={styles.aqiCard}>
            <Text style={styles.aqiHeader}>CHẤT LƯỢNG KHÔNG KHÍ HIỆN TẠI</Text>
            {reading && info ? (
              <>
                <AqiGauge value={reading.aqi} />
                <Text style={[styles.aqiCategory, { color: info.color }]}>{info.label}</Text>
                <Text style={styles.aqiDesc}>{info.desc}</Text>
              </>
            ) : (
              <EmptyBlock
                title="Chưa có dữ liệu"
                description="Thiết bị chưa gửi số liệu đo nào. Hãy chắc chắn ESP32 đã kết nối và ghi vào bảng air_quality_readings."
                height={180}
              />
            )}
          </View>

          {reading && (
            <>
              <Text style={styles.sectionTitle}>Thông số hiện tại</Text>
              <View style={styles.grid}>
                <SensorCard icon={Thermometer} iconColor="#EA580C" value={`${reading.temperature} °C`} label="Nhiệt độ" />
                <SensorCard icon={Droplets} iconColor="#3B82F6" value={`${reading.humidity} %`} label="Độ ẩm" />
                <SensorCard icon={Wind} iconColor="#8B5CF6" value={`${reading.pm25} µg/m³`} label="PM2.5" />
                <SensorCard icon={CloudFog} iconColor="#6B7280" value={`${reading.co} ppm`} label="CO" />
              </View>
            </>
          )}

          <Text style={styles.sectionTitle}>Dự báo 12 giờ tới</Text>
          {forecast.length === 0 ? (
            <EmptyBlock
              title="Chưa có dự báo"
              description="Bảng air_quality_forecasts hiện chưa có dữ liệu cho thiết bị này."
              height={120}
            />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {forecast.map(f => {
                const fInfo = getAqiInfo(f.aqi);
                return (
                  <View key={f.time} style={styles.forecastChip}>
                    <Text style={styles.forecastTime}>{f.time}</Text>
                    <View style={[styles.forecastCircle, { backgroundColor: fInfo.color }]}>
                      <Text style={styles.forecastValue}>{f.aqi}</Text>
                    </View>
                    <Text style={[styles.forecastLabel, { color: fInfo.color }]}>{fInfo.label}</Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  deviceName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusText: { fontSize: 12, color: colors.textSecondary },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  bellBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  aqiCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  aqiHeader: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 },
  aqiCategory: { fontSize: 14, fontWeight: '700', marginTop: 4, marginBottom: 8 },
  aqiDesc: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  forecastChip: {
    width: 64,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 10,
    gap: 6,
  },
  forecastTime: { fontSize: 11, color: colors.textSecondary },
  forecastCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  forecastValue: { color: '#fff', fontSize: 12, fontWeight: '700' },
  forecastLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
});
