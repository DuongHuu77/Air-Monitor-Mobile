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
import { ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Field } from '../components/Field';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { AuthScreenProps } from '../navigation/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState {
  name: string;
  email: string;
  password: string;
  confirm: string;
}

export function SignUpScreen({ navigation }: AuthScreenProps<'SignUp'>) {
  const { signUp } = useAuth();
  const [form, setForm] = useState<FormState>({ name: '', email: '', password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'agree', string>>>({});
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function validate() {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = 'Vui lòng nhập họ và tên.';
    if (!form.email.trim()) e.email = 'Vui lòng nhập email.';
    else if (!EMAIL_RE.test(form.email.trim())) e.email = 'Email không hợp lệ.';
    if (!form.password) e.password = 'Vui lòng nhập mật khẩu.';
    else if (form.password.length < 6) e.password = 'Mật khẩu phải có ít nhất 6 ký tự.';
    if (form.confirm !== form.password) e.confirm = 'Mật khẩu xác nhận không khớp.';
    if (!agree) e.agree = 'Vui lòng đồng ý với điều khoản sử dụng.';
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    setErrors(e);
    setFormNotice(null);
    if (Object.keys(e).length > 0) return;
    setLoading(true);
    const { error } = await signUp(form.name, form.email, form.password);
    setLoading(false);
    if (error) setFormNotice(error);
    // Nếu Supabase bật auto-confirm, session sẽ có ngay -> AppNavigator tự chuyển màn hình.
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Tạo tài khoản</Text>
        <Text style={styles.subtitle}>Điền thông tin để tạo tài khoản mới.</Text>

        <Field
          label="Họ và tên"
          placeholder="Nhập họ và tên"
          value={form.name}
          onChangeText={t => update('name', t)}
          error={errors.name}
        />
        <Field
          label="Email"
          placeholder="Nhập email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={form.email}
          onChangeText={t => update('email', t)}
          error={errors.email}
        />
        <Field
          label="Mật khẩu"
          placeholder="Nhập mật khẩu"
          secureTextEntry={!showPw}
          value={form.password}
          onChangeText={t => update('password', t)}
          error={errors.password}
          right={
            <TouchableOpacity onPress={() => setShowPw(s => !s)} hitSlop={8}>
              {showPw ? <EyeOff size={18} color={colors.textTertiary} /> : <Eye size={18} color={colors.textTertiary} />}
            </TouchableOpacity>
          }
        />
        <Field
          label="Xác nhận mật khẩu"
          placeholder="Nhập lại mật khẩu"
          secureTextEntry={!showConfirm}
          value={form.confirm}
          onChangeText={t => update('confirm', t)}
          error={errors.confirm}
          right={
            <TouchableOpacity onPress={() => setShowConfirm(s => !s)} hitSlop={8}>
              {showConfirm ? <EyeOff size={18} color={colors.textTertiary} /> : <Eye size={18} color={colors.textTertiary} />}
            </TouchableOpacity>
          }
        />

        <TouchableOpacity style={styles.agreeRow} onPress={() => setAgree(a => !a)} activeOpacity={0.7}>
          <View style={[styles.checkbox, agree && styles.checkboxChecked]} />
          <Text style={styles.agreeText}>
            Tôi đồng ý với <Text style={styles.link}>Điều khoản sử dụng</Text> và{' '}
            <Text style={styles.link}>Chính sách bảo mật</Text>
          </Text>
        </TouchableOpacity>
        {errors.agree ? <Text style={styles.formError}>{errors.agree}</Text> : null}
        {formNotice ? <Text style={styles.formNotice}>{formNotice}</Text> : null}

        <View style={{ marginTop: 20 }}>
          <PrimaryButton onPress={handleSubmit} loading={loading}>
            Đăng ký
          </PrimaryButton>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Đã có tài khoản? </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.footerLink}>Đăng nhập</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 16, paddingBottom: 40 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', marginBottom: 8, marginLeft: -6 },
  title: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 24 },
  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 4 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  agreeText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  link: { color: colors.primary, fontWeight: '600' },
  formError: { color: colors.danger, fontSize: 12, marginTop: 6 },
  formNotice: { color: colors.textPrimary, fontSize: 13, marginTop: 12, textAlign: 'center' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { fontSize: 14, color: colors.textSecondary },
  footerLink: { fontSize: 14, fontWeight: '700', color: colors.primary },
});
