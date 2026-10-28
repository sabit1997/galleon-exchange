"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "@/components/providers/account-provider";
import { useMarket } from "@/components/providers/market-provider";
import { useMemberSession } from "@/components/providers/session-provider";
import { Card, Empty, Spinner } from "@/components/ui/card";
import { ChangePct, Galleon, toneClass } from "@/components/ui/galleon";
import { HouseBadge } from "@/components/ui/house-badge";
import { useNow } from "@/hooks/use-now";
import type { MarketEvent, PriceTick } from "@/lib/database.types";
import { formatRelativeTime, formatSignedGalleon } from "@/lib/format";
import { changeRatio, holdingValuation, toChartPoints } from "@/lib/market";
import { EventLabel, eventIcon } from "./event-text";
import { PriceChart } from "./price-chart";
import { TradeForm } from "./trade-form";

const TICK_LIMIT = 500;
const EVENT_LIMIT = 20;

export function StockDetail() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const { supabase, guildId } = useMemberSession();
  const { stocks, config, loading } = useMarket();
  const { holdings } = useAccount();
  const now = useNow();
  const stock = stocks.get(id);

  const [ticks, setTicks] = useState<PriceTick[] | null>(null);
  const [events, setEvents] = useState<MarketEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [tickRes, eventRes] = await Promise.all([
        supabase
          .from("price_ticks")
          .select("*")
          .eq("guild_id", guildId)
          .eq("discord_id", id)
          .order("id", { ascending: false })
          .limit(TICK_LIMIT),
        supabase
          .from("market_events")
          .select("*")
          .eq("guild_id", guildId)
          .eq("discord_id", id)
          .order("id", { ascending: false })
          .limit(EVENT_LIMIT),
      ]);
      if (cancelled) return;
      setTicks(tickRes.data ?? []);
      setEvents(eventRes.data ?? []);
    };

    const channel = supabase
      .channel(`stock:${guildId}:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "price_ticks", filter: `discord_id=eq.${id}` },
        (payload) => {
          const row = payload.new as PriceTick;
          if (row.guild_id !== guildId) return;
          setTicks((prev) => (prev && !prev.some((t) => t.id === row.id) ? [row, ...prev].slice(0, TICK_LIMIT) : prev));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "market_events", filter: `discord_id=eq.${id}` },
        (payload) => {
          const row = payload.new as MarketEvent;
          if (row.guild_id !== guildId) return;
          setEvents((prev) => (prev && !prev.some((e) => e.id === row.id) ? [row, ...prev].slice(0, EVENT_LIMIT) : prev));
        },
      )
      .subscribe((status) => {
        if (status !== "CLOSED") void load();
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, guildId, id]);

  const points = useMemo(() => toChartPoints(ticks ?? []), [ticks]);

  if (loading) return <Spinner />;
  if (!stock) {
    return (
      <Card>
        <Empty>
          상장되지 않은 학생이에요.{" "}
          <Link href="/" className="text-gold underline">
            시장으로 돌아가기
          </Link>
        </Empty>
      </Card>
    );
  }

  const ratio = changeRatio(stock.price, stock.day_open);
  const holding = holdings.get(stock.discord_id);
  const valuation = holding ? holdingValuation(holding.qty, holding.cost_basis, stock.price) : null;
  const firstPrice = points[0]?.value ?? stock.price;

  return (
    <div className="space-y-4">
      <Link href="/" className="inline-block text-sm text-slate-400 hover:text-gold">
        ← 시장
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display gilded text-2xl font-bold sm:text-3xl">{stock.display_name}</h1>
            <HouseBadge house={stock.house} />
          </div>
          {stock.last_event_at && (
            <p className="mt-1 text-xs text-slate-500">마지막 소식 {formatRelativeTime(stock.last_event_at, now)}</p>
          )}
        </div>
        <div key={stock.flashKey} className={`rounded-lg px-2 text-right ${stock.flashKey > 0 ? `flash-${stock.flash}` : ""}`}>
          <Galleon value={stock.price} price className="text-3xl font-bold" />
          <p className="text-sm">
            <span className="mr-1 text-slate-500">오늘</span>
            <ChangePct ratio={ratio} />
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            {ticks === null ? (
              <Spinner />
            ) : points.length < 2 ? (
              <Empty>차트를 그릴 만큼 거래 기록이 쌓이지 않았어요.</Empty>
            ) : (
              <PriceChart points={points} up={stock.price >= firstPrice} />
            )}
            <p className="mt-2 text-right text-xs text-slate-500">
              시가 <Galleon value={stock.day_open} price /> · 기준가 <Galleon value={stock.base_price} price />
            </p>
          </Card>

          <Card>
            <h2 className="font-display mb-3 font-semibold text-slate-100">📜 최근 소식</h2>
            {events === null ? (
              <Spinner />
            ) : events.length === 0 ? (
              <Empty>아직 소식이 없어요.</Empty>
            ) : (
              <ul className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 text-sm">
                    <span aria-hidden>{eventIcon(e.type)}</span>
                    <EventLabel event={e} />
                    <span className="ml-auto shrink-0 text-xs text-slate-500">{formatRelativeTime(e.occurred_at, now)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {holding && valuation && (
            <Card>
              <h2 className="font-display mb-2 font-semibold text-slate-100">내 보유</h2>
              <dl className="grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-slate-400">수량</dt>
                <dd className="text-right tabular-nums">{holding.qty.toLocaleString("ko-KR")}주</dd>
                <dt className="text-slate-400">평가금액</dt>
                <dd className="text-right">
                  <Galleon value={valuation.value} />
                </dd>
                <dt className="text-slate-400">평가손익</dt>
                <dd className={`text-right tabular-nums ${toneClass(valuation.pnl)}`}>
                  {formatSignedGalleon(valuation.pnl)} (<ChangePct ratio={valuation.pnlRatio} />)
                </dd>
              </dl>
            </Card>
          )}
          <Card>
            <h2 className="font-display mb-3 font-semibold text-slate-100">🪶 주문</h2>
            {config ? <TradeForm stock={stock} config={config} /> : <Empty>시장 설정을 불러오지 못했어요.</Empty>}
          </Card>
        </div>
      </div>
    </div>
  );
}
