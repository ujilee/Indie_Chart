# INDIE CHART — web

국내 인디 아티스트 차트 웹서비스 (사용자 화면 + 관리자 페이지). 기획 요약은 [`../docs/PLANNING.md`](../docs/PLANNING.md).

```bash
npm install
npm run dev   # http://localhost:3000 , 관리자: /admin
```

## 구조
- `src/app/(site)` — 사용자 화면: 홈/차트, 응원, 아티스트 상세, 아티스트·공연 제보, 로그인, 가이드
- `src/app/admin` — 관리자: 대시보드, 아티스트/제보/공연/차트/점수/수집/응원/월간 TOP 3 관리
- `src/lib/score.ts` — 순위 산정 로직 (가중치, 환산, 공연 가점, 공동 순위)
- `src/lib/data.ts` — 차트 계산 및 조회 (서버 전용)
- `src/lib/db.ts`, `src/lib/seed.ts` — 로컬 JSON 저장소와 시드 데이터

## 현재 목업인 부분
- 데이터 저장: `.data/db.json` (gitignore). 삭제하면 시드로 초기화
- 외부 플랫폼 수치(멜론/Spotify): 아티스트별 시드로 생성. 수집기 연동 필요
- 시드 아티스트(`src/lib/seed-artists.ts`)는 실제 국내 인디 아티스트 30팀과 Spotify ID. 순위·수치·공연·응원은 목업 (사용자 화면 상단에 안내 배너)

## 프로필 이미지
아티스트의 Spotify ID로 프로필 이미지를 가져와요 (`src/lib/artist-image.ts`).
- 기본: 인증이 필요 없는 Spotify oEmbed (320px)
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` 환경변수가 있으면 Web API (최대 640px)
- 아티스트 등록·제보 승인·최초 수집 시 자동으로 가져오고, 관리자 > 데이터 수집에서 일괄 갱신
- 관리자가 이미지 URL을 직접 입력하면 자동 갱신에서 제외
- 소셜 로그인: localStorage 목업. OAuth 연동 필요
- 관리자 인증: 미적용
- 기준일: `src/lib/constants.ts`의 `TODAY` (2026-11-11) 고정

## 데이터 모드

| 모드 | 기본 적용 | 동작 |
| --- | --- | --- |
| `file` | 로컬 개발 | `web/.data/db.json`에 읽고 쓴다. 파일을 지우면 시드 데이터로 초기화된다. |
| `demo` | Vercel (`VERCEL` 환경 변수가 있을 때) | 시드 데이터를 메모리에서 읽기만 한다. 제보·응원·관리자 변경 기능은 화면과 서버 액션 양쪽에서 막는다. |

`INDIECHART_DATA_MODE=file` 또는 `demo`로 직접 지정할 수 있다. Vercel은 파일 시스템이 읽기 전용이라 `file` 모드로 배포하면 첫 요청에서 서버 오류가 난다.

실제 데이터를 저장하려면 `src/lib/db.ts`의 `readDb`/`writeDb`/`mutate`를 외부 DB(예: Postgres)로 교체해야 한다.
