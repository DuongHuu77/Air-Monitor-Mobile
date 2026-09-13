import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, Leaf } from 'lucide-react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';
import { RootScreenProps } from '../navigation/types';

const LINKS = ['Thông tin dự án', 'Điều khoản sử dụng', 'Chính sách bảo mật'];

export function AboutScreen({ navigation }: RootScreenProps<'About'>) {
  return (
    <Screen>
      <ScreenHeader title="Giới thiệu ứng dụng" onBack={() => navigation.goBack()} />
      <View style={{ padding: 16 }}>
        <View style={styles.heroBox}>
          <View style={styles.logoBox}>
            <Leaf size={30} color="#fff" />
          </View>
          <Text style={styles.appName}>AirGuard</Text>
          <Text style={styles.tagline}>Smart Air Quality Monitoring</Text>
          <Text style={styles.version}>Phiên bản 1.0.0</Text>
        </View>
        <View style={styles.card}>
          {LINKS.map(link => (
            <TouchableOpacity key={link} style={styles.row}>
              <Text style={styles.label}>{link}</Text>
              <ChevronRight size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroBox: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  appName: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  tagline: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  version: { fontSize: 12, color: colors.textTertiary, marginTop: 4 },
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
});
