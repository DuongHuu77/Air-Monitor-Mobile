#pragma once
#include <math.h>
#include "Config.h"

// Basic range/sanity checks. Kept sensor-specific, but grouped together
// so all validation rules live in one obvious place.
namespace Validator {

  inline bool isValidTemperature(float t) {
    return !isnan(t) && t >= DHT11_TEMP_MIN && t <= DHT11_TEMP_MAX;
  }

  inline bool isValidHumidity(float h) {
    return !isnan(h) && h >= DHT11_HUM_MIN && h <= DHT11_HUM_MAX;
  }

  inline bool isValidMQ7Raw(int raw) {
    return raw >= MQ7_ADC_MIN && raw <= MQ7_ADC_MAX;
  }

  // Rejects a sample that jumps too far from the previous accepted one.
  // `previous == NAN` means "no baseline yet" -> never flagged as spike.
  inline bool isSpike(float previous, float current) {
    if (isnan(previous)) return false;
    return fabs(current - previous) > MQ7_MAX_DELTA_PER_SAMPLE;
  }

}  // namespace Validator
