import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Eye, EyeOff, KeyRound } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Field } from '../components/Field';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

export function ResetPasswordScreen() {
  const { recoveryError, updatePassword, cancelPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (password !== confirm) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setError(null);
    setLoading(true);
    const { error: err } = await updatePassword(password);
    setLoading(false);
    if (err) setError(err);
    else setDone(true);
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrap}>
            <View style={styles.iconBox}>
              <KeyRound size={26} color="#fff" />
            </View>
          </View>

          {recoveryError ? (
            <>
              <Text style={styles.title}>Liên kết không hợp lệ</Text>
              <Text style={styles.subtitle}>{recoveryError}</Text>
              <TouchableOpacity onPress={cancelPasswordRecovery} style={{ marginTop: 24 }}>
                <Text style={styles.backLink}>Quay lại đăng nhập</Text>
              </TouchableOpacity>
            </>
          ) : done ? (
            <>
              <Text style={styles.title}>Đã đổi mật khẩu!</Text>
              <Text style={styles.subtitle}>
                Mật khẩu của bạn đã được cập nhật. Vui lòng đăng nhập lại bằng mật khẩu mới.
              </Text>
              <View style={{ marginTop: 24 }}>
                <PrimaryButton onPress={cancelPasswordRecovery}>Đăng nhập ngay</PrimaryButton>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>Đặt mật khẩu mới</Text>
              <Text style={styles.subtitle}>
                Nhập mật khẩu mới cho tài khoản của bạn.
              </Text>
              <Field
                label="Mật khẩu mới"
                placeholder="Nhập mật khẩu mới"
                secureTextEntry={!showPw}
                value={password}
                onChangeText={setPassword}
                right={
                  <TouchableOpacity onPress={() => setShowPw(s => !s)} hitSlop={8}>
                    {showPw ? (
                      <EyeOff size={18} color={colors.textTertiary} />
                    ) : (
                      <Eye size={18} color={colors.textTertiary} />
                    )}
                  </TouchableOpacity>
                }
              />
              <Field
                label="Xác nhận mật khẩu mới"
                placeholder="Nhập lại mật khẩu mới"
                secureTextEntry={!showPw}
                value={confirm}
                onChangeText={setConfirm}
                error={error ?? undefined}
              />
              <View style={{ marginTop: 8 }}>
                <PrimaryButton onPress={handleSubmit} loading={loading}>
                  Cập nhật mật khẩu
                </PrimaryButton>
              </View>
              <TouchableOpacity onPress={cancelPasswordRecovery} style={{ marginTop: 16 }}>
                <Text style={styles.backLink}>Hủy</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 40, paddingBottom: 40 },
  iconWrap: { alignItems: 'center', marginBottom: 24 },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  backLink: { fontSize: 14, fontWeight: '600', color: colors.primary, textAlign: 'center' },
});
