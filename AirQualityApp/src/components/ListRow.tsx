import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, LucideIcon } from 'lucide-react-native';
import { colors } from '../theme/colors';

interface ListRowProps {
  icon: LucideIcon;
  label: string;
  trailing?: string;
  onPress: () => void;
  danger?: boolean;
}

export function ListRow({ icon: Icon, label, trailing, onPress, danger }: ListRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconCircle, { backgroundColor: danger ? colors.dangerLight : colors.primaryLight }]}>
        <Icon size={18} color={danger ? colors.danger : colors.primary} />
      </View>
      <Text style={[styles.label, { color: danger ? colors.danger : colors.textPrimary }]}>{label}</Text>
      {trailing ? <Text style={styles.trailing}>{trailing}</Text> : null}
      <ChevronRight size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, fontSize: 14, fontWeight: '500' },
  trailing: { fontSize: 14, color: colors.textSecondary, marginRight: 2 },
});
