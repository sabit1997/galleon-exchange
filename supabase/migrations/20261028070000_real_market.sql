-- 실제 증권시장처럼 — 주식 공부용 개편
--
-- 넣은 것
--   호가 단위 · 상·하한가(기준가 ±30%) · 정적 VI(±10% 급변 시 2분 거래 정지)
--   수수료(매수·매도 0.5%) + 증권거래세(매도 1%) — 왕복 비용은 예전과 같은 2%
--   지정가 주문(당일 유효 · 주문가능금액/수량을 묶어 둠) · 주문 취소
--   신용매수(보증금 40% · 이자 · 담보비율 140% 미만 반대매매)
--   공매도(보증금 50% · 대차료 · 담보비율 120% 미만 강제 상환)
--   일봉(시가·고가·저가·종가·거래량·거래대금) · 발행주식수 → 시가총액
--   호그와트 종합지수 · 기숙사 업종지수
--   주간 실적 발표(공부시간 컨센서스 vs 실제 → 어닝 서프라이즈/쇼크) · 배당 · 배당락
--   5분마다 랜덤 노이즈(시장·업종·종목 요인) · 랜덤 뉴스(시장 · 업종 · 종목 루머)
--   증권계좌 입금 한도 제거
--
-- 갈레온이 새로 생기지 않게
--   배당은 지난주 걷힌 수수료·거래세의 절반에서만 나간다.
--   신용·공매도는 담보비율 아래로 내려가면 바로 반대매매해서 계좌가 음수가 되지 않는다.
--   신용 대출금과 공매도 매도대금은 계좌 현금이 아니라 포지션에 묶이므로 출금할 수 없다.
--
-- 가격이 바뀌는 길은 전부 _move_price 하나를 지난다 (호가 단위 · 가격 제한 · VI · 일봉).
-- 가격이 바뀐 뒤엔 _settle 이 지정가 주문 체결과 반대매매를 처리한다.

-- ───────────────────────────── 설정 ─────────────────────────────

alter table public.market_config
  add column sell_tax_rate         numeric not null default 0.01,
  add column price_limit_rate      numeric not null default 0.30,
  add column vi_rate               numeric not null default 0.10,
  add column vi_seconds            integer not null default 120,
  add column shares_outstanding    integer not null default 10000,
  add column credit_margin_rate    numeric not null default 0.40,
  add column credit_maintenance    numeric not null default 1.40,
  add column credit_interest_rate  numeric not null default 0.001,   -- 하루
  add column credit_max_loan       bigint  not null default 100000,  -- 1인 신용 대출 한도
  add column short_margin_rate     numeric not null default 0.50,
  add column short_maintenance     numeric not null default 1.20,
  add column short_fee_rate        numeric not null default 0.0005,  -- 하루 대차료
  add column dividend_payout       numeric not null default 0.5,
  add column noise_market          numeric not null default 0.0007,  -- 5분당 표준편차
  add column noise_house           numeric not null default 0.0005,
  add column noise_stock           numeric not null default 0.001,
  add column news_macro_per_day    numeric not null default 1.5,
  add column news_sector_per_day   numeric not null default 2,
  add column news_rumor_per_day    numeric not null default 4,
  add column earnings_sensitivity  numeric not null default 0.2,
  add column earnings_max          numeric not null default 0.15;

-- 수수료를 매수·매도 0.5% + 매도 거래세 1% 로 나눈다 (왕복 2% 는 그대로).
-- 입금 한도는 없앤다. 봇이 quota 를 읽으므로 숫자는 남기되 사실상 무한으로 둔다.
update public.market_config set fee_rate = 0.005, daily_deposit_cap = 1000000000000;

-- ───────────────────────────── 호가 단위 · 가격 제한 ─────────────────────────────

-- 한국거래소 호가 단위 (2023~)
create function public.tick_size(p numeric) returns numeric
language sql immutable set search_path = public as $$
  select case when p < 2000 then 1 when p < 5000 then 5 when p < 20000 then 10
              when p < 50000 then 50 when p < 200000 then 100 when p < 500000 then 500
              else 1000 end::numeric
$$;

create function public.round_tick(p numeric) returns numeric
language sql immutable set search_path = public as $$
  select round(p / public.tick_size(p)) * public.tick_size(p)
$$;

create function public.floor_tick(p numeric) returns numeric
language sql immutable set search_path = public as $$
  select floor(p / public.tick_size(p)) * public.tick_size(p)
$$;

create function public.ceil_tick(p numeric) returns numeric
language sql immutable set search_path = public as $$
  select ceil(p / public.tick_size(p)) * public.tick_size(p)
$$;

-- 기준가(day_open)에서 하한가 · 상한가
create function public.price_bounds(p_day_open numeric, out lo numeric, out hi numeric)
language sql stable set search_path = public as $$
  select greatest(c.min_price, public.ceil_tick(p_day_open * (1 - c.price_limit_rate))),
         public.floor_tick(p_day_open * (1 + c.price_limit_rate))
    from public.market_config c
$$;

-- 표준정규분포 (Box–Muller)
create function public.randn() returns double precision
language sql volatile set search_path = public as $$
  select sqrt(-2 * ln(1 - random())) * cos(2 * pi() * random())
$$;

-- ───────────────────────────── 테이블 변경 ─────────────────────────────

alter table public.stocks
  add column vi_ref   numeric(12,2),
  add column vi_until timestamptz;
-- 기존 가격을 호가 단위에 맞춘다.
update public.stocks
   set price = public.round_tick(price),
       day_open = public.round_tick(day_open),
       base_price = public.round_tick(base_price);
