"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Holding } from "@/lib/database.types";
import { useMemberSession } from "./session-provider";

type AccountContextValue = {
  loading: boolean;
  /** 계좌가 아직 없으면 0 */
  cash: number;
  hasAccount: boolean;
  holdings: Map<string, Holding>;
  refresh: () => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { supabase, guildId, me } = useMemberSession();
  const [loading, setLoading] = useState(true);
  const [cash, setCash] = useState(0);
  const [hasAccount, setHasAccount] = useState(false);
  const [holdings, setHoldings] = useState<Map<string, Holding>>(new Map());

  const refresh = useCallback(async () => {
    const [acctRes, holdRes] = await Promise.all([
      supabase.from("accounts").select("*").eq("guild_id", guildId).eq("discord_id", me).maybeSingle(),
      supabase.from("holdings").select("*").eq("guild_id", guildId).eq("owner_id", me),
    ]);
    if (!acctRes.error) {
      setCash(acctRes.data?.cash ?? 0);
      setHasAccount(acctRes.data != null);
    }
    if (!holdRes.error) setHoldings(new Map(holdRes.data.map((h) => [h.stock_id, h])));
    setLoading(false);
  }, [supabase, guildId, me]);

  useEffect(() => {
    // 계좌·보유는 내 것만 RLS 로 보인다. 변경 내용과 상관없이 다시 읽는 게 가장 단순하고 정확하다
    // (holdings DELETE 이벤트에는 기본 키만 온다).
    const channel = supabase
      .channel(`account:${guildId}:${me}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts", filter: `discord_id=eq.${me}` }, () => {
        void refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "holdings", filter: `owner_id=eq.${me}` }, () => {
        void refresh();
      })
      .subscribe((status) => {
        // 연결 실패해도 처음 한 번은 읽어 둔다.
        if (status !== "CLOSED") void refresh();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, guildId, me, refresh]);

  const value = useMemo(
    () => ({ loading, cash, hasAccount, holdings, refresh }),
    [loading, cash, hasAccount, holdings, refresh],
  );
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount 는 AccountProvider 안에서만 쓸 수 있어요");
  return ctx;
}
