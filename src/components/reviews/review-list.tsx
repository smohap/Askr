import { Stars } from "./stars";
import { Panel, SectionLabel } from "@/components/ui/panel";
import { formatDateTime } from "@/lib/money";

export type PublicReview = {
  id: string;
  rating: number;
  body: string;
  reply_body: string | null;
  replied_at: string | null;
  created_at: string;
};

/** Reviews as a buyer sees them while deciding: the rating, and the reply under it. */
export function ReviewList({ reviews }: { reviews: PublicReview[] }) {
  if (reviews.length === 0) return null;

  return (
    <Panel>
      <SectionLabel className="mb-3">Recent reviews</SectionLabel>

      <ul className="space-y-3.5">
        {reviews.map((r) => (
          <li key={r.id} className="border-b border-dashed border-grid pb-3.5 last:border-b-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <Stars rating={r.rating} />
              <span className="font-mono text-[10.5px] text-faint">
                {formatDateTime(r.created_at)}
              </span>
            </div>

            {r.body && <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{r.body}</p>}

            {r.reply_body && (
              <div className="mt-2.5 border-l-2 border-signal-dim pl-3">
                <SectionLabel>Provider replied</SectionLabel>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">{r.reply_body}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
