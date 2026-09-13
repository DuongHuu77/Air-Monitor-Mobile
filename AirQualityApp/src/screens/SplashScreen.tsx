import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Leaf } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

export function SplashScreen() {
  return (
    <Screen edges={['top', 'bottom']} style={styles.container}>
      <View style={styles.logoBox}>
        <Leaf size={38} color="#fff" />
      </View>
      <Text style={styles.title}>AirGuard</Text>
      <Text style={styles.tagline}>Smart Air Quality Monitoring</Text>
      <Text style={styles.desc}>Giám sát chất lượng không khí xung quanh nhà của bạn</Text>
      <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 28 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 32,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  tagline: { fontSize: 14, fontWeight: '500', color: colors.primaryDark, marginBottom: 24 },
  desc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
});
