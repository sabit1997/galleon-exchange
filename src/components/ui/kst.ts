// 한국 시간(KST, UTC+9) 기준 날짜 계산. 시장의 하루는 00:00 KST 에 바뀐다.

const KST_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 오늘 00:00 KST 의 ISO 문자열 (created_at 비교용) */
export function kstDayStartIso(now: number = Date.now()): string {
  const start = Math.floor((now + KST_MS) / DAY_MS) * DAY_MS - KST_MS;
  return new Date(start).toISOString();
}

/** 오늘 KST 날짜 'YYYY-MM-DD' (candles.day 비교용) */
export function kstDate(now: number = Date.now()): string {
  return new Date(now + KST_MS).toISOString().slice(0, 10);
}

const two = (n: number) => String(n).padStart(2, "0");

/** 'HH:mm' (KST) */
export function kstTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t + KST_MS);
  return `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

/** 'MM.DD HH:mm' (KST) */
export function kstDateTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t + KST_MS);
  return `${two(d.getUTCMonth() + 1)}.${two(d.getUTCDate())} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

/** 'YYYY-MM-DD' → 'M월 D일' */
export function dayLabel(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  if (!m || !d) return day;
  return `${m}월 ${d}일`;
}
