#pragma once
#include <Arduino.h>
#include <math.h>
#include "SensorStatus.h"

// Common contract every sensor value must follow (architecture doc section 11).
// Every reading (temperature, humidity, co, pm25, pm10, ...) is this same shape,
// so external consumers (Firebase / app) never need sensor-specific logic.
struct SensorReading {
  float value;
  SensorState state;
  ErrorDetail detail;
  unsigned long timestamp;  // millis() at time this reading was produced

  static SensorReading ok(float v) {
    return SensorReading{ v, SensorState::OK, ErrorDetail::NONE, millis() };
  }

  static SensorReading invalid(ErrorDetail d) {
    return SensorReading{ NAN, SensorState::INVALID, d, millis() };
  }

  static SensorReading unavailable(ErrorDetail d) {
    return SensorReading{ NAN, SensorState::UNAVAILABLE, d, millis() };
  }

  static SensorReading error(ErrorDetail d) {
    return SensorReading{ NAN, SensorState::ERROR, d, millis() };
  }
};
