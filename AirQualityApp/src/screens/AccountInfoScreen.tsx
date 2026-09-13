import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { Field } from '../components/Field';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';
import { getProfile, updateProfileName } from '../services/api';
import { RootScreenProps } from '../navigation/types';

export function AccountInfoScreen({ navigation }: RootScreenProps<'AccountInfo'>) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    getProfile()
      .then(p => {
        if (p) {
          setName(p.fullName);
          setEmail(p.email);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!name.trim()) {
      setError('Vui lòng nhập họ và tên.');
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      await updateProfileName(name.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err?.message ?? 'Không thể lưu, vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Thông tin tài khoản" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Avatar name={name} size={84} />
        </View>
        <Field label="Họ và tên" value={name} onChangeText={setName} error={error} placeholder="Nhập họ và tên" editable={!loading} />
        <Field label="Email" value={email} editable={false} />
        <Text style={styles.hint}>Email không thể thay đổi.</Text>
        {saved && (
          <View style={styles.savedBanner}>
            <Text style={styles.savedText}>Đã cập nhật thông tin.</Text>
          </View>
        )}
        <PrimaryButton onPress={handleSave} loading={saving}>
          Lưu thay đổi
        </PrimaryButton>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.textTertiary, marginTop: -10, marginBottom: 16 },
  savedBanner: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  savedText: { color: colors.primaryDark, fontWeight: '600', fontSize: 13 },
});
