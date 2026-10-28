"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useAccount } from "@/components/providers/account-provider";
import { useSession } from "@/components/providers/session-provider";
import { Galleon } from "@/components/ui/galleon";
import { Sparkle } from "@/components/ui/ornament";

const NAV = [
  { href: "/", label: "시장", icon: "📈" },
  { href: "/portfolio", label: "내 계좌", icon: "🗝️" },
  { href: "/news", label: "예언자 일보", icon: "📜" },
  { href: "/leaderboard", label: "명예의 전당", icon: "🏆" },
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
              isActive(pathname, item.href)
                ? "bg-gold/10 text-gold ring-1 ring-gold/30"
                : "text-slate-300 hover:bg-white/5 hover:text-gold-bright"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-gold/25 bg-ink/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgb(0_0_0/0.5)] backdrop-blur sm:hidden">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive(pathname, item.href) ? "text-gold" : "text-slate-400"}`}
        >
          {isActive(pathname, item.href) && <span aria-hidden className="absolute inset-x-6 top-0 h-px bg-gold shadow-[0_0_8px_var(--color-gold)]" />}
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
      <header className="sticky top-0 z-20 border-b border-gold/20 bg-ink/85 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.7)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="갈레온 증권 홈">
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,var(--color-gold-bright),var(--color-gold)_55%,#8a5a12)] text-ink shadow-[0_0_12px_rgb(226_189_104/0.35)] ring-1 ring-gold-bright/60"
            >
              <Sparkle className="h-3.5 w-3.5" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-display gilded font-bold">갈레온 증권</span>
              <span className="font-display text-[10px] tracking-[0.18em] text-slate-400">그린고츠 거래소</span>
            </span>
          </Link>
          {/* usePathname 은 동적 경로에서 suspend 할 수 있다 (cacheComponents) */}
          <Suspense fallback={null}>
            <NavLinks variant="top" />
          </Suspense>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {!loading && (
              <Link href="/portfolio" className="rounded-lg border border-gold/25 bg-gold/5 px-2.5 py-1 text-gold-bright hover:bg-gold/10" title="증권계좌 잔고">
                <Galleon value={cash} />
              </Link>
            )}
            {profile?.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element -- 디스코드 CDN 아바타, 최적화 불필요
              <img src={profile.avatar_url} alt="" className="hidden h-7 w-7 rounded-full ring-1 ring-gold/40 sm:block" />
            )}
            <button type="button" onClick={() => void signOut()} className="shrink-0 text-slate-400 hover:text-slate-200">
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
