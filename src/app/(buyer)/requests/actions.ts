"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publishRequest } from "@/lib/requests/broadcast";
import { findLocation } from "@/lib/nz-locations";
import {
  CATEGORY_FIELDS,
  parseDollarsToCents,
  requestInput,
  validateDetail,
} from "@/lib/validation/request";

export type RequestFormState = { error?: string };

/**
 * Creates a request as a draft or publishes it immediately.
 *
 * The insert runs as the buyer, so RLS is what proves they own it. Publishing
 * then hands off to publishRequest(), which needs the service role to write the
 * broadcast rows.
 */
export async function createRequest(
  _prev: RequestFormState,
  formData: FormData,
): Promise<RequestFormState> {
  const viewer = await requireRole("buyer", "/requests/new");

  const intent = formData.get("intent");
  const categorySlug = String(formData.get("categorySlug") ?? "");

  const detail: Record<string, string | number> = {};
  for (const field of CATEGORY_FIELDS[categorySlug] ?? []) {
    const raw = formData.get(`detail.${field.name}`);
    if (typeof raw === "string" && raw !== "") {
      detail[field.name] = field.type === "number" ? Number(raw) : raw;
    }
  }

  const detailError = validateDetail(categorySlug, detail);
  if (detailError) return { error: detailError };

  const location = findLocation(String(formData.get("locationLabel") ?? ""));
  if (!location) return { error: "Pick a location from the list" };

  const neededByRaw = formData.get("neededBy");
  const budgetMode = formData.get("budgetMode") === "open" ? "open" : "fixed";

  const parsed = requestInput.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    categorySlug,
    detail,
    budgetMode,
    budgetCents: budgetMode === "open" ? null : parseDollarsToCents(formData.get("budgetDollars")),
    neededBy:
      typeof neededByRaw === "string" && neededByRaw !== ""
        ? new Date(neededByRaw).toISOString()
        : null,
    locationLabel: location.label,
    lat: location.lat,
    lng: location.lng,
    radiusKm: Number(formData.get("radiusKm") ?? 15),
    urgency: formData.get("urgency") === "urgent" ? "urgent" : "standard",
    visibility: formData.get("visibility") === "private" ? "private" : "public",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", parsed.data.categorySlug)
    .single();

  if (!category) return { error: "That category no longer exists" };

  const { data: created, error } = await supabase
    .from("requests")
    .insert({
      buyer_id: viewer.id,
      category_id: category.id,
      title: parsed.data.title,
      description: parsed.data.description,
      detail: parsed.data.detail,
      budget_mode: parsed.data.budgetMode,
      budget_cents: parsed.data.budgetCents,
      needed_by: parsed.data.neededBy,
      location_label: parsed.data.locationLabel,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      radius_km: parsed.data.radiusKm,
      urgency: parsed.data.urgency,
      visibility: parsed.data.visibility,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !created) return { error: error?.message ?? "Could not save the request" };

  // Media rides along in the same FormData. Uploading after the insert means the
  // request id is available as the folder name, which is what the storage
  // policies authorise on.
  const files = formData.getAll("media").filter((f): f is File => f instanceof File && f.size > 0);

  for (const file of files) {
    const path = `${created.id}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("request-media")
      .upload(path, file, { contentType: file.type });

    if (uploadError) continue; // a failed photo must not lose the request

    await supabase
      .from("request_media")
      .insert({ request_id: created.id, storage_path: path, mime_type: file.type });
  }

  if (intent === "draft") {
    revalidatePath("/requests");
    redirect("/requests?saved=draft");
  }

  await publishRequest(created.id, viewer.id);

  revalidatePath("/requests");
  redirect(`/requests/${created.id}?broadcasting=1`);
}

export async function publishDraft(requestId: string) {
  const viewer = await requireRole("buyer");
  await publishRequest(requestId, viewer.id);
  revalidatePath(`/requests/${requestId}`);
  redirect(`/requests/${requestId}?broadcasting=1`);
}

export async function cancelRequest(requestId: string) {
  const viewer = await requireRole("buyer");
  const supabase = await createClient();

  await supabase
    .from("requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("buyer_id", viewer.id);

  revalidatePath("/requests");
  redirect("/requests");
}
