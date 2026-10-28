-- 카르텔 마법학교 주식시장 — 초기 스키마
--
-- 흐름
--   봇 ──insert market_events──▶ 트리거가 주가 갱신 ──Realtime──▶ 사이트
--   봇 ──bank_deposit / bank_withdraw RPC──▶ accounts (갈레온 입출금)
--   사이트 ──trade RPC──▶ accounts · holdings · stocks
--
-- 갈레온 잔액의 원본은 봇(bot-data.json)이다. 여기 accounts.cash 는 "증권계좌"에
-- 옮겨 둔 갈레온이고, 봇 지갑과 이 계좌 사이 이동은 transfers 가 장부 역할을 한다.
-- 쓰기는 전부 security definer 함수로만 한다. 테이블에 insert/update 정책은 없다.

-- ───────────────────────────── 설정 ─────────────────────────────

create table public.market_config (
  id                 boolean primary key default true check (id),
  fee_rate           numeric not null default 0.01,   -- 매매 수수료 (소멸 = 갈레온 소비처)
  daily_deposit_cap  bigint  not null default 100,    -- 하루(KST) 입금 한도
  base_price         numeric not null default 10,     -- 신규 상장가 · 평균 회귀 목표
  min_price          numeric not null default 1,
  reversion_rate     numeric not null default 0.05,   -- 매일 기준가와의 격차 중 이만큼 되돌림
  trade_impact       numeric not null default 0.002,  -- 1주당 가격 충격
  max_trade_impact   numeric not null default 0.05,
  max_trade_qty      integer not null default 1000
);
insert into public.market_config default values;

-- 봇 이벤트 종류별 주가 변동률. weight(0~3)를 곱해 적용한다.
create table public.event_effects (
  type   text primary key,
  pct    numeric not null,
  label  text not null
);
insert into public.event_effects (type, pct, label) values
  ('period_complete', 0.02,  '교시 완주'),
  ('attendance',      0.005, '출석'),
  ('golden_snitch',   0.10,  '황금 스니치 포획'),
  ('golden_egg',      0.05,  '황금 알 획득'),
  ('comeback',        0.03,  '복귀'),
  ('warning',        -0.01,  '집중 경고'),
  ('penalty',        -0.04,  '벌점');

-- ───────────────────────────── 테이블 ─────────────────────────────

create table public.profiles (
  user_id     uuid primary key references auth.users on delete cascade,
  discord_id  text not null unique,
  display_name text,
  avatar_url  text
);

create table public.stocks (
  guild_id      text not null,
  discord_id    text not null,
  display_name  text not null,
  house         text,
  price         numeric(12,2) not null,
  base_price    numeric(12,2) not null,
  day_open      numeric(12,2) not null,
  last_event_at timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (guild_id, discord_id)
);