update public.stocks set vi_ref = day_open;
alter table public.stocks alter column vi_ref set not null;

alter table public.price_ticks drop constraint price_ticks_cause_check;
alter table public.price_ticks add constraint price_ticks_cause_check
  check (cause in ('listing', 'event', 'trade', 'reversion', 'noise', 'news', 'earnings', 'dividend'));

alter table public.trades
  add column tax        bigint  not null default 0,
  add column position   text    not null default 'cash' check (position in ('cash', 'credit', 'short')),
  add column order_type text    not null default 'market' check (order_type in ('market', 'limit')),
  add column forced     boolean not null default false;

-- 지정가 매도 주문에 묶인 수량. 팔 수 있는 수량 = qty - reserved_qty
alter table public.holdings add column reserved_qty integer not null default 0 check (reserved_qty >= 0);

create table public.orders (
  id            bigserial primary key,
  guild_id      text not null,
  owner_id      text not null,
  stock_id      text not null,
  side          text not null check (side in ('buy', 'sell')),
  qty           integer not null check (qty > 0),
  limit_price   numeric(12,2) not null,
  -- 매수 주문에 묶어 둔 갈레온 (지정가 × 수량 + 수수료). 체결되면 차액을 돌려준다.
  reserved_cash bigint not null default 0,
  status        text not null default 'open' check (status in ('open', 'filled', 'cancelled', 'expired')),
  exec_price    numeric(12,2),
  trade_id      bigint,
  created_at    timestamptz not null default now(),
  closed_at     timestamptz
);
create index orders_open_idx on public.orders (guild_id, stock_id) where status = 'open';
create index orders_owner_idx on public.orders (guild_id, owner_id, id desc);

create table public.credit_positions (
  guild_id    text not null,
  owner_id    text not null,
  stock_id    text not null,
  qty         integer not null default 0 check (qty >= 0),
  loan        bigint  not null default 0 check (loan >= 0),   -- 갚아야 할 신용 대출금 (이자 포함)
  cost_basis  bigint  not null default 0,                     -- 매수 총액 (대출 포함 · 수수료 포함)
  updated_at  timestamptz not null default now(),
  primary key (guild_id, owner_id, stock_id)
);

create table public.short_positions (
  guild_id    text not null,
  owner_id    text not null,
  stock_id    text not null,
  qty         integer not null default 0 check (qty >= 0),
  collateral  bigint  not null default 0 check (collateral >= 0),  -- 매도대금 + 보증금 − 대차료
  sell_value  bigint  not null default 0,                          -- 공매도 매도 총액 (평균 매도가 계산용)
  updated_at  timestamptz not null default now(),
  primary key (guild_id, owner_id, stock_id)
);

create table public.candles (
  guild_id    text not null,
  discord_id  text not null,
  day         date not null,
  open        numeric(12,2) not null,
  high        numeric(12,2) not null,
  low         numeric(12,2) not null,
  close       numeric(12,2) not null,
  volume      bigint not null default 0,
  value       bigint not null default 0,   -- 거래대금
  primary key (guild_id, discord_id, day),
  foreign key (guild_id, discord_id) references public.stocks on delete cascade
);

-- 지수는 시가총액 가중. 발행주식수가 모두 같아 가격 합 / 제수(divisor) 다.
-- 신규 상장 때 제수를 조정해 지수가 튀지 않게 한다 (실제 지수와 같은 방식).
create table public.market_indices (
  guild_id    text not null,
  scope       text not null,           -- 'all' 또는 기숙사 이름
  divisor     numeric not null,
  day_open    numeric(12,2) not null,  -- 그날 00:00 지수
  primary key (guild_id, scope)
);

create table public.index_ticks (
  id          bigserial primary key,
  guild_id    text not null,
  scope       text not null,
  value       numeric(12,2) not null,
  created_at  timestamptz not null default now()
);
create index index_ticks_idx on public.index_ticks (guild_id, scope, id desc);

create table public.earnings (
  guild_id      text not null,
  discord_id    text not null,
  week_start    date not null,            -- 그 주 월요일 (KST)
  consensus     integer,                  -- 예상 공부시간(분)
  actual        integer,                  -- 실제 공부시간(분) — 발표 전엔 null
  surprise      numeric,                  -- (실제 − 예상) / 예상
  price_effect  numeric,                  -- 주가에 준 영향
  dps           numeric(12,2),            -- 주당 배당금
  dividend_total bigint,
  announced_at  timestamptz,
  primary key (guild_id, discord_id, week_start),
  foreign key (guild_id, discord_id) references public.stocks on delete cascade
);

create table public.dividend_payments (
  id          bigserial primary key,
  guild_id    text not null,
  owner_id    text not null,
  stock_id    text not null,
  week_start  date not null,
  qty         integer not null,
  amount      bigint not null,       -- 음수면 공매도 포지션이 낸 배당
  created_at  timestamptz not null default now()
);
create index dividend_payments_owner_idx on public.dividend_payments (guild_id, owner_id, id desc);

create table public.market_news (
  id          bigserial primary key,
  guild_id    text not null,
  kind        text not null check (kind in ('macro', 'sector', 'rumor', 'earnings', 'dividend', 'vi', 'limit_up', 'limit_down')),
  target      text,                  -- sector: 기숙사 · rumor/earnings/vi/limit: discord_id
  headline    text not null,
  pct         numeric,
  created_at  timestamptz not null default now()
);
create index market_news_feed_idx on public.market_news (guild_id, id desc);

