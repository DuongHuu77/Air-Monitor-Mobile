#pragma once
#include <Arduino.h>

// ESP32-C6-WROOM-1 pin mapping.
// TODO: adjust to match the actual PCB / breadboard wiring.

static const uint8_t PIN_DHT11 = 4;
static const uint8_t PIN_MQ7   = 0;  // must be an ADC-capable pin

// Reserved for APM2000 (UART). Finalize once the module is identified/tested.
static const uint8_t PIN_APM2000_RX = 6;
static const uint8_t PIN_APM2000_TX = 7;
