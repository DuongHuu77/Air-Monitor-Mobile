import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Droplets,
  Globe,
  MapPin,
  Plus,
  Thermometer,
  Trash2,
  Wind,
  X,
} from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Field } from '../components/Field';
import { PrimaryButton } from '../components/PrimaryButton';
import { EmptyBlock, LoadingBlock } from '../components/StateBlocks';
import { colors, getAqiInfo } from '../theme/colors';
import {
  addSavedLocation,
  deleteSavedLocation,
  getSavedLocations,
  SavedLocationRow,
} from '../services/api';
import {
  fetchAirQualityByCity,
  searchStations,
  ExternalAqiResult,
  StationSearchResult,
  POLLUTANT_LABELS,
} from '../lib/waqi';

type CardState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ExternalAqiResult };

export function ExploreScreen() {
  const [locations, setLocations] = useState<SavedLocationRow[]>([]);
  const [cardState, setCardState] = useState<Record<string, CardState>>({});
  const [loadingList, setLoadingList] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchCard = useCallback(async (row: SavedLocationRow) => {
    setCardState(prev => ({ ...prev, [row.id]: { status: 'loading' } }));
    try {
      const data = await fetchAirQualityByCity(row.query);
      setCardState(prev => ({ ...prev, [row.id]: { status: 'ready', data } }));
    } catch (err: any) {
      setCardState(prev => ({
        ...prev,
        [row.id]: {
          status: 'error',
          message:
            err?.message === 'CITY_NOT_FOUND'
              ? 'Không tìm thấy dữ liệu cho địa điểm này.'
              : err?.message ?? 'Không tải được dữ liệu.',
        },
      }));
    }
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const rows = await getSavedLocations();
      setLocations(rows);
      rows.forEach(fetchCard);
    } catch {
      // im lặng — danh sách rỗng vẫn hiện được trạng thái "chưa có địa điểm"
    }
  }, [fetchCard]);

  useFocusEffect(
    useCallback(() => {
      setLoadingList(true);
      loadAll().finally(() => setLoadingList(false));
    }, [loadAll]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  async function handleDelete(id: string) {
    const previous = locations;
    setLocations(prev => prev.filter(l => l.id !== id));
    try {
      await deleteSavedLocation(id);
    } catch {
      setLocations(previous);
    }
  }

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Khám phá</Text>
          <Text style={styles.pageSubtitle}>Chất lượng không khí ở nơi khác</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)} hitSlop={8}>
          <Plus size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loadingList ? (
        <LoadingBlock height={300} />
      ) : locations.length === 0 ? (
        <EmptyBlock
          icon={Globe}
          title="Chưa có địa điểm nào"
          description="Bấm nút + phía trên để thêm một thành phố/địa điểm muốn theo dõi."
          height={300}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {locations.map(loc => (
            <LocationCard
              key={loc.id}
              query={loc.displayName ?? loc.query}
              state={cardState[loc.id] ?? { status: 'loading' }}
              onDelete={() => handleDelete(loc.id)}
              onRetry={() => fetchCard(loc)}
            />
          ))}
        </ScrollView>
      )}

      <AddLocationModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={row => {
          setLocations(prev => [...prev, row]);
          fetchCard(row);
        }}
      />
    </Screen>
  );
}

function LocationCard({
  query,
  state,
  onDelete,
  onRetry,
}: {
  query: string;
  state: CardState;
  onDelete: () => void;
  onRetry: () => void;
}) {
  if (state.status === 'loading') {
    return (
      <View style={styles.card}>
        <LoadingBlock height={80} />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cityName} numberOfLines={1}>
            {query}
          </Text>
          <TouchableOpacity onPress={onDelete} hitSlop={8}>
            <Trash2 size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={onRetry}>
          <Text style={styles.errorText}>{state.message} Bấm để thử lại.</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { data } = state;
  const info = getAqiInfo(data.aqi);

  return (
    <View style={[styles.card, { borderColor: info.color + '40' }]}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cityRow}>
          <MapPin size={14} color={colors.textSecondary} />
          <Text style={styles.cityName} numberOfLines={1}>
            {data.cityName}
          </Text>
        </View>
        <TouchableOpacity onPress={onDelete} hitSlop={8}>
          <Trash2 size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <View style={styles.aqiRow}>
        <View style={[styles.aqiBadge, { backgroundColor: info.color }]}>
          <Text style={styles.aqiValue}>{data.aqi}</Text>
          <Text style={styles.aqiUnit}>AQI</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.category, { color: info.color }]}>{info.label}</Text>
          <Text style={styles.desc} numberOfLines={2}>
            {info.desc}
          </Text>
        </View>
      </View>

      {data.dominantPollutant && (
        <Text style={styles.pollutant}>
          Ô nhiễm chính:{' '}
          <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
            {POLLUTANT_LABELS[data.dominantPollutant] ?? data.dominantPollutant.toUpperCase()}
          </Text>
        </Text>
      )}

      {(data.temperature !== null || data.humidity !== null || data.windSpeed !== null) && (
        <View style={styles.weatherRow}>
          {data.temperature !== null && (
            <WeatherChip icon={Thermometer} text={`${data.temperature}°C`} />
          )}
          {data.humidity !== null && <WeatherChip icon={Droplets} text={`${data.humidity}%`} />}
          {data.windSpeed !== null && <WeatherChip icon={Wind} text={`${data.windSpeed} m/s`} />}
        </View>
      )}
    </View>
  );
}

