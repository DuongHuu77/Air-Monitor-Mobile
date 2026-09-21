import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Linking } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

/** Đường link riêng của app — phải được thêm vào "Redirect URLs" trong
 * Supabase Dashboard (Authentication > URL Configuration), nếu không
 * Supabase sẽ từ chối và quay về Site URL mặc định (localhost:3000). */
export const RESET_PASSWORD_DEEP_LINK = 'airguard://reset-password';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  /** true khi app vừa được mở từ link "quên mật khẩu" trong email — lúc này
   * cần hiện màn hình đặt mật khẩu mới thay vì vào thẳng app như đăng nhập
   * bình thường, dù Supabase đã tạo 1 session tạm cho việc này. */
  isPasswordRecovery: boolean;
  recoveryError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  cancelPasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Trích các tham số từ URL dạng "...#key=value&key2=value2" hoặc
 * "...?key=value&key2=value2" — link Supabase gửi về thường dùng dấu #. */
function parseUrlParams(url: string): Record<string, string> {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const start = hashIndex >= 0 ? hashIndex + 1 : queryIndex >= 0 ? queryIndex + 1 : -1;
  const params: Record<string, string> = {};
  if (start === -1) return params;
  for (const pair of url.slice(start).split('&')) {
    const [key, value] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(value ?? '');
  }
  return params;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Bắt link "quên mật khẩu" mở app (deep link airguard://reset-password),
  // cả khi app đang mở sẵn lẫn khi app được mở lần đầu TỪ link đó.
  useEffect(() => {
    function handleUrl(url: string | null | undefined) {
      if (!url || !url.startsWith(RESET_PASSWORD_DEEP_LINK)) return;
      const params = parseUrlParams(url);

      if (params.error) {
        setRecoveryError(
          params.error_code === 'otp_expired'
            ? 'Liên kết đặt lại mật khẩu đã hết hạn hoặc đã được dùng. Vui lòng yêu cầu gửi lại email mới.'
            : params.error_description?.replace(/\+/g, ' ') ?? 'Liên kết không hợp lệ.',
        );
        setIsPasswordRecovery(true);
        return;
      }

      if (params.access_token && params.refresh_token) {
        setRecoveryError(null);
        supabase.auth
          .setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          })
          .then(({ error }) => {
            if (error) {
              setRecoveryError(mapAuthError(error.message));
            }
            setIsPasswordRecovery(true);
          });
      }
    }

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      isPasswordRecovery,
      recoveryError,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        return { error: error ? mapAuthError(error.message) : null };
      },
      async signUp(name, email, password) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
          },
        });
        if (error) return { error: mapAuthError(error.message) };
        // Trigger `handle_new_user` trong schema.sql sẽ tự tạo dòng trong bảng
        // `profiles` khi có user mới — xem supabase/schema.sql.
        if (data.session === null) {
          return {
            error:
              'Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản trước khi đăng nhập.',
          };
        }
        return { error: null };
      },
      async signOut() {
        await supabase.auth.signOut();
      },
      async resetPassword(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: RESET_PASSWORD_DEEP_LINK,
        });
        return { error: error ? mapAuthError(error.message) : null };
      },
      async updatePassword(newPassword) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) return { error: mapAuthError(error.message) };
        setIsPasswordRecovery(false);
        setRecoveryError(null);
        return { error: null };
      },
      cancelPasswordRecovery() {
        setIsPasswordRecovery(false);
        setRecoveryError(null);
        supabase.auth.signOut();
      },
    }),
    [session, loading, isPasswordRecovery, recoveryError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải được dùng bên trong <AuthProvider>');
  return ctx;
}

function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return 'Email hoặc mật khẩu không chính xác.';
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'Email này đã được đăng ký. Vui lòng đăng nhập.';
  }
  if (m.includes('password should be at least')) {
    return 'Mật khẩu quá ngắn (Supabase yêu cầu tối thiểu 6 ký tự).';
  }
  if (m.includes('network')) {
    return 'Không thể kết nối đến máy chủ. Kiểm tra kết nối mạng hoặc cấu hình Supabase.';
  }
  return message;
}
