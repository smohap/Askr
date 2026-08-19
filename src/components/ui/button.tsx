import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Mockup .primary-btn and its variants.
 *
 * `signal` is the single primary action on a screen — the accent is scarce on
 * purpose, so two signal buttons in one view means one of them is wrong.
 */
type Variant = "signal" | "ghost" | "danger";

const base =
  "w-full rounded-xl px-4 py-[15px] text-[14.5px] font-bold transition-opacity " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  signal: "bg-signal text-void hover:opacity-90",
  ghost:
    "border border-grid bg-transparent text-muted hover:border-signal-dim hover:text-text",
  danger: "border border-danger bg-transparent text-danger hover:bg-danger/10",
};

export function Button({
  variant = "signal",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cn(base, variants[variant], className)} {...props} />;
}

/** Same surface as Button, for links that are actions (mockup .search-cta). */
export function ButtonLink({
  variant = "signal",
  className,
  ...props
}: ComponentProps<"a"> & { variant?: Variant }) {
  return (
    <a
      className={cn(base, variants[variant], "block text-center", className)}
      {...props}
    />
  );
}
