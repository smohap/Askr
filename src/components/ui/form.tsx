import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Mockup .field label — mono, uppercase, faint. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-[18px]">
      <label
        htmlFor={htmlFor}
        className="mb-2 block font-mono text-[11.5px] uppercase tracking-[0.06em] text-faint"
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-[11.5px] text-faint">{hint}</p>}
      {error && (
        <p className="mt-1.5 text-[11.5px] text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const control =
  "w-full rounded-[10px] border border-grid bg-panel-raised px-[13px] py-3 text-[14px] " +
  "text-text placeholder:text-faint focus:border-signal-dim";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "resize-none", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(control, className)} {...props}>
      {children}
    </select>
  );
}

/** A form-level failure, distinct from per-field errors. */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="mb-4 rounded-[10px] border border-danger bg-danger/10 px-3.5 py-3 text-[12.5px] text-danger"
    >
      {children}
    </p>
  );
}

/** Mockup .escrow-note — the reassuring signal-washed callout. */
export function SignalNote({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 flex gap-2.5 rounded-[10px] border border-signal-dim bg-signal-wash-soft px-3.5 py-3 text-[12px] text-muted">
      {children}
    </div>
  );
}
