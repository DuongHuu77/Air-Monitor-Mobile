#pragma once
#include "SensorReading.h"
#include "DHT11Sensor.h"
#include "MQ7Sensor.h"
#include "APM2000Sensor.h"
#include "Config.h"
#include "Scheduler.h"

enum class DeviceStatus : uint8_t { ONLINE, OFFLINE };

// Device-level health, separate from any individual sensor's health
// (architecture doc section 13).
struct DeviceHealth {
  const char* deviceId = "airmonitor-001";
  DeviceStatus status = DeviceStatus::ONLINE;
  bool wifiConnected  = false;  // wire up when Wi-Fi is added
  bool cloudConnected = false;  // wire up when Firebase is added
  unsigned long lastSeen = 0;
  unsigned long uptimeMs = 0;
};

// Owns every sensor + device health, and is the ONLY thing main .ino
// talks to. Adding a new sensor later means touching this class and
// nothing else outside of it (architecture doc section 18).
class SensorManager {
public:
  void begin();
  void update();  // call every loop(); non-blocking

  bool isPublishDue();

  // Read-only accessors used by DataFormatter / future Firebase publisher.
  SensorReading getTemperature() const { return _dht.getTemperature(); }
  SensorReading getHumidity()    const { return _dht.getHumidity(); }
  SensorReading getMQ7()         const { return _mq7.getReading(); }
  SensorReading getPM25()        const { return _apm.getPM25(); }
  SensorReading getPM10()        const { return _apm.getPM10(); }
  const DeviceHealth& getHealth() const { return _health; }

private:
  DHT11Sensor   _dht;
  MQ7Sensor     _mq7;
  APM2000Sensor _apm;
  DeviceHealth  _health;

  IntervalTimer _healthTimer{ HEALTH_UPDATE_INTERVAL_MS };
  IntervalTimer _publishTimer{ PUBLISH_INTERVAL_MS };

  void updateHealth();
};