create table public.market_events (
  id          bigserial primary key,
  guild_id    text not null,
  discord_id  text not null,
  type        text not null,
  payload     jsonb not null default '{}',
  display_name text not null,
  house       text,
  dedupe_key  text not null unique,
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index market_events_feed_idx on public.market_events (guild_id, id desc);

create table public.price_ticks (
  id          bigserial primary key,
  guild_id    text not null,
  discord_id  text not null,
  price       numeric(12,2) not null,
  change_pct  numeric not null,
  cause       text not null check (cause in ('listing', 'event', 'trade', 'reversion')),
  ref_id      bigint,
  created_at  timestamptz not null default now(),
  foreign key (guild_id, discord_id) references public.stocks on delete cascade
);
create index price_ticks_stock_idx on public.price_ticks (guild_id, discord_id, id desc);

create table public.accounts (
  guild_id    text not null,
  discord_id  text not null,
  cash        bigint not null default 0 check (cash >= 0),
  updated_at  timestamptz not null default now(),
  primary key (guild_id, discord_id)
);

create table public.holdings (
  guild_id    text not null,
  owner_id    text not null,
  stock_id    text not null,
  qty         integer not null check (qty > 0),
  cost_basis  bigint not null,
  primary key (guild_id, owner_id, stock_id)
);

create table public.trades (
  id          bigserial primary key,
  guild_id    text not null,
  owner_id    text not null,
  stock_id    text not null,
  side        text not null check (side in ('buy', 'sell')),
  qty         integer not null,
  exec_price  numeric(12,2) not null,
  gross       bigint not null,
  fee         bigint not null,
  created_at  timestamptz not null default now()
);
create index trades_feed_idx on public.trades (guild_id, id desc);

-- 봇 지갑 ↔ 증권계좌 이동 장부. id 는 봇이 만든 transfer id (멱등 키).
create table public.transfers (
  id          text primary key,
  guild_id    text not null,
  discord_id  text not null,
  kind        text not null check (kind in ('deposit', 'withdraw')),
  amount      bigint not null check (amount > 0),
  -- deposit: done (계좌 입금 완료)
  -- withdraw: debited (계좌 차감, 봇 지갑 지급 대기) → settled (봇 지급 완료)
  status      text not null check (status in ('done', 'debited', 'settled')),
  created_at  timestamptz not null default now(),
  settled_at  timestamptz
);
create index transfers_quota_idx on public.transfers (guild_id, discord_id, kind, created_at);

-- ───────────────────────────── 헬퍼 ─────────────────────────────

create function public.my_discord_id() returns text
language sql stable security definer set search_path = public as $$
  select discord_id from public.profiles where user_id = auth.uid()
$$;

-- 이 길드에서 한 번이라도 공부(상장)했거나 계좌가 있는 사람만 시장을 볼 수 있다.
-- 디스코드 로그인은 누구나 할 수 있으므로 이걸로 서버 밖 사람을 막는다.
create function public.is_guild_member(p_guild text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.stocks   where guild_id = p_guild and discord_id = public.my_discord_id())
      or exists (select 1 from public.accounts where guild_id = p_guild and discord_id = public.my_discord_id())
$$;

create function public.kst_day_start() returns timestamptz
language sql stable as $$
  select date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
$$;

-- 디스코드 로그인 시 profiles 생성. Supabase Discord provider 는 provider_id 에 유저 id 를 넣는다.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, discord_id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'provider_id', new.raw_user_meta_data->>'sub'),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────────── 이벤트 → 주가 ─────────────────────────────

create function public.apply_market_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cfg     public.market_config;
  eff     numeric;
  weight  numeric;
  s       public.stocks;
  new_price    numeric;
begin
  select * into cfg from public.market_config;
  select pct into eff from public.event_effects where type = new.type;
  weight := least(3, greatest(0, coalesce((new.payload->>'weight')::numeric, 1)));

  -- 첫 이벤트면 상장
  insert into public.stocks (guild_id, discord_id, display_name, house, price, base_price, day_open)
  values (new.guild_id, new.discord_id, new.display_name, new.house, cfg.base_price, cfg.base_price, cfg.base_price)
  on conflict (guild_id, discord_id) do nothing;
  if found then
    insert into public.price_ticks (guild_id, discord_id, price, change_pct, cause, ref_id)
    values (new.guild_id, new.discord_id, cfg.base_price, 0, 'listing', new.id);
  end if;

  select * into s from public.stocks
   where guild_id = new.guild_id and discord_id = new.discord_id
   for update;

  new_price := greatest(cfg.min_price, round(s.price * (1 + coalesce(eff, 0) * weight), 2));

  update public.stocks
     set price = new_price,
         display_name = new.display_name,
         house = coalesce(new.house, house),
         last_event_at = new.occurred_at,
         updated_at = now()
   where guild_id = s.guild_id and discord_id = s.discord_id;

  if new_price <> s.price then
    insert into public.price_ticks (guild_id, discord_id, price, change_pct, cause, ref_id)
    values (s.guild_id, s.discord_id, new_price, round((new_price - s.price) / s.price, 4), 'event', new.id);
  end if;
  return new;
