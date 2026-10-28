"use client";

import { useMarket } from "@/components/providers/market-provider";
import { ChangePct } from "@/components/ui/galleon";
import type { MarketEvent } from "@/lib/database.types";
import { eventImpact } from "@/lib/market";

const EVENT_ICONS: Record<string, string> = {
  listing: "🎓",
  period_complete: "📚",
  golden_snitch: "✨",
  golden_egg: "🥚",
  comeback: "🔁",
  penalty: "🚫",
};

export function eventIcon(type: string) {
  return EVENT_ICONS[type] ?? "🔮";
}

/** event_effects.label 과 예상 영향(pct*weight)을 함께 보여준다. */
export function EventLabel({ event }: { event: Pick<MarketEvent, "type" | "payload"> }) {
  const { effects } = useMarket();
  const effect = effects.get(event.type);
  const impact = eventImpact(effect?.pct, event.payload);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{effect?.label ?? event.type}</span>
      {impact !== 0 && <ChangePct ratio={impact} className="text-xs" />}
    </span>
  );
}
