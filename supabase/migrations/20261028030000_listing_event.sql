-- 기존 학생 일괄 상장용 이벤트 (봇 src/market/seed.js). 변동률 0 — 상장만 한다.

insert into public.event_effects (type, pct, label) values ('listing', 0, '상장')
on conflict (type) do nothing;
