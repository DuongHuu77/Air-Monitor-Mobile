#include "DHT11Sensor.h"

void DHT11Sensor::begin() {
  _dht.begin();
}

void DHT11Sensor::update() {
  if (!_timer.isDue()) return;  // not due yet, do nothing (non-blocking)
  readAndValidate();
}

void DHT11Sensor::readAndValidate() {
  float t = _dht.readTemperature();
  float h = _dht.readHumidity();

  if (isnan(t) || isnan(h)) {
    _consecutiveFailures++;

    if (_consecutiveFailures >= DHT11_MAX_CONSECUTIVE_FAILURES) {
      // Lỗi kéo dài -> coi như cảm biến đã bị rút/mất kết nối vật lý
      _temperature = SensorReading::unavailable(ErrorDetail::NOT_DETECTED);
      _humidity    = SensorReading::unavailable(ErrorDetail::NOT_DETECTED);
    } else {
      // Mới lỗi vài lần -> có thể chỉ là nhiễu tạm thời, chưa vội kết luận
      _temperature = SensorReading::error(ErrorDetail::READ_FAILED);
      _humidity    = SensorReading::error(ErrorDetail::READ_FAILED);
    }
    return;
  }

  _consecutiveFailures = 0; // đọc thành công -> reset bộ đếm

  _temperature = Validator::isValidTemperature(t)
    ? SensorReading::ok(t)
    : SensorReading::invalid(ErrorDetail::OUT_OF_RANGE);

  _humidity = Validator::isValidHumidity(h)
    ? SensorReading::ok(h)
    : SensorReading::invalid(ErrorDetail::OUT_OF_RANGE);
}