create table public.news_templates (
  id        serial primary key,
  scope     text not null check (scope in ('macro', 'sector', 'rumor')),
  positive  boolean not null,
  headline  text not null              -- {name} · {house} 를 채운다
);

insert into public.news_templates (scope, positive, headline) values
  ('macro', true,  '마법부, 전국 O.W.L. 시험 기간 선포 — 공부 열풍 기대감'),
  ('macro', true,  '그린고츠, 기준 금리 인하 발표 — 증권가 훈풍'),
  ('macro', true,  '예언자 일보 "올해 호그와트 합격률 역대 최고" 보도'),
  ('macro', true,  '호그스미드 축제 개막 — 학생들 사기 충천'),
  ('macro', true,  '덤블도어 교장 "집중하는 학생에게 특별 장학금" 발언'),
  ('macro', false, '그린고츠, 기준 금리 전격 인상 — 투자 심리 위축'),
  ('macro', false, '어둠의 마법사 출몰 소문 — 학교 전체 불안감 확산'),
  ('macro', false, '마법부 감사단 호그와트 방문 — 긴장감 고조'),
  ('macro', false, '폭설로 부엉이 우편 지연 — 학교 분위기 침체'),
  ('macro', false, '디멘터 순찰 강화 — 학생들 기운 빠져'),
  ('sector', true,  '{house}, 퀴디치 결승 진출 — 기숙사 분위기 최고조'),
  ('sector', true,  '{house} 휴게실 리모델링 완료 — 공부 환경 개선 기대'),
  ('sector', true,  '{house} 사감 "이번 학기 기숙사컵 자신 있다"'),
  ('sector', true,  '{house}, 기숙사 점수 대량 획득 소식'),
  ('sector', false, '{house}, 퀴디치 경기 대패 — 기숙사 사기 저하'),
  ('sector', false, '{house} 휴게실 벽난로 고장 — 밤샘 공부 차질 우려'),
  ('sector', false, '{house} 학생 일부 금지된 숲 무단 출입 적발'),
  ('sector', false, '{house}, 기숙사 점수 대량 감점 루머'),
  ('rumor', true,  '{name}, 도서관 제한 구역에서 밤샘 공부 목격담'),
  ('rumor', true,  '{name}, 교수님께 따로 칭찬받았다는 소문'),
  ('rumor', true,  '{name}, 새 공부 계획표 공개 — "이번엔 진짜다"'),
  ('rumor', true,  '{name}, 펠릭스 펠리시스 한 병 손에 넣었다는 루머'),
  ('rumor', true,  '{name}, 시험 범위 미리 다 끝냈다는 소식'),
  ('rumor', false, '{name}, 늦잠으로 아침 수업 결석 루머'),
  ('rumor', false, '{name}, 버터맥주 마시러 호그스미드 갔다는 목격담'),
  ('rumor', false, '{name}, 휴대 거울로 밤새 수다 떨었다는 소문'),
  ('rumor', false, '{name}, 과제 마감 놓쳤다는 루머'),
  ('rumor', false, '{name}, 투명 망토 쓰고 땡땡이쳤다는 의혹');

-- ───────────────────────────── 가격 이동 (단일 통로) ─────────────────────────────

create function public._move_price(p_guild text, p_stock text, p_target numeric, p_cause text, p_ref bigint default null)
returns numeric
language plpgsql security definer set search_path = public as $$
declare
  cfg   public.market_config;
  s     public.stocks;
  b     record;
  np    numeric;
  vi    boolean;
  today date := (now() at time zone 'Asia/Seoul')::date;
begin
  select * into cfg from public.market_config;
  select * into s from public.stocks where guild_id = p_guild and discord_id = p_stock for update;
  if not found then return null; end if;
  select * into b from public.price_bounds(s.day_open);

  np := least(b.hi, greatest(b.lo, public.round_tick(p_target)));
  if np = s.price then return np; end if;

  vi := abs(np - s.vi_ref) / s.vi_ref >= cfg.vi_rate;

  update public.stocks
     set price = np,
         vi_ref = case when vi then np else vi_ref end,
         vi_until = case when vi then now() + make_interval(secs => cfg.vi_seconds) else vi_until end,
         updated_at = now()
   where guild_id = p_guild and discord_id = p_stock;

  insert into public.price_ticks (guild_id, discord_id, price, change_pct, cause, ref_id)
  values (p_guild, p_stock, np, round((np - s.price) / s.price, 4), p_cause, p_ref);

  insert into public.candles (guild_id, discord_id, day, open, high, low, close)
  values (p_guild, p_stock, today, s.day_open, greatest(s.day_open, np), least(s.day_open, np), np)
  on conflict (guild_id, discord_id, day) do update
    set high = greatest(candles.high, excluded.close),
        low = least(candles.low, excluded.close),
        close = excluded.close;

  if vi then
    insert into public.market_news (guild_id, kind, target, headline, pct)
    values (p_guild, 'vi', p_stock,
            format('%s, 변동성 완화장치(VI) 발동 — %s분간 거래 정지', s.display_name, cfg.vi_seconds / 60),
            round((np - s.price) / s.price, 4));
  end if;
  if np = b.hi and s.price < b.hi then
    insert into public.market_news (guild_id, kind, target, headline, pct)
    values (p_guild, 'limit_up', p_stock, format('%s, 상한가 도달 🔺', s.display_name), cfg.price_limit_rate);
  elsif np = b.lo and s.price > b.lo and b.lo > cfg.min_price then
    insert into public.market_news (guild_id, kind, target, headline, pct)
    values (p_guild, 'limit_down', p_stock, format('%s, 하한가 도달 🔻', s.display_name), -cfg.price_limit_rate);
  end if;
  return np;
