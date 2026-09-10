/**
 * Các kiểu dữ liệu (types) dùng chung cho toàn bộ app AirGuard.
 * Khớp với schema Supabase trong file supabase/schema.sql
 */

export type AqiCategoryKey = 'good' | 'moderate' | 'poor' | 'very_poor' | 'hazardous';

export interface AqiCategoryInfo {
  key: AqiCategoryKey;
  label: string;
  color: string;
  desc: string;
}

export interface Profile {
  id: string;
  fullName: string;
  email: string;
}

export interface Device {
  id: string;
  name: string;
  deviceCode: string;
  location: string | null;
  firmwareVersion: string | null;
  status: 'online' | 'offline' | 'unknown';
  lastSeenAt: string | null;
}

export interface AirQualityReading {
  id: number;
  deviceId: string;
  recordedAt: string;
  temperature: number;
  humidity: number;
  pm25: number;
  co: number;
  aqi: number;
}

export interface ForecastPoint {
  time: string;
  aqi: number;
}

export type MetricKey = 'aqi' | 'temperature' | 'humidity' | 'co' | 'pm25';

export interface HistoryPoint {
  label: string;
  value: number;
}

export type HistoryRangeKey = 'today' | '3d' | '7d' | 'custom';

export type NotificationType = 'warning' | 'forecast' | 'normal' | 'improvement';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

export interface AlertThresholds {
  aqi: number;
  pm25: number;
  co: number;
}

export interface NotificationSettings {
  aqiAlert: boolean;
  coAlert: boolean;
  pm25Alert: boolean;
  forecastAlert: boolean;
  improvementAlert: boolean;
}
