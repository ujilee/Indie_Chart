-- ============================================================================
-- INDIE CHART 0002: 소셜 로그인 가입 시 닉네임 자동 생성
--
-- 소셜 계정(카카오·Google)의 이름은 공백·특수문자가 있거나 다른 회원과 겹칠 수 있다.
-- 0001의 가입 트리거는 그런 이름을 그대로 넣으려다 가입 자체가 실패할 수 있어서,
-- 닉네임 규칙(한글·영문·숫자·_ 2~12자)에 맞게 다듬고, 겹치면 뒤에 숫자를 붙인다.
-- 함수 하나만 바꾼다 (테이블·데이터 변경 없음).
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  base text;
  candidate text;
  tries int := 0;
begin
  -- 이메일 가입은 nickname, 소셜 가입은 제공자가 준 이름을 쓴다
  base := coalesce(
    nullif(meta ->> 'nickname', ''),
    nullif(meta ->> 'name', ''),
    nullif(meta ->> 'full_name', ''),
    nullif(meta ->> 'user_name', ''),
    nullif(meta ->> 'preferred_username', ''),
    ''
  );
  base := left(regexp_replace(base, '[^가-힣A-Za-z0-9_]', '', 'g'), 12);
  if length(base) < 2 then
    base := 'user_' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;

  candidate := base;
  while exists (select 1 from public.profiles where lower(nickname) = lower(candidate)) and tries < 20 loop
    tries := tries + 1;
    candidate := left(base, 8) || (floor(random() * 9000) + 1000)::int::text;
  end loop;
  if exists (select 1 from public.profiles where lower(nickname) = lower(candidate)) then
    candidate := 'user_' || substr(replace(new.id::text, '-', ''), 1, 7);
  end if;

  insert into public.profiles (id, nickname) values (new.id, candidate);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
