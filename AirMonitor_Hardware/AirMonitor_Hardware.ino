/*
  AirMonitor - Hardware Edge Node
  Board:  ESP32C6 Dev Module

  This sketch demonstrates the full pipeline defined in
  AirMonitor_Hardware_Architecture.md:

      Acquisition -> Validation -> Filtering -> Aggregation
                   -> Standardization -> Health -> (Firebase)

  For now, instead of publishing to Firebase, it prints the exact
  standardized snapshot to the Serial Monitor so you can verify the
  whole pipeline works end-to-end before wiring up the cloud.

  Required libraries (Arduino IDE > Tools > Manage Libraries):
    - "DHT sensor library" by Adafruit
    - "Adafruit Unified Sensor" (dependency of the above)

  --------------------------------------------------------------------
  NOTE ON PROJECT STRUCTURE
  --------------------------------------------------------------------
  The Arduino IDE compiles a sketch as a flat set of tabs inside ONE
  folder; it does not support the nested config/core/sensors/... folders
  shown in the architecture doc. All files below are tabs in this same
  sketch folder, but are still organized to match those layers:

    Config.h, Pins.h                          -> config layer
    SensorStatus.h, SensorReading.h           -> core layer
    DHT11Sensor.*, MQ7Sensor.*, APM2000Sensor.* -> sensors layer
    Validator.h, Filter.h                     -> processing layer
    SensorManager.*, Scheduler.h              -> system layer
    DataFormatter.*                            -> standardization/output

  If you need real folder separation later, convert this into a proper
  Arduino library (src/ layout) or build it with PlatformIO / arduino-cli.
  --------------------------------------------------------------------
*/

#include "Config.h"
#include "Pins.h"
#include "SensorManager.h"
#include "DataFormatter.h"
#include "esp_system.h"
#include "SupabasePublisher.h"

SensorManager sensorManager;

void printResetReason() {
  esp_reset_reason_t reason = esp_reset_reason();
  Serial.print(F("Reset reason: "));
  switch (reason) {
    case ESP_RST_POWERON:   Serial.println(F("POWER-ON (cold boot)")); break;
    case ESP_RST_SW:        Serial.println(F("Software reset")); break;
    case ESP_RST_PANIC:     Serial.println(F("Crash / panic")); break;
    case ESP_RST_INT_WDT:   Serial.println(F("Interrupt watchdog")); break;
    case ESP_RST_TASK_WDT:  Serial.println(F("Task watchdog")); break;
    case ESP_RST_WDT:       Serial.println(F("Other watchdog")); break;
    case ESP_RST_BROWNOUT:  Serial.println(F("BROWNOUT (vi phạm điện áp!)")); break;
    case ESP_RST_DEEPSLEEP: Serial.println(F("Wake from deep sleep")); break;
    default:                Serial.println(F("Other/unknown")); break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);  // give the Serial Monitor time to attach
  printResetReason();
  
  Serial.println(F("AirMonitor edge node starting..."));

  sensorManager.begin();

  SupabasePublisher::begin();

  Serial.println(F("Setup complete. Entering main loop."));
}

void loop() {
  // Non-blocking: every sensor/subsystem decides internally whether it
  // is "due" for work this iteration. Nothing here ever calls delay().
  sensorManager.update();

  if (sensorManager.isPublishDue()) {
    // Swap this line for a real Firebase publish call later; nothing
    // above this line needs to change when you do.
    DataFormatter::printSnapshot(sensorManager);
    // Ghi chú: Thêm hàm gọi Supabase. Hàm này sẽ tự đóng gói các SensorReading 
    // và tính p_aqi trước khi gửi JSON qua HTTP POST.
    SupabasePublisher::publishSnapshot(sensorManager);
  }
}
