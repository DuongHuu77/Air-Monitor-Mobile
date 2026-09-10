import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Info } from 'lucide-react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { Screen } from '../components/Screen';
import { EmptyBlock, LoadingBlock } from '../components/StateBlocks';
import { colors } from '../theme/colors';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/api';
import { AppNotification, NotificationType } from '../types';
import { RootScreenProps } from '../navigation/types';

const NOTIF_META: Record<NotificationType, { icon: any; color: string; bg: string }> = {
  warning: { icon: AlertTriangle, color: '#DC2626', bg: '#FEE2E2' },
  forecast: { icon: AlertTriangle, color: '#EA580C', bg: '#FFEDD5' },
  normal: { icon: CheckCircle2, color: '#16A34A', bg: '#DCFCE7' },
  improvement: { icon: Info, color: '#3B82F6', bg: '#DBEAFE' },
};

export function NotificationsScreen({ navigation }: RootScreenProps<'Notifications'>) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getNotifications()
      .then(setItems)
      .catch(err => setError(err?.message ?? 'Không thể tải thông báo.'))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  async function handleMarkAll() {
    setItems(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      load();
    }
  }

  async function handleMarkOne(id: string) {
    setItems(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      await markNotificationRead(id);
    } catch {
      load();
    }
  }

  return (
    <Screen>
      <ScreenHeader
        title="Thông báo"
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity onPress={handleMarkAll} hitSlop={8}>
            <CheckCheck size={20} color={colors.primary} />
          </TouchableOpacity>
        }
      />
      {loading ? (
        <LoadingBlock height={300} />
      ) : error ? (
        <EmptyBlock title="Có lỗi xảy ra" description={error} height={300} />
      ) : items.length === 0 ? (
        <EmptyBlock icon={Bell} title="Không có thông báo mới" height={300} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => {
            const meta = NOTIF_META[item.type];
            const Icon = meta.icon;
            return (
              <TouchableOpacity
                style={[styles.item, { backgroundColor: item.isRead ? '#fff' : colors.background }]}
                onPress={() => handleMarkOne(item.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconCircle, { backgroundColor: meta.bg }]}>
                  <Icon size={18} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.itemHeaderRow}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.itemTime}>
                      {new Date(item.createdAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Text style={styles.itemMessage}>{item.message}</Text>
                </View>
                {!item.isRead && <View style={styles.dot} />}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'flex-start',
  },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  itemHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  itemTime: { fontSize: 11, color: colors.textTertiary },
  itemMessage: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginTop: 4 },
});
