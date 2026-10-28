-- Supabase 보안 advisor 정리.
--
-- Supabase 는 public 스키마의 새 함수에 anon/authenticated 실행 권한을 기본으로 준다.
-- 트리거 함수는 RPC 로 부를 이유가 없으니 막고, RLS 정책이 쓰는 헬퍼는 로그인
-- 사용자에게만 남긴다 (정책은 조회하는 역할의 권한으로 평가되므로 authenticated 는 필요).
-- trade · leaderboard 는 사이트가 로그인 상태로 부르는 의도된 공개 RPC 라 그대로 둔다.

alter function public.kst_day_start() set search_path = public;

revoke all on function public.apply_market_event() from public, anon, authenticated;
revoke all on function public.handle_new_user()    from public, anon, authenticated;

revoke all on function public.my_discord_id(), public.is_guild_member(text) from public, anon;
grant execute on function public.my_discord_id(), public.is_guild_member(text) to authenticated;
