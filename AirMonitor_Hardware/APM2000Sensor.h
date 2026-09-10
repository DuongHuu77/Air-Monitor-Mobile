#pragma once
#include "SensorReading.h"

// APM2000 is not physically connected yet (pending delivery).
// This stub keeps the pipeline / data contract complete NOW so
// SensorManager, DataFormatter, and the future Firebase payload can all
// be built and tested without waiting for the hardware.
//
// Once the module arrives: implement UART read/parse in update(), keep
// the public interface (getPM25/getPM10) exactly as-is so nothing else
// in the system needs to change (architecture doc section 18).
class APM2000Sensor {
public:
  void begin();
  void update();

  SensorReading getPM25() const { return _pm25; }
  SensorReading getPM10() const { return _pm10; }

private:
  SensorReading _pm25 = SensorReading::unavailable(ErrorDetail::NOT_DETECTED);
  SensorReading _pm10 = SensorReading::unavailable(ErrorDetail::NOT_DETECTED);
};
