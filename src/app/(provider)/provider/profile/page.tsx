import type { Metadata } from "next";
import { Badge } from "@/components/ui/identity";
import { Panel, SectionLabel } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { DocumentUpload } from "./document-upload";

export const metadata: Metadata = { title: "Business profile" };

const VERIFICATION_COPY = {
  unverified: {
    tone: "muted",
    label: "Not verified",
    hint: "Upload your documents below. You can't send offers until an admin approves them.",
  },
  pending: {
    tone: "amber",
    label: "Verification pending",
    hint: "An admin is reviewing your documents. Requests appear in your feed once approved.",
  },
  verified: {
    tone: "signal",
    label: "Verified",
    hint: "You're live. Matching requests arrive in your feed.",
  },
  rejected: {
    tone: "danger",
    label: "Verification rejected",
    hint: "See the reason below, then upload a replacement document.",
  },
} as const;

export default async function ProviderProfilePage() {
  const viewer = await requireRole("provider");
  const supabase = await createClient();

  const [{ data: profile }, { data: categories }] = await Promise.all([
    supabase
      .from("provider_profiles")
      .select(
        "id, business_name, tagline, about, location_label, service_radius_km, verification_status, verification_reason, rating_avg, rating_count, jobs_completed",
      )
      .eq("user_id", viewer.id)
      .maybeSingle(),
    supabase.from("categories").select("slug, name").eq("is_phase1", true).order("sort_order"),
  ]);

  const { data: mine } = profile
    ? await supabase
        .from("provider_categories")
        .select("categories(slug)")
        .eq("provider_id", profile.id)
    : { data: null };

  const selected =
    mine?.map((m) => (m.categories as unknown as { slug: string }).slug).filter(Boolean) ?? [];

  const { data: documents } = profile
    ? await supabase
        .from("provider_documents")
        .select("id, doc_type, status, review_reason, created_at")
        .eq("provider_id", profile.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const status = (profile?.verification_status ??
    "unverified") as keyof typeof VERIFICATION_COPY;
  const copy = VERIFICATION_COPY[status];

  return (
    <div className="grid gap-5 py-6 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="mb-4 font-display text-[22px] font-semibold">Business profile</h1>
        <ProfileForm
          categories={categories ?? []}
          selectedCategories={selected}
          profile={
            profile
              ? {
                  businessName: profile.business_name,
                  tagline: profile.tagline,
                  about: profile.about,
                  locationLabel: profile.location_label,
                  serviceRadiusKm: profile.service_radius_km,
                }
              : null
          }
        />
      </div>

      <div className="space-y-4">
        <Panel>
          <SectionLabel className="mb-2.5">Verification</SectionLabel>
          <Badge tone={copy.tone}>{copy.label}</Badge>
          <p className="mt-2.5 text-[12.5px] text-muted">{copy.hint}</p>
          {profile?.verification_reason && status === "rejected" && (
            <p className="mt-2.5 rounded-[10px] border border-danger px-3 py-2.5 text-[12px] text-danger">
              {profile.verification_reason}
            </p>
          )}
        </Panel>

        {profile && (
          <>
            <Panel>
              <SectionLabel className="mb-3">Documents</SectionLabel>
              {documents?.length ? (
                <ul className="mb-4 space-y-2">
                  {documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3">
                      <span className="text-[12.5px] capitalize text-muted">{d.doc_type}</span>
                      <span className="flex items-center gap-2">
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
                        <span className="font-mono text-[10px] text-faint">
                          {formatDateTime(d.created_at)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-4 text-[12.5px] text-faint">Nothing uploaded yet.</p>
              )}
              <DocumentUpload />
            </Panel>

            <Panel>
              <SectionLabel className="mb-3">Standing</SectionLabel>
              <dl className="space-y-2 text-[12.5px]">
                <Stat label="Rating">
                  {profile.rating_count > 0
                    ? `★ ${Number(profile.rating_avg).toFixed(1)} · ${profile.rating_count} reviews`
                    : "No reviews yet"}
                </Stat>
                <Stat label="Jobs completed">{profile.jobs_completed}</Stat>
              </dl>
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-faint">{label}</dt>
      <dd className="font-mono text-muted">{children}</dd>
    </div>
  );
}
