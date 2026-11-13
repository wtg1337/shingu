-- ==============================================================================
-- 신구길 (Shingu-Gil) Supabase 전체 스키마 DDL
-- Supabase SQL Editor에서 이 스크립트를 전체 실행(Run)하세요.
-- ==============================================================================

-- 1. 사용자 프로필 테이블 (Profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '신구인',
  phone TEXT DEFAULT '010-0000-0000',
  gender TEXT DEFAULT '선택 안 함',
  role TEXT DEFAULT 'rider', -- 'rider' | 'driver'
  manner_rating NUMERIC(2,1) DEFAULT 4.9,
  mileage INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 신규 유저 가입 시 자동으로 profiles 레코드를 생성하는 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, phone, gender, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'phone', '010-0000-0000'),
    COALESCE(NEW.raw_user_meta_data->>'gender', '선택 안 함'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'rider')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. 사용자 통학/통근 경로 테이블 (Routes)
CREATE TABLE IF NOT EXISTS public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'rider', -- 'rider' | 'driver'
  start_point TEXT NOT NULL,
  destination TEXT NOT NULL,
  waypoint TEXT DEFAULT '',
  pickup TEXT DEFAULT '',
  weekdays TEXT[] DEFAULT ARRAY['월','화','수','목','금'],
  departure_time TEXT NOT NULL DEFAULT '08:10',
  preferred_arrival TEXT NOT NULL DEFAULT '09:00',
  smoking_preference TEXT DEFAULT '비흡연자 선호',
  gender_preference TEXT DEFAULT '성별 무관',
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_role_route UNIQUE (user_id, role)
);

-- 3. 카풀 운행 등록 테이블 (Rides)
CREATE TABLE IF NOT EXISTS public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  driver_name TEXT NOT NULL,
  car_info TEXT NOT NULL,
  start_point TEXT NOT NULL,
  destination TEXT NOT NULL,
  waypoints TEXT DEFAULT '',
  date TEXT NOT NULL,
  departure_time TEXT NOT NULL,
  estimated_duration INT DEFAULT 25,
  arrival_time TEXT NOT NULL,
  seats INT NOT NULL DEFAULT 1,
  total_seats INT NOT NULL DEFAULT 3,
  price INT NOT NULL DEFAULT 2800,
  match_rate INT DEFAULT 90,
  rating NUMERIC(2,1) DEFAULT 4.9,
  reviews_count INT DEFAULT 10,
  smoking_preference TEXT DEFAULT '비흡연자 선호',
  gender_preference TEXT DEFAULT '성별 무관',
  note TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT '모집 중', -- '모집 중' | '운행 중' | '정산 대기' | '완료' | '취소'
  settlement_status TEXT NOT NULL DEFAULT '정산 전', -- '정산 전' | '정산 대기' | '정산 완료'
  ended_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. 카풀 탑승 신청 테이블 (Carpool Applications)
CREATE TABLE IF NOT EXISTS public.carpool_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  rider_name TEXT NOT NULL,
  driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT '승인 대기', -- '승인 대기' | '승인 완료' | '거절 완료' | '취소 완료'
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. 포인트 지갑 및 충전 내역 테이블 (Points)
CREATE TABLE IF NOT EXISTS public.point_wallets (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.point_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  payment_method TEXT NOT NULL,
  balance_after INT NOT NULL,
  status TEXT NOT NULL DEFAULT '충전 완료',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. 카풀 후기 테이블 (Reviews)
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  target_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rating NUMERIC(2,1) NOT NULL DEFAULT 5.0,
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. 안전 신고 테이블 (Safety Reports)
CREATE TABLE IF NOT EXISTS public.safety_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL,
  target_name TEXT NOT NULL,
  target_role TEXT NOT NULL,
  ride_label TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT NOT NULL,
  images TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT '검토 중', -- '검토 중' | '처리 완료'
  response TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. 차단된 사용자 목록 (Blocked Users)
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_user_id TEXT NOT NULL,
  blocked_user_name TEXT NOT NULL,
  blocked_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. 실시간 채팅 메시지 (Chat Messages)
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- RLS (Row Level Security) 설정
-- 편리한 개발 및 테스트를 위해 anon/authenticated 사용자 모두에게 읽기/쓰기 허용 정책 부여
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carpool_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE
  t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Public full access policy" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Public full access policy" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- ==============================================================================
-- 실시간(Realtime) 구독 활성화
-- ==============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.carpool_applications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
