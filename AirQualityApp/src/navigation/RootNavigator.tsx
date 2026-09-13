import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabs } from './MainTabs';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { AccountInfoScreen } from '../screens/AccountInfoScreen';
import { MyDevicesScreen } from '../screens/MyDevicesScreen';
import { AlertThresholdsScreen } from '../screens/AlertThresholdsScreen';
import { NotificationSettingsScreen } from '../screens/NotificationSettingsScreen';
import { LanguageScreen } from '../screens/LanguageScreen';
import { AboutScreen } from '../screens/AboutScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="AccountInfo" component={AccountInfoScreen} />
      <Stack.Screen name="MyDevices" component={MyDevicesScreen} />
      <Stack.Screen name="AlertThresholds" component={AlertThresholdsScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="Language" component={LanguageScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
    </Stack.Navigator>
  );
}
