// 직접 그린 라인 아이콘과 마법 모티프. 외부 이미지·로고는 쓰지 않는다.

type IconProps = { className?: string };

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** 네 갈래 반짝이 별 */
export function Sparkle({ className = "" }: IconProps) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`h-3 w-3 ${className}`} fill="currentColor">
      <path d="M12 1.5c.5 4.9 2.6 7 7.5 7.5v.1c-4.9.5-7 2.6-7.5 7.5h-.1c-.5-4.9-2.6-7-7.5-7.5V9c4.9-.5 7-2.6 7.5-7.5Z" transform="translate(0 3)" />
    </svg>
  );
}

/** 로고 마크 — 끝에서 별이 반짝이는 지팡이 */
export function LogoMark({ className = "" }: IconProps) {
  return (
    <span
      aria-hidden
      className={`relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,#8b7cff,#5b4bdb_55%,#2b2470)] shadow-[0_6px_20px_-6px_rgb(124_108_255/0.8),inset_0_1px_0_rgb(255_255_255/0.25)] ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5">
        <path d="M5 19 14.5 9.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M5 19 7.2 16.8" stroke="#ffe29a" strokeWidth="2.2" strokeLinecap="round" />
        <path
          d="M17.5 2.5c.3 2.4 1.3 3.4 3.7 3.7v.1c-2.4.3-3.4 1.3-3.7 3.7h-.1c-.3-2.4-1.3-3.4-3.7-3.7v-.1c2.4-.3 3.4-1.3 3.7-3.7Z"
          fill="#ffe29a"
        />
      </svg>
    </span>
  );
}

export function ChartIcon({ className = "" }: IconProps) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`h-5 w-5 ${className}`} {...line}>
      <path d="M3 17.5 9 11.5l4 4 8-8.5" />
      <path d="M15.5 7H21v5.5" />
    </svg>
  );
}

export function WalletIcon({ className = "" }: IconProps) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`h-5 w-5 ${className}`} {...line}>
      <rect x="3" y="5.5" width="18" height="14" rx="3.5" />
      <path d="M16 12.5h2" />
      <path d="M3 9.5h18" />
    </svg>
  );
}

export function NewsIcon({ className = "" }: IconProps) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`h-5 w-5 ${className}`} {...line}>
      <path d="M5 4.5h11a2 2 0 0 1 2 2V19a1.5 1.5 0 0 0 3 0V9h-3" />
      <path d="M5 4.5A2 2 0 0 0 3 6.5V18a2 2 0 0 0 2 2.5h14.5" />
      <path d="M7 9h7M7 12.5h7M7 16h4" />
    </svg>
  );
}

export function BookIcon({ className = "" }: IconProps) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`h-5 w-5 ${className}`} {...line}>
      <path d="M12 6.5C10.2 5 7.6 4.5 4 4.5v13c3.6 0 6.2.5 8 2 1.8-1.5 4.4-2 8-2v-13c-3.6 0-6.2.5-8 2Z" />
      <path d="M12 6.5v13" />
    </svg>
  );
}

export function TrophyIcon({ className = "" }: IconProps) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`h-5 w-5 ${className}`} {...line}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3.6M17 6h2.5a2.5 2.5 0 0 1-2.6 3.6" />
      <path d="M12 14v3.5M8.5 20.5h7M9.5 17.5h5" />
    </svg>
  );
}

export function ArrowLeftIcon({ className = "" }: IconProps) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} {...line}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function ChevronRightIcon({ className = "" }: IconProps) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} {...line}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function SearchIcon({ className = "" }: IconProps) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} {...line}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  );
}

export function LogoutIcon({ className = "" }: IconProps) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} {...line}>
      <path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14" />
      <path d="M10 8l-4 4 4 4M6 12h9" />
    </svg>
  );
}