end $$;

-- 시장가 체결 견적. 체결가는 충격 전후 가격의 중간을 호가 단위로 반올림한 값이다.
-- 충격 전 가격으로 체결하면 "대량 매수 → 오른 가격에 매도" 가 무위험 차익이 되기 때문.
create function public._quote(p_price numeric, p_day_open numeric, p_side text, p_qty integer,
                              out exec_px numeric, out new_price numeric, out gross bigint)
language plpgsql stable set search_path = public as $$
declare
  cfg    public.market_config;
  b      record;
  impact numeric;
begin
  select * into cfg from public.market_config;
  select * into b from public.price_bounds(p_day_open);
  impact := least(cfg.max_trade_impact, cfg.trade_impact * p_qty);
  new_price := least(b.hi, greatest(b.lo, public.round_tick(
    p_price * (case when p_side = 'buy' then 1 + impact else 1 - impact end))));
  exec_px := public.round_tick((p_price + new_price) / 2);
  gross := (exec_px * p_qty)::bigint;
end $$;

-- ───────────────────────────── 체결 (계좌 반영) ─────────────────────────────
--
-- 검증(로그인 · 멤버 · 자기 종목 · VI)은 호출하는 쪽이 한다.
-- p_forced: 반대매매. 잔고가 모자라도 실패하지 않고 0 에서 멈춘다.
-- p_prepaid: 지정가 매수 주문에 미리 묶어 둔 갈레온.

