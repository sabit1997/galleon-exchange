# 🪙 갈레온 증권 — 카르텔 마법학교 주식시장

디스코드 스터디 봇 "카르텔 마법학교"의 친구 주식시장. 서버에서 공부한 학생은 한 명 한 명이 상장 종목이 되고,
교시 완주·출석·황금 스니치는 주가를 올리고 집중 경고·벌점은 주가를 내린다.
갈레온은 디스코드에서 `/증권 입금` 으로 증권계좌에 옮겨 와 이 사이트에서 거래하고, `/증권 출금` 으로 돌려받는다.

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres · Auth(Discord) · Realtime)
- 패키지 매니저: pnpm

## 화면

| 경로 | 내용 |
| --- | --- |
| `/` | 시장 — 종목 목록, 오늘 시가 대비 등락, 실시간 깜빡임 |
| `/stocks/[discord_id]` | 종목 상세 — 주가 차트, 최근 소식, 매수/매도 (체결 금액 미리보기) |
| `/portfolio` | 내 계좌 — 현금, 보유 주식 평가손익, 입출금 안내 |
| `/news` | 예언자 일보 — 봇 이벤트와 체결 내역 실시간 피드 |
| `/leaderboard` | 총 자산 순위 |

## 로컬 개발

```bash
pnpm install
cp .env.example .env.local   # 값 채우기
pnpm dev
```

검증 명령: `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build`

## Supabase 설정

1. **마이그레이션 적용**
   - Supabase CLI: `supabase link --project-ref <ref>` 후 `supabase db push`
   - 또는 대시보드 SQL Editor 에서 `supabase/migrations/20261028000000_init_market.sql` 실행
   - `pg_cron` 확장을 쓴다 (매일 00:00 KST 평균 회귀). 대시보드 Database → Extensions 에서 켜져 있는지 확인한다.
2. **Discord 로그인 켜기**
   - [Discord Developer Portal](https://discord.com/developers/applications) 에서 앱을 만들고 OAuth2 → Redirects 에
     `https://<project-ref>.supabase.co/auth/v1/callback` 을 추가한다.
   - Supabase 대시보드 Authentication → Sign In / Providers → Discord 를 켜고 Client ID / Secret 을 입력한다.
   - Authentication → URL Configuration
     - Site URL: `https://<배포 도메인>`
     - Redirect URLs: `https://<배포 도메인>/auth/callback`, 로컬 개발용 `http://localhost:3000/auth/callback`
       (Vercel 프리뷰도 쓰려면 `https://*-<팀>.vercel.app/auth/callback` 같은 와일드카드 추가)
3. **Realtime** — 마이그레이션이 `supabase_realtime` publication 에 테이블을 추가한다. 추가 설정은 필요 없다.

## Vercel 배포

Project Settings → Environment Variables 에 아래 세 값을 넣고 다시 배포한다 (`NEXT_PUBLIC_*` 는 빌드 시점에 들어간다).

| 이름 | 값 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project Settings → API 의 Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 같은 화면의 anon(public) key |
| `NEXT_PUBLIC_GUILD_ID` | 디스코드 서버 ID — 봇이 넣는 `guild_id` 와 같아야 한다 |

환경변수가 없어도 빌드는 통과하며, 이때 사이트는 "설정이 필요해요" 화면을 보여준다.
service_role 키는 봇 전용이다. 이 사이트에는 절대 넣지 않는다.
