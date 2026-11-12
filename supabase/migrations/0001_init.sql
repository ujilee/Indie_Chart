-- ============================================================================
-- INDIE CHART 0001: 운영 DB 기본 구조
--
-- 실행 위치: Supabase SQL Editor (또는 supabase db push)
-- 이 파일은 테이블·관계·RLS·트리거만 만든다. 데이터는 넣지 않는다 (데모 데이터 없음).
-- 기존 테이블을 지우거나 바꾸지 않는다. (예전 indie_state / indie_meta 는 그대로 둔다)
--
-- 접근 원칙
--   · 방문자(anon): 공개 정보만 읽기 (활성 아티스트, 승인 공연, 차트, TOP 3, 공개 수치)
--   · 회원(authenticated): 자기 프로필·응원·제보만 읽고, 응원·제보를 남길 수 있다
--   · 관리자(profiles.role = 'admin'): 관리 테이블 읽기·쓰기. 모든 변경은 admin_audit_log에 자동 기록
--   · 서버 예약 수집(service_role): RLS를 거치지 않는다. 비밀 키는 서버에만 둔다
-- 날짜는 모두 한국 시간(Asia/Seoul) 기준 date로 저장한다.
-- ============================================================================

-- 한국 날짜
create or replace function public.kst_today()
returns date
language sql
stable
as $$ select (now() at time zone 'Asia/Seoul')::date $$;

-- updated_at 자동 갱신
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 회원 프로필 (로그인 정보는 Supabase Auth의 auth.users, 여기에는 공개 가능한 정보와 권한만)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nickname   text not null unique check (nickname ~ '^[가-힣A-Za-z0-9_]{2,12}$'),
  role       text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- 관리자 여부 (RLS 정책에서 사용)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- 가입하면 프로필 생성 (닉네임은 가입 때 user_metadata.nickname 으로 받는다)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'nickname', ''), 'user_' || substr(replace(new.id::text, '-', ''), 1, 6)));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 회원은 자기 role을 바꿀 수 없다 (관리자 지정은 관리자 또는 SQL로만)
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception '권한을 바꿀 수 없어요.';
  end if;
  return new;
end;
$$;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ----------------------------------------------------------------------------
-- 아티스트
-- ----------------------------------------------------------------------------
create table public.artists (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (length(trim(name)) > 0),
  name_en           text not null default '',
  genre             text not null default '',
  -- active: 차트 대상 / excluded: 차트 제외(숨김)
  status            text not null default 'active' check (status in ('active', 'excluded')),
  melon_id          text unique check (melon_id ~ '^[0-9]+$'),
  spotify_id        text unique check (spotify_id ~ '^[A-Za-z0-9]{22}$'),
  youtube           text,
  apple_music_id    text,
  image_url         text,
  -- spotify: 자동으로 가져온 이미지 / manual: 관리자가 직접 넣은 이미지(자동 갱신 안 함)
  image_source      text check (image_source in ('spotify', 'manual')),
  image_updated_at  timestamptz,
  -- 최초 수치가 들어오기 전에는 차트 산정에서 보류
  collected         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index artists_status_idx on public.artists (status);
create trigger artists_touch before update on public.artists
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 공연 (관리자 등록 또는 회원 제보)
-- ----------------------------------------------------------------------------
create table public.concerts (
  id            uuid primary key default gen_random_uuid(),
  artist_id     uuid not null references public.artists (id) on delete cascade,
  title         text not null check (length(trim(title)) > 0),
  date          date not null,
  time          time,
  venue         text not null,
  address       text,
  url           text not null check (url ~* '^https?://'),
  description   text,
  poster_url    text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'canceled')),
  source        text not null check (source in ('admin', 'report')),
  reporter_id   uuid references public.profiles (id) on delete set null,
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  reject_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index concerts_artist_date_idx on public.concerts (artist_id, date);
create index concerts_status_idx on public.concerts (status);
create trigger concerts_touch before update on public.concerts
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 아티스트 제보
-- ----------------------------------------------------------------------------
create table public.artist_reports (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (length(trim(name)) > 0),
  spotify_id         text not null check (spotify_id ~ '^[A-Za-z0-9]{22}$'),
  melon_id           text check (melon_id ~ '^[0-9]+$'),
  youtube            text,
  apple_music_id     text,
  status             text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reporter_id        uuid references public.profiles (id) on delete set null,
  -- 승인으로 만들어진(또는 연결된) 아티스트
  approved_artist_id uuid references public.artists (id) on delete set null,
  reviewed_by        uuid references public.profiles (id) on delete set null,
  reviewed_at        timestamptz,
  reject_reason      text,
  created_at         timestamptz not null default now()
);
create index artist_reports_status_idx on public.artist_reports (status, created_at desc);

