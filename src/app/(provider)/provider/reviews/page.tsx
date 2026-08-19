import type { Metadata } from "next";
import { Stars } from "@/components/reviews/stars";
import { EmptyState, Panel, SectionLabel } from "@/components/ui/panel";
import { requireProvider } from "@/lib/auth";
import { formatDateTime } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { ReplyForm } from "./reply-form";

export const metadata: Metadata = { title: "Reviews" };

export default async function ProviderReviewsPage() {
  const provider = await requireProvider();
  const supabase = await createClient();

  const [{ data: reviews }, { data: profile }] = await Promise.all([
    supabase
      .from("reviews")
      .select("id, rating, body, reply_body, replied_at, created_at, requests(title)")
      .eq("provider_id", provider.providerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("provider_profiles")
      .select("rating_avg, rating_count")
      .eq("id", provider.providerId)
      .single(),
  ]);

  return (
    <div className="py-6">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h1 className="font-display text-[20px] font-semibold">Reviews</h1>
        {profile && profile.rating_count > 0 && (
          <span className="font-mono text-[13px] text-amber">
            ★ {Number(profile.rating_avg).toFixed(1)} · {profile.rating_count} review
            {profile.rating_count === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {!reviews?.length ? (
        <EmptyState
          title="No reviews yet"
          hint="A buyer can review a job once they confirm it and the payment is released."
        />
      ) : (
        <div className="grid max-w-[640px] gap-3">
          {reviews.map((r) => {
            const request = r.requests as unknown as { title: string } | null;

            return (
              <Panel key={r.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Stars rating={r.rating} />
                    {request && (
                      <div className="mt-1 text-[12.5px] font-semibold">{request.title}</div>
                    )}
                  </div>
                  <span className="font-mono text-[10.5px] text-faint">
                    {formatDateTime(r.created_at)}
                  </span>
                </div>

                {r.body && (
                  <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{r.body}</p>
                )}

                {r.reply_body ? (
                  <div className="mt-3 border-l-2 border-signal-dim pl-3">
                    <SectionLabel>Your reply</SectionLabel>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted">{r.reply_body}</p>
                  </div>
                ) : (
                  <ReplyForm reviewId={r.id} />
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
