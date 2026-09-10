import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';
import { RootScreenProps } from '../navigation/types';

const OPTIONS = [
  { key: 'vi', label: 'Tiếng Việt' },
  { key: 'en', label: 'English' },
] as const;

export function LanguageScreen({ navigation }: RootScreenProps<'Language'>) {
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');

  return (
    <Screen>
      <ScreenHeader title="Ngôn ngữ" onBack={() => navigation.goBack()} />
      <View style={{ padding: 16 }}>
        <View style={styles.card}>
          {OPTIONS.map(opt => (
            <TouchableOpacity key={opt.key} style={styles.row} onPress={() => setLanguage(opt.key)}>
              <Text style={styles.label}>{opt.label}</Text>
              {language === opt.key && <Check size={18} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
        {language === 'en' && (
          <Text style={styles.note}>
            Bản dịch tiếng Anh đang được phát triển và sẽ sớm ra mắt. (Gợi ý: tích hợp
            thư viện i18n như i18next để hoàn thiện đa ngôn ngữ.)
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, overflow: 'hidden', backgroundColor: '#fff' },
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
  note: { fontSize: 12, color: colors.textTertiary, marginTop: 12, lineHeight: 18 },
});
