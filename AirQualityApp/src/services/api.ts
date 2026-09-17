import { supabase } from '../lib/supabase';
import {
  AirQualityReading,
  AlertThresholds,
  AppNotification,
  Device,
  ForecastPoint,
  HistoryPoint,
  HistoryRangeKey,
  MetricKey,
  NotificationSettings,
  Profile,
} from '../types';

/**
 * Lớp này gói toàn bộ truy vấn Supabase lại một chỗ.
 * Bảng dữ liệu tương ứng nằm trong supabase/schema.sql — bạn cần chạy file đó
 * trong Supabase SQL Editor trước khi các hàm dưới đây trả về dữ liệu thật.
 * Trước khi có dữ liệu (ví dụ chưa nối ESP32), các hàm sẽ trả mảng rỗng /
 * null một cách an toàn — màn hình tương ứng sẽ tự hiện trạng thái "chưa có
 * dữ liệu" thay vì lỗi.
 */

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/* --------------------------------- Profile -------------------------------- */
export async function getProfile(): Promise<Profile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;

  return {
    id: user.id,
    fullName: data?.full_name ?? '',
    email: user.email ?? '',
  };
}

export async function updateProfileName(fullName: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error('Chưa đăng nhập.');
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', userId);
  if (error) throw error;
}

/* --------------------------------- Devices -------------------------------- */
/**
 * Thiết bị được coi là "online" nếu CÓ dữ liệu (reading) mới trong khoảng
 * này. Không còn dùng heartbeat riêng — chỉ cần ESP32 gửi submit_reading
 * đều đặn (khuyến nghị mỗi 10-20 giây để có biên độ an toàn dưới ngưỡng 30s).
 */
export const ONLINE_THRESHOLD_MS = 30 * 1000;

export function computeStatus(lastSeenAt: string | null): Device['status'] {
  if (!lastSeenAt) return 'unknown';
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  return diff <= ONLINE_THRESHOLD_MS ? 'online' : 'offline';
}

