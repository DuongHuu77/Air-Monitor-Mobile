import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Eye, EyeOff, Leaf, Check } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Field } from '../components/Field';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { AuthScreenProps } from '../navigation/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const { signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  function validate() {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Vui lòng nhập email.';
    else if (!EMAIL_RE.test(email.trim())) e.email = 'Email không hợp lệ.';
    if (!password) e.password = 'Mật khẩu không được để trống.';
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length > 0) return;
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setFormError(error);
    // Nếu thành công, AuthContext cập nhật session -> AppNavigator tự chuyển sang MainTabs.
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <View style={styles.logoBox}>
            <Leaf size={26} color="#fff" />
          </View>
        </View>
        <Text style={styles.title}>Chào mừng trở lại!</Text>
        <Text style={styles.subtitle}>Đăng nhập để tiếp tục theo dõi chất lượng không khí.</Text>

        <Field
          label="Email"
          placeholder="Nhập email của bạn"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
        />
        <Field
          label="Mật khẩu"
          placeholder="Nhập mật khẩu"
          secureTextEntry={!showPw}
          value={password}
          onChangeText={setPassword}
          error={errors.password}
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

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}

        <TouchableOpacity style={styles.forgotLink} onPress={() => setShowForgot(true)}>
          <Text style={styles.forgotText}>Quên mật khẩu?</Text>
        </TouchableOpacity>

        <PrimaryButton onPress={handleSubmit} loading={loading}>
          Đăng nhập
        </PrimaryButton>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Chưa có tài khoản? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text style={styles.footerLink}>Đăng ký ngay</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ForgotPasswordModal
        visible={showForgot}
        onClose={() => setShowForgot(false)}
        onSubmit={resetPassword}
      />
      </KeyboardAvoidingView>
    </Screen>
  );
}

function ForgotPasswordModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (email: string) => Promise<{ error: string | null }>;
}) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    onClose();
    setTimeout(() => {
      setSent(false);
      setEmail('');
      setError(null);
    }, 250);
  }

  async function handleSend() {
    if (!email.trim()) return;
    setLoading(true);
    const { error: err } = await onSubmit(email);
    setLoading(false);
    if (err) setError(err);
    else setSent(true);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          {!sent ? (
            <>
              <Text style={styles.sheetTitle}>Quên mật khẩu?</Text>
              <Text style={styles.sheetDesc}>
                Nhập email của bạn, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.
              </Text>
              <Field
                label="Email"
                placeholder="Nhập email của bạn"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                error={error ?? undefined}
              />
              <PrimaryButton onPress={handleSend} loading={loading} disabled={!email.trim()}>
                Gửi liên kết
              </PrimaryButton>
              <TouchableOpacity onPress={handleClose} style={{ marginTop: 12 }}>
                <Text style={styles.cancelText}>Hủy</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <View style={styles.successCircle}>
                <Check size={22} color={colors.primary} />
              </View>
              <Text style={styles.sheetDesc}>
                Nếu email tồn tại trong hệ thống, bạn sẽ sớm nhận được liên kết đặt lại mật khẩu.
              </Text>
              <TouchableOpacity onPress={handleClose} style={{ marginTop: 16 }}>
                <Text style={styles.footerLink}>Đóng</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 32, paddingBottom: 40 },
  logoWrap: { alignItems: 'center', marginBottom: 24 },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 28 },
  forgotLink: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -6 },
  forgotText: { fontSize: 14, fontWeight: '500', color: colors.primary },
  formError: { color: colors.danger, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  footerText: { fontSize: 14, color: colors.textSecondary },
  footerLink: { fontSize: 14, fontWeight: '700', color: colors.primary },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  sheetDesc: { fontSize: 14, color: colors.textSecondary, marginBottom: 18, textAlign: 'center' },
  cancelText: { textAlign: 'center', color: colors.textSecondary, fontSize: 14 },
  successCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
});