end $$;

create trigger on_market_event
  after insert on public.market_events
  for each row execute function public.apply_market_event();

-- 매일 00:00 KST: 기준가 쪽으로 되돌리고 당일 시가를 기록한다.
create function public.apply_daily_reversion() returns void
language plpgsql security definer set search_path = public as $$
declare
  cfg public.market_config;
  s   public.stocks;
  new_price numeric;
begin
  select * into cfg from public.market_config;
  for s in select * from public.stocks for update loop
    new_price := greatest(cfg.min_price, round(s.price + (s.base_price - s.price) * cfg.reversion_rate, 2));
    update public.stocks set price = new_price, day_open = new_price, updated_at = now()
     where guild_id = s.guild_id and discord_id = s.discord_id;
    if new_price <> s.price then
      insert into public.price_ticks (guild_id, discord_id, price, change_pct, cause)
      values (s.guild_id, s.discord_id, new_price, round((new_price - s.price) / s.price, 4), 'reversion');
    end if;
  end loop;
end $$;

create extension if not exists pg_cron;
select cron.schedule('market-daily-reversion', '0 15 * * *', 'select public.apply_daily_reversion()');

-- ───────────────────────────── 매매 (사이트) ─────────────────────────────
--
-- 체결가는 충격 전후 가격의 중간값이다. 충격 전 가격으로 체결하면
-- "대량 매수 → 오른 가격에 매도" 가 무위험 차익이 되기 때문.

create function public.trade(p_guild text, p_stock text, p_side text, p_qty integer)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cfg     public.market_config;
  me      text := public.my_discord_id();
  s       public.stocks;
  acct    public.accounts;
  h       public.holdings;
  impact  numeric;
  exec_px    numeric;
  new_price    numeric;
  gross   bigint;
  fee     bigint;
  trade_id bigint;
begin
  if me is null then raise exception 'not_logged_in'; end if;
  if p_side not in ('buy', 'sell') then raise exception 'bad_side'; end if;
  select * into cfg from public.market_config;
  if p_qty is null or p_qty < 1 or p_qty > cfg.max_trade_qty then raise exception 'bad_qty'; end if;
  if p_stock = me then raise exception 'self_trade'; end if;

  select * into s from public.stocks where guild_id = p_guild and discord_id = p_stock for update;
  if not found then raise exception 'no_stock'; end if;

  insert into public.accounts (guild_id, discord_id) values (p_guild, me) on conflict do nothing;
  select * into acct from public.accounts where guild_id = p_guild and discord_id = me for update;

  impact := least(cfg.max_trade_impact, cfg.trade_impact * p_qty);

  if p_side = 'buy' then
    exec_px  := round(s.price * (1 + impact / 2), 2);
    new_price  := round(s.price * (1 + impact), 2);
    gross := ceil(exec_px * p_qty);
    fee   := greatest(1, ceil(gross * cfg.fee_rate));
    if acct.cash < gross + fee then raise exception 'insufficient_cash'; end if;

    update public.accounts set cash = cash - gross - fee, updated_at = now()
     where guild_id = p_guild and discord_id = me;
    insert into public.holdings (guild_id, owner_id, stock_id, qty, cost_basis)
    values (p_guild, me, p_stock, p_qty, gross + fee)
    on conflict (guild_id, owner_id, stock_id)
    do update set qty = holdings.qty + excluded.qty, cost_basis = holdings.cost_basis + excluded.cost_basis;
  else
    select * into h from public.holdings
     where guild_id = p_guild and owner_id = me and stock_id = p_stock for update;
    if not found or h.qty < p_qty then raise exception 'insufficient_shares'; end if;

    exec_px  := round(s.price * (1 - impact / 2), 2);
    new_price  := greatest(cfg.min_price, round(s.price * (1 - impact), 2));
    gross := floor(exec_px * p_qty);
    fee   := least(gross, greatest(1, ceil(gross * cfg.fee_rate)));

    update public.accounts set cash = cash + gross - fee, updated_at = now()
     where guild_id = p_guild and discord_id = me;
    if h.qty = p_qty then
      delete from public.holdings where guild_id = p_guild and owner_id = me and stock_id = p_stock;
    else
      update public.holdings
         set qty = qty - p_qty,
             cost_basis = cost_basis - round(cost_basis * p_qty::numeric / h.qty)
       where guild_id = p_guild and owner_id = me and stock_id = p_stock;
    end if;
  end if;

  update public.stocks set price = new_price, updated_at = now()
   where guild_id = p_guild and discord_id = p_stock;

  insert into public.trades (guild_id, owner_id, stock_id, side, qty, exec_price, gross, fee)
  values (p_guild, me, p_stock, p_side, p_qty, exec_px, gross, fee)
  returning id into trade_id;

  insert into public.price_ticks (guild_id, discord_id, price, change_pct, cause, ref_id)
  values (p_guild, p_stock, new_price, round((new_price - s.price) / s.price, 4), 'trade', trade_id);

  return jsonb_build_object('trade_id', trade_id, 'exec_price', exec_px, 'gross', gross, 'fee', fee, 'price', new_price);
