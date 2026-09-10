#pragma once
#include "SensorManager.h"

// Prints the exact standardized snapshot that will later be sent to
// Firebase (architecture doc section 15). Swapping this for a real
// Firebase publish call should not require changing anything upstream.
namespace DataFormatter {
  void printSnapshot(const SensorManager& manager);
}
