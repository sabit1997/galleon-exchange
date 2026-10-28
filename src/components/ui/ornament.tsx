// 직접 그린 장식 요소 (별·촛불·밀랍 봉인·장식선). 외부 이미지·로고는 쓰지 않는다.

/** 가운데 별이 있는 금색 장식선 */
export function Flourish({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 200 12" className={`h-3 w-40 text-gold ${className}`} fill="none">
      <path d="M2 6 H80" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1" />
      <path d="M120 6 H198" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1" />
      <circle cx="84" cy="6" r="1.4" fill="currentColor" fillOpacity="0.7" />
      <circle cx="116" cy="6" r="1.4" fill="currentColor" fillOpacity="0.7" />
      <path d="M100 0.5 L102 4 L105.5 6 L102 8 L100 11.5 L98 8 L94.5 6 L98 4 Z" fill="currentColor" />
    </svg>
  );
}

/** 작은 반짝이 별 */
export function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`h-3 w-3 ${className}`} fill="currentColor">
      <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" />
    </svg>
  );
}

/** 일렁이는 촛불 */
export function Candle({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 64" className={`h-14 w-5 ${className}`}>
      <defs>
        <radialGradient id="candle-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd88a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffd88a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="candle-wax" x1="0" x2="1">
          <stop offset="0%" stopColor="#e9dcc0" />
          <stop offset="60%" stopColor="#f8f0dc" />
          <stop offset="100%" stopColor="#cbb98f" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="14" r="12" fill="url(#candle-glow)" />
      <g className="candle-flame">
        <path d="M12 4 C15 9 15.5 13 12 18 C8.5 13 9 9 12 4 Z" fill="#ffc861" />
        <path d="M12 9 C13.4 11.5 13.4 14 12 16.5 C10.6 14 10.6 11.5 12 9 Z" fill="#fff4d0" />
      </g>
      <path d="M12 18 V21" stroke="#3b2a1a" strokeWidth="1" />
      <path d="M7 21 H17 V62 H7 Z" fill="url(#candle-wax)" />
      <path d="M7 21 C8 25 9 23 9.5 27 C10 23 11 24 12 21 Z" fill="#f8f0dc" />
    </svg>
  );
}

/** 밀랍 봉인 — 가운데 별 문양 */
export function WaxSeal({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 64 64" className={`h-16 w-16 ${className}`}>
      <defs>
        <radialGradient id="wax" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#b0303f" />
          <stop offset="70%" stopColor="#7a1a28" />
          <stop offset="100%" stopColor="#4d0f19" />
        </radialGradient>
      </defs>
      <path
        d="M32 3 C38 5 41 2 46 6 C51 9 55 10 57 16 C60 21 62 25 60 31 C61 37 62 42 58 47 C55 52 52 56 46 58 C41 61 37 62 32 60 C26 62 21 60 17 57 C11 55 8 51 6 46 C3 41 3 36 4 31 C2 25 5 21 8 16 C10 11 14 8 19 6 C23 3 27 4 32 3 Z"
        fill="url(#wax)"
      />
      <circle cx="32" cy="32" r="19" fill="none" stroke="#3f0c14" strokeOpacity="0.55" strokeWidth="2" />
      <circle cx="32" cy="32" r="19" fill="none" stroke="#e0707e" strokeOpacity="0.25" strokeWidth="1" transform="translate(-0.8 -0.8)" />
      <path
        d="M32 18 L35 28 L45 29 L37 35 L40 45 L32 39 L24 45 L27 35 L19 29 L29 28 Z"
        fill="#4d0f19"
        fillOpacity="0.75"
        stroke="#e0707e"
        strokeOpacity="0.35"
        strokeWidth="0.8"
      />
    </svg>
  );
}
