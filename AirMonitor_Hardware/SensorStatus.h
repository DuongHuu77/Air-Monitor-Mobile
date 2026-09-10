#pragma once
#include <Arduino.h>

// Common state model shared by ALL sensors (architecture doc section 9).
enum class SensorState : uint8_t {
  OK,
  INVALID,
  UNAVAILABLE,
  ERROR
};

// Diagnostic detail attached to a state (architecture doc section 10).
enum class ErrorDetail : uint8_t {
  NONE,
  NOT_DETECTED,
  READ_FAILED,
  TIMEOUT,
  OUT_OF_RANGE
};

inline const char* toString(SensorState state) {
  switch (state) {
    case SensorState::OK:          return "OK";
    case SensorState::INVALID:     return "INVALID";
    case SensorState::UNAVAILABLE: return "UNAVAILABLE";
    case SensorState::ERROR:       return "ERROR";
  }
  return "UNKNOWN";
}

inline const char* toString(ErrorDetail detail) {
  switch (detail) {
    case ErrorDetail::NONE:         return "NONE";
    case ErrorDetail::NOT_DETECTED: return "NOT_DETECTED";
    case ErrorDetail::READ_FAILED:  return "READ_FAILED";
    case ErrorDetail::TIMEOUT:      return "TIMEOUT";
    case ErrorDetail::OUT_OF_RANGE: return "OUT_OF_RANGE";
  }
  return "UNKNOWN";
}
