#pragma once
#include <math.h>
#include <string.h>

// Lightweight filtering only (architecture doc section 8) - no heavy
// statistics, no AI, nothing that doesn't belong on an MCU.
namespace Filter {

  inline float average(const float* buffer, int count) {
    if (count <= 0) return NAN;
    float sum = 0;
    for (int i = 0; i < count; i++) sum += buffer[i];
    return sum / count;
  }

  // Simple insertion-sort median. Fine for the small window sizes used here
  // (see MQ7_WINDOW_SAMPLES in Config.h). Max 32 samples supported.
  inline float median(const float* buffer, int count) {
    if (count <= 0 || count > 32) return NAN;

    float sorted[32];
    memcpy(sorted, buffer, sizeof(float) * count);

    for (int i = 1; i < count; i++) {
      float key = sorted[i];
      int j = i - 1;
      while (j >= 0 && sorted[j] > key) {
        sorted[j + 1] = sorted[j];
        j--;
      }
      sorted[j + 1] = key;
    }

    return (count % 2 == 0)
      ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2.0f
      : sorted[count / 2];
  }

}  // namespace Filter
