"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Verification decisions. The admin's own session does the writing — the
 * provider_profiles_admin_all and provider_documents_admin_update policies are
 * what permit it, and guard_provider_self_service() lets verification_status
 * through only because is_admin() is true.
 *
 * Rejecting requires a reason. A provider told only "rejected" has nothing to
 * fix and will simply upload the same document again.
 */

export type VerificationState = { error?: string };

export async function decideDocument(
  _prev: VerificationState,
  formData: FormData,
): Promise<VerificationState> {
  const admin = await requireRole("admin");
  const documentId = String(formData.get("documentId"));
  const approve = String(formData.get("decision")) === "approve";
  const reason = String(formData.get("reason") ?? "").trim();

  if (!approve && !reason) return { error: "Rejecting a document needs a reason." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("provider_documents")
    .update({
      status: approve ? "approved" : "rejected",
      review_reason: approve ? null : reason,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (error) return { error: error.message };

  revalidatePath("/admin/verification");
  return {};
}

export async function decideProvider(
  _prev: VerificationState,
  formData: FormData,
): Promise<VerificationState> {
  // provider_profiles records no reviewer, so the gate is all this needs.
  await requireRole("admin");
  const providerId = String(formData.get("providerId"));
  const approve = String(formData.get("decision")) === "approve";
  const reason = String(formData.get("reason") ?? "").trim();

  if (!approve && !reason) return { error: "Rejecting a provider needs a reason." };

  const supabase = await createClient();

  const { data: provider, error } = await supabase
    .from("provider_profiles")
    .update({
      verification_status: approve ? "verified" : "rejected",
      verification_reason: approve ? null : reason,
    })
    .eq("id", providerId)
    .select("user_id, business_name")
    .single();

  if (error) return { error: error.message };

  // Notifications are written with the service role: a notification is addressed
  // to the provider, and notifications has no insert policy for anyone.
  await createAdminClient()
    .from("notifications")
    .insert({
      user_id: provider.user_id,
      type: approve ? "verification_approved" : "verification_rejected",
      title: approve ? "You're verified" : "Verification needs more from you",
      body: approve
        ? "You can now submit offers on requests in your categories."
        : reason,
      link: "/provider/profile",
    });

  revalidatePath("/admin/verification");
  return {};
}
