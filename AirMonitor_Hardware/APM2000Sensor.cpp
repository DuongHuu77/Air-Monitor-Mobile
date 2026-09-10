#include "APM2000Sensor.h"
#include <Arduino.h>
#include "Pins.h"
#include "Config.h"

// Sử dụng UART số 1 của ESP32
HardwareSerial SerialPM(1);

// Khung lệnh yêu cầu trả về PM1.0, PM2.5, PM10 theo datasheet
const byte CMD_READ_ALL[] = {0xFE, 0xA5, 0x00, 0x01, 0xA6};

void APM2000Sensor::begin() {
  // Khởi tạo UART ở mức Baudrate 1200, chế độ 8N1 theo datasheet
  SerialPM.begin(1200, SERIAL_8N1, PIN_APM2000_RX, PIN_APM2000_TX);
}

void APM2000Sensor::update() {
  static unsigned long lastRequestTime = 0;
  unsigned long now = millis();

  // 1. Gửi lệnh định kỳ mỗi 2 giây (non-blocking)
  if (now - lastRequestTime >= 2000) {
    while (SerialPM.available()) SerialPM.read(); // Clear buffer
    SerialPM.write(CMD_READ_ALL, sizeof(CMD_READ_ALL));
    lastRequestTime = now;
  }

  // 2. Đọc 11 byte phản hồi
  if (SerialPM.available() >= 11) {
    byte buffer[11];
    SerialPM.readBytes(buffer, 11);

    if (buffer[0] == 0xFE && buffer[1] == 0xA5) {
      
      // Tính toán Checksum (Byte 1 đến Byte 9)
      int sum = buffer[1] + buffer[2] + buffer[3] + buffer[4] + 
                buffer[5] + buffer[6] + buffer[7] + buffer[8] + buffer[9];
      byte calculatedCS = (byte)(sum & 0xFF);

      if (calculatedCS == buffer[10]) {
        // PM2.5 ở byte 6 (High) và 7 (Low)
        int pm25_val = (buffer[6] * 256) + buffer[7];
        _pm25 = SensorReading::ok((float)pm25_val);

        // PM10 ở byte 8 (High) và 9 (Low)
        int pm10_val = (buffer[8] * 256) + buffer[9];
        _pm10 = SensorReading::ok((float)pm10_val);
      } else {
        // Sai Checksum
        _pm25 = SensorReading::error(ErrorDetail::READ_FAILED);
        _pm10 = SensorReading::error(ErrorDetail::READ_FAILED);
      }
    }
  }
}