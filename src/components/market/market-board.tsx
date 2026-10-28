"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount } from "@/components/providers/account-provider";
import { useMarket, type LiveStock } from "@/components/providers/market-provider";
import { useMemberSession } from "@/components/providers/session-provider";
import { Card, Empty, MeChip, PageTitle, SkeletonRows } from "@/components/ui/card";
import { ChangePct, Galleon } from "@/components/ui/galleon";
import { HouseBadge, StockAvatar } from "@/components/ui/house-badge";
import { SearchIcon } from "@/components/ui/icons";
import { changeRatio } from "@/lib/market";

type SortKey = "change" | "price" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "change", label: "등락률" },
  { key: "price", label: "주가" },
  { key: "name", label: "이름" },
];

export function MarketBoard() {
  const { stocks, loading, error } = useMarket();
  const { holdings } = useAccount();
  const { me } = useMemberSession();
  const [sort, setSort] = useState<SortKey>("change");
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const arr = [...stocks.values()].filter(
      (s) => !q || s.display_name.toLowerCase().includes(q) || (s.house ?? "").toLowerCase().includes(q),
    );
    arr.sort((a, b) => {
      if (sort === "name") return a.display_name.localeCompare(b.display_name, "ko");
      if (sort === "price") return b.price - a.price;
      return changeRatio(b.price, b.day_open) - changeRatio(a.price, a.day_open);
    });
    return arr;
  }, [stocks, sort, query]);

  const ups = useMemo(() => [...stocks.values()].filter((s) => s.price > s.day_open).length, [stocks]);
  const downs = useMemo(() => [...stocks.values()].filter((s) => s.price < s.day_open).length, [stocks]);

  return (
    <div>
      <PageTitle eyebrow="실시간 시세" title="오늘의 시장" subtitle="등락률은 오늘 00시(KST) 시가 기준이에요. 주가는 실시간으로 바뀌어요." />

      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="상장 학생" value={stocks.size} tone="text-slate-50" />
        <Stat label="상승" value={ups} tone="text-rise" />
        <Stat label="하락" value={downs} tone="text-fall" />
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">이름·기숙사 검색</span>
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름·기숙사 검색"
            className="field w-full py-2.5 pl-10 pr-3 text-sm placeholder:text-slate-500"
          />
        </label>
        <div className="flex rounded-2xl border border-white/6 bg-white/[0.03] p-1 text-sm" role="group" aria-label="정렬">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              aria-pressed={sort === s.key}
              className={`pressable flex-1 rounded-xl px-3.5 py-1.5 font-medium sm:flex-none ${
                sort === s.key ? "bg-white/10 text-slate-50 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <SkeletonRows />
        ) : error ? (
          <Empty>시장 정보를 불러오지 못했어요. ({error})</Empty>
        ) : list.length === 0 ? (
          <Empty>{query ? "검색 결과가 없어요." : "아직 상장된 학생이 없어요. 첫 교시를 완주해 보세요!"}</Empty>
        ) : (
          <ul className="divide-y divide-white/5">
            {list.map((s) => (
              <StockRow key={s.discord_id} stock={s} isMe={s.discord_id === me} heldQty={holdings.get(s.discord_id)?.qty ?? 0} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="panel rounded-2xl px-3 py-3 sm:px-4 sm:py-4">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${tone}`}>{value}</p>
    </div>
  );
}

function StockRow({ stock, isMe, heldQty }: { stock: LiveStock; isMe: boolean; heldQty: number }) {
  const ratio = changeRatio(stock.price, stock.day_open);
  const flashClass = stock.flash === "up" ? "flash-up" : stock.flash === "down" ? "flash-down" : "";
  return (
    <li>
      <Link
        href={`/stocks/${encodeURIComponent(stock.discord_id)}`}
        className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.035] active:bg-white/[0.06] sm:px-5"
      >
        <StockAvatar name={stock.display_name} house={stock.house} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold text-slate-100">{stock.display_name}</span>
            {isMe && <MeChip />}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <HouseBadge house={stock.house} />
            {heldQty > 0 && <span className="truncate">보유 {heldQty.toLocaleString("ko-KR")}주</span>}
          </div>
        </div>
        {/* flashKey 가 바뀌면 다시 마운트되어 애니메이션이 재생된다 */}
        <div key={stock.flashKey} className={`shrink-0 rounded-xl px-2 py-1 text-right ${stock.flashKey > 0 ? flashClass : ""}`}>
          <Galleon value={stock.price} price className="text-[15px] font-semibold text-slate-50" />
          <div className="mt-0.5 text-[13px] font-medium">
            <ChangePct ratio={ratio} />
          </div>
        </div>
      </Link>
    </li>
  );
}
