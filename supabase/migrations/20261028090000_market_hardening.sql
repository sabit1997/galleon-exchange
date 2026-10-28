-- 실전 시장 보강 (코드 리뷰 반영)
--
-- 1) 신용 · 공매도 손익을 정확히 보여 주려고 내가 낸 돈을 따로 남긴다.
--    credit_positions.own_paid  : 신용매수 때 현금에서 낸 보증금 + 수수료
--    short_positions.margin_paid: 공매도 때 현금에서 묶은 보증금
--    신용 손익 = 평가금액 − 대출금(이자 포함) − own_paid
--    공매도 손익 = 담보(수수료 · 세금 · 대차료 · 배당 반영) − 되사는 금액 − margin_paid
-- 2) 월요일 자정 작업: 실적 발표가 실패해도 나머지(주문 만료 · 이자 · 기준가)는 진행하고,
--    같은 주를 두 번 발표하지 않는다.
-- 3) 봇 이벤트의 presenceMinutes 가 숫자가 아니면 0 으로 본다.

alter table public.credit_positions add column own_paid bigint not null default 0;
alter table public.short_positions add column margin_paid bigint not null default 0;
-- 기존 포지션: 신용은 매수 총액 − 대출금, 공매도는 담보에서 매도대금 순액을 뺀 값으로 추정
update public.credit_positions set own_paid = greatest(0, cost_basis - loan) where qty > 0;
update public.short_positions
   set margin_paid = greatest(0, collateral - floor(sell_value * (1 - (select fee_rate + sell_tax_rate from public.market_config))))
 where qty > 0;

create or replace function public._study_minutes(p_guild text, p_stock text, p_from timestamptz, p_to timestamptz) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when e.payload->>'presenceMinutes' ~ '^[0-9]+(\.[0-9]+)?$'
                           then (e.payload->>'presenceMinutes')::numeric else 0 end), 0)::integer
    from public.market_events e
   where e.guild_id = p_guild and e.discord_id = p_stock and e.type = 'period_complete'
     and e.occurred_at >= p_from and e.occurred_at < p_to
$$;

