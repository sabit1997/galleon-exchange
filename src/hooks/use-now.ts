"use client";

import { useEffect, useState } from "react";

/** 상대 시간 표시용 현재 시각. intervalMs 마다 갱신된다. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
