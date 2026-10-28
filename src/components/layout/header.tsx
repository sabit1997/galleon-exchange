"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useAccount } from "@/components/providers/account-provider";
import { useSession } from "@/components/providers/session-provider";
import { Galleon } from "@/components/ui/galleon";
import { ChartIcon, LogoMark, LogoutIcon, NewsIcon, TrophyIcon, WalletIcon } from "@/components/ui/icons";

const NAV = [
  { href: "/", label: "시장", Icon: ChartIcon },
  { href: "/portfolio", label: "내 계좌", Icon: WalletIcon },
  { href: "/news", label: "예언자 일보", Icon: NewsIcon },
  { href: "/leaderboard", label: "명예의 전당", Icon: TrophyIcon },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/stocks");
  return pathname.startsWith(href);
}

function NavLinks({ variant }: { variant: "top" | "bottom" }) {
  const pathname = usePathname();
  if (variant === "top") {
    return (
      <nav className="hidden items-center gap-0.5 rounded-full border border-white/6 bg-white/[0.03] p-1 sm:flex">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`pressable rounded-full px-3.5 py-1.5 text-sm font-medium ${
                active ? "bg-white/10 text-slate-50 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]" : "text-slate-400 hover:text-slate-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-white/8 px-2 pb-[env(safe-area-inset-bottom)] sm:hidden">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`pressable relative flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium ${active ? "text-slate-50" : "text-slate-500"}`}
          >
            <span
              className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${active ? "bg-magic/20 text-magic-bright" : ""}`}
            >
              <item.Icon className="h-[22px] w-[22px]" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Header() {
  const { profile, signOut } = useSession();
  const { cash, loading } = useAccount();
  return (
    <>
      <header className="glass sticky top-0 z-20 border-b border-white/6">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-4 px-4">
          <Link href="/" className="pressable flex shrink-0 items-center gap-2.5" aria-label="갈레온 증권 홈">
            <LogoMark />
            <span className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold tracking-tight text-slate-50">갈레온 증권</span>
              <span className="text-[11px] font-medium text-slate-500">카르텔 마법학교</span>
            </span>
          </Link>
          {/* usePathname 은 동적 경로에서 suspend 할 수 있다 (cacheComponents) */}
          <Suspense fallback={null}>
            <NavLinks variant="top" />
          </Suspense>
          <div className="ml-auto flex items-center gap-2 text-sm">
            {!loading && (
              <Link
                href="/portfolio"
                className="pressable rounded-full border border-gold/20 bg-gold/[0.08] px-3 py-1.5 font-semibold text-gold-bright hover:bg-gold/[0.14]"
                title="증권계좌 잔고"
              >
                <Galleon value={cash} />
              </Link>
            )}
            {profile?.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element -- 디스코드 CDN 아바타, 최적화 불필요
              <img src={profile.avatar_url} alt="" className="hidden h-8 w-8 rounded-full ring-2 ring-white/10 sm:block" />
            )}
            <button
              type="button"
              onClick={() => void signOut()}
              className="pressable grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-white/8 hover:text-slate-100"
              aria-label="로그아웃"
              title="로그아웃"
            >
              <LogoutIcon className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </header>
      <Suspense fallback={null}>
        <NavLinks variant="bottom" />
      </Suspense>
    </>
  );
}
