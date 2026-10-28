"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useAccount } from "@/components/providers/account-provider";
import { useSession } from "@/components/providers/session-provider";
import { Galleon } from "@/components/ui/galleon";

const NAV = [
  { href: "/", label: "시장", icon: "📈" },
  { href: "/portfolio", label: "내 계좌", icon: "💼" },
  { href: "/news", label: "예언자 일보", icon: "📰" },
  { href: "/leaderboard", label: "순위", icon: "🏆" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/stocks");
  return pathname.startsWith(href);
}

function NavLinks({ variant }: { variant: "top" | "bottom" }) {
  const pathname = usePathname();
  if (variant === "top") {
    return (
      <nav className="hidden items-center gap-1 sm:flex">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              isActive(pathname, item.href) ? "bg-white/10 text-gold" : "text-slate-300 hover:bg-white/5"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-white/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive(pathname, item.href) ? "text-gold" : "text-slate-400"}`}
        >
          <span className="text-lg" aria-hidden>
            {item.icon}
          </span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function Header() {
  const { profile, signOut } = useSession();
  const { cash, loading } = useAccount();
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-ink/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4">
          <Link href="/" className="font-display flex items-center gap-1.5 font-bold text-gold">
            <span aria-hidden>🪙</span>
            <span>갈레온 증권</span>
          </Link>
          {/* usePathname 은 동적 경로에서 suspend 할 수 있다 (cacheComponents) */}
          <Suspense fallback={null}>
            <NavLinks variant="top" />
          </Suspense>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {!loading && (
              <Link href="/portfolio" className="rounded-lg bg-white/5 px-2.5 py-1 text-slate-200 hover:bg-white/10" title="증권계좌 잔고">
                <Galleon value={cash} />
              </Link>
            )}
            {profile?.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element -- 디스코드 CDN 아바타, 최적화 불필요
              <img src={profile.avatar_url} alt="" className="hidden h-7 w-7 rounded-full sm:block" />
            )}
            <button type="button" onClick={() => void signOut()} className="text-slate-400 hover:text-slate-200">
              로그아웃
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
