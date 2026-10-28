"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CreditPosition, Holding, Order, ShortPosition } from "@/lib/database.types";
import { useMemberSession } from "./session-provider";

type AccountContextValue = {
  loading: boolean;
  /** 주문가능 현금. 계좌가 아직 없으면 0 */
  cash: number;
  hasAccount: boolean;
  holdings: Map<string, Holding>;
  /** 열린 지정가 주문 (최신순) */
  openOrders: Order[];
  /** 지정가 매수 주문에 묶인 갈레온 합계 */
  reservedCash: number;
  credit: Map<string, CreditPosition>;
  shorts: Map<string, ShortPosition>;
  refresh: () => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { supabase, guildId, me } = useMemberSession();
  const [loading, setLoading] = useState(true);
  const [cash, setCash] = useState(0);
  const [hasAccount, setHasAccount] = useState(false);
  const [holdings, setHoldings] = useState<Map<string, Holding>>(new Map());
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [credit, setCredit] = useState<Map<string, CreditPosition>>(new Map());
  const [shorts, setShorts] = useState<Map<string, ShortPosition>>(new Map());

  // 실시간 이벤트가 몰리면 refresh 가 겹친다. 늦게 도착한 옛 응답이 새 값을 덮지 않게 마지막 요청만 반영한다.
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++latest.current;
    const [acctRes, holdRes, orderRes, creditRes, shortRes] = await Promise.all([
      supabase.from("accounts").select("*").eq("guild_id", guildId).eq("discord_id", me).maybeSingle(),
      // 전량 매도한 종목은 qty 0 으로 남는다 (마이그레이션 holdings 주석 참고).
      supabase.from("holdings").select("*").eq("guild_id", guildId).eq("owner_id", me).gt("qty", 0),
      supabase
        .from("orders")
        .select("*")
        .eq("guild_id", guildId)
        .eq("owner_id", me)
        .eq("status", "open")
        .order("id", { ascending: false }),
      supabase.from("credit_positions").select("*").eq("guild_id", guildId).eq("owner_id", me).gt("qty", 0),
      supabase.from("short_positions").select("*").eq("guild_id", guildId).eq("owner_id", me).gt("qty", 0),
    ]);
    if (seq !== latest.current) return;
    if (!acctRes.error) {
      setCash(acctRes.data?.cash ?? 0);
      setHasAccount(acctRes.data != null);
    }
    if (!holdRes.error) setHoldings(new Map(holdRes.data.map((h) => [h.stock_id, h])));
    if (!orderRes.error) setOpenOrders(orderRes.data);
    if (!creditRes.error) setCredit(new Map(creditRes.data.map((c) => [c.stock_id, c])));
    if (!shortRes.error) setShorts(new Map(shortRes.data.map((c) => [c.stock_id, c])));
    setLoading(false);
  }, [supabase, guildId, me]);

  useEffect(() => {
    // 계좌·보유·주문은 내 것만 RLS 로 보인다. 변경 내용과 상관없이 다시 읽는 게 가장 단순하고 정확하다
    const onChange = () => void refresh();
    const channel = supabase
      .channel(`account:${guildId}:${me}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts", filter: `discord_id=eq.${me}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "holdings", filter: `owner_id=eq.${me}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `owner_id=eq.${me}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "credit_positions", filter: `owner_id=eq.${me}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "short_positions", filter: `owner_id=eq.${me}` }, onChange)
      .subscribe((status) => {
        // 연결 실패해도 처음 한 번은 읽어 둔다.
        if (status !== "CLOSED") void refresh();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, guildId, me, refresh]);

  const reservedCash = useMemo(
    () => openOrders.reduce((sum, o) => sum + (o.side === "buy" ? o.reserved_cash : 0), 0),
    [openOrders],
  );

  const value = useMemo(
    () => ({ loading, cash, hasAccount, holdings, openOrders, reservedCash, credit, shorts, refresh }),
    [loading, cash, hasAccount, holdings, openOrders, reservedCash, credit, shorts, refresh],
  );
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount 는 AccountProvider 안에서만 쓸 수 있어요");
  return ctx;
}
