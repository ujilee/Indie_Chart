# INDIE CHART

국내 인디 아티스트 차트 웹서비스. 사용자 서비스와 관리자 서비스를 별도 앱으로 나눈 npm workspaces 모노레포예요. 기획 요약은 [`docs/PLANNING.md`](docs/PLANNING.md).

```bash
npm install
npm run dev:web     # 사용자 서비스  http://localhost:3000
npm run dev:admin   # 관리자 서비스  http://localhost:3001
```

```bash
npm run typecheck   # 두 앱 타입 검사
npm run lint        # 두 앱 린트
npm run build       # 두 앱 프로덕션 빌드
```

## 구조

```
Indie/
├── apps/
│   ├── web/          # 사용자 서비스 (@indie/web)
│   └── admin/        # 관리자 서비스 (@indie/admin)
├── packages/
│   └── core/         # 공통 코드 (@indie/core)
├── supabase/migrations/ # Supabase 운영 DB 구조 (SQL Editor에서 순서대로 1회씩 실행)
├── .env.example      # 환경 변수 예시 → .env.local로 복사
├── docs/PLANNING.md
└── package.json      # workspaces 루트
```

- `apps/web/src/app/(site)` — 홈/차트, 응원, 아티스트 상세, 아티스트·공연 제보, 로그인·회원가입, 가이드
- `apps/web/src/lib/auth.ts` — 쿠키 세션으로 현재 회원 확인
- `apps/admin/src/app` — 대시보드, 아티스트/제보/공연/차트/점수/수집/응원/월간 TOP 3 관리
- `packages/core/src`
  - `types.ts`, `score.ts` — 공통 타입과 순위 산정 로직 (가중치, 환산, 공연 가점, 공동 순위)
  - `data.ts` — 차트 계산 및 조회 (서버 전용)
  - `db.ts`, `seed.ts`, `data-mode.ts` — 저장소(Supabase/파일/데모), 시드 데이터, 데이터 모드
  - `melon.ts`, `artist-image.ts` — 멜론 차트·팬·좋아요 수집, Spotify 이미지·팔로워
  - `auth.ts` — 비밀번호 해시, 세션 토큰 서명, 가입 입력 검증
  - `ui.tsx`, `styles/theme.css` — 두 앱이 같이 쓰는 UI 컴포넌트와 디자인 토큰

두 앱이 같은 저장소를 봐야 해서, 저장소와 조회 로직도 `core`에 있어요.

## 회원

- 이메일 회원가입·로그인 (소셜 로그인 없음). 응원에만 로그인이 필요해요.
- 비밀번호는 scrypt로 해시해 저장하고, 로그인 상태는 서명한 httpOnly 쿠키(30일)로 유지해요.
- 응원자는 서버 세션으로 확인해요 (1인 하루 1회).
- 운영 배포에서는 `AUTH_SECRET` 환경 변수가 필요해요. 로컬 개발은 개발용 기본값을 써요.
- 관리자 서비스는 관리자 계정 로그인이 필요해요 (운영 DB 모드).

## 데이터 모드

| 모드 | 기본 적용 | 동작 |
| --- | --- | --- |
| `supabase` | `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`가 있을 때 | Supabase(Postgres)에 읽고 쓴다. 로컬과 Vercel이 같은 데이터를 쓴다. |
| `file` | 로컬 개발 (Supabase 키 없음) | 저장소 루트의 `.data/db.json`에 읽고 쓴다. 파일을 지우면 시드 데이터로 초기화된다. |
| `demo` | Vercel인데 Supabase 키가 없을 때 | 시드 데이터를 메모리에서 읽기만 한다. 회원가입·응원·제보·관리자 변경은 막는다. |

`INDIECHART_DATA_MODE=supabase|file|demo`로 직접 지정할 수 있다. 환경 변수는 저장소 루트의 `.env.local` 하나에 넣으면 두 앱이 같이 읽는다 (`.env.example` 참고).

### Supabase 연결하기 (운영 DB)

1. Supabase 프로젝트를 만든다.
2. **SQL Editor**에서 `supabase/migrations/`의 파일을 번호 순서대로 한 번씩 실행한다.
   - `0001_init.sql` — 테이블·관계·RLS·트리거·변경 이력 (데이터는 점수 기준 기본값만)
   - `0002_social_nickname.sql` — 소셜 가입 닉네임 자동 생성
