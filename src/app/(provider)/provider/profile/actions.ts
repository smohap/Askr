"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { findLocation } from "@/lib/nz-locations";

export type ProfileFormState = { error?: string; notice?: string };

const profileInput = z.object({
  businessName: z.string().trim().min(2, "Enter your business name").max(120),
  tagline: z.string().trim().max(140).nullable(),
  about: z.string().trim().max(2000).nullable(),
  serviceRadiusKm: z.number().int().min(1).max(200),
  categorySlugs: z.array(z.string()).min(1, "Pick at least one category"),
});

/**
 * Create or update the business profile.
 *
 * verification_status, ratings and stripe_account_id are deliberately absent —
 * guard_provider_self_service() strips them from any non-admin update, so a
 * provider cannot verify itself or invent a rating even by crafting the request.
 */
export async function saveProviderProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const viewer = await requireRole("provider");
  const supabase = await createClient();

  const taglineRaw = formData.get("tagline");
  const aboutRaw = formData.get("about");

  const parsed = profileInput.safeParse({
    businessName: formData.get("businessName"),
    tagline: typeof taglineRaw === "string" && taglineRaw.trim() !== "" ? taglineRaw : null,
    about: typeof aboutRaw === "string" && aboutRaw.trim() !== "" ? aboutRaw : null,
    serviceRadiusKm: Number(formData.get("serviceRadiusKm") ?? 15),
    categorySlugs: formData.getAll("categories").map(String),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const location = findLocation(String(formData.get("locationLabel") ?? ""));
  if (!location) return { error: "Pick a base location from the list" };

  const { data: existing } = await supabase
    .from("provider_profiles")
    .select("id")
    .eq("user_id", viewer.id)
    .maybeSingle();

  const row = {
    user_id: viewer.id,
    business_name: parsed.data.businessName,
    tagline: parsed.data.tagline,
    about: parsed.data.about,
    location_label: location.label,
    lat: location.lat,
    lng: location.lng,
    service_radius_km: parsed.data.serviceRadiusKm,
  };

  const { data: saved, error } = existing
    ? await supabase.from("provider_profiles").update(row).eq("id", existing.id).select("id").single()
    : await supabase.from("provider_profiles").insert(row).select("id").single();

  if (error || !saved) return { error: error?.message ?? "Could not save your profile" };

  const { data: categories } = await supabase
    .from("categories")
    .select("id, slug")
    .in("slug", parsed.data.categorySlugs);

  // Replace rather than merge: the form submits the complete set every time.
  await supabase.from("provider_categories").delete().eq("provider_id", saved.id);

  if (categories?.length) {
    await supabase
      .from("provider_categories")
      .insert(categories.map((c) => ({ provider_id: saved.id, category_id: c.id })));
  }

  revalidatePath("/provider/profile");
  return { notice: "Profile saved." };
}

const DOC_TYPES = ["identity", "business", "insurance", "licence"] as const;

/**
 * Upload a verification document. Submitting any document moves the provider to
 * 'pending' so they surface in the admin queue — but that move is an admin-side
 * concern, so it runs through the admin client rather than the provider's.
 */
export async function uploadVerificationDocument(formData: FormData): Promise<void> {
  const viewer = await requireRole("provider");
  const supabase = await createClient();

  const { data: provider } = await supabase
    .from("provider_profiles")
    .select("id")
    .eq("user_id", viewer.id)
    .single();

  if (!provider) return;

  const docType = String(formData.get("docType"));
  if (!DOC_TYPES.includes(docType as (typeof DOC_TYPES)[number])) return;

  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) return;

  const path = `${provider.id}/${docType}-${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage
    .from("provider-documents")
    .upload(path, file, { contentType: file.type });

  if (error) return;

  await supabase.from("provider_documents").insert({
    provider_id: provider.id,
    doc_type: docType,
    storage_path: path,
  });

  const { createAdminClient } = await import("@/lib/supabase/admin");
  await createAdminClient()
    .from("provider_profiles")
    .update({ verification_status: "pending" })
    .eq("id", provider.id)
    .eq("verification_status", "unverified");

  revalidatePath("/provider/profile");
}
