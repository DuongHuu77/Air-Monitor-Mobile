import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  BellRing,
  ChevronRight,
  Globe,
  Info,
  LogOut,
  SlidersHorizontal,
  Smartphone,
  User as UserIcon,
} from 'lucide-react-native';
import { Avatar } from '../components/Avatar';
import { Screen } from '../components/Screen';
import { ListRow } from '../components/ListRow';
import { colors } from '../theme/colors';
import { getProfile } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Profile } from '../types';
import { MainTabScreenProps } from '../navigation/types';

export function ProfileScreen({ navigation }: MainTabScreenProps<'Profile'>) {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useFocusEffect(
    useCallback(() => {
      getProfile()
        .then(setProfile)
        .catch(() => {});
    }, []),
  );

  function confirmLogout() {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi AirGuard?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <Screen edges={['top']}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={styles.pageTitle}>Hồ sơ</Text>

      <TouchableOpacity style={styles.profileCard} onPress={() => navigation.navigate('AccountInfo')} activeOpacity={0.7}>
        <Avatar name={profile?.fullName} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {profile?.fullName || '—'}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {profile?.email}
          </Text>
        </View>
        <ChevronRight size={20} color={colors.textTertiary} />
      </TouchableOpacity>

      <View style={styles.menuCard}>
        <ListRow icon={UserIcon} label="Thông tin tài khoản" onPress={() => navigation.navigate('AccountInfo')} />
        <ListRow icon={Smartphone} label="Thiết bị của tôi" onPress={() => navigation.navigate('MyDevices')} />
        <ListRow icon={SlidersHorizontal} label="Ngưỡng cảnh báo" onPress={() => navigation.navigate('AlertThresholds')} />
        <ListRow icon={BellRing} label="Cài đặt thông báo" onPress={() => navigation.navigate('NotificationSettings')} />
        <ListRow icon={Globe} label="Ngôn ngữ" trailing="Tiếng Việt" onPress={() => navigation.navigate('Language')} />
        <ListRow icon={Info} label="Giới thiệu ứng dụng" onPress={() => navigation.navigate('About')} />
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout} activeOpacity={0.7}>
        <LogOut size={18} color={colors.danger} />
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </TouchableOpacity>
    </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  email: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  menuCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
  },
  logoutBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: colors.dangerLight,
    borderRadius: 16,
    paddingVertical: 14,
  },
  logoutText: { fontSize: 14, fontWeight: '700', color: colors.danger },
});