end $$;

create function public.leaderboard(p_guild text)
returns table (discord_id text, display_name text, cash bigint, stock_value bigint, net_worth bigint)
language sql stable security definer set search_path = public as $$
  select a.discord_id,
         coalesce(st.display_name, a.discord_id),
         a.cash,
         coalesce(v.value, 0)::bigint,
         (a.cash + coalesce(v.value, 0))::bigint
    from public.accounts a
    left join public.stocks st on st.guild_id = a.guild_id and st.discord_id = a.discord_id
    left join lateral (
      select floor(sum(h.qty * s.price)) as value
        from public.holdings h
        join public.stocks s on s.guild_id = h.guild_id and s.discord_id = h.stock_id
       where h.guild_id = a.guild_id and h.owner_id = a.discord_id
    ) v on true
   where a.guild_id = p_guild and public.is_guild_member(p_guild)
   order by 5 desc
$$;

-- ───────────────────────────── 입출금 (봇 전용) ─────────────────────────────
--
-- 모두 transfer id 로 멱등이다. 봇이 재시도해도 두 번 반영되지 않는다.

create function public.bank_deposit_quota(p_guild text, p_discord text) returns bigint
language sql stable security definer set search_path = public as $$
  select greatest(0, (select daily_deposit_cap from public.market_config) - coalesce(sum(amount), 0))::bigint
    from public.transfers
   where guild_id = p_guild and discord_id = p_discord and kind = 'deposit'
     and created_at >= public.kst_day_start()
$$;

-- 봇이 지갑에서 이미 뺀 갈레온을 계좌에 넣는다. 한도 검사는 봇이 quota 로 먼저 한다 —
-- 여기서 거절하면 봇 지갑에서 빠진 갈레온이 갈 곳이 없어지므로 거절하지 않는다.
create function public.bank_deposit(p_transfer_id text, p_guild text, p_discord text, p_amount bigint)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  new_cash bigint;
begin
  insert into public.transfers (id, guild_id, discord_id, kind, amount, status)
  values (p_transfer_id, p_guild, p_discord, 'deposit', p_amount, 'done')
  on conflict (id) do nothing;

  if found then
    insert into public.accounts (guild_id, discord_id, cash) values (p_guild, p_discord, p_amount)
    on conflict (guild_id, discord_id) do update set cash = accounts.cash + excluded.cash, updated_at = now()
    returning cash into new_cash;
    return jsonb_build_object('status', 'done', 'cash', new_cash);
  end if;

  select cash into new_cash from public.accounts where guild_id = p_guild and discord_id = p_discord;
  return jsonb_build_object('status', 'duplicate', 'cash', new_cash);
end $$;

