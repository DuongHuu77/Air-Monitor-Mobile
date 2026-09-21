#include "SupabasePublisher.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <math.h>

namespace SupabasePublisher {

// ============================================================
// AQI DEMO
// 12 samples × 10 seconds = 2-minute sliding window
//
// -1 = chưa có dữ liệu
// Index 0 = mẫu mới nhất
// Index 11 = mẫu cũ nhất
//
// Window chỉ tồn tại trong RAM ESP32.
// Không gửi window lên Supabase.
// ============================================================

constexpr int AQI_WINDOW_SIZE = 12;
constexpr float AQI_INVALID = -1.0f;

float pm25Window[AQI_WINDOW_SIZE];
float coWindow[AQI_WINDOW_SIZE];


// ============================================================
// Khởi tạo window
// ============================================================

void initAQIWindow() {

  for (int i = 0; i < AQI_WINDOW_SIZE; i++) {
    pm25Window[i] = AQI_INVALID;
    coWindow[i] = AQI_INVALID;
  }
}


// ============================================================
// Thêm sample mới vào window
// ============================================================

void pushAQISample(float window[], float value) {

  for (int i = AQI_WINDOW_SIZE - 1; i > 0; i--) {
    window[i] = window[i - 1];
  }

  window[0] = value;
}


// ============================================================
// Weighted sliding window
//
// w* = (Cmax - Cmin) / Cmax
// w  = max(w*, 0.5)
//
// Mẫu mới nhất có trọng số lớn nhất.
// ============================================================

float calculateWeightedWindow(const float window[]) {

  float cMin = INFINITY;
  float cMax = -INFINITY;
  int validCount = 0;

  // Tìm Cmin, Cmax
  for (int i = 0; i < AQI_WINDOW_SIZE; i++) {

    if (window[i] < 0.0f) {
      continue;
    }

    if (window[i] < cMin) {
      cMin = window[i];
    }

    if (window[i] > cMax) {
      cMax = window[i];
    }

    validCount++;
  }

  // Chưa có dữ liệu
  if (validCount == 0) {
    return AQI_INVALID;
  }

  // Chỉ có 1 mẫu hoặc toàn bộ = 0
  if (validCount == 1 || cMax <= 0.0f) {
    return window[0];
  }

  // Tính trọng số
  float wStar = (cMax - cMin) / cMax;
  float w = (wStar < 0.5f) ? 0.5f : wStar;

  float weightedSum = 0.0f;
  float weightSum = 0.0f;

  float weight = 1.0f;

  for (int i = 0; i < AQI_WINDOW_SIZE; i++) {

    if (window[i] >= 0.0f) {

      weightedSum += window[i] * weight;
      weightSum += weight;
    }

    weight *= w;
  }

  if (weightSum <= 0.0f) {
    return AQI_INVALID;
  }

  return weightedSum / weightSum;
}


// ============================================================
// AQI interpolation
//
// AQI = ((Ii+1 - Ii) / (BPi+1 - BPi))
//       × (C - BPi) + Ii
// ============================================================

float calculateAQIFromBreakpoint(
  float concentration,
  const float bp[],
  const float index[],
  int size
) {

  if (concentration < 0.0f) {
    return AQI_INVALID;
  }

  // Tìm khoảng breakpoint chứa C
  for (int i = 0; i < size - 1; i++) {

    if (concentration <= bp[i + 1]) {

      return
        ((index[i + 1] - index[i]) /
        (bp[i + 1] - bp[i])) *
        (concentration - bp[i])
        + index[i];
    }
  }

  // Vượt breakpoint cao nhất
  return index[size - 1];
}


// ============================================================
// PM2.5 AQI
//
// Đơn vị: µg/m³
//
// Chỉ lấy breakpoint cần thiết.
// ============================================================

float calculatePM25AQI(float pm25) {

  const float bp[] = {
    0.0f,
    25.0f,
    50.0f,
    80.0f,
    150.0f,
    250.0f,
    350.0f,
    500.0f
  };

  const float index[] = {
    0.0f,
    50.0f,
    100.0f,
    150.0f,
    200.0f,
    300.0f,
    400.0f,
    500.0f
  };

  return calculateAQIFromBreakpoint(
    pm25,
    bp,
    index,
    8
  );
}


// ============================================================
// CO AQI
//
// Đơn vị breakpoint: µg/m³
// ============================================================

float calculateCOAQI(float coUgM3) {

  const float bp[] = {
    0.0f,
    10000.0f,
    30000.0f,
    45000.0f,
    60000.0f,
    90000.0f,
    120000.0f,
    150000.0f
  };

  const float index[] = {
    0.0f,
    50.0f,
    100.0f,
    150.0f,
    200.0f,
    300.0f,
    400.0f,
    500.0f
  };

  return calculateAQIFromBreakpoint(
    coUgM3,
    bp,
    index,
    8
  );
}


// ============================================================
// CO: ppm -> µg/m³
//
// MQ-7 value được giữ ở ppm.
// Chỉ quy đổi sang µg/m³ khi tính AQI.
//
// CO = 28.01 g/mol
// Vm ≈ 24.45 L/mol
// ============================================================

float coPpmToUgM3(float coPpm) {

  constexpr float CO_MOLAR_MASS = 28.01f;
  constexpr float MOLAR_VOLUME = 24.45f;

  return coPpm *
         (CO_MOLAR_MASS / MOLAR_VOLUME) *
         1000.0f;
}


// ============================================================
// State
// ============================================================

bool aqiWindowInitialized = false;


// ============================================================
// WiFi / Supabase begin
// Giữ nguyên logic cũ + khởi tạo AQI window
// ============================================================

void begin() {

  initAQIWindow();
  aqiWindowInitialized = true;

  Serial.print(F("Connecting to WiFi: "));
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASS);
}


