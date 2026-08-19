import { cn } from "@/lib/cn";
import { BRAND } from "@/lib/brand";

/** Mockup .brand-mark — ring with a filled core. */
export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="relative inline-block flex-none rounded-full border-[1.5px] border-signal"
      style={{ width: size, height: size }}
    >
      <span
        className="absolute rounded-full bg-signal"
        style={{ inset: Math.max(4, Math.round(size * 0.27)) }}
      />
    </span>
  );
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <BrandMark size={size} />
      <span className="font-display text-[16px] font-bold">{BRAND.name}</span>
    </span>
  );
}

/** Mockup .avatar — initials on a signal-dim gradient. */
export function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-hidden
      className="flex flex-none items-center justify-center rounded-[10px] bg-gradient-to-br from-signal-dim to-grid font-bold text-void"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.37) }}
    >
      {initials}
    </span>
  );
}

/** Mockup .live-status — the blinking dot that means "happening now". */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-1.5 flex-none rounded-full bg-signal shadow-[0_0_6px_var(--signal)] animate-blink",
        className,
      )}
    />
  );
}

/** Verification and status chips. Amber is pending, danger is failed. */
export function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "signal" | "amber" | "danger" | "muted";
}) {
  const tones = {
    signal: "border-signal-dim text-signal",
    amber: "border-amber/50 text-amber",
    danger: "border-danger/50 text-danger",
    muted: "border-grid text-muted",
  } as const;

  return (
    <span
      className={cn(
        "inline-block rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-[0.05em]",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Mockup .best-tag — solid signal, used only on the single best-match offer. */
export function BestMatchTag() {
  return (
    <span className="inline-block rounded-full bg-signal px-2 py-0.5 font-mono text-[9.5px] font-bold tracking-[0.04em] text-void">
      Best match
    </span>
  );
}
