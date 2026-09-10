#pragma once
#include <DHT.h>
#include "SensorReading.h"
#include "Config.h"
#include "Pins.h"
#include "Validator.h"
#include "Scheduler.h"

// Requires library: "DHT sensor library" by Adafruit
//              (+ dependency "Adafruit Unified Sensor")
class DHT11Sensor {
public:
  void begin();
  void update();  // call every loop(); internally throttled, non-blocking

  SensorReading getTemperature() const { return _temperature; }
  SensorReading getHumidity()    const { return _humidity; }

private:
  DHT _dht{ PIN_DHT11, DHT11 };
  IntervalTimer _timer{ DHT11_SAMPLE_INTERVAL_MS };

  SensorReading _temperature = SensorReading::unavailable(ErrorDetail::NOT_DETECTED);
  SensorReading _humidity    = SensorReading::unavailable(ErrorDetail::NOT_DETECTED);

  int _consecutiveFailures = 0;
  
  void readAndValidate();
};