3. 관리자 지정: 사용자 서비스에서 가입(이메일 인증)한 뒤 SQL Editor에서 실행한다.
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = '관리자 이메일');
   ```
4. **Project Settings → API Keys**에서 값을 복사해 저장소 루트 `.env.local`에 넣는다 (`.env.example` 참고).
   - `SUPABASE_URL` — 프로젝트 주소
   - `SUPABASE_PUBLISHABLE_KEY` — 공개용 키 (회원 로그인)
   - `SUPABASE_SERVICE_ROLE_KEY` — Secret 키 (서버 전용, 절대 공개 금지)
5. 두 앱을 다시 켠다. 관리자 앱은 로그인 화면부터 나온다.

운영 DB 모드에서는
- 샘플(데모) 데이터를 넣지 않는다. 값이 없으면 미수집·빈 화면으로 보인다.
- 회원 가입·로그인은 Supabase Auth(이메일 인증)로 하고, 응원은 로그인한 회원 권한으로 저장해 DB 규칙(RLS·하루 1회)을 그대로 따른다.
- 관리자 앱은 로그인한 **관리자 계정**(profiles.role = 'admin')만 들어갈 수 있다. 관리자 변경은 그 관리자의 토큰으로 저장해 RLS 검사를 받고, 변경 이력에 관리자 계정이 남는다. 예약 수집(`/api/cron/*`)은 `CRON_SECRET`으로 따로 확인한다.
- 소셜 로그인(카카오·Google)은 Supabase 대시보드에서 제공자를 켜고 `SUPABASE_OAUTH_PROVIDERS`에 적으면 버튼이 활성화된다.
- 멜론 자동 수집은 꺼져 있다 (`MELON_AUTO_COLLECT=1`로만 켬).
- 앱 폴더(`apps/web`, `apps/admin`)에 `.env.local`이 따로 있으면 그 값이 루트보다 우선한다.

## 차트 수치: 샘플 / 실제

관리자 > 데이터 수집에서 **샘플 수치**와 **실제 수치**를 전환한다 (데모 모드는 항상 샘플).

| 지표 | 출처 | 방법 |
| --- | --- | --- |
| 멜론 곡 순위 | [멜론 인디 일간 차트](https://www.melon.com/chart/day/index.htm?classCd=GN0500) | 자동 수집. 차트 페이지 1개, 10분 안 재요청 금지 |
| 멜론 팬맺기 수 | 아티스트 페이지가 쓰는 공개 JSON (`/artist/getArtistFanNTemper.json`) | 자동 수집 |
| 멜론 좋아요 합계 | 발매곡 목록(`/artist/songPaging.htm`) + 곡 좋아요 JSON(`/commonlike/getSongLike.json`) | 자동 수집. 발매곡 목록은 7일마다 갱신 |
| Spotify 팔로워 | Spotify Web API (`SPOTIFY_CLIENT_ID/SECRET`) | 자동 시도. Spotify가 값을 주지 않으면 수치 입력 |
| Spotify 월간 리스너 | 공식 API 없음 | 관리자 > 수치 입력 (참고용, 점수 미반영) |

- 아티스트는 **멜론 아티스트 ID**로 연결된다. 관리자 > 아티스트에서 멜론 ID를 넣어야 수집된다.
- 좋아요·팬·팔로워 점수는 기간 마지막 날 값 − 시작 전날 값(증가량)이다. 두 날짜 중 하나라도 값이 없으면 미수집(0점). 자동 수집 첫날에는 비교할 전날 값이 없어 다음 날부터 증가량이 나온다.
- 요청 간격은 3초(`MELON_REQUEST_GAP_MS`). 시험 중 1분에 50번쯤 요청하자 멜론이 몇 분간 접속을 막았다. 멜론이 응답하지 않으면 그 자리에서 수집을 멈추고, 오늘 끝낸 아티스트는 다음 실행 때 건너뛴다.
- 예약 수집: 관리자 앱 `apps/admin/vercel.json`에 매일 12:00·12:10·12:20(KST) 실행. 첫 번째는 차트+수치, 나머지는 남은 아티스트 이어서 수집. `Authorization: Bearer <CRON_SECRET>` 헤더가 필요하다.
- 멜론 `robots.txt`는 일반 수집기 접근을 허용하지 않고, 수치 수집은 멜론이 공개 문서로 제공하는 API가 아니다. 주소나 응답 형식이 바뀌면 수집이 실패로 기록된다. 정식 운영 전 법률 검토 또는 제휴를 권장한다.

## Vercel 배포

Vercel 프로젝트를 앱마다 하나씩 만든다.

| 프로젝트 | Root Directory | 환경 변수 |
| --- | --- | --- |
| 사용자 서비스 | `apps/web` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET` |
| 관리자 서비스 | `apps/admin` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_WEB_URL` = 사용자 서비스 주소, (선택) `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` |

- 아티스트 수치 수집은 몇 분 걸려서 함수 최대 실행 시간을 300초로 잡았다.

## 현재 목업인 부분

- 샘플 수치 모드의 차트 수치와 시드 데이터(공연·응원 등)는 목업 (사용자 화면 상단에 안내 배너)
- 시드 아티스트(`packages/core/src/seed-artists.ts`)는 실제 국내 인디 아티스트 30팀. 멜론 ID는 9팀만 들어 있다
- 데모 모드 기준일은 2026-11-11 고정, 그 외는 실제 한국 날짜

## 프로필 이미지

아티스트의 Spotify ID로 프로필 이미지를 가져와요 (`packages/core/src/artist-image.ts`).
- 기본: 인증이 필요 없는 Spotify oEmbed (320px)
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` 환경변수가 있으면 Web API (최대 640px)
- 아티스트 등록·제보 승인·최초 수집 시 자동으로 가져오고, 관리자 > 데이터 수집에서 일괄 갱신
- 관리자가 이미지 URL을 직접 입력하면 자동 갱신에서 제외
