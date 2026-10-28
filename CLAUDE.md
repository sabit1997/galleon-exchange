# 갈레온 증권 (카르텔 마법학교 주식시장)

디스코드 스터디 봇 "카르텔 마법학교"의 친구 주식시장 웹사이트. Next.js(App Router) + Supabase.

## 기본 정보

- 패키지 매니저: **pnpm** (`pnpm install`)
- 기본 브랜치: `main`
- Next.js 16 — 기존 지식과 API가 다를 수 있다. 코드 작성 전 `AGENTS.md`와 `node_modules/next/dist/docs/`를 확인한다.

## 검증 명령

| 항목 | 명령 |
| --- | --- |
| lint | `pnpm lint` |
| 타입체크 | `pnpm typecheck` |
| 테스트 | `pnpm test` |
| 빌드 | `pnpm build` |

빌드는 실제 환경변수 없이도 통과해야 한다 (`src/lib/env.ts` 가 미설정 상태를 처리).

## 구조

- `supabase/migrations/` — 백엔드 계약. 사이트는 이 스키마를 읽기만 하고, 쓰기는 `trade` RPC 하나뿐이다.
- `src/lib/database.types.ts` — 마이그레이션에서 손으로 옮긴 `Database` 타입. 스키마를 바꾸면 함께 고친다.
- `src/lib/market.ts` — 체결가 미리보기(SQL `trade` 함수와 동일한 반올림), 에러 메시지 매핑 등 순수 로직. 테스트는 `*.test.ts`.
- `src/components/providers/` — 세션·멤버십 게이트, 시장(주식 목록·설정) / 내 계좌 Realtime 구독.
- 입출금은 사이트가 아니라 디스코드 `/증권 입금`, `/증권 출금` 으로만 한다.
