#include "SupabasePublisher.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

namespace SupabasePublisher {

  // Công thức tính AQI từ PM2.5 theo tài liệu FIRMWARE_INTEGRATION.md
  int calcAqiFromPm25(float pm25) {
    struct BP { float cLow, cHigh; int aLow, aHigh; };
    BP table[] = {
      {0.0, 12.0, 0, 50},
      {12.1, 35.4, 51, 100},
      {35.5, 55.4, 101, 150},
      {55.5, 150.4, 151, 200},
      {150.5, 350.4, 201, 300},
    };
    for (auto &bp : table) {
      if (pm25 >= bp.cLow && pm25 <= bp.cHigh) {
        return round((float)(bp.aHigh - bp.aLow) / (bp.cHigh - bp.cLow) * (pm25 - bp.cLow) + bp.aLow);
      }
    }
    return 300; 
  }

  void begin() {
    Serial.print(F("Connecting to WiFi: "));
    Serial.println(WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    // Lưu ý: Đây là cách kết nối WiFi cơ bản, ESP32 sẽ tự động kết nối nền (non-blocking ở mức độ nhất định)
  }

  void publishSnapshot(const SensorManager& manager) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println(F("[Supabase] WiFi not connected. Skip publishing."));
      return;
    }

    WiFiClientSecure client;
    client.setInsecure(); // Demo/đồ án: Bỏ qua kiểm tra chứng chỉ SSL

    HTTPClient http;
    http.begin(client, SUPABASE_URL);
    http.addHeader("apikey", SUPABASE_ANON_KEY);
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
    http.addHeader("Content-Type", "application/json");

    // Rút trích giá trị. Nếu cảm biến lỗi/chưa có (như APM2000), gửi giá trị "null" lên DB
    String t_str = (manager.getTemperature().state == SensorState::OK) ? String(manager.getTemperature().value, 1) : "null";
    String h_str = (manager.getHumidity().state == SensorState::OK) ? String(manager.getHumidity().value, 1) : "null";
    String pm25_str = (manager.getPM25().state == SensorState::OK) ? String(manager.getPM25().value, 1) : "null";
    String co_str = (manager.getMQ7().state == SensorState::OK) ? String(manager.getMQ7().value, 2) : "null";
    
    // Tính AQI dựa trên PM2.5 (nếu PM2.5 hợp lệ)
    String aqi_str = "null";
    if (manager.getPM25().state == SensorState::OK) {
      aqi_str = String(calcAqiFromPm25(manager.getPM25().value));
    }

    String body = String("{") +
      "\"p_device_code\":\"" + DEVICE_CODE + "\"," +
      "\"p_temperature\":" + t_str + "," +
      "\"p_humidity\":" + h_str + "," +
      "\"p_pm25\":" + pm25_str + "," +
      "\"p_co\":" + co_str + "," +
      "\"p_aqi\":" + aqi_str +
    "}";

    int code = http.POST(body);
    Serial.printf("[Supabase] submit_reading -> HTTP %d\n", code);
    if(code < 0) {
       Serial.printf("[Supabase] Error: %s\n", http.errorToString(code).c_str());
    }
    http.end();
  }
}