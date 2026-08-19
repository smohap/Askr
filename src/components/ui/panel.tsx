import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/** Mockup .live-card / .offer-card / .pay-summary — the raised surface. */
export function Panel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-xl border border-grid bg-panel-raised p-[15px]",
        className,
      )}
      {...props}
    />
  );
}

/** A Panel that navigates. Hover lifts the border to signal-dim, as in the mockup. */
export function PanelLink({
  className,
  href,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-xl border border-grid bg-panel-raised p-[15px] transition-colors hover:border-signal-dim",
        className,
      )}
      {...props}
    />
  );
}

/** Mockup .section-label — mono, uppercase, wide tracking, faint. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Mockup .topbar — back affordance plus title, on a grid rule. */
export function TopBar({
  title,
  backHref,
  action,
}: {
  title: string;
  backHref?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-none items-center gap-3 border-b border-grid px-5 pb-[10px] pt-[14px]">
      {backHref && (
        <Link
          href={backHref}
          aria-label="Back"
          className="flex size-[30px] flex-none items-center justify-center rounded-full border border-grid bg-panel-raised text-muted transition-colors hover:border-signal-dim hover:text-signal"
        >
          ←
        </Link>
      )}
      <h1 className="font-display text-[17px] font-semibold">{title}</h1>
      {action && <div className="ml-auto">{action}</div>}
    </header>
  );
}

/** A metric rendered the way the mockup renders every number: mono. */
export function Metric({
  value,
  label,
  tone = "text",
}: {
  value: string;
  label?: string;
  tone?: "text" | "signal" | "amber" | "danger" | "muted";
}) {
  const tones = {
    text: "text-text",
    signal: "text-signal",
    amber: "text-amber",
    danger: "text-danger",
    muted: "text-muted",
  } as const;

  return (
    <div>
      <div className={cn("font-mono text-[18px] font-semibold", tones[tone])}>{value}</div>
      {label && <SectionLabel className="mt-1">{label}</SectionLabel>}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-grid px-5 py-10 text-center">
      <p className="text-[13.5px] font-semibold">{title}</p>
      {hint && <p className="mt-1.5 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}
