#pragma once
#include "SensorManager.h"

namespace SupabasePublisher {
  void begin();
  void publishSnapshot(const SensorManager& manager);
}