-- ----------------------------------------------------------------------------
-- 응원 (1인 하루 1회, 한국 날짜 기준)
-- ----------------------------------------------------------------------------
create table public.cheers (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  artist_id      uuid not null references public.artists (id) on delete cascade,
  cheer_date     date not null default public.kst_today(),
  created_at     timestamptz not null default now(),
  valid          boolean not null default true,
  -- 부정 응원 의심 사유 (자동 탐지 또는 관리자 표시)
  flag           text,
  invalidated_at timestamptz,
  invalidated_by uuid references public.profiles (id) on delete set null,
  unique (user_id, cheer_date)
);
create index cheers_artist_date_idx on public.cheers (artist_id, cheer_date) where valid;
create index cheers_date_idx on public.cheers (cheer_date);

-- 회원이 응원을 남길 때 날짜·유효 여부를 서버 값으로 고정 (조작 방지)
create or replace function public.guard_cheer_insert()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() then
    new.cheer_date := public.kst_today();
    new.valid := true;
    new.flag := null;
    new.invalidated_at := null;
    new.invalidated_by := null;
  end if;
  return new;
end;
$$;
create trigger cheers_guard_insert before insert on public.cheers
  for each row execute function public.guard_cheer_insert();

-- 차트 대상(활성) 아티스트에게만 응원할 수 있다
create or replace function public.check_cheer_artist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.artists where id = new.artist_id and status = 'active') then
    raise exception '응원할 수 없는 아티스트예요.';
  end if;
  return new;
end;
$$;
create trigger cheers_check_artist before insert on public.cheers
  for each row execute function public.check_cheer_artist();

-- 공개 집계: 기간 내 유효 응원 수 (개별 응원 기록은 공개하지 않는다)
create or replace function public.cheer_counts(from_date date, to_date date)
returns table (artist_id uuid, cheer_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.artist_id, count(*)
  from public.cheers c
  join public.artists a on a.id = c.artist_id and a.status = 'active'
  where c.valid and c.cheer_date between from_date and to_date
  group by c.artist_id
$$;

-- ----------------------------------------------------------------------------
-- 아티스트 수치 (관리자 입력·CSV·공식 API)
-- ----------------------------------------------------------------------------
create table public.metric_snapshots (
  artist_id                 uuid not null references public.artists (id) on delete cascade,
  date                      date not null,
  melon_fans                bigint check (melon_fans >= 0),
  melon_likes               bigint check (melon_likes >= 0),
  spotify_followers         bigint check (spotify_followers >= 0),
  spotify_monthly_listeners bigint check (spotify_monthly_listeners >= 0),
  source                    text not null check (source in ('manual', 'csv', 'api', 'auto')),
  updated_by                uuid references public.profiles (id) on delete set null,
  updated_at                timestamptz not null default now(),
  primary key (artist_id, date),
  check (coalesce(melon_fans, melon_likes, spotify_followers, spotify_monthly_listeners) is not null)
);
create index metric_snapshots_date_idx on public.metric_snapshots (date);
create trigger metric_snapshots_touch before update on public.metric_snapshots
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 멜론 인디 일간 차트 (관리자 입력 또는 수집)
-- ----------------------------------------------------------------------------
create table public.melon_charts (
  chart_date   date primary key,
  collected_at timestamptz not null default now(),
  source       text not null default 'manual' check (source in ('manual', 'auto'))
);

create table public.melon_chart_entries (
  chart_date       date not null references public.melon_charts (chart_date) on delete cascade,
  rank             int not null check (rank between 1 and 100),
  song_id          text not null,
  title            text not null,
  -- 곡에 참여한 아티스트의 멜론 ID / 이름 (등록되지 않은 아티스트도 포함)
  artist_melon_ids text[] not null default '{}',
  artist_names     text[] not null default '{}',
  primary key (chart_date, rank)
);
create index melon_chart_entries_artists_idx on public.melon_chart_entries using gin (artist_melon_ids);

-- ----------------------------------------------------------------------------
-- 수집·입력 이력
-- ----------------------------------------------------------------------------
create table public.collection_runs (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('melon-chart', 'artist-metrics', 'spotify', 'csv-import', 'manual-input')),
  run_date     date not null default public.kst_today(),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running' check (status in ('running', 'success', 'partial', 'failed')),
  artist_count int not null default 0,
  manual       boolean not null default false,
  note         text,
  error        text,
  triggered_by uuid references public.profiles (id) on delete set null
);
create index collection_runs_started_idx on public.collection_runs (started_at desc);

