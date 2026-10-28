-- 종목이 없는 계좌 주인(기숙사 미배정 · 사감)도 서버 닉네임으로 보이게 한다.
--
-- 종목 이름은 봇 이벤트가 서버 닉네임으로 채우지만, 기숙사가 없으면 종목이 없어
-- 명예의 전당은 디스코드 이름(profiles)으로, 매매 소식은 "익명의 마법사" 로
-- 떨어졌다. 봇이 `/증권 입금` 때 서버 닉네임을 함께 보내 accounts 에 남긴다.

alter table public.accounts add column display_name text;

-- 인자를 하나 늘린다. 옛 4인자 함수를 남겨 두면 PostgREST 가 이름 붙은 4인자
-- 호출을 두 함수 중 어디로 보낼지 정하지 못하므로 지우고 새로 만든다.
-- p_display_name 은 기본값이 있어 옛 봇(4인자 호출)도 그대로 동작한다.
drop function public.bank_deposit(text, text, text, bigint);

create function public.bank_deposit(
  p_transfer_id text, p_guild text, p_discord text, p_amount bigint, p_display_name text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  new_cash bigint;
begin
  insert into public.transfers (id, guild_id, discord_id, kind, amount, status)
  values (p_transfer_id, p_guild, p_discord, 'deposit', p_amount, 'done')
  on conflict (id) do nothing;

  if found then
    insert into public.accounts (guild_id, discord_id, cash, display_name)
    values (p_guild, p_discord, p_amount, p_display_name)
    on conflict (guild_id, discord_id) do update
      set cash = accounts.cash + excluded.cash,
          display_name = coalesce(excluded.display_name, accounts.display_name),
          updated_at = now()
    returning cash into new_cash;
    return jsonb_build_object('status', 'done', 'cash', new_cash);
  end if;

  select cash into new_cash from public.accounts where guild_id = p_guild and discord_id = p_discord;
  return jsonb_build_object('status', 'duplicate', 'cash', new_cash);
end $$;

revoke all on function public.bank_deposit(text, text, text, bigint, text) from public, anon, authenticated;

create or replace function public.leaderboard(p_guild text)
returns table (discord_id text, display_name text, cash bigint, stock_value bigint, net_worth bigint)
language sql stable security definer set search_path = public as $$
  select a.discord_id,
         coalesce(st.display_name, a.display_name, pr.display_name, '익명의 마법사'),
         a.cash,
         coalesce(v.value, 0)::bigint,
         (a.cash + coalesce(v.value, 0))::bigint
    from public.accounts a
    left join public.stocks st on st.guild_id = a.guild_id and st.discord_id = a.discord_id
    left join public.profiles pr on pr.discord_id = a.discord_id
    left join lateral (
      select floor(sum(h.qty * s.price)) as value
        from public.holdings h
        join public.stocks s on s.guild_id = h.guild_id and s.discord_id = h.stock_id
       where h.guild_id = a.guild_id and h.owner_id = a.discord_id
    ) v on true
   where a.guild_id = p_guild and public.is_guild_member(p_guild)
   order by 5 desc
$$;

-- 종목이 없는 계좌 주인의 이름표. 매매 소식에서 owner_id 를 이름으로 바꿀 때 쓴다.
-- 잔액은 내주지 않는다 (accounts RLS 는 본인 행만 보이므로 이름만 따로 연다).
create function public.account_names(p_guild text)
returns table (discord_id text, display_name text)
language sql stable security definer set search_path = public as $$
  select a.discord_id, a.display_name
    from public.accounts a
   where a.guild_id = p_guild and a.display_name is not null and public.is_guild_member(p_guild)
$$;

revoke all on function public.account_names(text) from public, anon;
grant execute on function public.account_names(text) to authenticated;
