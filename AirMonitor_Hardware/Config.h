#pragma once

// =====================================================================
// Timing configuration
// Keep Sampling Interval / Processing Window / Publish Interval
// clearly separated, per architecture doc section 6.
// =====================================================================

// --- DHT11 ---
// DHT11 hardware needs >= 1s between reads; 2s is a safe margin.
static const unsigned long DHT11_SAMPLE_INTERVAL_MS = 2000;
static const int DHT11_MAX_CONSECUTIVE_FAILURES = 3;

// --- MQ-7 ---
static const unsigned long MQ7_SAMPLE_INTERVAL_MS = 500;  // raw ADC sample rate
static const int           MQ7_WINDOW_SAMPLES      = 10;  // 10 x 500ms = 5s window
static const int MQ7_DISCONNECTED_THRESHOLD = 30;

// --- Health / Heartbeat ---
static const unsigned long HEALTH_UPDATE_INTERVAL_MS = 5000;

// --- Publish (Firebase later, Serial for now) ---
static const unsigned long PUBLISH_INTERVAL_MS = 10000;

// =====================================================================
// Validation ranges
// =====================================================================

// DHT11 practical operating range
static const float DHT11_TEMP_MIN = -20.0f;
static const float DHT11_TEMP_MAX = 60.0f;
static const float DHT11_HUM_MIN  = 0.0f;
static const float DHT11_HUM_MAX  = 100.0f;

// MQ-7 raw ADC valid range (ESP32-C6 ADC is 12-bit: 0-4095)
static const int MQ7_ADC_MIN = 0;
static const int MQ7_ADC_MAX = 4095;

// Spike rejection: max allowed jump between two consecutive raw samples
static const float MQ7_MAX_DELTA_PER_SAMPLE = 800.0f;

// =====================================================================
// WiFi & Supabase Cloud Configuration
// =====================================================================
static const char* WIFI_SSID = "Cut me di";
static const char* WIFI_PASS = "Tu1den9@";

// Điền đúng Project URL và ANON_KEY lấy từ Supabase
static const char* SUPABASE_URL = "https://uorxskikmtfimndjribo.supabase.co/rest/v1/rpc/submit_reading";
static const char* SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvcnhza2lrbXRmaW1uZGpyaWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NzU2MDEsImV4cCI6MjEwNDI1MTYwMX0.JDLgN0GubxDd2C_gWSqrDVdb04pSKq04pz3Cy42pvl4";

// Mã thiết bị phải khớp 100% với mã đã tạo trong bảng `devices` trên Supabase
static const char* DEVICE_CODE = "ESP32-AQ-001";