create function public._execute(
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
    insert into public.credit_positions (guild_id, owner_id, stock_id, qty, loan, cost_basis)
    values (p_guild, p_owner, p_stock, p_qty, v_loan, q.gross + fee)
    on conflict (guild_id, owner_id, stock_id) do update
      set qty = credit_positions.qty + excluded.qty,
          loan = credit_positions.loan + excluded.loan,
          cost_basis = credit_positions.cost_basis + excluded.cost_basis,
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
           updated_at = now()
     where guild_id = p_guild and owner_id = p_owner and stock_id = p_stock;

  elsif p_position = 'short' and p_side = 'sell' then
    margin := ceil(q.gross * cfg.short_margin_rate);
    if acct.cash < margin then raise exception 'insufficient_cash'; end if;
    update public.accounts set cash = cash - margin, updated_at = now()
     where guild_id = p_guild and discord_id = p_owner;
    insert into public.short_positions (guild_id, owner_id, stock_id, qty, collateral, sell_value)
    values (p_guild, p_owner, p_stock, p_qty, q.gross - fee - tax + margin, q.gross)
    on conflict (guild_id, owner_id, stock_id) do update
      set qty = short_positions.qty + excluded.qty,
          collateral = short_positions.collateral + excluded.collateral,
          sell_value = short_positions.sell_value + excluded.sell_value,
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

-- ───────────────────────────── 지정가 체결 · 반대매매 ─────────────────────────────

-- 열린 지정가 주문 중 지금 가격으로 체결 가능한 것을 오래된 순으로 체결한다.
-- 일부 체결은 없다 (전량 체결 또는 대기).
create function public._match_orders(p_guild text, p_stock text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  s     public.stocks;
  o     public.orders;
  q     record;
  r     jsonb;
  n     integer := 0;
  again boolean := true;
begin
  while again and n < 50 loop
    again := false;
    select * into s from public.stocks where guild_id = p_guild and discord_id = p_stock;
    if not found or (s.vi_until is not null and s.vi_until > now()) then return n; end if;
    for o in select * from public.orders
              where guild_id = p_guild and stock_id = p_stock and status = 'open'
              order by id for update skip locked loop
      select * into q from public._quote(s.price, s.day_open, o.side, o.qty);
      if (o.side = 'buy' and q.exec_px <= o.limit_price) or (o.side = 'sell' and q.exec_px >= o.limit_price) then
        begin
          r := public._execute(p_guild, o.owner_id, p_stock, o.side, o.qty, 'cash', 'limit', false,
                               case when o.side = 'buy' then o.reserved_cash end);
          update public.orders
             set status = 'filled', exec_price = (r->>'exec_price')::numeric,
                 trade_id = (r->>'trade_id')::bigint, closed_at = now()
           where id = o.id;
        exception when others then
          -- 체결할 수 없는 주문(보유 수량이 사라진 경우 등)은 취소하고 넘어간다
          perform public._close_order(o.id, 'cancelled');
        end;
        n := n + 1;
        again := true;
        exit;   -- 가격이 바뀌었으니 처음부터 다시 본다
      end if;
    end loop;
  end loop;
  return n;
end $$;

create function public._check_margins(p_guild text, p_stock text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  cfg public.market_config;
  s   public.stocks;
  cp  public.credit_positions;
  sp  public.short_positions;
  n   integer := 0;
begin
  select * into cfg from public.market_config;
  select * into s from public.stocks where guild_id = p_guild and discord_id = p_stock;
  if not found then return 0; end if;
  for cp in select * from public.credit_positions
             where guild_id = p_guild and stock_id = p_stock and qty > 0
               and qty * s.price < loan * cfg.credit_maintenance loop
    perform public._execute(p_guild, cp.owner_id, p_stock, 'sell', cp.qty, 'credit', 'market', true);
    n := n + 1;
    select * into s from public.stocks where guild_id = p_guild and discord_id = p_stock;
  end loop;
  for sp in select * from public.short_positions
             where guild_id = p_guild and stock_id = p_stock and qty > 0
               and collateral < qty * s.price * cfg.short_maintenance loop
    perform public._execute(p_guild, sp.owner_id, p_stock, 'buy', sp.qty, 'short', 'market', true);
    n := n + 1;
    select * into s from public.stocks where guild_id = p_guild and discord_id = p_stock;
  end loop;
  return n;
end $$;

-- 가격이 바뀐 뒤 호출. 체결이 또 가격을 바꾸므로 잠잠해질 때까지 반복한다.
create function public._settle(p_guild text, p_stock text) returns void
language plpgsql security definer set search_path = public as $$
declare
  i integer := 0;
begin
  loop
    i := i + 1;
    exit when (public._match_orders(p_guild, p_stock) + public._check_margins(p_guild, p_stock)) = 0 or i >= 10;
  end loop;
-- 정리 실패가 주문 · 봇 이벤트 · 시세 틱 전체를 되돌리지 않게 한다. 다음 틱에 다시 시도된다.
exception when others then
  raise warning 'market settle failed (%, %): %', p_guild, p_stock, sqlerrm;
end $$;

-- ───────────────────────────── 지수 ─────────────────────────────

create function public._index_value(p_guild text, p_scope text) returns numeric
language sql stable security definer set search_path = public as $$
  select round(sum(s.price) / mi.divisor, 2)
    from public.market_indices mi
    join public.stocks s on s.guild_id = mi.guild_id and (mi.scope = 'all' or s.house = mi.scope)
   where mi.guild_id = p_guild and mi.scope = p_scope
   group by mi.divisor
$$;

-- 신규 상장: 지수가 그대로 유지되도록 제수를 늘린다. 지수가 없으면 1000 에서 시작.
create function public._index_on_listing(p_guild text, p_house text, p_price numeric) returns void
language plpgsql security definer set search_path = public as $$
declare
  sc     text;
  total  numeric;
  mi     public.market_indices;
begin
  foreach sc in array array['all', p_house] loop
    continue when sc is null;
    select coalesce(sum(price), 0) into total from public.stocks
     where guild_id = p_guild and (sc = 'all' or house = sc);   -- 새 종목 포함
    select * into mi from public.market_indices where guild_id = p_guild and scope = sc for update;
    if not found then
      insert into public.market_indices (guild_id, scope, divisor, day_open)
      values (p_guild, sc, total / 1000, 1000);
    elsif total - p_price > 0 then
      update public.market_indices set divisor = divisor * total / (total - p_price)
       where guild_id = p_guild and scope = sc;
    end if;
  end loop;
end $$;

-- 기존 종목으로 지수를 1000 에서 시작한다.
insert into public.market_indices (guild_id, scope, divisor, day_open)
select guild_id, 'all', sum(price) / 1000, 1000 from public.stocks group by guild_id;
insert into public.market_indices (guild_id, scope, divisor, day_open)
select guild_id, house, sum(price) / 1000, 1000 from public.stocks where house is not null group by guild_id, house;

create function public._snapshot_indices(p_guild text) returns void
language sql security definer set search_path = public as $$
  insert into public.index_ticks (guild_id, scope, value)
  select mi.guild_id, mi.scope, public._index_value(mi.guild_id, mi.scope)
    from public.market_indices mi where mi.guild_id = p_guild
$$;

select public._snapshot_indices(g) from (select distinct guild_id g from public.market_indices) x;

-- 기존 종목의 오늘 일봉
insert into public.candles (guild_id, discord_id, day, open, high, low, close)
select guild_id, discord_id, (now() at time zone 'Asia/Seoul')::date, day_open,
       greatest(day_open, price), least(day_open, price), price
  from public.stocks
on conflict do nothing;

-- 오늘 이미 체결된 거래를 거래량에 넣는다.
update public.candles c
   set volume = t.vol, value = t.val
  from (select guild_id, stock_id, sum(qty) vol, sum(gross) val
          from public.trades where created_at >= public.kst_day_start()
         group by guild_id, stock_id) t
 where c.guild_id = t.guild_id and c.discord_id = t.stock_id
   and c.day = (now() at time zone 'Asia/Seoul')::date;

-- ───────────────────────────── 봇 이벤트 → 주가 ─────────────────────────────

create or replace function public.apply_market_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cfg    public.market_config;
  eff    numeric;
  weight numeric;
  s      public.stocks;
begin
  select * into cfg from public.market_config;
  select pct into eff from public.event_effects where type = new.type;
  weight := least(3, greatest(0, coalesce((new.payload->>'weight')::numeric, 1)));

  -- 첫 이벤트면 상장
  insert into public.stocks (guild_id, discord_id, display_name, house, price, base_price, day_open, vi_ref)
  values (new.guild_id, new.discord_id, new.display_name, new.house, cfg.base_price, cfg.base_price, cfg.base_price, cfg.base_price)
  on conflict (guild_id, discord_id) do nothing;
  if found then
    insert into public.price_ticks (guild_id, discord_id, price, change_pct, cause, ref_id)
    values (new.guild_id, new.discord_id, cfg.base_price, 0, 'listing', new.id);
    insert into public.candles (guild_id, discord_id, day, open, high, low, close)
    values (new.guild_id, new.discord_id, (now() at time zone 'Asia/Seoul')::date,
            cfg.base_price, cfg.base_price, cfg.base_price, cfg.base_price)
    on conflict do nothing;
    perform public._index_on_listing(new.guild_id, new.house, cfg.base_price);
  end if;

  update public.stocks
     set display_name = new.display_name,
         house = coalesce(new.house, house),
         last_event_at = new.occurred_at,
         updated_at = now()
   where guild_id = new.guild_id and discord_id = new.discord_id
  returning * into s;

  if coalesce(eff, 0) * weight <> 0 then
    perform public._move_price(s.guild_id, s.discord_id, s.price * (1 + eff * weight), 'event', new.id);
    perform public._settle(s.guild_id, s.discord_id);
  end if;
  return new;
end $$;

-- ───────────────────────────── 사이트 주문 ─────────────────────────────

create function public.place_order(
  p_guild text, p_stock text, p_side text, p_qty integer,
  p_position text default 'cash', p_limit numeric default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cfg     public.market_config;
  me      text := public.my_discord_id();
  s       public.stocks;
  b       record;
  h       public.holdings;
  reserve bigint;
  v_order bigint;
  r       jsonb;
  st      text;
begin
  if me is null then raise exception 'not_logged_in'; end if;
  if not public.is_guild_member(p_guild) then raise exception 'not_member'; end if;
  if p_side is null or p_side not in ('buy', 'sell') then raise exception 'bad_side'; end if;
  if p_position is null or p_position not in ('cash', 'credit', 'short') then raise exception 'bad_position'; end if;
  select * into cfg from public.market_config;
  if p_qty is null or p_qty < 1 or p_qty > cfg.max_trade_qty then raise exception 'bad_qty'; end if;
  if p_stock = me then raise exception 'self_trade'; end if;

  select * into s from public.stocks where guild_id = p_guild and discord_id = p_stock for update;
  if not found then raise exception 'no_stock'; end if;

  if p_limit is null then
    if s.vi_until is not null and s.vi_until > now() then raise exception 'vi_halt'; end if;
    r := public._execute(p_guild, me, p_stock, p_side, p_qty, p_position);
    perform public._settle(p_guild, p_stock);
    return r || jsonb_build_object('status', 'filled');
  end if;

  -- 지정가
  if p_position <> 'cash' then raise exception 'limit_cash_only'; end if;
  select * into b from public.price_bounds(s.day_open);
  if p_limit <> public.round_tick(p_limit) or p_limit < b.lo or p_limit > b.hi then raise exception 'bad_price'; end if;

  insert into public.accounts (guild_id, discord_id) values (p_guild, me) on conflict do nothing;
  if p_side = 'buy' then
    reserve := ceil(p_limit * p_qty) + greatest(1, ceil(p_limit * p_qty * cfg.fee_rate));
    update public.accounts set cash = cash - reserve, updated_at = now()
     where guild_id = p_guild and discord_id = me and cash >= reserve;
    if not found then raise exception 'insufficient_cash'; end if;
  else
    reserve := 0;
    select * into h from public.holdings
     where guild_id = p_guild and owner_id = me and stock_id = p_stock for update;
    if not found or h.qty - h.reserved_qty < p_qty then raise exception 'insufficient_shares'; end if;
    update public.holdings set reserved_qty = reserved_qty + p_qty
     where guild_id = p_guild and owner_id = me and stock_id = p_stock;
  end if;

  insert into public.orders (guild_id, owner_id, stock_id, side, qty, limit_price, reserved_cash)
  values (p_guild, me, p_stock, p_side, p_qty, p_limit, reserve)
  returning id into v_order;

  perform public._settle(p_guild, p_stock);
  select status into st from public.orders where id = v_order;
  return jsonb_build_object('order_id', v_order, 'status', st);
end $$;

-- 주문 취소 / 만료 공통: 묶어 둔 갈레온 · 수량을 푼다.
create function public._close_order(p_order_id bigint, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id and status = 'open' for update;
  if not found then return; end if;
  if o.side = 'buy' then
    update public.accounts set cash = cash + o.reserved_cash, updated_at = now()
     where guild_id = o.guild_id and discord_id = o.owner_id;
  else
    update public.holdings set reserved_qty = greatest(0, reserved_qty - o.qty)
     where guild_id = o.guild_id and owner_id = o.owner_id and stock_id = o.stock_id;
  end if;
  update public.orders set status = p_status, closed_at = now() where id = p_order_id;
end $$;

create function public.cancel_order(p_order_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  me text := public.my_discord_id();
begin
  if me is null then raise exception 'not_logged_in'; end if;
  if not exists (select 1 from public.orders where id = p_order_id and owner_id = me and status = 'open') then
    raise exception 'no_order';
  end if;
  perform public._close_order(p_order_id, 'cancelled');
end $$;

-- 예전 사이트 호환: 현금 시장가 주문
create or replace function public.trade(p_guild text, p_stock text, p_side text, p_qty integer)
returns jsonb
language sql security definer set search_path = public as $$
  select public.place_order(p_guild, p_stock, p_side, p_qty, 'cash', null)
$$;

-- 호가창: 열린 지정가 주문을 가격별로 모은다 (누가 냈는지는 숨긴다).
create function public.order_book(p_guild text, p_stock text)
returns table (side text, price numeric, qty bigint, orders bigint)
language sql stable security definer set search_path = public as $$
  select o.side, o.limit_price, sum(o.qty), count(*)
    from public.orders o
   where o.guild_id = p_guild and o.stock_id = p_stock and o.status = 'open'
     and public.is_guild_member(p_guild)
   group by o.side, o.limit_price
   order by o.limit_price desc
$$;

-- 종목별 최근 주가 (목록 미니 그래프)
create function public.recent_prices(p_guild text, p_points integer default 30)
returns table (discord_id text, price numeric, id bigint)
language sql stable security definer set search_path = public as $$
  select t.discord_id, t.price, t.id
    from (select pt.discord_id, pt.price, pt.id,
                 row_number() over (partition by pt.discord_id order by pt.id desc) rn
            from public.price_ticks pt
           where pt.guild_id = p_guild and pt.created_at > now() - interval '3 days') t
   where t.rn <= p_points and public.is_guild_member(p_guild)
   order by t.id
$$;

-- ───────────────────────────── 명예의 전당 (순자산) ─────────────────────────────
--
-- 순자산 = 현금 + 매수 주문에 묶인 갈레온 + 보유 주식 평가액
--        + 신용(평가액 − 대출금) + 공매도(담보 − 되사는 데 드는 금액)

drop function public.leaderboard(text);
create function public.leaderboard(p_guild text)
returns table (discord_id text, display_name text, cash bigint, stock_value bigint, net_worth bigint)
language sql stable security definer set search_path = public as $$
  select a.discord_id,
         coalesce(st.display_name, a.display_name, pr.display_name, '익명의 마법사'),
         a.cash,
         (coalesce(v.value, 0) + coalesce(c.value, 0) + coalesce(sh.value, 0) + coalesce(o.reserved, 0))::bigint,
         (a.cash + coalesce(v.value, 0) + coalesce(c.value, 0) + coalesce(sh.value, 0) + coalesce(o.reserved, 0))::bigint
    from public.accounts a
    left join public.stocks st on st.guild_id = a.guild_id and st.discord_id = a.discord_id
    left join public.profiles pr on pr.discord_id = a.discord_id
    left join lateral (
      select floor(sum(h.qty * s.price)) as value
        from public.holdings h
        join public.stocks s on s.guild_id = h.guild_id and s.discord_id = h.stock_id
       where h.guild_id = a.guild_id and h.owner_id = a.discord_id
    ) v on true
    left join lateral (
      select floor(sum(cp.qty * s.price - cp.loan)) as value
        from public.credit_positions cp
        join public.stocks s on s.guild_id = cp.guild_id and s.discord_id = cp.stock_id
       where cp.guild_id = a.guild_id and cp.owner_id = a.discord_id
    ) c on true
    left join lateral (
      select floor(sum(sp.collateral - sp.qty * s.price)) as value
        from public.short_positions sp
        join public.stocks s on s.guild_id = sp.guild_id and s.discord_id = sp.stock_id
       where sp.guild_id = a.guild_id and sp.owner_id = a.discord_id
    ) sh on true
    left join lateral (
      select sum(od.reserved_cash) as reserved
        from public.orders od
       where od.guild_id = a.guild_id and od.owner_id = a.discord_id and od.status = 'open'
    ) o on true
   where a.guild_id = p_guild and public.is_guild_member(p_guild)
   order by 5 desc
$$;

-- ───────────────────────────── 실적 · 배당 (매주 월요일 00:00) ─────────────────────────────

create function public._study_minutes(p_guild text, p_stock text, p_from timestamptz, p_to timestamptz) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum((e.payload->>'presenceMinutes')::numeric), 0)::integer
    from public.market_events e
   where e.guild_id = p_guild and e.discord_id = p_stock and e.type = 'period_complete'
     and e.occurred_at >= p_from and e.occurred_at < p_to
$$;

create function public._announce_earnings(p_guild text) returns void
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
    insert into public.market_news (guild_id, kind, target, headline, pct)
    values (p_guild, 'earnings', s.discord_id,
            format('%s 주간 실적 — 공부 %s분 (예상 %s분) · %s', s.display_name, act, cons,
                   case when sur >= 0.1 then '어닝 서프라이즈 🚀' when sur <= -0.1 then '어닝 쇼크 📉' else '예상 부합' end),
            round(eff, 4));

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

-- ───────────────────────────── 매일 00:00 KST ─────────────────────────────

drop function public.apply_daily_reversion();

create function public.market_daily() returns void
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
      perform public._announce_earnings(g);
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

-- ───────────────────────────── 5분마다: 노이즈 · 랜덤 뉴스 ─────────────────────────────

create function public.market_tick() returns void
language plpgsql security definer set search_path = public as $$
declare
  cfg     public.market_config;
  g       text;
  s       public.stocks;
  m       double precision;
  hf      jsonb;
  hs      text;
  pct     numeric;
  t       public.news_templates;
  pos     boolean;
  target  public.stocks;
  per_tick numeric := 1.0 / 288;
begin
  perform pg_advisory_xact_lock(hashtext('galleon-market'));
  select * into cfg from public.market_config;

  for g in select distinct guild_id from public.stocks loop
    -- 노이즈 = 시장 요인 + 기숙사 요인 + 종목 고유 요인 (평균 0)
    m := public.randn() * cfg.noise_market;
    select coalesce(jsonb_object_agg(house, public.randn() * cfg.noise_house), '{}') into hf
      from (select distinct house from public.stocks where guild_id = g and house is not null) x;
    for s in select * from public.stocks where guild_id = g order by discord_id loop
      pct := m + coalesce((hf->>s.house)::double precision, 0) + public.randn() * cfg.noise_stock;
      perform public._move_price(g, s.discord_id, (s.price * (1 + pct))::numeric, 'noise');
    end loop;

    -- 시장 전체 뉴스
    if random() < cfg.news_macro_per_day * per_tick then
      pos := random() < 0.5;
      select * into t from public.news_templates where scope = 'macro' and positive = pos order by random() limit 1;
      pct := (0.01 + random() * 0.02) * (case when pos then 1 else -1 end);
      insert into public.market_news (guild_id, kind, headline, pct) values (g, 'macro', t.headline, round(pct, 4));
      for s in select * from public.stocks where guild_id = g order by discord_id loop
        perform public._move_price(g, s.discord_id, (s.price * (1 + pct * (0.7 + random() * 0.6)))::numeric, 'news');
      end loop;
    end if;

    -- 기숙사(업종) 뉴스
    if random() < cfg.news_sector_per_day * per_tick then
      hs := null;
      select house into hs from public.stocks where guild_id = g and house is not null order by random() limit 1;
      if hs is not null then
        pos := random() < 0.5;
        select * into t from public.news_templates where scope = 'sector' and positive = pos order by random() limit 1;
        pct := (0.015 + random() * 0.025) * (case when pos then 1 else -1 end);
        insert into public.market_news (guild_id, kind, target, headline, pct)
        values (g, 'sector', hs, replace(t.headline, '{house}',
                case hs when 'gryffindor' then '그리핀도르' when 'slytherin' then '슬리데린'
                        when 'ravenclaw' then '래번클로' when 'hufflepuff' then '후플푸프' else hs end),
                round(pct, 4));
        for s in select * from public.stocks where guild_id = g and house = hs order by discord_id loop
          perform public._move_price(g, s.discord_id, (s.price * (1 + pct * (0.7 + random() * 0.6)))::numeric, 'news');
        end loop;
      end if;
    end if;

    -- 종목 루머
    if random() < cfg.news_rumor_per_day * per_tick then
      select * into target from public.stocks where guild_id = g order by random() limit 1;
      pos := random() < 0.5;
      select * into t from public.news_templates where scope = 'rumor' and positive = pos order by random() limit 1;
      pct := (0.02 + random() * 0.04) * (case when pos then 1 else -1 end);
      insert into public.market_news (guild_id, kind, target, headline, pct)
      values (g, 'rumor', target.discord_id, replace(t.headline, '{name}', target.display_name), round(pct, 4));
      perform public._move_price(g, target.discord_id, target.price * (1 + pct), 'news');
    end if;

    for s in select * from public.stocks where guild_id = g order by discord_id loop
      perform public._settle(g, s.discord_id);
    end loop;
    perform public._snapshot_indices(g);
  end loop;
end $$;

select cron.unschedule('market-daily-reversion');
select cron.schedule('market-daily', '0 15 * * *', 'select public.market_daily()');
select cron.schedule('market-tick', '*/5 * * * *', 'select public.market_tick()');

-- ───────────────────────────── 권한 · RLS · Realtime ─────────────────────────────

revoke all on function
  public._move_price(text, text, numeric, text, bigint),
  public._quote(numeric, numeric, text, integer),
  public.price_bounds(numeric),
  public.randn(),
  public._execute(text, text, text, text, integer, text, text, boolean, bigint),
  public._match_orders(text, text),
  public._check_margins(text, text),
  public._settle(text, text),
  public._index_value(text, text),
  public._index_on_listing(text, text, numeric),
  public._snapshot_indices(text),
  public._study_minutes(text, text, timestamptz, timestamptz),
  public._announce_earnings(text),
  public._close_order(bigint, text),
  public.market_daily(),
  public.market_tick()
from public, anon, authenticated;

revoke all on function
  public.place_order(text, text, text, integer, text, numeric),
  public.cancel_order(bigint),
  public.order_book(text, text),
  public.recent_prices(text, integer),
  public.leaderboard(text)
from public, anon;
grant execute on function
  public.place_order(text, text, text, integer, text, numeric),
  public.cancel_order(bigint),
  public.order_book(text, text),
  public.recent_prices(text, integer),
  public.leaderboard(text)
to authenticated;

alter table public.orders            enable row level security;
alter table public.credit_positions  enable row level security;
alter table public.short_positions   enable row level security;
alter table public.candles           enable row level security;
alter table public.market_indices    enable row level security;
alter table public.index_ticks       enable row level security;
alter table public.earnings          enable row level security;
alter table public.dividend_payments enable row level security;
alter table public.market_news       enable row level security;
alter table public.news_templates    enable row level security;

create policy "own orders"     on public.orders            for select to authenticated using (owner_id = public.my_discord_id());
create policy "own credit"     on public.credit_positions  for select to authenticated using (owner_id = public.my_discord_id());
create policy "own short"      on public.short_positions   for select to authenticated using (owner_id = public.my_discord_id());
create policy "own dividends"  on public.dividend_payments for select to authenticated using (owner_id = public.my_discord_id());
create policy "member candles" on public.candles           for select to authenticated using (public.is_guild_member(guild_id));
create policy "member indices" on public.market_indices    for select to authenticated using (public.is_guild_member(guild_id));
create policy "member index ticks" on public.index_ticks   for select to authenticated using (public.is_guild_member(guild_id));
create policy "member earnings" on public.earnings         for select to authenticated using (public.is_guild_member(guild_id));
create policy "member news"    on public.market_news       for select to authenticated using (public.is_guild_member(guild_id));

alter publication supabase_realtime add table
  public.orders, public.credit_positions, public.short_positions, public.market_news,
  public.market_indices, public.index_ticks, public.earnings;
