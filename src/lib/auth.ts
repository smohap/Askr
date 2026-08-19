import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type Role = "buyer" | "provider" | "admin";

export type Viewer = {
  id: string;
  email: string;
  role: Role;
  fullName: string;
  /** provider_profiles.id — present only once a provider has created a profile. */
  providerId: string | null;
  businessName: string | null;
  verificationStatus: "unverified" | "pending" | "verified" | "rejected" | null;
};

/** A provider who has actually created their business profile. */
export type ProviderViewer = Viewer & { providerId: string; businessName: string };

/**
 * The signed-in user, or null for a guest.
 *
 * Uses getUser() rather than getSession(): getSession trusts the cookie, getUser
 * revalidates the token with Supabase. Everything downstream authorises on this.
 */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  let providerId: string | null = null;
  let businessName: string | null = null;
  let verificationStatus: Viewer["verificationStatus"] = null;

  if (profile.role === "provider") {
    const { data: provider } = await supabase
      .from("provider_profiles")
      .select("id, business_name, verification_status")
      .eq("user_id", user.id)
      .maybeSingle();

    providerId = provider?.id ?? null;
    businessName = provider?.business_name ?? null;
    verificationStatus = provider?.verification_status ?? null;
  }

  return {
    id: user.id,
    email: user.email ?? "",
    role: profile.role as Role,
    fullName: profile.full_name,
    providerId,
    businessName,
    verificationStatus,
  };
}

export async function requireViewer(returnTo?: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  }
  return viewer;
}

/**
 * Gate a route group on a role. RLS is what actually protects the data — this
 * exists so a buyer landing on /admin gets sent home instead of an empty screen.
 */
export async function requireRole(role: Role, returnTo?: string): Promise<Viewer> {
  const viewer = await requireViewer(returnTo);
  if (viewer.role !== role) redirect(homeFor(viewer.role));
  return viewer;
}

/**
 * A provider with a business profile. A provider who signed up but never filled
 * in their profile has no provider_profiles row, so nothing can be keyed to
 * them — they go to the profile form rather than getting an empty screen.
 */
export async function requireProvider(returnTo?: string): Promise<ProviderViewer> {
  const viewer = await requireRole("provider", returnTo);
  if (!viewer.providerId || !viewer.businessName) redirect("/provider/profile?setup=1");
  return viewer as ProviderViewer;
}

export function homeFor(role: Role): string {
  switch (role) {
    case "provider":
      return "/provider";
    case "admin":
      return "/admin";
    default:
      return "/";
  }
}
