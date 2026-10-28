-- 봇이 보내지 않는 이벤트 종류를 지운다. 사이트가 이 표의 라벨로 "주가가 오르는/
-- 내려가는 순간" 을 안내하므로, 남아 있으면 일어나지 않는 일을 안내하게 된다.
-- 집중 경고는 봇에서 벌점(penalty) 으로 들어온다.

delete from public.event_effects where type in ('attendance', 'warning');
