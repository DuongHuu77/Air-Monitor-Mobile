import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { colors } from '../theme/colors';

export function LoadingBlock({ height = 190 }: { height?: number }) {
  return (
    <View style={[styles.center, { height }]}>
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  );
}

interface EmptyBlockProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  height?: number;
}

export function EmptyBlock({ icon: Icon, title, description, height = 190 }: EmptyBlockProps) {
  return (
    <View style={[styles.center, { height, paddingHorizontal: 24 }]}>
      {Icon ? <Icon size={32} color={colors.textTertiary} style={{ marginBottom: 10 }} /> : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  desc: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});
