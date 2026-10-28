-- 실전 시장 개편 보정
--
-- 1) VI 기준가를 지금 주가로 맞춘다. 개편 직후 기준가(day_open)로 잡았더니, 이미 10% 넘게
--    오른 종목은 다음 틱에 바로 VI 가 걸렸다. 자정부터는 market_daily 가 기준가로 다시 잡는다.
-- 2) 실적 발표 때 예상 · 실제가 모두 0분인 종목은 뉴스를 내지 않는다.

update public.stocks set vi_ref = price, vi_until = null;

create or replace function public._announce_earnings(p_guild text) returns void
language plpgsql security definer set search_path = public as $$
declare
  cfg      public.market_config;
  wk_end   timestamptz := public.kst_day_start();         -- 이번 주 월요일 00:00
  wk_start timestamptz := public.kst_day_start() - interval '7 days';
  wk       date := (wk_start at time zone 'Asia/Seoul')::date;
  median   numeric;
  pool     bigint;
  total_min numeric;
  s        public.stocks;
  e        public.earnings;
  act      integer;
  cons     integer;
  sur      numeric;
  eff      numeric;
  alloc    bigint;
  held     bigint;
  v_dps    numeric;
  paid     bigint;
  amt      bigint;
  r        record;
begin
  select * into cfg from public.market_config;

  -- 지난주 실제 공부시간 중앙값 · 합계
  select percentile_cont(0.5) within group (order by x.m), coalesce(sum(x.m), 0) into median, total_min
    from (select public._study_minutes(p_guild, st.discord_id, wk_start, wk_end) m
            from public.stocks st where st.guild_id = p_guild) x;
  -- 배당 재원: 지난주 걷힌 수수료 · 거래세의 일부
  select floor(coalesce(sum(t.fee + t.tax), 0) * cfg.dividend_payout) into pool
    from public.trades t where t.guild_id = p_guild and t.created_at >= wk_start and t.created_at < wk_end;

  for s in select * from public.stocks where guild_id = p_guild order by discord_id loop
    act := public._study_minutes(p_guild, s.discord_id, wk_start, wk_end);
    select * into e from public.earnings where guild_id = p_guild and discord_id = s.discord_id and week_start = wk;
    -- 컨센서스가 없으면(첫 주 · 신규 상장) 그 주 전체 중앙값을 기준으로 삼는다
    cons := coalesce(e.consensus, round(median)::integer);
    sur := (act - cons)::numeric / greatest(cons, 90);
    eff := least(cfg.earnings_max, greatest(-cfg.earnings_max, cfg.earnings_sensitivity * sur));

    insert into public.earnings (guild_id, discord_id, week_start, consensus, actual, surprise, price_effect, announced_at)
    values (p_guild, s.discord_id, wk, cons, act, round(sur, 4), round(eff, 4), now())
    on conflict (guild_id, discord_id, week_start) do update
      set consensus = excluded.consensus, actual = excluded.actual, surprise = excluded.surprise,
          price_effect = excluded.price_effect, announced_at = excluded.announced_at;

    if round(eff, 4) <> 0 then
      perform public._move_price(p_guild, s.discord_id, s.price * (1 + eff), 'earnings');
    end if;
    -- 예상도 실제도 0분인 종목은 뉴스로 내지 않는다 (매주 같은 줄이 쏟아지지 않게)
    if act > 0 or cons > 0 then
      insert into public.market_news (guild_id, kind, target, headline, pct)
      values (p_guild, 'earnings', s.discord_id,
              format('%s 주간 실적 — 공부 %s분 (예상 %s분) · %s', s.display_name, act, cons,
                     case when sur >= 0.1 then '어닝 서프라이즈 🚀' when sur <= -0.1 then '어닝 쇼크 📉' else '예상 부합' end),
              round(eff, 4));
    end if;

    -- 배당: 공부한 만큼 재원을 나눠 주주에게 지급
    if pool > 0 and total_min > 0 and act > 0 then
      alloc := floor(pool * act / total_min);
      select coalesce(sum(qty), 0) into held from (
        select qty from public.holdings where guild_id = p_guild and stock_id = s.discord_id and qty > 0
        union all
        select qty from public.credit_positions where guild_id = p_guild and stock_id = s.discord_id and qty > 0
      ) x;
      if alloc > 0 and held > 0 then
        v_dps := round(alloc::numeric / held, 2);
        paid := 0;
        for r in
          select owner_id, sum(qty) qty from (
            select owner_id, qty from public.holdings where guild_id = p_guild and stock_id = s.discord_id and qty > 0
            union all
            select owner_id, qty from public.credit_positions where guild_id = p_guild and stock_id = s.discord_id and qty > 0
          ) x group by owner_id
        loop
          amt := floor(alloc::numeric * r.qty / held);
          continue when amt <= 0;
          update public.accounts set cash = cash + amt, updated_at = now()
           where guild_id = p_guild and discord_id = r.owner_id;
          insert into public.dividend_payments (guild_id, owner_id, stock_id, week_start, qty, amount)
          values (p_guild, r.owner_id, s.discord_id, wk, r.qty, amt);
          paid := paid + amt;
        end loop;
        -- 공매도는 빌린 주식의 배당을 대신 낸다 (담보에서 차감 · 소멸)
        for r in select * from public.short_positions where guild_id = p_guild and stock_id = s.discord_id and qty > 0 loop
          amt := least(r.collateral, floor(v_dps * r.qty));
          continue when amt <= 0;
          update public.short_positions set collateral = collateral - amt, updated_at = now()
           where guild_id = p_guild and owner_id = r.owner_id and stock_id = s.discord_id;
          insert into public.dividend_payments (guild_id, owner_id, stock_id, week_start, qty, amount)
          values (p_guild, r.owner_id, s.discord_id, wk, -r.qty, -amt);
        end loop;
        update public.earnings set dps = v_dps, dividend_total = paid
         where guild_id = p_guild and discord_id = s.discord_id and week_start = wk;
        insert into public.market_news (guild_id, kind, target, headline, pct)
        values (p_guild, 'dividend', s.discord_id,
                format('%s, 주당 %s갈레온 배당 지급 (배당락)', s.display_name, v_dps), null);
        -- 배당락: 배당만큼 주가가 내려간다
        select * into s from public.stocks where guild_id = p_guild and discord_id = s.discord_id;
        perform public._move_price(p_guild, s.discord_id, s.price - v_dps, 'dividend');
      end if;
    end if;

    -- 이번 주 컨센서스: 최근 4주 실제 공부시간 평균
    insert into public.earnings (guild_id, discord_id, week_start, consensus)
    select p_guild, s.discord_id, (wk_end at time zone 'Asia/Seoul')::date, round(avg(x.actual))::integer
      from (select actual from public.earnings
             where guild_id = p_guild and discord_id = s.discord_id and actual is not null
             order by week_start desc limit 4) x
    on conflict do nothing;
  end loop;
end $$;
