"use client";

/** 밑줄 탭. 탭이 많으면 탭 줄 안에서만 가로로 스크롤된다. */
export function TabBar<K extends string>({
  tabs,
  value,
  onChange,
  label,
  className = "",
}: {
  tabs: readonly { key: K; label: string; count?: number }[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={`scroll-x border-b border-white/8 ${className}`}>
      <div role="tablist" aria-label={label} className="flex min-w-max gap-5 px-4 sm:px-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={value === t.key}
            onClick={() => onChange(t.key)}
            className="tab"
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1 rounded-md bg-white/8 px-1.5 py-px text-[11px] font-semibold text-slate-300 tabular-nums">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 필터 칩 줄. 하나만 고른다. 칩이 넘치면 칩 줄 안에서만 가로 스크롤. */
export function ChipGroup<K extends string>({
  options,
  value,
  onChange,
  label,
  className = "",
}: {
  options: readonly { key: K; label: React.ReactNode }[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={`scroll-x ${className}`}>
      <div role="group" aria-label={label} className="flex min-w-max gap-1.5">
        {options.map((o) => (
          <button key={o.key} type="button" aria-pressed={value === o.key} onClick={() => onChange(o.key)} className="chip pressable">
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
