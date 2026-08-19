import { cn } from "@/lib/cn";

/** Mockup .stars — amber when on, grid when off. Read-only. */
export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span
      className="inline-flex gap-0.5 leading-none"
      style={{ fontSize: size }}
      aria-label={`${rating} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((v) => (
        <span key={v} aria-hidden className={cn(v <= rating ? "text-amber" : "text-grid")}>
          ★
        </span>
      ))}
    </span>
  );
}