create or replace function public._execute(
  p_guild text, p_owner text, p_stock text, p_side text, p_qty integer,
  p_position text, p_order_type text default 'market', p_forced boolean default false,
  p_prepaid bigint default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cfg     public.market_config;
  s       public.stocks;
  q       record;
  acct    public.accounts;
  h       public.holdings;
  cp      public.credit_positions;
  sp      public.short_positions;
  fee     bigint;
  tax     bigint := 0;
  own     bigint;
  v_loan  bigint;
  repay   bigint;
  release bigint;
  margin  bigint;
  net     bigint;
  tid     bigint := nextval('public.trades_id_seq');
begin
  select * into cfg from public.market_config;
  select * into s from public.stocks where guild_id = p_guild and discord_id = p_stock for update;
  if not found then raise exception 'no_stock'; end if;

  insert into public.accounts (guild_id, discord_id) values (p_guild, p_owner) on conflict do nothing;
  select * into acct from public.accounts where guild_id = p_guild and discord_id = p_owner for update;

  select * into q from public._quote(s.price, s.day_open, p_side, p_qty);
  fee := greatest(1, ceil(q.gross * cfg.fee_rate));
  if p_side = 'sell' then
    tax := ceil(q.gross * cfg.sell_tax_rate);
    fee := least(q.gross, fee);
    tax := least(q.gross - fee, tax);
  end if;

  if p_position = 'cash' and p_side = 'buy' then
    if p_prepaid is not null then
      net := p_prepaid - q.gross - fee;   -- 묶어 둔 돈에서 남는 만큼 돌려준다
    else
      if acct.cash < q.gross + fee then raise exception 'insufficient_cash'; end if;
      net := -(q.gross + fee);
    end if;
    update public.accounts set cash = cash + net, updated_at = now()
     where guild_id = p_guild and discord_id = p_owner;
    insert into public.holdings (guild_id, owner_id, stock_id, qty, cost_basis)
    values (p_guild, p_owner, p_stock, p_qty, q.gross + fee)
    on conflict (guild_id, owner_id, stock_id)
    do update set qty = holdings.qty + excluded.qty, cost_basis = holdings.cost_basis + excluded.cost_basis;

  elsif p_position = 'cash' then
    select * into h from public.holdings
     where guild_id = p_guild and owner_id = p_owner and stock_id = p_stock for update;
    -- 지정가 매도 체결이면 묶어 둔 수량에서 나간다 (p_order_type = 'limit')
    if not found or h.qty < p_qty
       or (p_order_type = 'market' and h.qty - h.reserved_qty < p_qty) then
      raise exception 'insufficient_shares';
    end if;
    update public.accounts set cash = cash + q.gross - fee - tax, updated_at = now()
     where guild_id = p_guild and discord_id = p_owner;
    update public.holdings
       set qty = qty - p_qty,
           reserved_qty = case when p_order_type = 'limit' then reserved_qty - p_qty else reserved_qty end,
           cost_basis = case when h.qty = p_qty then 0
                             else cost_basis - round(cost_basis * p_qty::numeric / h.qty) end
     where guild_id = p_guild and owner_id = p_owner and stock_id = p_stock;

  elsif p_position = 'credit' and p_side = 'buy' then
    own := ceil(q.gross * cfg.credit_margin_rate) + fee;
    v_loan := q.gross + fee - own;
    if acct.cash < own then raise exception 'insufficient_cash'; end if;
    if coalesce((select sum(c.loan) from public.credit_positions c
                  where c.guild_id = p_guild and c.owner_id = p_owner), 0) + v_loan > cfg.credit_max_loan then
      raise exception 'credit_limit';
    end if;
    update public.accounts set cash = cash - own, updated_at = now()
     where guild_id = p_guild and discord_id = p_owner;
    insert into public.credit_positions (guild_id, owner_id, stock_id, qty, loan, cost_basis, own_paid)
    values (p_guild, p_owner, p_stock, p_qty, v_loan, q.gross + fee, own)
    on conflict (guild_id, owner_id, stock_id) do update
      set qty = credit_positions.qty + excluded.qty,
          loan = credit_positions.loan + excluded.loan,
          cost_basis = credit_positions.cost_basis + excluded.cost_basis,
          own_paid = credit_positions.own_paid + excluded.own_paid,
          updated_at = now();

  elsif p_position = 'credit' then
    select * into cp from public.credit_positions
     where guild_id = p_guild and owner_id = p_owner and stock_id = p_stock for update;
    if not found or cp.qty < p_qty then raise exception 'insufficient_shares'; end if;
    repay := case when cp.qty = p_qty then cp.loan else round(cp.loan * p_qty::numeric / cp.qty) end;
    net := q.gross - fee - tax - repay;
    if net < 0 and acct.cash + net < 0 and not p_forced then raise exception 'insufficient_cash'; end if;
    update public.accounts set cash = greatest(0, cash + net), updated_at = now()
     where guild_id = p_guild and discord_id = p_owner;
    update public.credit_positions
       set qty = qty - p_qty,
           loan = loan - repay,
           cost_basis = case when cp.qty = p_qty then 0
                             else cost_basis - round(cost_basis * p_qty::numeric / cp.qty) end,
           own_paid = case when cp.qty = p_qty then 0
                           else own_paid - round(own_paid * p_qty::numeric / cp.qty) end,
           updated_at = now()
     where guild_id = p_guild and owner_id = p_owner and stock_id = p_stock;

  elsif p_position = 'short' and p_side = 'sell' then
    margin := ceil(q.gross * cfg.short_margin_rate);
    if acct.cash < margin then raise exception 'insufficient_cash'; end if;
    update public.accounts set cash = cash - margin, updated_at = now()
     where guild_id = p_guild and discord_id = p_owner;
    insert into public.short_positions (guild_id, owner_id, stock_id, qty, collateral, sell_value, margin_paid)
    values (p_guild, p_owner, p_stock, p_qty, q.gross - fee - tax + margin, q.gross, margin)
    on conflict (guild_id, owner_id, stock_id) do update
      set qty = short_positions.qty + excluded.qty,
          collateral = short_positions.collateral + excluded.collateral,
          sell_value = short_positions.sell_value + excluded.sell_value,
          margin_paid = short_positions.margin_paid + excluded.margin_paid,
          updated_at = now();

  elsif p_position = 'short' then
    select * into sp from public.short_positions
     where guild_id = p_guild and owner_id = p_owner and stock_id = p_stock for update;
    if not found or sp.qty < p_qty then raise exception 'insufficient_short'; end if;
    release := case when sp.qty = p_qty then sp.collateral else round(sp.collateral * p_qty::numeric / sp.qty) end;
    net := release - q.gross - fee;
    if net < 0 and acct.cash + net < 0 and not p_forced then raise exception 'insufficient_cash'; end if;
    update public.accounts set cash = greatest(0, cash + net), updated_at = now()
     where guild_id = p_guild and discord_id = p_owner;
    update public.short_positions
       set qty = qty - p_qty,
           collateral = collateral - release,
           sell_value = case when sp.qty = p_qty then 0
                             else sell_value - round(sell_value * p_qty::numeric / sp.qty) end,
           margin_paid = case when sp.qty = p_qty then 0
                              else margin_paid - round(margin_paid * p_qty::numeric / sp.qty) end,
           updated_at = now()
     where guild_id = p_guild and owner_id = p_owner and stock_id = p_stock;
  else
    raise exception 'bad_position';
  end if;

  perform public._move_price(p_guild, p_stock, q.new_price, 'trade', tid);

  insert into public.trades (id, guild_id, owner_id, stock_id, side, qty, exec_price, gross, fee, tax, position, order_type, forced)
  values (tid, p_guild, p_owner, p_stock, p_side, p_qty, q.exec_px, q.gross, fee, tax, p_position, p_order_type, p_forced);

  insert into public.candles (guild_id, discord_id, day, open, high, low, close, volume, value)
  select p_guild, p_stock, (now() at time zone 'Asia/Seoul')::date, st.day_open,
         greatest(st.day_open, st.price), least(st.day_open, st.price), st.price, p_qty, q.gross
    from public.stocks st where st.guild_id = p_guild and st.discord_id = p_stock
  on conflict (guild_id, discord_id, day) do update
    set volume = candles.volume + excluded.volume, value = candles.value + excluded.value;

  return jsonb_build_object('trade_id', tid, 'exec_price', q.exec_px, 'gross', q.gross,
                            'fee', fee, 'tax', tax, 'price', q.new_price);
end $$;

create or replace function public.market_daily() returns void
language plpgsql security definer set search_path = public as $$
declare
  cfg   public.market_config;
  s     public.stocks;
  np    numeric;
  o     bigint;
  g     text;
  today date := (now() at time zone 'Asia/Seoul')::date;
begin
  perform pg_advisory_xact_lock(hashtext('galleon-market'));
  select * into cfg from public.market_config;

  -- 1) 당일 유효 지정가 주문 만료
  for o in select id from public.orders where status = 'open' loop
    perform public._close_order(o, 'expired');
  end loop;

  -- 2) 신용 이자 · 대차료
  update public.credit_positions set loan = loan + ceil(loan * cfg.credit_interest_rate), updated_at = now()
   where qty > 0 and loan > 0;
  update public.short_positions sp
     set collateral = greatest(0, collateral - ceil(sp.qty * st.price * cfg.short_fee_rate)), updated_at = now()
    from public.stocks st
   where st.guild_id = sp.guild_id and st.discord_id = sp.stock_id and sp.qty > 0;

  -- 3) 기준가 쪽 되돌림 · 새 기준가(=시가) · 가격 제한 · VI 초기화 · 새 일봉
  for s in select * from public.stocks for update loop
    np := greatest(cfg.min_price, public.round_tick(s.price + (s.base_price - s.price) * cfg.reversion_rate));
    update public.stocks set price = np, day_open = np, vi_ref = np, vi_until = null, updated_at = now()
     where guild_id = s.guild_id and discord_id = s.discord_id;
    if np <> s.price then
      insert into public.price_ticks (guild_id, discord_id, price, change_pct, cause)
      values (s.guild_id, s.discord_id, np, round((np - s.price) / s.price, 4), 'reversion');
    end if;
    insert into public.candles (guild_id, discord_id, day, open, high, low, close)
    values (s.guild_id, s.discord_id, today, np, np, np, np)
    on conflict do nothing;
  end loop;

  -- 4) 월요일이면 지난주 실적 발표 · 배당
  if extract(isodow from now() at time zone 'Asia/Seoul') = 1 then
    for g in select distinct guild_id from public.stocks loop
      -- 같은 주를 두 번 발표하지 않는다 (배당 · 실적 반영이 겹치지 않게)
      continue when exists (
        select 1 from public.earnings
         where guild_id = g and announced_at is not null
           and week_start = ((public.kst_day_start() - interval '7 days') at time zone 'Asia/Seoul')::date);
      -- 실적 발표가 실패해도 주문 만료 · 이자 · 기준가 갱신은 진행한다
      begin
        perform public._announce_earnings(g);
      exception when others then
        raise warning 'earnings failed (%): %', g, sqlerrm;
      end;
    end loop;
  end if;

  -- 5) 지수 시가 · 반대매매 확인
  for g in select distinct guild_id from public.market_indices loop
    update public.market_indices mi set day_open = coalesce(public._index_value(mi.guild_id, mi.scope), mi.day_open)
     where mi.guild_id = g;
    perform public._snapshot_indices(g);
  end loop;
  for s in select * from public.stocks loop
    perform public._settle(s.guild_id, s.discord_id);
  end loop;
end $$;