-- 계좌에서 먼저 차감한다(debited). 봇은 지갑 지급 후 bank_settle_withdrawal 로 확정한다.
create function public.bank_withdraw(p_transfer_id text, p_guild text, p_discord text, p_amount bigint)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t    public.transfers;
  acct public.accounts;
begin
  select * into t from public.transfers where id = p_transfer_id;
  if found then
    return jsonb_build_object('status', t.status, 'amount', t.amount);
  end if;

  select * into acct from public.accounts where guild_id = p_guild and discord_id = p_discord for update;
  if not found or acct.cash < p_amount then
    return jsonb_build_object('status', 'insufficient', 'cash', coalesce(acct.cash, 0));
  end if;

  update public.accounts set cash = cash - p_amount, updated_at = now()
   where guild_id = p_guild and discord_id = p_discord;
  insert into public.transfers (id, guild_id, discord_id, kind, amount, status)
  values (p_transfer_id, p_guild, p_discord, 'withdraw', p_amount, 'debited');
  return jsonb_build_object('status', 'debited', 'cash', acct.cash - p_amount);
end $$;

create function public.bank_settle_withdrawal(p_transfer_id text) returns void
language sql security definer set search_path = public as $$
  update public.transfers set status = 'settled', settled_at = now()
   where id = p_transfer_id and kind = 'withdraw' and status = 'debited'
$$;

-- 봇 부팅 시 복구용: 계좌에선 빠졌는데 봇 지갑 지급이 확정되지 않은 출금.
create function public.bank_pending_withdrawals(p_guild text)
returns setof public.transfers
language sql stable security definer set search_path = public as $$
  select * from public.transfers
   where guild_id = p_guild and kind = 'withdraw' and status = 'debited'
   order by created_at
$$;

create function public.bank_balance(p_guild text, p_discord text) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce((select cash from public.accounts where guild_id = p_guild and discord_id = p_discord), 0)
$$;

-- ───────────────────────────── 권한 ─────────────────────────────

revoke all on function
  public.bank_deposit_quota(text, text),
  public.bank_deposit(text, text, text, bigint),
  public.bank_withdraw(text, text, text, bigint),
  public.bank_settle_withdrawal(text),
  public.bank_pending_withdrawals(text),
  public.bank_balance(text, text),
  public.apply_daily_reversion()
from public, anon, authenticated;

revoke all on function public.trade(text, text, text, integer), public.leaderboard(text) from public, anon;
grant execute on function public.trade(text, text, text, integer), public.leaderboard(text) to authenticated;

alter table public.market_config  enable row level security;
alter table public.event_effects  enable row level security;
alter table public.profiles       enable row level security;
alter table public.stocks         enable row level security;
alter table public.market_events  enable row level security;
alter table public.price_ticks    enable row level security;
alter table public.accounts       enable row level security;
alter table public.holdings       enable row level security;
alter table public.trades         enable row level security;
alter table public.transfers      enable row level security;

create policy "read config"   on public.market_config for select to authenticated using (true);
create policy "read effects"  on public.event_effects for select to authenticated using (true);
create policy "own profile"   on public.profiles      for select to authenticated using (user_id = auth.uid());
create policy "member stocks" on public.stocks        for select to authenticated using (public.is_guild_member(guild_id));
create policy "member events" on public.market_events for select to authenticated using (public.is_guild_member(guild_id));
create policy "member ticks"  on public.price_ticks   for select to authenticated using (public.is_guild_member(guild_id));
create policy "member trades" on public.trades        for select to authenticated using (public.is_guild_member(guild_id));
create policy "own account"   on public.accounts      for select to authenticated using (discord_id = public.my_discord_id());
create policy "own holdings"  on public.holdings      for select to authenticated using (owner_id = public.my_discord_id());
create policy "own transfers" on public.transfers     for select to authenticated using (discord_id = public.my_discord_id());

alter publication supabase_realtime add table
  public.stocks, public.price_ticks, public.market_events, public.trades, public.accounts, public.holdings;
