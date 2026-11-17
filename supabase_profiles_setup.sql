-- ==============================================================================
-- 신구길 (Shingu-Gil) Supabase 사용자 프로필 및 실시간 동기화 설정 SQL
-- Supabase Dashboard > SQL Editor에 복사하여 실행하세요.
-- ==============================================================================

-- 1. profiles 테이블 생성
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  gender TEXT DEFAULT '선택 안 함',
  role TEXT NOT NULL DEFAULT 'rider' CHECK (role IN ('rider', 'driver')),
  is_driver_verified BOOLEAN DEFAULT FALSE,
  license_file_name TEXT DEFAULT '',
  vehicle_name TEXT DEFAULT '',
  vehicle_capacity INT DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. profiles 테이블 RLS (행 수준 보안) 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2-1. 모든 인증된 사용자/공개 사용자가 프로필을 조회할 수 있도록 허용 (카풀 매칭 및 프로필 카드 조회용)
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- 비로그인 사용자도 공개 프로필 읽기 가능하도록 허용 (필요 시)
CREATE POLICY "Profiles are viewable by public"
  ON public.profiles
  FOR SELECT
  TO anon
  USING (true);

-- 2-2. 본인의 프로필만 수정 가능
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2-3. 본인의 프로필 생성 가능 (클라이언트 레벨 폴백용)
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 3. 신규 가입 시 auth.users -> public.profiles 자동 동기화 트리거 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    name,
    phone,
    gender,
    role,
    is_driver_verified,
    license_file_name,
    vehicle_name,
    vehicle_capacity,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    COALESCE(new.email, ''),
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), '사용자'),
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    COALESCE(new.raw_user_meta_data->>'gender', '선택 안 함'),
    COALESCE(new.raw_user_meta_data->>'role', 'rider'),
    COALESCE((new.raw_user_meta_data->>'isDriverVerified')::boolean, false),
    COALESCE(new.raw_user_meta_data->>'licenseFileName', ''),
    COALESCE(new.raw_user_meta_data->>'vehicleName', ''),
    COALESCE((new.raw_user_meta_data->>'vehicleCapacity')::int, 5),
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = CASE WHEN EXCLUDED.name <> '' THEN EXCLUDED.name ELSE profiles.name END,
    phone = CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE profiles.phone END,
    role = EXCLUDED.role,
    is_driver_verified = EXCLUDED.is_driver_verified,
    updated_at = timezone('utc'::text, now());

  RETURN new;
END;
$$;

-- 3-1. 기존 트리거 제거 후 재등록 (안전성 보장)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Supabase Realtime (실시간 동기화) 활성화
-- profiles 테이블 변경 시 클라이언트에 WebSocket 이벤트 전송
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
