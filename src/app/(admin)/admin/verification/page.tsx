import type { Metadata } from "next";
import { Badge } from "@/components/ui/identity";
import { EmptyState, Panel, SectionLabel } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { DecisionForm } from "./decision-form";

export const metadata: Metadata = { title: "Verification queue" };

const DOC_LABEL: Record<string, string> = {
  identity: "Photo ID",
  business: "Business registration",
  insurance: "Insurance certificate",
  licence: "Trade licence",
};

/** Anyone not yet verified is in the queue — rejected providers can resubmit. */
const IN_QUEUE = ["pending", "unverified", "rejected"];

export default async function VerificationQueue() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: providers } = await supabase
    .from("provider_profiles")
    .select(
      `id, business_name, tagline, location_label, verification_status, verification_reason,
       created_at,
       profiles(full_name),
       provider_documents(id, doc_type, storage_path, status, review_reason, created_at)`,
    )
    .in("verification_status", IN_QUEUE)
    .order("created_at");

  if (!providers?.length) {
    return (
      <div className="py-8">
        <EmptyState title="Queue is clear" hint="Every provider has been through verification." />
      </div>
    );
  }

  // Signed URLs rather than public ones: identity documents are not public, and
  // an hour is long enough to review a queue without leaving a live link behind.
  const signed = new Map<string, string>();
  await Promise.all(
    providers.flatMap((p) =>
      (p.provider_documents ?? []).map(async (d) => {
        const { data } = await supabase.storage
          .from("provider-documents")
          .createSignedUrl(d.storage_path, 3600);
        if (data?.signedUrl) signed.set(d.id, data.signedUrl);
      }),
    ),
  );

  return (
    <div className="py-6">
      <h1 className="mb-5 font-display text-[20px] font-semibold">
        Verification queue
        <span className="ml-2.5 font-mono text-[13px] font-normal text-faint">
          {providers.length} waiting
        </span>
      </h1>

      <div className="grid gap-4 lg:grid-cols-2">
        {providers.map((p) => {
          const owner = p.profiles as unknown as { full_name: string } | null;
          const docs = p.provider_documents ?? [];

          return (
            <Panel key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[14.5px] font-semibold">{p.business_name}</div>
                  <div className="mt-0.5 text-[12px] text-muted">
                    {owner?.full_name} · {p.location_label || "no location set"}
                  </div>
                </div>
                <Badge
                  tone={
                    p.verification_status === "pending"
                      ? "amber"
                      : p.verification_status === "rejected"
                        ? "danger"
                        : "muted"
                  }
                >
                  {p.verification_status}
                </Badge>
              </div>

              {p.verification_reason && (
                <p className="mt-2 text-[12px] text-danger">
                  Previously rejected: {p.verification_reason}
                </p>
              )}

              <SectionLabel className="mb-2 mt-4">Documents</SectionLabel>

              {docs.length === 0 ? (
                <p className="text-[12.5px] text-faint">
                  Nothing uploaded yet — there is nothing to verify against.
                </p>
              ) : (
                <ul className="space-y-3">
                  {docs.map((d) => (
                    <li key={d.id} className="rounded-[10px] border border-grid p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[12.5px] font-semibold">
                            {DOC_LABEL[d.doc_type] ?? d.doc_type}
                          </div>
                          <div className="mt-0.5 font-mono text-[10.5px] text-faint">
                            {formatDateTime(d.created_at)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <Badge
                            tone={
                              d.status === "approved"
                                ? "signal"
                                : d.status === "rejected"
                                  ? "danger"
                                  : "amber"
                            }
                          >
                            {d.status}
                          </Badge>
                          {signed.has(d.id) && (
                            <a
                              href={signed.get(d.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-[11px] text-signal hover:underline"
                            >
                              open ↗
                            </a>
                          )}
                        </div>
                      </div>

                      {d.review_reason && (
                        <p className="mt-1.5 text-[11.5px] text-danger">{d.review_reason}</p>
                      )}

                      {d.status === "pending" && (
                        <DecisionForm
                          target="document"
                          id={d.id}
                          approveLabel="Approve document"
                          rejectLabel="Reject"
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 border-t border-grid pt-3">
                <SectionLabel className="mb-1">Provider decision</SectionLabel>
                <p className="text-[11.5px] text-faint">
                  Verifying lets this provider submit offers. It is independent of the individual
                  documents above — approve those first.
                </p>
                <DecisionForm
                  target="provider"
                  id={p.id}
                  approveLabel="Verify provider"
                  rejectLabel="Reject provider"
                />
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
