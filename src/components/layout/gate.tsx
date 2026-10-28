"use client";

import { AccountProvider } from "@/components/providers/account-provider";
import { MarketProvider } from "@/components/providers/market-provider";
import { useSession } from "@/components/providers/session-provider";
import { Spinner } from "@/components/ui/card";
import { DiscordLoginButton } from "@/components/ui/discord-button";
import { LogoMark, Sparkle } from "@/components/ui/icons";

/** 세션 상태에 따라 랜딩 / 입장 불가 / 시장 화면을 고른다. */
export function Gate({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  const { status } = useSession();

  switch (status) {
    case "unconfigured":
      return <Unconfigured />;
    case "loading":
      return (
        <Centered>
          <Spinner label="부엉이가 편지를 확인하는 중…" />
        </Centered>
      );
    case "signed_out":
      return <Landing />;
    case "not_member":
      return <NotMember />;
    case "error":
      return <LoadError />;
    case "member":
      return (
        <MarketProvider>
          <AccountProvider>
            {header}
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:pb-12 sm:pt-8">{children}</main>
          </AccountProvider>
        </MarketProvider>
      );
  }
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 text-center">{children}</div>;
}

const primaryBtn =
  "pressable rounded-2xl bg-magic px-5 py-2.5 font-semibold text-slate-950 shadow-[0_8px_24px_-8px_rgb(155_140_255/0.8)] hover:bg-magic-bright";
const ghostBtn = "pressable rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-2.5 font-medium text-slate-300 hover:bg-white/8";

const RISE_EVENTS = [
  { icon: "📚", label: "교시 완주" },
  { icon: "🙋", label: "출석" },
  { icon: "✨", label: "황금 스니치 포획" },
  { icon: "🥚", label: "황금 알 획득" },
];
const FALL_EVENTS = [
  { icon: "⚠️", label: "집중 경고" },
  { icon: "🚫", label: "벌점" },
];

function Landing() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center gap-2.5 px-5 py-5">
        <LogoMark />
        <span className="flex flex-col leading-tight">
          <span className="text-[15px] font-bold tracking-tight text-slate-50">갈레온 증권</span>
          <span className="text-[11px] font-medium text-slate-500">카르텔 마법학교</span>
        </span>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-12 px-5 pb-16 pt-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pt-0">
        <section className="animate-fade-up">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-magic/25 bg-magic/10 px-3 py-1 text-xs font-semibold text-magic-bright">
            <Sparkle className="h-3 w-3 text-gold-bright" />
            카르텔 마법학교 친구 주식시장
          </p>
          <h1 className="mt-5 text-[2.6rem] font-extrabold leading-[1.12] tracking-[-0.04em] text-slate-50 sm:text-6xl">
            공부하면 오르는
            <br />
            <span className="text-aurora">친구 주식</span>
          </h1>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-slate-400">
            교시를 완주하면 오르고, 벌점을 받으면 내려가요. 친구들의 공부 주식을 사고팔아 최고의 투자 마법사가 되어 보세요.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <DiscordLoginButton />
            <p className="text-center text-xs text-slate-500 sm:text-left">
              카르텔 마법학교 디스코드 계정으로
              <br className="hidden sm:block" /> 바로 입장해요
            </p>
          </div>
        </section>

        <section className="space-y-3 animate-fade-up [animation-delay:120ms]" aria-label="이렇게 움직여요">
          <div className="panel-glow float rounded-3xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-100">주가가 오르는 순간</p>
              <span className="rounded-full bg-rise/15 px-2 py-0.5 text-xs font-semibold text-rise">▲ 상승</span>
            </div>
            <svg aria-hidden viewBox="0 0 300 70" className="mt-3 h-16 w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="landing-area" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#ff6b6b" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#ff6b6b" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 58 L40 52 L70 55 L105 40 L140 44 L175 30 L210 33 L245 16 L300 8 L300 70 L0 70 Z" fill="url(#landing-area)" />
              <path
                d="M0 58 L40 52 L70 55 L105 40 L140 44 L175 30 L210 33 L245 16 L300 8"
                fill="none"
                stroke="#ff6b6b"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {RISE_EVENTS.map((e) => (
                <li key={e.label} className="rounded-full bg-white/6 px-2.5 py-1 text-xs text-slate-200">
                  <span aria-hidden className="mr-1">
                    {e.icon}
                  </span>
                  {e.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="panel rounded-3xl p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-100">내려가는 순간</p>
                <span className="text-xs font-semibold text-fall">▼ 하락</span>
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {FALL_EVENTS.map((e) => (
                  <li key={e.label} className="rounded-full bg-white/6 px-2.5 py-1 text-xs text-slate-200">
                    <span aria-hidden className="mr-1">
                      {e.icon}
                    </span>
                    {e.label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel rounded-3xl p-5">
              <p className="text-sm font-semibold text-slate-100">갈레온은 디스코드에서</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                <code className="rounded-md bg-gold/10 px-1.5 py-0.5 font-semibold text-gold-bright">/증권 입금</code> 으로 봇 지갑의 갈레온을 옮겨 와 거래해요.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function NotMember() {
  const { profile, signOut } = useSession();
  return (
    <Centered>
      <div className="grid h-20 w-20 place-items-center rounded-3xl bg-white/[0.04] text-4xl ring-1 ring-white/8" aria-hidden>
        🦉
      </div>
      <h1 className="mt-6 text-2xl font-bold text-slate-50">아직 입학 기록이 없어요</h1>
      <p className="mt-3 max-w-sm text-balance leading-relaxed text-slate-400">
        기숙사에 배정된 학생은 자동으로 상장돼요. 막 입학했다면 한 교시 완주하거나{" "}
        <code className="rounded-md bg-gold/10 px-1.5 py-0.5 text-gold-bright">/증권 입금</code>을 하면 입장할 수 있어요.
      </p>
      {profile?.display_name && <p className="mt-3 text-sm text-slate-500">{profile.display_name} 님으로 로그인되어 있어요.</p>}
      <div className="mt-8 flex gap-2">
        <button type="button" onClick={() => window.location.reload()} className={primaryBtn}>
          다시 확인하기
        </button>
        <button type="button" onClick={() => void signOut()} className={ghostBtn}>
          로그아웃
        </button>
      </div>
    </Centered>
  );
}

function LoadError() {
  const { retry, signOut } = useSession();
  return (
    <Centered>
      <div className="grid h-20 w-20 place-items-center rounded-3xl bg-white/[0.04] text-4xl ring-1 ring-white/8" aria-hidden>
        🪄
      </div>
      <h1 className="mt-6 text-2xl font-bold text-slate-50">마법이 잠시 엉켰어요</h1>
      <p className="mt-3 text-slate-400">계정 정보를 불러오지 못했어요.</p>
      <div className="mt-8 flex gap-2">
        <button type="button" onClick={retry} className={primaryBtn}>
          다시 시도
        </button>
        <button type="button" onClick={() => void signOut()} className={ghostBtn}>
          로그아웃
        </button>
      </div>
    </Centered>
  );
}

function Unconfigured() {
  return (
    <Centered>
      <LogoMark />
      <h1 className="mt-5 text-2xl font-bold text-slate-50">설정이 필요해요</h1>
      <p className="mt-3 max-w-md leading-relaxed text-slate-400">
        <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, <code>NEXT_PUBLIC_GUILD_ID</code>{" "}
        환경변수를 설정한 뒤 다시 배포해 주세요. (<code>.env.example</code> 참고)
      </p>
    </Centered>
  );
}