// ============================================================
// Publish snapshot
// ============================================================

void publishSnapshot(const SensorManager& manager) {

  // ----------------------------------------------------------
  // Initialize AQI window nếu cần
  // ----------------------------------------------------------

  if (!aqiWindowInitialized) {
    initAQIWindow();
    aqiWindowInitialized = true;
  }


  // ----------------------------------------------------------
  // Rút trích giá trị sensor
  // Giữ nguyên logic cũ
  // ----------------------------------------------------------

  String t_str =
    (manager.getTemperature().state == SensorState::OK)
      ? String(manager.getTemperature().value, 1)
      : "null";

  String h_str =
    (manager.getHumidity().state == SensorState::OK)
      ? String(manager.getHumidity().value, 1)
      : "null";

  String pm25_str =
    (manager.getPM25().state == SensorState::OK)
      ? String(manager.getPM25().value, 1)
      : "null";

  String co_str =
    (manager.getMQ7().state == SensorState::OK)
      ? String(manager.getMQ7().value, 2)
      : "null";


  // ==========================================================
  // AQI
  // ==========================================================

  // ----------------------------------------------------------
  // Thêm sample mới vào sliding window
  // ----------------------------------------------------------

  if (manager.getPM25().state == SensorState::OK) {

    pushAQISample(
      pm25Window,
      manager.getPM25().value
    );
  }

  if (manager.getMQ7().state == SensorState::OK) {

    // MQ-7 value = ppm
    pushAQISample(
      coWindow,
      manager.getMQ7().value
    );
  }


  // ----------------------------------------------------------
  // Weighted representative value
  // ----------------------------------------------------------

  float pm25Weighted =
    calculateWeightedWindow(pm25Window);

  float coWeightedPpm =
    calculateWeightedWindow(coWindow);


  // ----------------------------------------------------------
  // CO ppm -> µg/m³
  // ----------------------------------------------------------

  float coWeightedUgM3 = AQI_INVALID;

  if (coWeightedPpm >= 0.0f) {

    coWeightedUgM3 =
      coPpmToUgM3(coWeightedPpm);
  }


  // ----------------------------------------------------------
  // AQI từng pollutant
  // ----------------------------------------------------------

  float aqiPM25 =
    calculatePM25AQI(pm25Weighted);

  float aqiCO =
    calculateCOAQI(coWeightedUgM3);


  // ----------------------------------------------------------
  // AQI tổng hợp
  //
  // AQI = MAX(AQI_PM25, AQI_CO)
  // ----------------------------------------------------------

  float currentAQI = AQI_INVALID;

  if (aqiPM25 >= 0.0f && aqiCO >= 0.0f) {

    currentAQI =
      (aqiPM25 > aqiCO)
        ? aqiPM25
        : aqiCO;

  } else if (aqiPM25 >= 0.0f) {

    currentAQI = aqiPM25;

  } else if (aqiCO >= 0.0f) {

    currentAQI = aqiCO;
  }


  // ----------------------------------------------------------
  // Làm tròn AQI về số nguyên
  // ----------------------------------------------------------

  String aqi_str =
    (currentAQI >= 0.0f)
      ? String((int)roundf(currentAQI))
      : "null";


  // ----------------------------------------------------------
  // Debug AQI
  // ----------------------------------------------------------

  Serial.printf(
    "[AQI] PM2.5 weighted: %.2f ug/m3 | AQI: %.2f\n",
    pm25Weighted,
    aqiPM25
  );

  Serial.printf(
    "[AQI] CO weighted: %.2f ppm | %.2f ug/m3 | AQI: %.2f\n",
    coWeightedPpm,
    coWeightedUgM3,
    aqiCO
  );

  Serial.printf(
    "[AQI] Current AQI: %s\n",
    aqi_str.c_str()
  );


  // ==========================================================
  // Supabase
  // ==========================================================

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println(
      F("[Supabase] WiFi not connected. Skip publishing.")
    );

    return;
  }


  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;

  http.begin(client, SUPABASE_URL);

  http.addHeader(
    "apikey",
    SUPABASE_ANON_KEY
  );

  http.addHeader(
    "Authorization",
    String("Bearer ") + SUPABASE_ANON_KEY
  );

  http.addHeader(
    "Content-Type",
    "application/json"
  );


  // ==========================================================
  // Payload
  //
  // Giữ nguyên toàn bộ field cũ.
  // Chỉ thêm p_aqi.
  // ==========================================================

  String body = String("{") +
    "\"p_device_code\":\"" + DEVICE_CODE + "\"," +
    "\"p_temperature\":" + t_str + "," +
    "\"p_humidity\":" + h_str + "," +
    "\"p_pm25\":" + pm25_str + "," +
    "\"p_co\":" + co_str + "," +
    "\"p_aqi\":" + aqi_str +
    "}";


  Serial.print(F("[Supabase] Payload: "));
  Serial.println(body);


  int code = http.POST(body);

  Serial.printf(
    "[Supabase] submit_reading -> HTTP %d\n",
    code
  );

  if (code < 0) {

    Serial.printf(
      "[Supabase] Error: %s\n",
      http.errorToString(code).c_str()
    );
  }

  http.end();
}

} // namespace SupabasePublisher