export async function getMyDevices(): Promise<Device[]> {
  const { data, error } = await supabase
    .from('device_users')
    .select('name, location, devices ( id, device_code, firmware_version, last_seen_at )')
    .order('connected_at', { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .filter((row: any) => row.devices)
    .map((row: any) => ({
      id: row.devices.id,
      name: row.name,
      deviceCode: row.devices.device_code,
      location: row.location,
      firmwareVersion: row.devices.firmware_version,
      status: computeStatus(row.devices.last_seen_at),
      lastSeenAt: row.devices.last_seen_at,
    }));
}

/**
 * Kết nối một thiết bị (theo mã thiết bị) vào tài khoản hiện tại — thông qua
 * RPC `claim_device` (xem supabase/migration_shared_devices.sql).
 * KHÔNG giới hạn số người dùng cùng kết nối 1 thiết bị: nhiều tài khoản có
 * thể cùng theo dõi một thiết bị vật lý, mỗi người tự đặt tên/vị trí riêng.
 * Ném lỗi 'DEVICE_NOT_FOUND' nếu sai mã thiết bị (không tồn tại).
 */
export async function claimDevice(
  deviceCode: string,
  name: string,
  location: string,
): Promise<void> {
  const { error } = await supabase.rpc('claim_device', {
    p_device_code: deviceCode.trim(),
    p_name: name.trim(),
    p_location: location.trim(),
  });

  if (error) {
    if (error.message.includes('DEVICE_NOT_FOUND')) {
      throw new Error('DEVICE_NOT_FOUND');
    }
    throw error;
  }
}

/* ----------------------------- Current reading ----------------------------- */
export async function getLatestReading(deviceId: string): Promise<AirQualityReading | null> {
  const { data, error } = await supabase
    .from('air_quality_readings')
    .select('id, device_id, recorded_at, temperature, humidity, pm25, co, aqi')
    .eq('device_id', deviceId)
    // Bỏ qua các dòng thiếu aqi (NULL) — tránh trường hợp Number(null) = 0
    // khiến "chưa có dữ liệu" bị hiểu nhầm thành "AQI = 0" (tốt nhất).
    .not('aqi', 'is', null)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    deviceId: data.device_id,
    recordedAt: data.recorded_at,
    temperature: data.temperature === null ? 0 : Number(data.temperature),
    humidity: data.humidity === null ? 0 : Number(data.humidity),
    pm25: data.pm25 === null ? 0 : Number(data.pm25),
    co: data.co === null ? 0 : Number(data.co),
    aqi: Number(data.aqi),
  };
}

/**
 * Lắng nghe dữ liệu MỚI theo thời gian thực (Supabase Realtime) — mỗi khi
 * ESP32 gửi 1 dòng reading mới cho thiết bị này, callback sẽ được gọi ngay,
 * không cần người dùng tự kéo refresh.
 * LƯU Ý: phải bật Realtime cho bảng air_quality_readings trong Supabase
 * (xem supabase/migration_realtime.sql), nếu không sự kiện sẽ không bắn tới.
 * Trả về hàm huỷ đăng ký (gọi khi unmount màn hình).
 */
export function subscribeToDeviceReadings(
  deviceId: string,
  onInsert: (reading: AirQualityReading) => void,
): () => void {
  // Tên kênh phải DUY NHẤT cho mỗi lần gọi — nếu nhiều màn hình (Home,
  // History...) cùng đăng ký nghe 1 thiết bị mà trùng tên kênh, Supabase sẽ
  // báo lỗi "cannot add postgres_changes callbacks... after subscribe()"
  // vì React Navigation giữ các tab khác vẫn mounted ngầm phía sau.
  const channelName = `device-readings-${deviceId}-${Math.random().toString(36).slice(2)}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'air_quality_readings',
        filter: `device_id=eq.${deviceId}`,
      },
      (payload: any) => {
        const row = payload.new;
        // Dòng mới thiếu aqi (NULL) thì bỏ qua hẳn — không đẩy lên UI, tránh
        // ghi đè AQI đang hiển thị đúng bằng "0" giả do Number(null).
        if (row.aqi === null || row.aqi === undefined) return;
        onInsert({
          id: row.id,
          deviceId: row.device_id,
          recordedAt: row.recorded_at,
          temperature: row.temperature === null ? 0 : Number(row.temperature),
          humidity: row.humidity === null ? 0 : Number(row.humidity),
          pm25: row.pm25 === null ? 0 : Number(row.pm25),
          co: row.co === null ? 0 : Number(row.co),
          aqi: Number(row.aqi),
        });
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/* -------------------------------- Forecast -------------------------------- */
export async function getForecast(deviceId: string): Promise<ForecastPoint[]> {
  const { data, error } = await supabase
    .from('air_quality_forecasts')
    .select('forecast_for, aqi')
    .eq('device_id', deviceId)
    .gte('forecast_for', new Date().toISOString())
    .order('forecast_for', { ascending: true })
    .limit(12);

  if (error) throw error;

  return (data ?? []).map(f => ({
    time: new Date(f.forecast_for).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    aqi: Number(f.aqi),
  }));
}

/* --------------------------------- History -------------------------------- */
/** Số điểm cố định hiển thị trên biểu đồ. */
const CHART_POINT_COUNT = 8;

const METRIC_AVG_COLUMN: Record<MetricKey, string> = {
  aqi: 'avg_aqi',
  temperature: 'avg_temperature',
  humidity: 'avg_humidity',
  co: 'avg_co',
  pm25: 'avg_pm25',
};
const METRIC_CNT_COLUMN: Record<MetricKey, string> = {
  aqi: 'cnt_aqi',
  temperature: 'cnt_temperature',
  humidity: 'cnt_humidity',
  co: 'cnt_co',
  pm25: 'cnt_pm25',
};

export async function getHistorySeries(
  deviceId: string,
  metric: MetricKey,
  range: HistoryRangeKey,
  customRange?: { start: string; end: string },
): Promise<HistoryPoint[]> {
  const now = new Date();
  let since: Date;
  let until: Date = now;

  if (range === 'today') {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === '3d') {
    since = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  } else if (range === '7d') {
    since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    since = customRange ? new Date(customRange.start) : new Date(now.getTime() - 7 * 86400000);
    until = customRange ? new Date(customRange.end + 'T23:59:59') : now;
  }

  const sinceMs = since.getTime();
  const untilMs = Math.max(until.getTime(), sinceMs + 60000);
  const bucketMs = (untilMs - sinceMs) / CHART_POINT_COUNT;
  const decimals = metric === 'co' ? 2 : metric === 'temperature' ? 1 : 0;

  // Việc tính trung bình theo từng khoảng thời gian được thực hiện NGAY
  // TRONG DATABASE (xem supabase/migration_history_buckets.sql), không còn
  // tải dữ liệu thô về máy rồi mới gộp — tránh giới hạn số dòng tải về khi
  // thiết bị gửi dữ liệu rất dày (vài giây/lần vẫn tính đúng vì Postgres
  // gộp trước khi trả kết quả, chỉ trả về tối đa 8 dòng).
  const { data, error } = await supabase.rpc('get_history_buckets', {
    p_device_id: deviceId,
    p_since: since.toISOString(),
    p_until: until.toISOString(),
    p_bucket_count: CHART_POINT_COUNT,
  });

  if (error) throw error;

  const avgCol = METRIC_AVG_COLUMN[metric];
  const cntCol = METRIC_CNT_COLUMN[metric];
  const byIndex = new Map<number, any>();
  for (const row of (data ?? []) as any[]) {
    byIndex.set(row.bucket_index, row);
  }

  return Array.from({ length: CHART_POINT_COUNT }, (_, i) => {
    // Dùng mốc KẾT THÚC của mỗi khoảng thay vì điểm giữa — nhờ vậy nhãn của
    // điểm cuối cùng sẽ luôn trùng đúng thời điểm "bây giờ" (until), thay vì
    // luôn sớm hơn nửa khoảng như trước.
    const bucketEndMs = sinceMs + bucketMs * (i + 1);
    const d = new Date(bucketEndMs);
    // Chỉ hiện giờ:phút cụ thể ở chế độ "Hôm nay"; các chế độ nhiều ngày
    // (3 ngày / 7 ngày / tùy chọn) chỉ hiện ngày/tháng cho gọn trục X.
    const label =
      range === 'today'
        ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    const row = byIndex.get(i);
    const count = row ? Number(row[cntCol]) : 0;
    const value = count > 0 ? Number(Number(row[avgCol]).toFixed(decimals)) : null;
    return { label, value };
  });
}

/* ------------------------------ Notifications ------------------------------ */
export async function getNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, message, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data ?? []).map(n => ({
    id: n.id,
    type: n.type as AppNotification['type'],
    title: n.title,
    message: n.message,
    isRead: n.is_read,
    createdAt: n.created_at,
  }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const userId = await getUserId();
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteAllNotifications(): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const { error } = await supabase.from('notifications').delete().eq('user_id', userId);
  if (error) throw error;
}

/* ------------------------------- Thresholds -------------------------------- */
const DEFAULT_THRESHOLDS: AlertThresholds = { aqi: 100, pm25: 50, co: 0.3 };

export async function getThresholds(): Promise<AlertThresholds> {
  const userId = await getUserId();
  if (!userId) return DEFAULT_THRESHOLDS;

  const { data, error } = await supabase
    .from('alert_thresholds')
    .select('aqi_threshold, pm25_threshold, co_threshold')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return DEFAULT_THRESHOLDS;

  return {
    aqi: Number(data.aqi_threshold),
    pm25: Number(data.pm25_threshold),
    co: Number(data.co_threshold),
  };
}

export async function saveThresholds(thresholds: AlertThresholds): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error('Chưa đăng nhập.');

  const { error } = await supabase.from('alert_thresholds').upsert({
    user_id: userId,
    aqi_threshold: thresholds.aqi,
    pm25_threshold: thresholds.pm25,
    co_threshold: thresholds.co,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/* --------------------------- Notification settings -------------------------- */
const DEFAULT_NOTIF_SETTINGS: NotificationSettings = {
  aqiAlert: true,
  coAlert: true,
  pm25Alert: true,
  forecastAlert: true,
  improvementAlert: false,
};

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const userId = await getUserId();
  if (!userId) return DEFAULT_NOTIF_SETTINGS;

  const { data, error } = await supabase
    .from('notification_settings')
    .select('aqi_alert, co_alert, pm25_alert, forecast_alert, improvement_alert')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return DEFAULT_NOTIF_SETTINGS;

  return {
    aqiAlert: data.aqi_alert,
    coAlert: data.co_alert,
    pm25Alert: data.pm25_alert,
    forecastAlert: data.forecast_alert,
    improvementAlert: data.improvement_alert,
  };
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error('Chưa đăng nhập.');

  const { error } = await supabase.from('notification_settings').upsert({
    user_id: userId,
    aqi_alert: settings.aqiAlert,
    co_alert: settings.coAlert,
    pm25_alert: settings.pm25Alert,
    forecast_alert: settings.forecastAlert,
    improvement_alert: settings.improvementAlert,
  });
  if (error) throw error;
}

/* ----------------------------- Saved locations ----------------------------- */
export interface SavedLocationRow {
  id: string;
  query: string;
  displayName: string | null;
}

export async function getSavedLocations(): Promise<SavedLocationRow[]> {
  const { data, error } = await supabase
    .from('saved_locations')
    .select('id, query, display_name')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    query: row.query,
    displayName: row.display_name,
  }));
}

export async function addSavedLocation(query: string, displayName?: string): Promise<SavedLocationRow> {
  const userId = await getUserId();
  if (!userId) throw new Error('Chưa đăng nhập.');
  const { data, error } = await supabase
    .from('saved_locations')
    .insert({ user_id: userId, query: query.trim(), display_name: displayName ?? null })
    .select('id, query, display_name')
    .single();
  if (error) throw error;
  return { id: data.id, query: data.query, displayName: data.display_name };
}

export async function deleteSavedLocation(id: string): Promise<void> {
  const { error } = await supabase.from('saved_locations').delete().eq('id', id);
  if (error) throw error;
}
