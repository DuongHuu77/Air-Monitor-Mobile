import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { colors } from '../theme/colors';

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  right?: React.ReactNode;
}

export function Field({ label, error, right, style, ...rest }: FieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          {...rest}
          placeholderTextColor={colors.textTertiary}
          style={[
            styles.input,
            { borderColor: error ? colors.danger : '#E5E7EB', paddingRight: right ? 40 : 16 },
            style,
          ]}
        />
        {right && <View style={styles.rightSlot}>{right}</View>}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  inputWrapper: { position: 'relative', justifyContent: 'center' },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingLeft: 16,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: '#fff',
  },
  rightSlot: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
  },
  error: {
    marginTop: 6,
    fontSize: 12,
    color: colors.danger,
  },
});
