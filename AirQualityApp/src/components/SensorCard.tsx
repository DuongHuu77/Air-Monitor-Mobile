import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { colors } from '../theme/colors';

interface SensorCardProps {
  icon: LucideIcon;
  iconColor: string;
  value: string;
  label: string;
}

export function SensorCard({ icon: Icon, iconColor, value, label }: SensorCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        <Icon size={16} color={iconColor} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  value: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  label: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
