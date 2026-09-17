/**
 * ============================================================================
 * ⚠️  CẦN BẠN ĐIỀN TOKEN Ở ĐÂY (bắt buộc để tab "Khám phá" hoạt động) ⚠️
 * ============================================================================
 * 1. Vào https://aqicn.org/data-platform/token/
 * 2. Điền email, xác nhận -> nhận token MIỄN PHÍ ngay lập tức.
 * 3. Dán token vào WAQI_TOKEN bên dưới.
 *
 * LƯU Ý: đây là token cấp cho ứng dụng cá nhân/phi thương mại, không phải bí
 * mật tuyệt đối, nhưng cũng không nên đăng công khai token thật lên GitHub.
 * ============================================================================
 */
const WAQI_TOKEN = 'YOUR_WAQI_TOKEN'; // TODO: thay bằng token thật từ aqicn.org

export const POLLUTANT_LABELS: Record<string, string> = {
  pm25: 'PM2.5',
  pm10: 'PM10',
  o3: 'O3 (Ozone)',
  no2: 'NO2',
  so2: 'SO2',
  co: 'CO',
};

export interface ExternalAqiResult {
  aqi: number;
  cityName: string;
  dominantPollutant: string | null;
  pm25: number | null;
  pm10: number | null;
  co: number | null;
  no2: number | null;
  so2: number | null;
  o3: number | null;
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  updatedAt: string | null;
}

/**
 * Tra cứu chất lượng không khí hiện tại theo tên thành phố/địa điểm qua API
 * công khai WAQI (https://aqicn.org). Ném lỗi 'CITY_NOT_FOUND' nếu không tìm
 * thấy trạm đo phù hợp với tên đã nhập.
 */
export async function fetchAirQualityByCity(city: string): Promise<ExternalAqiResult> {
  if (WAQI_TOKEN === 'YOUR_WAQI_TOKEN') {
    throw new Error(
      'Chưa cấu hình WAQI_TOKEN trong src/lib/waqi.ts — xem hướng dẫn ở đầu file.',
    );
  }

  const url = `https://api.waqi.info/feed/${encodeURIComponent(city.trim())}/?token=${WAQI_TOKEN}`;
  const res = await fetch(url);
  const json = await res.json();

  if (json.status !== 'ok' || !json.data || Number.isNaN(Number(json.data?.aqi))) {
    throw new Error('CITY_NOT_FOUND');
  }

  const d = json.data;
  const iaqi = d.iaqi ?? {};
  const pick = (key: string): number | null =>
    iaqi[key]?.v !== undefined && iaqi[key]?.v !== null ? Number(iaqi[key].v) : null;

  return {
    aqi: Number(d.aqi),
    cityName: d.city?.name ?? city,
    dominantPollutant: d.dominentpol ?? null,
    pm25: pick('pm25'),
    pm10: pick('pm10'),
    co: pick('co'),
    no2: pick('no2'),
    so2: pick('so2'),
    o3: pick('o3'),
    temperature: pick('t'),
    humidity: pick('h'),
    windSpeed: pick('w'),
    updatedAt: d.time?.s ?? null,
  };
}
