// NEXT_PUBLIC_* 값은 빌드 시점에 인라인된다. 정적 접근(process.env.NEXT_PUBLIC_X)만 써야 한다.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const guildId = process.env.NEXT_PUBLIC_GUILD_ID ?? "";

export type PublicEnv = { url: string; anonKey: string; guildId: string };

/** 세 값이 모두 있으면 반환, 하나라도 비어 있으면 null (빌드·미설정 환경). */
export function getPublicEnv(): PublicEnv | null {
  if (!url || !anonKey || !guildId) return null;
  return { url, anonKey, guildId };
}
