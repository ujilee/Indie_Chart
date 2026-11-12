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
├── docs/PLANNING.md
└── package.json      # workspaces 루트
```

- `apps/web/src/app/(site)` — 홈/차트, 응원, 아티스트 상세, 아티스트·공연 제보, 로그인·회원가입, 가이드
- `apps/web/src/lib/auth.ts` — 쿠키 세션으로 현재 회원 확인
- `apps/admin/src/app` — 대시보드, 아티스트/제보/공연/차트/점수/수집/응원/월간 TOP 3 관리
- `packages/core/src`
  - `types.ts`, `score.ts` — 공통 타입과 순위 산정 로직 (가중치, 환산, 공연 가점, 공동 순위)
  - `data.ts` — 차트 계산 및 조회 (서버 전용)
  - `db.ts`, `seed.ts`, `data-mode.ts` — 저장소, 시드 데이터, 데이터 모드
  - `auth.ts` — 비밀번호 해시, 세션 토큰 서명, 가입 입력 검증
  - `ui.tsx`, `styles/theme.css` — 두 앱이 같이 쓰는 UI 컴포넌트와 디자인 토큰

실제 DB가 붙기 전까지 두 앱이 같은 저장소를 봐야 해서, 저장소와 조회 로직도 `core`에 있어요.

## 회원

- 이메일 회원가입·로그인 (소셜 로그인 없음). 응원에만 로그인이 필요해요.
- 비밀번호는 scrypt로 해시해 저장하고, 로그인 상태는 서명한 httpOnly 쿠키(30일)로 유지해요.
- 응원자는 서버 세션으로 확인해요 (1인 하루 1회).
- 운영 배포에서는 `AUTH_SECRET` 환경 변수가 필요해요. 로컬 개발은 개발용 기본값을 써요.
- 관리자 서비스는 아직 인증이 없어요.

## 데이터 모드

| 모드 | 기본 적용 | 동작 |
| --- | --- | --- |
| `file` | 로컬 개발 | 저장소 루트의 `.data/db.json`에 읽고 쓴다. 두 앱이 같은 파일을 쓴다. 파일을 지우면 시드 데이터로 초기화된다. |
| `demo` | Vercel (`VERCEL` 환경 변수가 있을 때) | 시드 데이터를 메모리에서 읽기만 한다. 회원가입·로그인·제보·응원·관리자 변경 기능은 화면과 서버 액션 양쪽에서 막는다. |

`INDIECHART_DATA_MODE=file` 또는 `demo`로 직접 지정할 수 있고, `INDIECHART_DATA_DIR`로 저장 폴더를 바꿀 수 있다. Vercel은 파일 시스템이 읽기 전용이라 `file` 모드로 배포하면 첫 요청에서 서버 오류가 난다.

실제 데이터를 저장하려면 `packages/core/src/db.ts`의 `readDb`/`writeDb`/`mutate`를 외부 DB(예: Postgres)로 교체해야 한다.

## 차트 수치: 샘플 / 실제

관리자 > 데이터 수집에서 **샘플 수치**와 **실제 수치**를 전환한다 (데모 모드는 항상 샘플).

실제 수치는 이렇게 모은다.

| 지표 | 출처 | 방법 |
| --- | --- | --- |
| 멜론 곡 순위 | [멜론 인디 일간 차트](https://www.melon.com/chart/day/index.htm?classCd=GN0500) | 자동 수집 (`packages/core/src/melon.ts`). 차트 페이지 1개만 요청, 10분 안 재요청 금지 |
| 멜론 팬 수·좋아요 합계 | 멜론 아티스트 페이지 | 관리자 > 수치 입력 (표 또는 CSV) |
| Spotify 팔로워·월별 리스너 | Spotify 아티스트 페이지 | 관리자 > 수치 입력 (표 또는 CSV) |

- 아티스트는 **멜론 아티스트 ID**로 차트와 연결된다. 관리자 > 아티스트에서 멜론 ID를 넣어야 곡 순위가 반영된다.
- 좋아요·팬·팔로워 점수는 기간 마지막 날 값 − 시작 전날 값(증가량)이다. 두 날짜 중 하나라도 입력이 없으면 미수집(0점).
- 예약 수집: `GET /api/cron/melon` (관리자 앱). `Authorization: Bearer <CRON_SECRET>` 헤더가 필요하다.
- 멜론 `robots.txt`는 일반 수집기의 차트 페이지 접근을 허용하지 않는다. 운영 전 법률 검토 또는 제휴를 권장한다.

## Vercel 배포

Vercel 프로젝트를 앱마다 하나씩 만든다.

| 프로젝트 | Root Directory | 환경 변수 |
| --- | --- | --- |
| 사용자 서비스 | `apps/web` | (DB 연동 후) `AUTH_SECRET` |
| 관리자 서비스 | `apps/admin` | `NEXT_PUBLIC_WEB_URL` = 사용자 서비스 주소 |

## 현재 목업인 부분

- 외부 플랫폼 수치(멜론/Spotify): 아티스트별 시드로 생성. 수집기 연동 필요
- 시드 아티스트(`packages/core/src/seed-artists.ts`)는 실제 국내 인디 아티스트 30팀과 Spotify ID. 순위·수치·공연·응원은 목업 (사용자 화면 상단에 안내 배너)
- 기준일: `packages/core/src/constants.ts`의 `TODAY` (2026-11-11) 고정

## 프로필 이미지

아티스트의 Spotify ID로 프로필 이미지를 가져와요 (`packages/core/src/artist-image.ts`).
- 기본: 인증이 필요 없는 Spotify oEmbed (320px)
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` 환경변수가 있으면 Web API (최대 640px)
- 아티스트 등록·제보 승인·최초 수집 시 자동으로 가져오고, 관리자 > 데이터 수집에서 일괄 갱신
- 관리자가 이미지 URL을 직접 입력하면 자동 갱신에서 제외
