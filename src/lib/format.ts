// 화면 표시용 포맷터. 모두 순수 함수.

const priceFmt = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const intFmt = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

/** 주가 (소수 둘째 자리): 1,234.50 */
export function formatPrice(n: number): string {
  return priceFmt.format(n);
}

/** 갈레온 정수 금액: 1,234 */
export function formatGalleon(n: number): string {
  return intFmt.format(n);
}

/** 부호 붙은 정수 금액: +1,234 / -56 / 0 */
export function formatSignedGalleon(n: number): string {
  if (n > 0) return `+${intFmt.format(n)}`;
  if (n < 0) return `-${intFmt.format(-n)}`;
  return "0";
}

/** 비율 → 퍼센트: 0.0123 → +1.23%, -0.005 → -0.50%, 0 → 0.00% */
export function formatPct(ratio: number, digits = 2): string {
  const pct = ratio * 100;
  const fixed = Math.abs(pct).toFixed(digits);
  if (Number(fixed) === 0) return `${(0).toFixed(digits)}%`;
  return `${pct > 0 ? "+" : "-"}${fixed}%`;
}

/** 상대 시간: 방금 / 3분 전 / 2시간 전 / 3일 전 / 10월 2일 */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const sec = Math.max(0, Math.floor((now - t) / 1000));
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  const d = new Date(t + 9 * 60 * 60 * 1000); // KST
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}

export type HouseKey = "gryffindor" | "slytherin" | "ravenclaw" | "hufflepuff" | "none";

const HOUSE_ALIASES: Record<Exclude<HouseKey, "none">, string[]> = {
  gryffindor: ["gryffindor", "그리핀도르"],
  slytherin: ["slytherin", "슬리데린"],
  ravenclaw: ["ravenclaw", "래번클로", "레번클로", "래반클로"],
  hufflepuff: ["hufflepuff", "후플푸프", "후플루프"],
};

/** 기숙사 이름(한글/영문, 이모지 섞여도 됨) → 키 */
export function houseKey(house: string | null | undefined): HouseKey {
  if (!house) return "none";
  const h = house.toLowerCase();
  for (const [key, names] of Object.entries(HOUSE_ALIASES) as [Exclude<HouseKey, "none">, string[]][]) {
    if (names.some((n) => h.includes(n))) return key;
  }
  return "none";
}

/**
 * 기숙사 색 — 빨강/금, 초록/은, 파랑/청동, 노랑/검정을 다크 배경용 모던 팔레트로.
 * badge: 은은한 칩, dot: 두 가지 기숙사 색 그라데이션, avatar: 이니셜 아바타 배경.
 */
export const HOUSE_STYLES: Record<HouseKey, { badge: string; dot: string; avatar: string; label: string }> = {
  gryffindor: {
    badge: "bg-[#ff5a5f]/12 text-[#ffb3ae] ring-[#ff5a5f]/25",
    dot: "bg-[linear-gradient(135deg,#ff5a5f_45%,#f5c451_55%)]",
    avatar: "bg-[linear-gradient(135deg,#ff5a5f,#b3243a_60%,#f5c451)] text-white",
    label: "그리핀도르",
  },
  slytherin: {
    badge: "bg-[#2ecc8f]/12 text-[#8ff0c4] ring-[#2ecc8f]/25",
    dot: "bg-[linear-gradient(135deg,#2ecc8f_45%,#c9d1d9_55%)]",
    avatar: "bg-[linear-gradient(135deg,#2ecc8f,#11734f_60%,#c9d1d9)] text-white",
    label: "슬리데린",
  },
  ravenclaw: {
    badge: "bg-[#4f7cff]/14 text-[#aec4ff] ring-[#4f7cff]/28",
    dot: "bg-[linear-gradient(135deg,#4f7cff_45%,#d08b4f_55%)]",
    avatar: "bg-[linear-gradient(135deg,#4f7cff,#243f9e_60%,#d08b4f)] text-white",
    label: "래번클로",
  },
  hufflepuff: {
    badge: "bg-[#ffcc33]/12 text-[#ffe08a] ring-[#ffcc33]/25",
    dot: "bg-[linear-gradient(135deg,#ffcc33_45%,#1c1c22_55%)] ring-1 ring-[#ffcc33]/40",
    avatar: "bg-[linear-gradient(135deg,#ffd84d,#e0a800_60%,#2a2520)] text-[#1c1708]",
    label: "후플푸프",
  },
  none: {
    badge: "bg-white/6 text-slate-300 ring-white/10",
    dot: "bg-slate-500",
    avatar: "bg-[linear-gradient(135deg,#6b7095,#33365a)] text-white",
    label: "무소속",
  },
};
