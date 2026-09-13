import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

interface ScreenProps {
  children: React.ReactNode;
  edges?: Edge[];
  style?: ViewStyle;
}

/**
 * Từ Android 15 trở đi, app mặc định vẽ "edge-to-edge" (nội dung tràn ra sau
 * status bar / thanh điều hướng cử chỉ) — xem android/gradle.properties có
 * `edgeToEdgeEnabled=true`. Vì vậy MỌI màn hình không dùng header gốc của
 * react-navigation (chúng ta đã tắt headerShown) cần tự chèn khoảng đệm an
 * toàn bằng SafeAreaView của react-native-safe-area-context.
 * Tab bar dưới cùng (bottom-tabs) đã tự lo phần đáy, nên các màn hình nằm
 * trong tab chỉ cần edges={['top']}; màn hình được push (Notifications, các
 * màn Profile con, Login/SignUp) cần cả hai: edges={['top','bottom']}.
 */
export function Screen({ children, edges = ['top', 'bottom'], style }: ScreenProps) {
  return (
    <SafeAreaView style={[styles.container, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
