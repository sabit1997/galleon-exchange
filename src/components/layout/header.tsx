"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useAccount } from "@/components/providers/account-provider";
import { useMarket } from "@/components/providers/market-provider";
import { useSession } from "@/components/providers/session-provider";
import { Galleon, toneClass } from "@/components/ui/galleon";
import { BookIcon, ChartIcon, LogoMark, LogoutIcon, NewsIcon, TrophyIcon, WalletIcon } from "@/components/ui/icons";
import { HOUSE_STYLES, formatPct, houseKey } from "@/lib/format";
import { changeRatio } from "@/lib/market";

const NAV = [
  { href: "/", label: "시장", Icon: ChartIcon },
  { href: "/portfolio", label: "내 계좌", Icon: WalletIcon },
  { href: "/news", label: "예언자 일보", Icon: NewsIcon },
  { href: "/leaderboard", label: "명예의 전당", Icon: TrophyIcon },
  { href: "/learn", label: "주식 공부", Icon: BookIcon },
] as const;

/** 지수 표시 순서: 종합 → 그리핀도르 → 슬리데린 → 래번클로 → 후플푸프 */
const HOUSE_ORDER = ["gryffindor", "slytherin", "ravenclaw", "hufflepuff", "none"] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/stocks");
  return pathname.startsWith(href);
}

function NavLinks({ variant }: { variant: "top" | "bottom" }) {
  const pathname = usePathname();
  if (variant === "top") {
    return (
      <nav className="hidden items-center gap-0.5 md:flex" aria-label="주 메뉴">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`pressable rounded-lg px-3 py-1.5 text-[14px] font-semibold ${
                active ? "bg-white/8 text-slate-50" : "text-slate-400 hover:text-slate-100"
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
    <nav
      className="glass fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/8 px-1 pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="주 메뉴"
    >
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`pressable relative flex min-w-0 flex-col items-center gap-1 pb-2 pt-2.5 text-[10.5px] font-medium ${active ? "text-slate-50" : "text-slate-500"}`}
          >
            <span className={`grid h-7 w-11 place-items-center rounded-full transition-colors ${active ? "bg-magic/20 text-magic-bright" : ""}`}>
              <item.Icon className="h-[21px] w-[21px]" />
            </span>
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** 데스크톱 헤더 아래 지수 띠 — 종합지수와 기숙사 업종지수 */
function IndexStrip() {
  const { indices, indexValue } = useMarket();
  const scopes = [...indices.keys()].sort((a, b) => {
    if (a === "all") return -1;
    if (b === "all") return 1;
    return HOUSE_ORDER.indexOf(houseKey(a)) - HOUSE_ORDER.indexOf(houseKey(b));
  });
  if (scopes.length === 0) return null;
  return (
    <div className="hidden border-t border-white/5 md:block">
      <ul className="mx-auto flex h-8 w-full max-w-6xl items-center gap-5 overflow-hidden px-4 text-[12px]" aria-label="지수 요약">
        {scopes.map((scope) => {
          const value = indexValue(scope);
          const open = indices.get(scope)?.day_open ?? 0;
          if (value == null) return null;
          const r = changeRatio(value, open);
          const key = houseKey(scope);
          return (
            <li key={scope} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
              {scope !== "all" && <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${HOUSE_STYLES[key].dot}`} />}
              <span className="text-slate-400">{scope === "all" ? "호그와트 종합" : HOUSE_STYLES[key].label}</span>
              <span className="font-semibold text-slate-100 tabular-nums">{value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className={`tabular-nums ${toneClass(r)}`}>
                {formatPct(r)}
              </span>
            </li>
          );
        })}
        <li className="ml-auto hidden shrink-0 text-slate-600 2xl:block">기준: 오늘 00:00 시가</li>
      </ul>
    </div>
  );
}

export function Header() {
  const { profile, signOut } = useSession();
  const { cash, loading } = useAccount();
  return (
    <>
      <header className="glass sticky top-0 z-40 border-b border-white/6">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 md:gap-5">
          <Link href="/" className="pressable flex shrink-0 items-center gap-2.5" aria-label="갈레온 증권 홈">
            <LogoMark className="!h-8 !w-8" />
            <span className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold tracking-tight text-slate-50">갈레온 증권</span>
              <span className="text-[10.5px] font-medium text-slate-500">카르텔 마법학교</span>
            </span>
          </Link>
          {/* usePathname 은 동적 경로에서 suspend 할 수 있다 (cacheComponents) */}
          <Suspense fallback={null}>
            <NavLinks variant="top" />
          </Suspense>
          <div className="ml-auto flex min-w-0 items-center gap-1.5 text-sm">
            {!loading && (
              <Link
                href="/portfolio"
                className="pressable flex min-w-0 items-center gap-1.5 rounded-lg border border-gold/20 bg-gold/[0.07] px-2.5 py-1.5 hover:bg-gold/[0.13]"
                title="주문가능금액 (증권계좌 현금)"
              >
                <span className="hidden text-[11px] font-medium text-slate-400 min-[400px]:inline">주문가능</span>
                <Galleon value={cash} className="truncate text-[13px] font-semibold text-gold-bright" />
              </Link>
            )}
            {profile?.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element -- 디스코드 CDN 아바타, 최적화 불필요
              <img src={profile.avatar_url} alt="" className="hidden h-7 w-7 rounded-full ring-2 ring-white/10 md:block" />
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
        <IndexStrip />
      </header>
      <Suspense fallback={null}>
        <NavLinks variant="bottom" />
      </Suspense>
    </>
  );
}
