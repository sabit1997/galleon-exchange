-- 시장 규모를 실제 갈레온 잔액에 맞춰 100배로 올린다.
--
-- 처음 수치(상장가 10 · 하루 입금 100)는 교시당 지급률만 보고 잡았는데, 실제
-- 잔액은 10위가 1.2만 · 1위가 50만이었다. 입금 한도가 잔액의 0.02% 라 놀 거리가
-- 없었고, 가격 충격이 주식 수 기준이라 싼 주가에선 부자가 주문을 쪼개 주가를
-- 쉽게 끌어올릴 수 있었다.
--
-- 매매·계좌 잔액이 0 인 시점에 적용했다. 이미 상장된 종목의 주가와 틱은 100배로
-- 환산해 상대 변동(완주 +2% 등)을 그대로 유지한다.

update public.market_config
   set base_price = 1000,
       min_price = 500,
       daily_deposit_cap = 10000,
       max_trade_qty = 100;

update public.stocks
   set price = price * 100,
       base_price = base_price * 100,
       day_open = day_open * 100;

update public.price_ticks set price = price * 100;
