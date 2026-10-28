-- 황금 알이 일반 스니치(+10%)보다 작게(+5%) 잡혀 있던 것을 바로잡는다.
-- 봇에서 황금 알은 스니치의 5배 보상(+100점 vs +20점)이고 더 드물다.

update public.event_effects set pct = 0.20 where type = 'golden_egg';
