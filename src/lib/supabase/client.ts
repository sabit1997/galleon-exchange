import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getPublicEnv } from "@/lib/env";

export type TypedClient = SupabaseClient<Database>;

let client: TypedClient | null = null;

/** 브라우저용 Supabase 클라이언트. 환경변수가 없으면 null — 빌드/프리렌더에서도 안전하다. */
export function getBrowserSupabase(): TypedClient | null {
  const env = getPublicEnv();
  if (!env) return null;
  if (!client) client = createBrowserClient<Database>(env.url, env.anonKey);
  return client;
}
