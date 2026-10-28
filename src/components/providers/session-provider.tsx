"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Profile } from "@/lib/database.types";
import { getPublicEnv } from "@/lib/env";
import { getBrowserSupabase, type TypedClient } from "@/lib/supabase/client";

export type SessionStatus = "unconfigured" | "loading" | "signed_out" | "not_member" | "member" | "error";

type Membership = {
  userId: string;
  profile: Profile | null;
  isMember: boolean;
  error: string | null;
};

type SessionContextValue = {
  status: SessionStatus;
  supabase: TypedClient | null;
  guildId: string;
  session: Session | null;
  profile: Profile | null;
  /** 내 디스코드 id (profiles.discord_id) */
  me: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => getBrowserSupabase());
  const guildId = getPublicEnv()?.guildId ?? "";
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [attempt, setAttempt] = useState(0);

  // INITIAL_SESSION 이벤트가 구독 직후 한 번 온다. 콜백 안에서 supabase 호출을 await 하지 않는다.
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!supabase || !userId) return;
    let cancelled = false;
    (async () => {
      const [profileRes, memberRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.rpc("is_guild_member", { p_guild: guildId }),
      ]);
      if (cancelled) return;
      const error = profileRes.error?.message ?? memberRes.error?.message ?? null;
      setMembership({ userId, profile: profileRes.data ?? null, isMember: memberRes.data === true, error });
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId, guildId, attempt]);

  const signIn = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setMembership(null);
  }, [supabase]);

  const retry = useCallback(() => {
    setMembership(null);
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo<SessionContextValue>(() => {
    let status: SessionStatus;
    const current = membership && membership.userId === userId ? membership : null;
    if (!supabase || !guildId) status = "unconfigured";
    else if (!authReady) status = "loading";
    else if (!session) status = "signed_out";
    else if (!current) status = "loading";
    else if (current.error) status = "error";
    else if (!current.isMember) status = "not_member";
    else status = "member";
    return {
      status,
      supabase,
      guildId,
      session,
      profile: current?.profile ?? null,
      me: current?.profile?.discord_id ?? null,
      signIn,
      signOut,
      retry,
    };
  }, [supabase, guildId, authReady, session, membership, userId, signIn, signOut, retry]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession 은 SessionProvider 안에서만 쓸 수 있어요");
  return ctx;
}

/** 멤버 화면 전용: supabase 와 me 가 반드시 있는 상태. */
export function useMemberSession() {
  const ctx = useSession();
  if (ctx.status !== "member" || !ctx.supabase) {
    throw new Error("useMemberSession 은 멤버 게이트 안에서만 쓸 수 있어요");
  }
  return { ...ctx, supabase: ctx.supabase, me: ctx.me ?? "" };
}
