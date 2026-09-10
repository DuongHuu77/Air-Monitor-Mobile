#pragma once
#include "SensorReading.h"
#include "Config.h"
#include "Pins.h"
#include "Validator.h"
#include "Filter.h"
#include "Scheduler.h"

class MQ7Sensor {
public:
  void begin();
  void update();  // call every loop(); samples + aggregates internally

  SensorReading getReading() const { return _processed; }

private:
  IntervalTimer _sampleTimer{ MQ7_SAMPLE_INTERVAL_MS };

  float _buffer[MQ7_WINDOW_SAMPLES];
  int   _bufferCount = 0;
  float _lastRawValue = NAN;
  float convertToPPM(float rawADC);

  SensorReading _processed = SensorReading::unavailable(ErrorDetail::NOT_DETECTED);

  void sample();
  void aggregateAndPublishWindow();
};
