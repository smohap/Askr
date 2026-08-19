"use client";

import { useEffect, useState } from "react";

/**
 * Mockup's visible offer expiry. Mono, like every other number in the product.
 * Ticks once a second and stops at zero rather than counting negative.
 */
export function Countdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(() => Date.parse(expiresAt) - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(Date.parse(expiresAt) - Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (remaining <= 0) {
    return <span className="font-mono text-[11px] text-danger">Expired</span>;
  }

  const totalMinutes = Math.floor(remaining / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.floor((remaining % 60_000) / 1000);

  const urgent = remaining < 60 * 60 * 1000;

  return (
    <span className={`font-mono text-[11px] ${urgent ? "text-amber" : "text-muted"}`}>
      {hours > 0
        ? `${hours}h ${String(minutes).padStart(2, "0")}m left`
        : `${minutes}:${String(seconds).padStart(2, "0")} left`}
    </span>
  );
}
