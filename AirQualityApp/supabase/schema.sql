-- ============================================================================
-- AirGuard — Supabase schema
-- ============================================================================
-- CÁCH DÙNG:
-- 1. Mở project Supabase của bạn -> SQL Editor -> New query.
-- 2. Dán TOÀN BỘ nội dung file này -> Run.
-- 3. (Tuỳ chọn) Chạy phần "SEED DỮ LIỆU MẪU" ở cuối file để có dữ liệu test.
-- An toàn khi chạy lại nhiều lần nhờ "if not exists" / "or replace".
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PROFILES — thông tin mở rộng của user (tên hiển thị)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Tự động tạo dòng profiles + tên khi có user đăng ký mới
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. DEVICES — thiết bị ESP32 của người dùng
-- ---------------------------------------------------------------------------
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Nhà của bạn',
  device_code text not null unique,
  location text,
  firmware_version text,
  status text not null default 'offline' check (status in ('online', 'offline', 'unknown')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.devices enable row level security;

drop policy if exists "devices_all_own" on public.devices;
create policy "devices_all_own" on public.devices
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- 3. AIR_QUALITY_READINGS — dữ liệu đo được từ cảm biến
-- ---------------------------------------------------------------------------
create table if not exists public.air_quality_readings (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  temperature numeric,
  humidity numeric,
  pm25 numeric,
  co numeric,
  aqi integer
);

create index if not exists idx_readings_device_time
  on public.air_quality_readings (device_id, recorded_at desc);

alter table public.air_quality_readings enable row level security;

drop policy if exists "readings_select_own_device" on public.air_quality_readings;
create policy "readings_select_own_device" on public.air_quality_readings
  for select using (
    exists (select 1 from public.devices d where d.id = device_id and d.owner_id = auth.uid())
  );

drop policy if exists "readings_insert_own_device" on public.air_quality_readings;
create policy "readings_insert_own_device" on public.air_quality_readings
  for insert with check (
    exists (select 1 from public.devices d where d.id = device_id and d.owner_id = auth.uid())
  );
-- LƯU Ý CHO GIAI ĐOẠN NỐI ESP32 (phần cứng, làm sau):
-- ESP32 thường KHÔNG đăng nhập bằng tài khoản người dùng, nên policy insert ở
-- trên (yêu cầu auth.uid()) sẽ KHÔNG áp dụng được cho request từ ESP32.
-- Khi làm phần cứng, cách phổ biến nhất là viết một Supabase Edge Function
-- (dùng service_role key ở phía server) để ESP32 gọi vào, thay vì để ESP32
-- gọi thẳng vào bảng này bằng anon key.

-- ---------------------------------------------------------------------------
-- 4. AIR_QUALITY_FORECASTS — dự báo AQI theo giờ
-- ---------------------------------------------------------------------------
create table if not exists public.air_quality_forecasts (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices (id) on delete cascade,
  forecast_for timestamptz not null,
  aqi integer not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_forecasts_device_time
  on public.air_quality_forecasts (device_id, forecast_for);

alter table public.air_quality_forecasts enable row level security;

drop policy if exists "forecasts_all_own_device" on public.air_quality_forecasts;
create policy "forecasts_all_own_device" on public.air_quality_forecasts
  for all using (
    exists (select 1 from public.devices d where d.id = device_id and d.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.devices d where d.id = device_id and d.owner_id = auth.uid())
  );
-- Dự báo cần một pipeline riêng (model dự báo / cron job) để tự động điền —
-- xem mục 49 trong tài liệu đặc tả gốc ("AQI prediction pipeline" chưa chốt).

-- ---------------------------------------------------------------------------
-- 5. NOTIFICATIONS
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id uuid references public.devices (id) on delete set null,
  type text not null check (type in ('warning', 'forecast', 'normal', 'improvement')),
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_time
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_all_own" on public.notifications;
create policy "notifications_all_own" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. ALERT_THRESHOLDS — ngưỡng cảnh báo tuỳ chỉnh theo user
-- ---------------------------------------------------------------------------
create table if not exists public.alert_thresholds (
  user_id uuid primary key references auth.users (id) on delete cascade,
  aqi_threshold integer not null default 100,
  pm25_threshold numeric not null default 50,
  co_threshold numeric not null default 0.3,
  updated_at timestamptz not null default now()
);

alter table public.alert_thresholds enable row level security;

drop policy if exists "thresholds_all_own" on public.alert_thresholds;
create policy "thresholds_all_own" on public.alert_thresholds
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 7. NOTIFICATION_SETTINGS
-- ---------------------------------------------------------------------------
create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  aqi_alert boolean not null default true,
  co_alert boolean not null default true,
  pm25_alert boolean not null default true,
  forecast_alert boolean not null default true,
  improvement_alert boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

drop policy if exists "notif_settings_all_own" on public.notification_settings;
create policy "notif_settings_all_own" on public.notification_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);



-- ============================================================================
-- MIGRATION — "Kết nối thiết bị mới" + trạng thái online theo heartbeat
-- ============================================================================
-- Chạy khối lệnh này nếu bạn ĐÃ chạy phần schema ở trên từ trước (an toàn để
-- chạy lại nhiều lần). Nếu là project Supabase hoàn toàn mới, chạy nguyên cả
-- file này 1 lượt là đủ, không cần chạy riêng khối bên dưới.

-- Cho phép thiết bị tồn tại nhưng CHƯA thuộc về ai (chờ người dùng "kết nối"
-- bằng mã thiết bị). Trước đây owner_id bắt buộc phải có ngay khi tạo.
alter table public.devices alter column owner_id drop not null;

-- RPC: người dùng nhập mã thiết bị + tên + vị trí -> bấm "Kết nối".
-- Hàm này chạy với quyền nâng cao (security definer) để có thể tìm thiết bị
-- CHƯA có chủ (owner_id is null) mà user bình thường không có quyền SELECT
-- tới (RLS chặn), rồi gán thiết bị đó cho user đang đăng nhập.
-- Trả lỗi 'DEVICE_NOT_FOUND' nếu không tìm thấy mã thiết bị, hoặc mã đó đã
-- được người khác kết nối trước rồi.
create or replace function public.claim_device(
  p_device_code text,
  p_name text,
  p_location text
)
returns public.devices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.devices;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_device
  from public.devices
  where device_code = p_device_code and owner_id is null
  for update;

  if not found then
    raise exception 'DEVICE_NOT_FOUND';
  end if;

  update public.devices
  set owner_id = auth.uid(),
      name = p_name,
      location = p_location,
      status = 'online',
      last_seen_at = now()
  where id = v_device.id
  returning * into v_device;

  return v_device;
end;
$$;

grant execute on function public.claim_device(text, text, text) to authenticated;

-- RPC: ESP32 gọi định kỳ (ví dụ mỗi 30–60 giây) để báo "tôi vẫn còn sống".
-- Dùng anon key là gọi được (không cần đăng nhập), vì bản thân thiết bị
-- phần cứng không có tài khoản Supabase. App sẽ tự suy ra online/offline dựa
-- vào việc last_seen_at có mới (gần đây) hay không, KHÔNG dựa vào cột status
-- được set thủ công.
create or replace function public.device_heartbeat(p_device_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.devices
  set last_seen_at = now()
  where device_code = p_device_code;
end;
$$;

grant execute on function public.device_heartbeat(text) to anon, authenticated;


-- ============================================================================
-- SEED DỮ LIỆU MẪU (TUỲ CHỌN — chỉ để xem thử giao diện có dữ liệu)
-- ============================================================================
-- Cách lấy USER_ID của bạn:
--   1. Đăng ký một tài khoản trong app (hoặc Supabase Dashboard -> Authentication -> Users).
--   2. Copy cột "UID" của user đó.
--   3. Thay 'PASTE-YOUR-USER-UUID-HERE' bên dưới bằng UID vừa copy.
--   4. Bỏ ký tự `--` ở đầu mỗi dòng trong khối lệnh dưới rồi chạy lại.
--
 do $$
 declare
   v_user_id uuid := '777673d3-69ac-461c-a8fe-c4164800ee50';
   v_device_id uuid;
 begin
   insert into public.devices (owner_id, name, device_code, location, firmware_version, status, last_seen_at)
   values (v_user_id, 'Nhà của bạn', 'ESP32-AQ-001', 'Phòng khách', 'v1.4.2', 'online', now())
   returning id into v_device_id;

  insert into public.air_quality_readings (device_id, recorded_at, temperature, humidity, pm25, co, aqi)
   values (v_device_id, now(), 28.5, 72, 35, 0.12, 72);

   insert into public.air_quality_forecasts (device_id, forecast_for, aqi)
   select v_device_id, now() + (n || ' hours')::interval, 40 + (n * 8)
   from generate_series(1, 8) as n;

   insert into public.notifications (user_id, device_id, type, title, message, is_read)
   values
     (v_user_id, v_device_id, 'warning', 'Cảnh báo: PM2.5 cao', 'Nồng độ PM2.5 đã vượt ngưỡng an toàn.', false),
     (v_user_id, v_device_id, 'normal', 'Chất lượng không khí bình thường', 'Chất lượng không khí hiện tại ở mức tốt.', false);

   insert into public.alert_thresholds (user_id) values (v_user_id) on conflict do nothing;
   insert into public.notification_settings (user_id) values (v_user_id) on conflict do nothing;
 end $$;
