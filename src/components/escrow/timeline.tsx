import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/money";
import type { OrderState } from "@/lib/escrow/machine";

/**
 * Mockup screen 09. The completed rows are order_events, in order, exactly as
 * written — not a hardcoded list of steps with a pointer into it. The greyed
 * rows below them are the rest of the happy path, shown so the buyer can see
 * where this is going; they carry no timestamp because they have not happened.
 */

export type TimelineEvent = {
  id: number;
  from_state: OrderState | null;
  to_state: OrderState;
  actor: string;
  reason: string | null;
  created_at: string;
};

/** What arriving in each state means, in the buyer's words. */
const ARRIVAL: Record<OrderState, { title: string; sub: string }> = {
  pending_payment: { title: "Offer accepted", sub: "Waiting for your payment" },
  escrow_held: { title: "Payment held in escrow", sub: "Released only when you confirm" },
  in_progress: { title: "Job in progress", sub: "The provider has started" },
  awaiting_confirmation: { title: "Provider marked it done", sub: "Confirm to release payment" },
  released: { title: "Payment released", sub: "The provider has been paid" },
  refunded: { title: "Refunded", sub: "The full amount went back to your card" },
  disputed: { title: "Dispute raised", sub: "An admin is reviewing this order" },
  cancelled: { title: "Cancelled", sub: "No money changed hands" },
};

/** The route an untroubled order takes. Anything else is shown as it happens. */
const HAPPY_PATH: OrderState[] = [
  "pending_payment",
  "escrow_held",
  "in_progress",
  "awaiting_confirmation",
  "released",
];

export function EscrowTimeline({
  events,
  state,
}: {
  events: TimelineEvent[];
  state: OrderState;
}) {
  const reached = new Set(events.map((e) => e.to_state));
  const position = HAPPY_PATH.indexOf(state);

  // Only project ahead while the order is still on the happy path; once it is
  // disputed, refunded or cancelled there is no "next step" to promise.
  const upcoming = position === -1 ? [] : HAPPY_PATH.slice(position + 1).filter((s) => !reached.has(s));

  return (
    <ol>
      {events.map((event, i) => {
        const copy = ARRIVAL[event.to_state];
        const current = i === events.length - 1;

        return (
          <li
            key={event.id}
            className="flex items-start gap-3.5 border-b border-dashed border-grid py-3.5 last:border-b-0"
          >
            <Dot tone={current ? "now" : "done"}>{current ? "●" : "✓"}</Dot>
            <div>
              <div className="text-[13.5px] font-semibold">{copy.title}</div>
              <div className="mt-0.5 font-mono text-[11px] text-faint">
                {formatDateTime(event.created_at)}
              </div>
              {event.reason && <div className="mt-1 text-[11.5px] text-muted">{event.reason}</div>}
            </div>
          </li>
        );
      })}

      {upcoming.map((next, i) => (
        <li
          key={next}
          className="flex items-start gap-3.5 border-b border-dashed border-grid py-3.5 last:border-b-0"
        >
          <Dot tone="pending">{events.length + i + 1}</Dot>
          <div>
            <div className="text-[13.5px] font-semibold text-muted">{ARRIVAL[next].title}</div>
            <div className="mt-0.5 text-[11.5px] text-faint">{ARRIVAL[next].sub}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Dot({ tone, children }: { tone: "done" | "now" | "pending"; children: React.ReactNode }) {
  const tones = {
    done: "bg-signal border-signal text-void",
    now: "bg-panel-raised border-signal text-signal animate-state-change",
    pending: "bg-panel-raised border-grid text-faint",
  } as const;

  return (
    <span
      aria-hidden
      className={cn(
        "flex size-[22px] flex-none items-center justify-center rounded-full border-2 font-mono text-[11px]",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
