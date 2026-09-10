import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Field } from '../components/Field';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';
import { getThresholds, saveThresholds } from '../services/api';
import { AlertThresholds } from '../types';
import { RootScreenProps } from '../navigation/types';

export function AlertThresholdsScreen({ navigation }: RootScreenProps<'AlertThresholds'>) {
  const [values, setValues] = useState<Record<keyof AlertThresholds, string>>({
    aqi: '100',
    pm25: '50',
    co: '0.3',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getThresholds()
      .then(t =>
        setValues({ aqi: String(t.aqi), pm25: String(t.pm25), co: String(t.co) }),
      )
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await saveThresholds({
        aqi: Number(values.aqi) || 0,
        pm25: Number(values.pm25) || 0,
        co: Number(values.co) || 0,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Ngưỡng cảnh báo" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.desc}>
          Bạn sẽ nhận cảnh báo khi thông số đo được vượt quá các ngưỡng dưới đây.
        </Text>
        <Field
          label="Ngưỡng AQI"
          value={values.aqi}
          onChangeText={t => setValues(v => ({ ...v, aqi: t }))}
          keyboardType="numeric"
          editable={!loading}
        />
        <Field
          label="Ngưỡng PM2.5 (µg/m³)"
          value={values.pm25}
          onChangeText={t => setValues(v => ({ ...v, pm25: t }))}
          keyboardType="numeric"
          editable={!loading}
        />
        <Field
          label="Ngưỡng CO (ppm)"
          value={values.co}
          onChangeText={t => setValues(v => ({ ...v, co: t }))}
          keyboardType="numeric"
          editable={!loading}
        />
        {saved && (
          <View style={styles.savedBanner}>
            <Text style={styles.savedText}>Đã lưu ngưỡng cảnh báo.</Text>
          </View>
        )}
        <PrimaryButton onPress={handleSave} loading={saving}>
          Lưu cấu hình
        </PrimaryButton>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  desc: { fontSize: 13, color: colors.textSecondary, marginBottom: 18, lineHeight: 19 },
  savedBanner: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  savedText: { color: colors.primaryDark, fontWeight: '600', fontSize: 13 },
});
