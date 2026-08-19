import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { LiveDot } from "@/components/ui/identity";
import { EmptyState, PanelLink, SectionLabel } from "@/components/ui/panel";
import { getViewer } from "@/lib/auth";
import { formatDateTime, formatNzd } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

/** Mockup screen 01. A guest sees the public feed; a buyer also sees their own. */
export default async function HomePage() {
  const viewer = await getViewer();
  const supabase = await createClient();

  const [{ data: categories }, { data: liveRequests }, mine] = await Promise.all([
    supabase.from("categories").select("slug, name").eq("is_phase1", true).order("sort_order"),
    supabase
      .from("requests")
      .select("id, title, budget_cents, budget_mode, needed_by, offers(count)")
      .eq("status", "published")
      .eq("visibility", "public")
      .order("published_at", { ascending: false })
      .limit(8),
    viewer?.role === "buyer"
      ? supabase
          .from("requests")
          .select("id, title, status, budget_cents, budget_mode, needed_by, offers(count)")
          .eq("buyer_id", viewer.id)
          .in("status", ["published", "awarded"])
          .order("created_at", { ascending: false })
          .limit(4)
      : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-[520px] flex-1 px-5 pb-16 pt-7">
        <h1 className="mb-1.5 font-display text-[25px] font-semibold leading-[1.2]">
          What do you
          <br />
          <em className="not-italic text-signal">need</em> today?
        </h1>
        <p className="mb-5 text-[13px] text-muted">
          Tell us once, name your price. Verified providers come to you.
        </p>

        <Link
          href="/requests/new"
          className="mb-3.5 block rounded-[14px] border border-grid bg-panel-raised p-4 transition-colors hover:border-signal-dim"
        >
          <span className="text-[14.5px] text-faint">
            e.g. &ldquo;4-bedroom house clean, this Saturday&rdquo;
          </span>
        </Link>

        <Link href="/requests/new">
          <Button className="mb-6">Broadcast a request →</Button>
        </Link>

        <div className="scrollbar-none -mx-5 mb-2 flex gap-2 overflow-x-auto px-5 pb-1.5">
          {categories?.map((c) => (
            <Link
              key={c.slug}
              href={`/requests/new?category=${c.slug}`}
              className="flex-none whitespace-nowrap rounded-full border border-grid bg-panel-raised px-3.5 py-2 text-[12px] text-muted transition-colors hover:border-signal-dim hover:text-text"
            >
              {c.name}
            </Link>
          ))}
        </div>

        {mine?.data && mine.data.length > 0 && (
          <section className="mt-6">
            <SectionLabel className="mb-2.5">Your requests</SectionLabel>
            <div className="space-y-2.5">
              {mine.data.map((r) => (
                <RequestCard key={r.id} request={r} href={`/requests/${r.id}`} />
              ))}
            </div>
          </section>
        )}

        <section className="mt-6">
          <SectionLabel className="mb-2.5">Live requests</SectionLabel>
          {liveRequests && liveRequests.length > 0 ? (
            <div className="space-y-2.5">
              {liveRequests.map((r) => (
                <RequestCard key={r.id} request={r} href={viewer ? `/requests/${r.id}` : "/signup"} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nothing live right now"
              hint="Published requests from across New Zealand show up here."
            />
          )}
        </section>
      </main>
    </>
  );
}

type CardRequest = {
  id: string;
  title: string;
  budget_cents: number | null;
  budget_mode: "fixed" | "open";
  needed_by: string | null;
  offers: { count: number }[];
};

function RequestCard({ request, href }: { request: CardRequest; href: string }) {
  const offerCount = request.offers?.[0]?.count ?? 0;

  return (
    <PanelLink href={href} className="p-3.5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-[13.5px] font-semibold">{request.title}</span>
        <span className="flex flex-none items-center gap-1.5 font-mono text-[10px] text-signal">
          <LiveDot />
          {offerCount > 0 ? `${offerCount} offer${offerCount === 1 ? "" : "s"}` : "Broadcasting"}
        </span>
      </div>
      <div className="font-mono text-[11.5px] text-muted">
        {request.budget_mode === "open" || request.budget_cents === null
          ? "Open budget"
          : `Budget ${formatNzd(request.budget_cents)}`}
        {request.needed_by && ` · Due ${formatDateTime(request.needed_by)}`}
      </div>
    </PanelLink>
  );
}
