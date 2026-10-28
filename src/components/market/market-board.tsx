"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount } from "@/components/providers/account-provider";
import { useMarket, type LiveStock } from "@/components/providers/market-provider";
import { useMemberSession } from "@/components/providers/session-provider";
import { Card, Empty, PageTitle, Spinner } from "@/components/ui/card";
import { ChangePct, Galleon } from "@/components/ui/galleon";
import { HouseBadge } from "@/components/ui/house-badge";
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
      <PageTitle title="오늘의 시장" subtitle="등락률은 오늘 00시(KST) 시가 기준이에요. 주가는 실시간으로 바뀌어요." />

      <div className="mb-4 grid grid-cols-3 gap-2 text-center text-sm">
        <Card className="!p-3">
          <p className="text-slate-400">상장 학생</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{stocks.size}</p>
        </Card>
        <Card className="!p-3">
          <p className="text-slate-400">상승</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-rise">{ups}</p>
        </Card>
        <Card className="!p-3">
          <p className="text-slate-400">하락</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-fall">{downs}</p>
        </Card>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·기숙사 검색"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-gold/50 focus:outline-none"
        />
        <div className="flex rounded-xl border border-white/10 p-0.5 text-sm" role="group" aria-label="정렬">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              aria-pressed={sort === s.key}
              className={`rounded-lg px-3 py-1.5 ${sort === s.key ? "bg-white/10 text-gold" : "text-slate-400"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <Spinner />
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

function StockRow({ stock, isMe, heldQty }: { stock: LiveStock; isMe: boolean; heldQty: number }) {
  const ratio = changeRatio(stock.price, stock.day_open);
  const flashClass = stock.flash === "up" ? "flash-up" : stock.flash === "down" ? "flash-down" : "";
  return (
    <li>
      <Link
        href={`/stocks/${encodeURIComponent(stock.discord_id)}`}
        className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.04]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{stock.display_name}</span>
            {isMe && <span className="rounded bg-gold/15 px-1.5 text-[11px] text-gold">나</span>}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <HouseBadge house={stock.house} />
            {heldQty > 0 && <span>보유 {heldQty.toLocaleString("ko-KR")}주</span>}
          </div>
        </div>
        {/* flashKey 가 바뀌면 다시 마운트되어 애니메이션이 재생된다 */}
        <div key={stock.flashKey} className={`rounded-lg px-2 py-1 text-right ${stock.flashKey > 0 ? flashClass : ""}`}>
          <Galleon value={stock.price} price className="font-semibold" />
          <div className="text-xs">
            <ChangePct ratio={ratio} />
          </div>
        </div>
      </Link>
    </li>
  );
}
