import { direction } from "@/lib/market";

/**
 * 지수 · 종목의 당일 미니 차트. base(기준가 · 시가) 위면 빨강, 아래면 파랑.
 * 가로는 부모 너비를 꽉 채우고 (viewBox + preserveAspectRatio none), 기준선은 점선.
 */
export function MiniChart({
  values,
  base,
  height = 40,
  className = "",
  label,
}: {
  values: readonly number[];
  base: number;
  height?: number;
  className?: string;
  label?: string;
}) {
  const W = 100;
  const H = height;
  const pad = 3;
  if (values.length < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={`block w-full ${className}`} style={{ height }} aria-hidden>
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} className="stroke-slate-600" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  const min = Math.min(base, ...values);
  const max = Math.max(base, ...values);
  const span = max - min || 1;
  const y = (v: number) => pad + (H - pad * 2) - ((v - min) / span) * (H - pad * 2);
  const stepX = W / (values.length - 1);
  const pts = values.map((v, i) => `${(i * stepX).toFixed(2)},${y(v).toFixed(2)}`);
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${W},${H} L0,${H} Z`;
  const dir = direction(values[values.length - 1] - base);
  const color = dir === "up" ? "#ff6b6b" : dir === "down" ? "#5b9bff" : "#8d92b4";
  const gid = `mc-${dir}`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={`block w-full overflow-visible ${className}`}
      style={{ height }}
      role="img"
      aria-label={label ?? (dir === "up" ? "기준보다 상승" : dir === "down" ? "기준보다 하락" : "보합")}
    >
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <line x1={0} x2={W} y1={y(base)} y2={y(base)} stroke="#6b7095" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