function WeatherChip({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.weatherChip}>
      <Icon size={13} color={colors.textSecondary} />
      <Text style={styles.weatherText}>{text}</Text>
    </View>
  );
}

function AddLocationModal({
  visible,
  onClose,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  onAdded: (row: SavedLocationRow) => void;
}) {
  const [keyword, setKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<StationSearchResult[] | null>(null);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  React.useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    });
    return () => sub.remove();
  }, []);

  function handleClose() {
    onClose();
    setTimeout(() => {
      setKeyword('');
      setError(null);
      setResults(null);
    }, 250);
  }

  async function handleSearch() {
    if (!keyword.trim()) return;
    Keyboard.dismiss();
    setSearching(true);
    setError(null);
    setResults(null);
    try {
      const stations = await searchStations(keyword);
      if (stations.length === 0) {
        setError('Không tìm thấy trạm nào khớp với từ khoá này. Thử từ khoá khác (tiếng Anh).');
      }
      setResults(stations);
    } catch (err: any) {
      setError(err?.message ?? 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setSearching(false);
    }
  }

  async function handleSelect(station: StationSearchResult) {
    setAdding(true);
    setError(null);
    try {
      const row = await addSavedLocation(`@${station.uid}`, station.name);
      onAdded(row);
      handleClose();
    } catch (err: any) {
      setError(err?.message ?? 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setAdding(false);
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
            <Text style={styles.sheetTitle}>Thêm địa điểm</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={8}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <Text style={styles.sheetDesc}>
              Nhập tên khu vực (nên gõ tiếng Anh, ví dụ "Ho Chi Minh", "Hanoi", "Tokyo"), sau đó
              chọn đúng trạm đo bạn muốn theo dõi trong danh sách kết quả — một khu vực có thể có
              nhiều trạm khác nhau.
            </Text>
            <Field
              label="Tìm kiếm khu vực / trạm đo"
              placeholder="Ví dụ: Ho Chi Minh"
              value={keyword}
              onChangeText={setKeyword}
              autoCapitalize="words"
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <PrimaryButton onPress={handleSearch} loading={searching} disabled={!keyword.trim()}>
              Tìm kiếm
            </PrimaryButton>

            {error && <Text style={styles.errorText}>{error}</Text>}

            {results && results.length > 0 && (
              <View style={styles.resultsList}>
                {results.map(station => {
                  const info = station.aqiPreview !== null ? getAqiInfo(station.aqiPreview) : null;
                  return (
                    <TouchableOpacity
                      key={station.uid}
                      style={styles.resultRow}
                      onPress={() => handleSelect(station)}
                      disabled={adding}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultName}>{station.name}</Text>
                        <Text style={styles.resultUid}>Mã trạm: {station.uid}</Text>
                      </View>
                      {info && (
                        <View style={[styles.resultAqiBadge, { backgroundColor: info.color }]}>
                          <Text style={styles.resultAqiText}>{station.aqiPreview}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  pageTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  pageSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  cityName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  errorText: { fontSize: 12, color: colors.danger, marginTop: 4 },
  aqiRow: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 10 },
  aqiBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aqiValue: { fontSize: 22, fontWeight: '700', color: '#fff' },
  aqiUnit: { fontSize: 10, fontWeight: '600', color: '#fff', opacity: 0.9 },
  category: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  desc: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  pollutant: { fontSize: 12, color: colors.textSecondary, marginBottom: 10 },
  weatherRow: { flexDirection: 'row', gap: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  weatherChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  weatherText: { fontSize: 12, color: colors.textSecondary },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  sheetDesc: { fontSize: 13, color: colors.textSecondary, marginBottom: 16, lineHeight: 19 },
  resultsList: { marginTop: 16, gap: 8 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
  },
  resultName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  resultUid: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  resultAqiBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  resultAqiText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
