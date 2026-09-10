import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { Screen } from '../components/Screen';
import { LoadingBlock } from '../components/StateBlocks';
import { colors } from '../theme/colors';
import { getNotificationSettings, saveNotificationSettings } from '../services/api';
import { NotificationSettings } from '../types';
import { RootScreenProps } from '../navigation/types';

const ROWS: { key: keyof NotificationSettings; label: string }[] = [
  { key: 'aqiAlert', label: 'Cảnh báo AQI' },
  { key: 'coAlert', label: 'Cảnh báo CO' },
  { key: 'pm25Alert', label: 'Cảnh báo PM2.5' },
  { key: 'forecastAlert', label: 'Dự báo xấu' },
  { key: 'improvementAlert', label: 'Thông báo cải thiện' },
];

export function NotificationSettingsScreen({ navigation }: RootScreenProps<'NotificationSettings'>) {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  useEffect(() => {
    getNotificationSettings().then(setSettings);
  }, []);

  function toggle(key: keyof NotificationSettings) {
    if (!settings) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    saveNotificationSettings(next).catch(() => setSettings(settings));
  }

  return (
    <Screen>
      <ScreenHeader title="Cài đặt thông báo" onBack={() => navigation.goBack()} />
      {!settings ? (
        <LoadingBlock height={200} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={styles.card}>
            {ROWS.map(row => (
              <View key={row.key} style={styles.row}>
                <Text style={styles.label}>{row.label}</Text>
                <Switch
                  value={settings[row.key]}
                  onValueChange={() => toggle(row.key)}
                  trackColor={{ true: colors.primary, false: '#D1D5DB' }}
                  thumbColor="#fff"
                />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
});
