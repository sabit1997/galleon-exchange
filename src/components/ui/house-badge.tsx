import { HOUSE_STYLES, houseKey } from "@/lib/format";

export function HouseBadge({ house }: { house: string | null }) {
  const key = houseKey(house);
  const style = HOUSE_STYLES[key];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${style.badge}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {key === "none" && house ? house : style.label}
    </span>
  );
}

/** 이름 첫 글자 + 기숙사 색 아바타 */
export function StockAvatar({ name, house, size = "md" }: { name: string; house: string | null; size?: "md" | "lg" }) {
  const style = HOUSE_STYLES[houseKey(house)];
  const initial = [...name.trim()][0] ?? "?";
  const sz = size === "lg" ? "h-14 w-14 text-xl" : "h-10 w-10 text-[15px]";
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-bold shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_4px_12px_-4px_rgb(0_0_0/0.6)] ${sz} ${style.avatar}`}
    >
      {initial}
    </span>
  );
}
