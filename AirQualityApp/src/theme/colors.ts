import { AqiCategoryInfo, AqiCategoryKey } from '../types';

export const colors = {
  primary: '#16A34A',
  primaryDark: '#15803D',
  primaryLight: '#F0FDF4',
  background: '#F7FAF8',
  surface: '#FFFFFF',
  border: '#EEF2F0',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  info: '#3B82F6',
};

export const AQI_INFO: Record<AqiCategoryKey, AqiCategoryInfo> = {
  good: {
    key: 'good',
    label: 'TỐT',
    color: '#16A34A',
    desc: 'Chất lượng không khí rất tốt, an toàn cho mọi hoạt động ngoài trời.',
  },
  moderate: {
    key: 'moderate',
    label: 'TRUNG BÌNH',
    color: '#D97706',
    desc: 'Chất lượng không khí chấp nhận được cho các hoạt động ngoài trời.',
  },
  poor: {
    key: 'poor',
    label: 'KÉM',
    color: '#EA580C',
    desc: 'Nhóm nhạy cảm nên hạn chế các hoạt động ngoài trời kéo dài.',
  },
  very_poor: {
    key: 'very_poor',
    label: 'XẤU',
    color: '#DC2626',
    desc: 'Mọi người nên hạn chế các hoạt động ngoài trời.',
  },
  hazardous: {
    key: 'hazardous',
    label: 'NGUY HẠI',
    color: '#9333EA',
    desc: 'Nguy hại cho sức khỏe, nên ở trong nhà và đóng kín cửa sổ.',
  },
};

export function getAqiInfo(value: number): AqiCategoryInfo {
  if (value <= 50) return AQI_INFO.good;
  if (value <= 100) return AQI_INFO.moderate;
  if (value <= 150) return AQI_INFO.poor;
  if (value <= 200) return AQI_INFO.very_poor;
  return AQI_INFO.hazardous;
}
