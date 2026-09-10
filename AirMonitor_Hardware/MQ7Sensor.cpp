#include "MQ7Sensor.h"

void MQ7Sensor::begin() {
  pinMode(PIN_MQ7, INPUT_PULLDOWN);
}

void MQ7Sensor::update() {
  if (!_sampleTimer.isDue()) return;
  sample();
}

void MQ7Sensor::sample() {
  int raw = analogRead(PIN_MQ7);

  if (raw <= MQ7_DISCONNECTED_THRESHOLD) {
    // Pull-down nội kéo chân về gần 0V khi không có gì drive nó
    // -> cảm biến hoặc nguồn của nó đã bị rút.
    _processed = SensorReading::unavailable(ErrorDetail::NOT_DETECTED);
    _bufferCount = 0;
    _lastRawValue = NAN;   // reset baseline để không báo "spike" giả khi cắm lại
    return;
  }
  
  if (!Validator::isValidMQ7Raw(raw)) {
    // A single bad ADC read must not kill the whole window, just skip it.
    return;
  }

  float value = (float)raw;

  if (Validator::isSpike(_lastRawValue, value)) {
    // Discard the obvious spike, keep the previous baseline.
    return;
  }
  _lastRawValue = value;

  if (_bufferCount < MQ7_WINDOW_SAMPLES) {
    _buffer[_bufferCount++] = value;
  }

  if (_bufferCount >= MQ7_WINDOW_SAMPLES) {
    aggregateAndPublishWindow();
    _bufferCount = 0;  // start a fresh window
  }
}

void MQ7Sensor::aggregateAndPublishWindow() {
  float avg = Filter::average(_buffer, _bufferCount);

  // NOTE: this is still raw ADC average, not ppm. Concentration conversion
  // / calibration is a sensor-specific concern (architecture doc section 16)
  // and will be added once the MQ-7 is calibrated against known gas levels.
  float ppmValue = convertToPPM(avg);
  _processed = SensorReading::ok(ppmValue);
}
/*
 * GHI CHÚ CHO ĐỒ ÁN: Hàm quy đổi PPM dựa trên Datasheet Hanwei MQ-7.
 * - Công thức R_s: Rs = (Vc - VRL) / VRL * RL (Theo mục OPERATION PRINCIPLE)
 * - Công thức ppm = 100 * (Rs/R0)^(-1.43) (Nội suy từ Fig 3)
 * Bạn có thể giữ hàm này trong mã nguồn để minh chứng cho việc nghiên cứu thuật toán.
 */
float MQ7Sensor::convertToPPM(float rawADC) {
  // 1. Tính điện áp thật tại chân A0 (đã bù trừ cầu phân áp 2 trở 10k -> nhân 2)
  float vA0 = (rawADC / 4095.0) * 3.3 * 2.0;

  // Giới hạn an toàn tránh chia cho 0
  if (vA0 <= 0.0 || vA0 >= 5.0) return 0.0;

  // 2. Tính Rs theo công thức chuẩn của hãng
  // Vc = 5V, RL = 10kOhm
  float RL = 10.0; 
  float Rs = (5.0 - vA0) / vA0 * RL;

  // 3. Tính tỷ lệ Rs/R0
  // LƯU Ý: R0 lúc này là điện trở ở 100ppm CO, KHÔNG PHẢI không khí sạch!
  // (Tôi sẽ hướng dẫn bạn cách tìm con số này ở phần follow-up bên dưới)
  float R0_at_100ppm = 0.62; 
  float ratio = Rs / R0_at_100ppm;

  // 4. Áp dụng phương trình toán học nội suy từ Fig. 3
  float ppm = 100.0 * pow(ratio, -1.43);

  return ppm;
}
