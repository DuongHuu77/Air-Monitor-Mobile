import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { SplashScreen } from '../screens/SplashScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';
import { AuthNavigator } from './AuthNavigator';
import { RootNavigator } from './RootNavigator';

export function AppNavigator() {
  const { session, loading, isPasswordRecovery } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      {isPasswordRecovery ? (
        // Ưu tiên cao nhất: dù Supabase đã tạo session tạm cho việc đổi mật
        // khẩu, vẫn phải hiện màn hình này thay vì vào thẳng app như đăng
        // nhập bình thường.
        <ResetPasswordScreen />
      ) : session ? (
        <RootNavigator />
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}