create table public.collection_failures (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references public.collection_runs (id) on delete cascade,
  artist_id   uuid references public.artists (id) on delete cascade,
  platform    text not null check (platform in ('melon', 'spotify')),
  reason      text not null,
  resolved    boolean not null default false,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz
);
create index collection_failures_open_idx on public.collection_failures (run_id) where not resolved;

-- ----------------------------------------------------------------------------
-- 점수 기준 (기간별 만점 기준 증가량) + 변경 이력
-- ----------------------------------------------------------------------------
create table public.score_basis (
  period     text primary key check (period in ('daily', 'weekly', 'monthly', 'yearly')),
  likes      numeric not null check (likes > 0),
  fans       numeric not null check (fans > 0),
  followers  numeric not null check (followers > 0),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger score_basis_touch before update on public.score_basis
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 차트 결과 (계산한 순위를 기간별로 저장. finalized = 확정되어 바뀌지 않음)
-- ----------------------------------------------------------------------------
create table public.chart_results (
  period       text not null check (period in ('daily', 'weekly', 'monthly', 'yearly')),
  period_start date not null,
  period_end   date not null,
  artist_id    uuid not null references public.artists (id) on delete cascade,
  rank         int not null check (rank >= 1),
  total        numeric not null,
  -- 항목별 점수와 원천 지표 (멜론 순위·좋아요·팬·Spotify·응원·공연 가점, 미수집 항목은 null)
  breakdown    jsonb not null,
  computed_at  timestamptz not null default now(),
  finalized    boolean not null default false,
  primary key (period, period_start, artist_id),
  check (period_end >= period_start)
);
create index chart_results_lookup_idx on public.chart_results (period, period_start, rank);

-- ----------------------------------------------------------------------------
-- 월간 종합 TOP 3 / 응원 TOP 3 (관리자 확정)
-- ----------------------------------------------------------------------------
create table public.monthly_top3 (
  month        text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  rank         int not null check (rank between 1 and 3),
  artist_id    uuid not null references public.artists (id) on delete restrict,
  total        numeric not null,
  confirmed_by uuid references public.profiles (id) on delete set null,
  confirmed_at timestamptz not null default now(),
  primary key (month, rank)
);

create table public.cheer_top3 (
  month        text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  rank         int not null check (rank between 1 and 3),
  artist_id    uuid not null references public.artists (id) on delete restrict,
  cheer_count  int not null check (cheer_count >= 0),
  confirmed_by uuid references public.profiles (id) on delete set null,
  confirmed_at timestamptz not null default now(),
  primary key (month, rank)
);

-- ----------------------------------------------------------------------------
-- 관리자 변경 이력 (트리거로 자동 기록)
-- ----------------------------------------------------------------------------
create table public.admin_audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  -- 'admin' | 'user' | 'system'(서버 예약 작업 등 로그인 사용자 없음)
  actor_role  text not null,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name  text not null,
  record_id   text,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index admin_audit_log_record_idx on public.admin_audit_log (table_name, record_id);

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  rid text;
begin
  rid := coalesce(rec ->> 'id', rec ->> 'artist_id', rec ->> 'chart_date', rec ->> 'period', rec ->> 'month');
  insert into public.admin_audit_log (actor_id, actor_role, action, table_name, record_id, before, after)
  values (
    auth.uid(),
    case when auth.uid() is null then 'system' when public.is_admin() then 'admin' else 'user' end,
    tg_op,
    tg_table_name,
    rid,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

-- 관리 대상 테이블의 모든 변경을 기록 (응원은 무효 처리 같은 수정·삭제만 기록)
create trigger audit_artists after insert or update or delete on public.artists
  for each row execute function public.write_audit_log();
create trigger audit_concerts after insert or update or delete on public.concerts
  for each row execute function public.write_audit_log();
create trigger audit_artist_reports after update or delete on public.artist_reports
  for each row execute function public.write_audit_log();
create trigger audit_cheers after update or delete on public.cheers
  for each row execute function public.write_audit_log();
create trigger audit_metric_snapshots after insert or update or delete on public.metric_snapshots
  for each row execute function public.write_audit_log();
create trigger audit_score_basis after insert or update or delete on public.score_basis
  for each row execute function public.write_audit_log();
create trigger audit_monthly_top3 after insert or update or delete on public.monthly_top3
  for each row execute function public.write_audit_log();
create trigger audit_cheer_top3 after insert or update or delete on public.cheer_top3
  for each row execute function public.write_audit_log();
create trigger audit_profiles_role after update of role on public.profiles
  for each row execute function public.write_audit_log();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.profiles            enable row level security;
alter table public.artists             enable row level security;
alter table public.concerts            enable row level security;
alter table public.artist_reports      enable row level security;
alter table public.cheers              enable row level security;
alter table public.metric_snapshots    enable row level security;
alter table public.melon_charts        enable row level security;
alter table public.melon_chart_entries enable row level security;
alter table public.collection_runs     enable row level security;
alter table public.collection_failures enable row level security;
alter table public.score_basis         enable row level security;
alter table public.chart_results       enable row level security;
alter table public.monthly_top3        enable row level security;
alter table public.cheer_top3          enable row level security;
alter table public.admin_audit_log     enable row level security;

-- profiles: 본인 읽기·닉네임 수정, 관리자 전체
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- artists: 공개는 활성만, 관리자 전체
create policy artists_public_read on public.artists for select to anon, authenticated using (status = 'active' or public.is_admin());
create policy artists_admin_write on public.artists for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- concerts: 공개는 승인된 공연, 제보자는 자기 제보, 관리자 전체
create policy concerts_public_read on public.concerts for select to anon, authenticated
  using (status = 'approved' or reporter_id = auth.uid() or public.is_admin());
create policy concerts_report_insert on public.concerts for insert to authenticated
  with check (source = 'report' and status = 'pending' and reporter_id = auth.uid() and reviewed_by is null);
create policy concerts_admin_write on public.concerts for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- artist_reports: 제보자는 자기 제보, 관리자 전체
create policy artist_reports_own_read on public.artist_reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy artist_reports_insert on public.artist_reports for insert to authenticated
  with check (status = 'pending' and reporter_id = auth.uid() and reviewed_by is null and approved_artist_id is null);
create policy artist_reports_admin_write on public.artist_reports for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- cheers: 본인 응원 읽기·남기기, 관리자 전체 (공개 집계는 cheer_counts 함수)
create policy cheers_own_read on public.cheers for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy cheers_own_insert on public.cheers for insert to authenticated with check (user_id = auth.uid());
create policy cheers_admin_write on public.cheers for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 공개 수치·차트: 누구나 읽기, 관리자만 쓰기
create policy metric_snapshots_public_read on public.metric_snapshots for select to anon, authenticated using (true);
create policy metric_snapshots_admin_write on public.metric_snapshots for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy melon_charts_public_read on public.melon_charts for select to anon, authenticated using (true);
create policy melon_charts_admin_write on public.melon_charts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy melon_chart_entries_public_read on public.melon_chart_entries for select to anon, authenticated using (true);
create policy melon_chart_entries_admin_write on public.melon_chart_entries for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy score_basis_public_read on public.score_basis for select to anon, authenticated using (true);
create policy score_basis_admin_write on public.score_basis for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy chart_results_public_read on public.chart_results for select to anon, authenticated using (true);
create policy chart_results_admin_write on public.chart_results for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy monthly_top3_public_read on public.monthly_top3 for select to anon, authenticated using (true);
create policy monthly_top3_admin_write on public.monthly_top3 for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy cheer_top3_public_read on public.cheer_top3 for select to anon, authenticated using (true);
create policy cheer_top3_admin_write on public.cheer_top3 for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 관리 전용: 수집 이력, 변경 이력
create policy collection_runs_admin on public.collection_runs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy collection_failures_admin on public.collection_failures for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_audit_log_admin_read on public.admin_audit_log for select to authenticated using (public.is_admin());
-- admin_audit_log 쓰기 정책 없음: 트리거(security definer)만 기록한다

-- 함수 실행 권한
revoke execute on function public.cheer_counts(date, date) from public;
grant execute on function public.cheer_counts(date, date) to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.kst_today() to anon, authenticated, service_role;

-- 트리거 전용 함수는 직접 호출하지 못하게 한다
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profile_role() from public, anon, authenticated;
revoke execute on function public.check_cheer_artist() from public, anon, authenticated;
revoke execute on function public.write_audit_log() from public, anon, authenticated;

-- ============================================================================
-- 점수 정책 기본값 (데모 데이터가 아니라 기획서의 만점 기준. packages/core/src/score.ts 와 같다)
-- ============================================================================
insert into public.score_basis (period, likes, fans, followers) values
  ('daily',   100,   100,   100),
  ('weekly',  500,   500,   500),
  ('monthly', 2000,  2000,  2000),
  ('yearly',  20000, 20000, 20000)
on conflict (period) do nothing;
