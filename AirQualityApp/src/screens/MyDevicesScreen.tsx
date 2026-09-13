import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Check, Plus, Smartphone, X } from 'lucide-react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { Screen } from '../components/Screen';
import { Field } from '../components/Field';
import { PrimaryButton } from '../components/PrimaryButton';
import { EmptyBlock, LoadingBlock } from '../components/StateBlocks';
import { colors } from '../theme/colors';
import { claimDevice, getMyDevices } from '../services/api';
import { Device } from '../types';
import { RootScreenProps } from '../navigation/types';

export function MyDevicesScreen({ navigation }: RootScreenProps<'MyDevices'>) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getMyDevices()
      .then(setDevices)
      .finally(() => setLoading(false));
  }, []);

  // Tải lại mỗi khi quay lại màn hình này — vừa nhận diện thiết bị mới vừa
  // cập nhật lại trạng thái online/offline (được tính lại từ last_seen_at
  // mỗi lần load, xem services/api.ts).
  useFocusEffect(load);

  return (
    <Screen>
      <ScreenHeader title="Thiết bị của tôi" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {loading ? (
          <LoadingBlock height={200} />
        ) : devices.length === 0 ? (
          <EmptyBlock
            icon={Smartphone}
            title="Chưa có thiết bị nào"
            description="Bấm nút bên dưới và nhập mã thiết bị để kết nối."
            height={180}
          />
        ) : (
          devices.map(device => (
            <View key={device.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                  <Smartphone size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{device.name}</Text>
                  <Text style={styles.code}>{device.deviceCode}</Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: device.status === 'online' ? colors.primaryLight : '#F3F4F6' },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: device.status === 'online' ? colors.primary : colors.textTertiary },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: device.status === 'online' ? colors.primaryDark : colors.textSecondary },
                    ]}
                  >
                    {device.status === 'online' ? 'Online' : 'Offline'}
                  </Text>
                </View>
              </View>
              <View style={styles.infoGrid}>
                <InfoItem label="Vị trí" value={device.location ?? '—'} />
                <InfoItem label="Firmware" value={device.firmwareVersion ?? '—'} />
              </View>
            </View>
          ))
        )}

        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)} activeOpacity={0.7}>
          <Plus size={18} color={colors.primary} />
          <Text style={[styles.addText, { color: colors.primary }]}>Thêm thiết bị</Text>
        </TouchableOpacity>
      </ScrollView>

      <AddDeviceModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onConnected={() => {
          setShowAddModal(false);
          load();
        }}
      />
    </Screen>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: '50%', marginBottom: 10 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function AddDeviceModal({
  visible,
  onClose,
  onConnected,
}: {
  visible: boolean;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [deviceCode, setDeviceCode] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      // Cuộn xuống cuối để nút "Kết nối" luôn lộ ra trên bàn phím, bất kể
      // đang bấm vào ô nào trong 3 ô nhập liệu.
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    });
    return () => sub.remove();
  }, []);

  function reset() {
    setDeviceCode('');
    setName('');
    setLocation('');
    setResult(null);
    setErrorMsg('');
  }

  function handleClose() {
    onClose();
    setTimeout(reset, 250);
  }

  async function handleConnect() {
    if (!deviceCode.trim() || !name.trim() || !location.trim()) {
      setResult('error');
      setErrorMsg('Vui lòng điền đầy đủ thông tin.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      await claimDevice(deviceCode, name, location);
      setResult('success');
      setTimeout(() => {
        onConnected();
        reset();
      }, 1200);
    } catch (err: any) {
      setResult('error');
      setErrorMsg(
        err?.message === 'DEVICE_NOT_FOUND'
          ? 'Không tìm thấy thiết bị nào với mã này. Kiểm tra lại mã thiết bị.'
          : err?.message ?? 'Kết nối thất bại, vui lòng thử lại.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Thêm thiết bị</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={8}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {result === 'success' ? (
            <View style={styles.resultBox}>
              <View style={styles.successCircle}>
                <Check size={22} color={colors.primary} />
              </View>
              <Text style={styles.resultText}>Kết nối thành công!</Text>
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <Text style={styles.sheetDesc}>
                Nhập mã thiết bị được in trên ESP32 (hoặc dán kèm theo thiết bị) để kết nối vào tài khoản của bạn.
              </Text>
              <Field
                label="Mã thiết bị"
                placeholder="Ví dụ: ESP32-AQ-001"
                autoCapitalize="characters"
                value={deviceCode}
                onChangeText={setDeviceCode}
              />
              <Field label="Tên thiết bị" placeholder="Ví dụ: Nhà của bạn" value={name} onChangeText={setName} />
              <Field label="Vị trí" placeholder="Ví dụ: Phòng khách" value={location} onChangeText={setLocation} />
              {result === 'error' && <Text style={styles.errorText}>{errorMsg}</Text>}
              <PrimaryButton onPress={handleConnect} loading={loading}>
                Kết nối
              </PrimaryButton>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  code: { fontSize: 12, color: colors.textSecondary },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  infoLabel: { fontSize: 11, color: colors.textTertiary },
  infoValue: { fontSize: 13, fontWeight: '500', color: colors.textPrimary, marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    paddingVertical: 14,
  },
  addText: { fontSize: 13, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  sheetDesc: { fontSize: 13, color: colors.textSecondary, marginBottom: 16, lineHeight: 19 },
  errorText: { fontSize: 12, color: colors.danger, marginBottom: 12 },
  resultBox: { alignItems: 'center', paddingVertical: 20 },
  successCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  resultText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
});
