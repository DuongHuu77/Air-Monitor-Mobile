#include "SensorManager.h"

void SensorManager::begin() {
  _dht.begin();
  _mq7.begin();
  _apm.begin();
  _health.uptimeMs = millis();
}

void SensorManager::update() {
  // Each sensor owns its own timing. A slow/faulty sensor here can
  // never block the others (architecture doc section 5, Rule 1).
  _dht.update();
  _mq7.update();
  _apm.update();

  if (_healthTimer.isDue()) {
    updateHealth();
  }
}

void SensorManager::updateHealth() {
  _health.uptimeMs = millis();
  _health.lastSeen = millis();  // heartbeat: firmware is alive and looping
  _health.status = DeviceStatus::ONLINE;

  // NOTE: wifiConnected / cloudConnected intentionally do NOT affect
  // device.status here. Per architecture doc Rule 4/5, the device can
  // stay ONLINE while Wi-Fi/cloud/sensors are degraded - only the
  // firmware loop itself dying should ever make it OFFLINE (detected
  // externally via heartbeat/lastSeen timeout, section 14).
}

bool SensorManager::isPublishDue() {
  return _publishTimer.isDue();
}
