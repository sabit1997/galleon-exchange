import { HOUSE_STYLES, houseKey } from "@/lib/format";

export function HouseBadge({ house }: { house: string | null }) {
  const key = houseKey(house);
  const style = HOUSE_STYLES[key];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${style.badge}`}>
      {key === "none" && house ? house : style.label}
    </span>
  );
}
