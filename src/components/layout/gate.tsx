"use client";

import { AccountProvider } from "@/components/providers/account-provider";
import { MarketProvider } from "@/components/providers/market-provider";
import { useSession } from "@/components/providers/session-provider";
import { Spinner } from "@/components/ui/card";
import { DiscordLoginButton } from "@/components/ui/discord-button";
import { Candle, Flourish, WaxSeal } from "@/components/ui/ornament";

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
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-4 sm:pb-10">{children}</main>
          </AccountProvider>
        </MarketProvider>
      );
  }
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 text-center">{children}</div>;
}

function Landing() {
  return (
    <Centered>
      <div className="flex items-end gap-3" aria-hidden>
        <Candle className="h-12" />
        <Candle className="h-16" />
        <Candle className="h-12" />
      </div>
      <p className="font-display mt-4 text-xs tracking-[0.3em] text-slate-400">카르텔 마법학교 · 그린고츠 거래소</p>
      <h1 className="font-display gilded mt-2 text-4xl font-bold sm:text-5xl">갈레온 증권</h1>
      <Flourish className="mt-3" />

      {/* 입학 통지서 느낌의 양피지 편지 */}
      <article className="parchment relative mt-8 w-full max-w-md rounded-sm px-6 pb-14 pt-7 text-left sm:px-8">
        <p className="font-display text-sm text-slate-400">친애하는 예비 투자 마법사께,</p>
        <p className="mt-3 leading-relaxed">
          교시를 완주하면 오르고, 벌점을 받으면 내려가요. 친구들의 공부 주식을 사고팔아 최고의 투자 마법사가 되어 보세요.
        </p>
        <ul className="mt-4 grid gap-2 text-sm text-slate-300">
          <li>📈 교시 완주 · 출석 · 황금 스니치 포획으로 주가 상승</li>
          <li>📉 집중 경고 · 벌점으로 주가 하락</li>
          <li>
            🏦 디스코드에서 <code className="rounded bg-black/10 px-1 font-semibold text-burgundy">/증권 입금</code> 으로 갈레온을 옮겨 와 거래
          </li>
        </ul>
        <p className="font-display mt-5 text-right text-sm text-slate-400">— 그린고츠 거래소 드림</p>
        <WaxSeal className="absolute -bottom-8 left-1/2 -translate-x-1/2 drop-shadow-[0_4px_6px_rgb(0_0_0/0.45)]" />
      </article>

      <div className="mt-14">
        <DiscordLoginButton />
      </div>
    </Centered>
  );
}

function NotMember() {
  const { profile, signOut } = useSession();
  return (
    <Centered>
      <p className="text-5xl" aria-hidden>
        🦉
      </p>
      <h1 className="font-display gilded mt-4 text-2xl font-bold">아직 입학 기록이 없어요</h1>
      <p className="mt-3 max-w-sm text-balance text-slate-300">
        서버에서 한 교시 이상 공부하거나 <code className="text-gold">/증권 입금</code>을 하면 입장할 수 있어요.
      </p>
      {profile?.display_name && (
        <p className="mt-2 text-sm text-slate-500">{profile.display_name} 님으로 로그인되어 있어요.</p>
      )}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-gold px-4 py-2 font-semibold text-slate-950 shadow-[0_0_16px_rgb(226_189_104/0.25)] hover:brightness-110"
        >
          다시 확인하기
        </button>
        <button type="button" onClick={() => void signOut()} className="rounded-xl border border-gold/25 px-4 py-2 text-slate-300 hover:bg-white/5">
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
      <h1 className="font-display gilded text-2xl font-bold">마법이 잠시 엉켰어요</h1>
      <p className="mt-3 text-slate-300">계정 정보를 불러오지 못했어요.</p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={retry} className="rounded-xl bg-gold px-4 py-2 font-semibold text-slate-950 shadow-[0_0_16px_rgb(226_189_104/0.25)] hover:brightness-110">
          다시 시도
        </button>
        <button type="button" onClick={() => void signOut()} className="rounded-xl border border-gold/25 px-4 py-2 text-slate-300">
          로그아웃
        </button>
      </div>
    </Centered>
  );
}

function Unconfigured() {
  return (
    <Centered>
      <h1 className="font-display gilded text-2xl font-bold">설정이 필요해요</h1>
      <p className="mt-3 max-w-md text-slate-300">
        <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, <code>NEXT_PUBLIC_GUILD_ID</code>{" "}
        환경변수를 설정한 뒤 다시 배포해 주세요. (<code>.env.example</code> 참고)
      </p>
    </Centered>
  );
}
