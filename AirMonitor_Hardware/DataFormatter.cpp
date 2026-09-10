#include "DataFormatter.h"

namespace {

void printReading(const char* label, const SensorReading& r, const char* unit = "") {
  Serial.print("    ");
  Serial.print(label);
  Serial.print(": { value: ");
  if (r.state == SensorState::OK) {
    Serial.print(r.value, 2);
    Serial.print(unit);
  } else {
    Serial.print("null");
  }
  Serial.print(", state: ");
  Serial.print(toString(r.state));
  Serial.print(", detail: ");
  Serial.print(toString(r.detail));
  Serial.println(" }");
}

}  // namespace

namespace DataFormatter {

void printSnapshot(const SensorManager& manager) {
  const DeviceHealth& health = manager.getHealth();

  Serial.println(F("================ SNAPSHOT (to be published) ================"));

  Serial.println(F("deviceInfo:"));
  Serial.print(F("    id: "));     Serial.println(health.deviceId);
  Serial.print(F("    status: ")); Serial.println(health.status == DeviceStatus::ONLINE ? "ONLINE" : "OFFLINE");

  Serial.println(F("connectivity:"));
  Serial.print(F("    wifi: "));  Serial.println(health.wifiConnected  ? "CONNECTED" : "DISCONNECTED");
  Serial.print(F("    cloud: ")); Serial.println(health.cloudConnected ? "CONNECTED" : "DISCONNECTED");

  Serial.println(F("heartbeat:"));
  Serial.print(F("    lastSeen: ")); Serial.println(health.lastSeen);
  Serial.print(F("    uptimeMs: ")); Serial.println(health.uptimeMs);

  Serial.println(F("sensors:"));
  Serial.println(F("  dht11:"));
  printReading("temperature", manager.getTemperature(), " C");
  printReading("humidity",    manager.getHumidity(),    " %");

  Serial.println(F("  mq7:"));
  printReading("co_raw", manager.getMQ7());

  Serial.println(F("  apm2000:"));
  printReading("pm25", manager.getPM25(), " ug/m3");
  printReading("pm10", manager.getPM10(), " ug/m3");

  Serial.println(F("=============================================================="));
  Serial.println();
}

}  // namespace DataFormatter
