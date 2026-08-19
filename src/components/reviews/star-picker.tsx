"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Mockup screen 10's star row. The value rides in a hidden input so the form
 * posts as a plain form — no client state has to reach the server action.
 */
export function StarPicker({ name = "rating", defaultValue = 0 }: { name?: string; defaultValue?: number }) {
  const [rating, setRating] = useState(defaultValue);
  const [hover, setHover] = useState(0);
  const shown = hover || rating;

  return (
    <div className="my-4">
      <input type="hidden" name={name} value={rating} />
      <div className="flex justify-center gap-2" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            aria-label={`${v} star${v === 1 ? "" : "s"}`}
            aria-pressed={rating === v}
            onMouseEnter={() => setHover(v)}
            onFocus={() => setHover(v)}
            onClick={() => setRating(v)}
            className={cn(
              "text-[32px] leading-none transition-colors",
              v <= shown ? "text-amber" : "text-grid",
            )}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}
