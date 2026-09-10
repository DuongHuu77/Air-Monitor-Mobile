#pragma once
#include <Arduino.h>

// Small reusable non-blocking timer, used by every sensor and by the
// SensorManager so the "is it due yet?" check (architecture doc section 5)
// is written once instead of duplicated everywhere.
//
// Usage:
//   IntervalTimer timer(2000); // 2s interval
//   void loop() {
//     if (timer.isDue()) { ...do the periodic work... }
//   }
class IntervalTimer {
public:
  explicit IntervalTimer(unsigned long intervalMs) : _interval(intervalMs) {}

  bool isDue() {
    unsigned long now = millis();
    if (now - _last >= _interval) {
      _last = now;
      return true;
    }
    return false;
  }

private:
  unsigned long _interval;
  unsigned long _last = 0;
};
