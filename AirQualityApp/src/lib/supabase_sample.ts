import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';

/**
 * ============================================================================
 * ⚠️  CẦN BẠN ĐIỀN THÔNG TIN Ở ĐÂY (bắt buộc để app chạy được) ⚠️
 * ============================================================================
 * 1. Vào https://supabase.com -> tạo project mới (hoặc dùng project có sẵn).
 * 2. Vào Project Settings -> Data API (hoặc "API" ở bản cũ hơn).
 * 3. Copy "Project URL" và dán vào SUPABASE_URL bên dưới.
 * 4. Copy khóa "anon public" (một số bản Supabase mới gọi là "publishable key",
 *    dạng bắt đầu bằng "sb_publishable_..." hoặc chuỗi JWT dài) và dán vào
 *    SUPABASE_ANON_KEY.
 *
 * LƯU Ý AN TOÀN: đây là khóa "anon/public" - được thiết kế để nhúng trong app
 * di động, không phải bí mật. TUYỆT ĐỐI không dùng "service_role key" ở đây.
 * Việc bảo mật dữ liệu thực sự nằm ở Row Level Security (RLS) đã được bật sẵn
 * trong file supabase/schema.sql.
 * ============================================================================
 */
const SUPABASE_URL = 'YOUR-PROJECT-URL'; // TODO: thay bằng URL thật
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY'; // TODO: thay bằng anon key thật

if (SUPABASE_URL.includes('YOUR-PROJECT-REF')) {
  console.warn(
    '[AirGuard] Bạn chưa cấu hình Supabase trong src/lib/supabase.ts — ' +
      'đăng nhập / dữ liệu sẽ không hoạt động cho tới khi bạn điền URL & anon key thật.',
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

// Supabase khuyến nghị: tự động refresh token khi app ở foreground,
// dừng lại khi app xuống background để tiết kiệm pin/mạng.
AppState.addEventListener('change', state => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
